//! Servidor MCP de CoffeeAnimate3D (HTTP «streamable» en 127.0.0.1, JSON-RPC 2.0).
//!
//! Las llamadas a herramientas se reenvían a la ventana (evento `mcp-call`), que las
//! ejecuta sobre el modelo abierto y responde con `mcp_reply`.

use serde_json::{Value, json};
use std::io::Read as _;

pub const TOOLS_JSON: &str = include_str!("../../src/mcp-tools.json");
pub const PROTOCOL_VERSIONS: [&str; 3] = ["2025-06-18", "2025-03-26", "2024-11-05"];

const INSTRUCTIONS: &str = "CoffeeAnimate3D modela y anima criaturas con cubos. Empieza con get_model. Unidades: 16 = 1 bloque; +Y arriba, +Z delante. Cada pieza gira alrededor de su pivote (relativo al del padre) y su caja va de `from` a `from + size` relativa al pivote. Las texturas son de 32×32 por cara. Para el lado opuesto usa mirror_part. Comprueba el resultado con preview desde varios ángulos. Todo lo que hagas se puede deshacer en la app con Ctrl+Z.";

fn ok(id: &Value, result: Value) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "result": result })
}

fn err(id: &Value, code: i64, message: &str) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } })
}

/// Atiende un mensaje JSON-RPC. Las notificaciones (sin id) no tienen respuesta.
pub fn handle_message(msg: &Value, call: &dyn Fn(&str, Value) -> Result<Value, String>) -> Option<Value> {
    let id = msg.get("id").cloned();
    let method = msg.get("method").and_then(Value::as_str).unwrap_or("");
    let Some(id) = id.filter(|v| !v.is_null()) else {
        return None;
    };
    let params = msg.get("params").cloned().unwrap_or(Value::Null);
    Some(match method {
        "initialize" => {
            let asked = params.get("protocolVersion").and_then(Value::as_str).unwrap_or("");
            let version = PROTOCOL_VERSIONS.iter().find(|v| **v == asked).copied().unwrap_or(PROTOCOL_VERSIONS[0]);
            ok(
                &id,
                json!({
                    "protocolVersion": version,
                    "capabilities": { "tools": { "listChanged": false } },
                    "serverInfo": { "name": "CoffeeAnimate3D", "version": env!("CARGO_PKG_VERSION") },
                    "instructions": INSTRUCTIONS,
                }),
            )
        }
        "ping" => ok(&id, json!({})),
        "tools/list" => match serde_json::from_str::<Value>(TOOLS_JSON) {
            Ok(tools) => ok(&id, json!({ "tools": tools })),
            Err(e) => err(&id, -32603, &format!("Lista de herramientas dañada: {e}")),
        },
        "tools/call" => {
            let Some(name) = params.get("name").and_then(Value::as_str) else {
                return Some(err(&id, -32602, "Falta el nombre de la herramienta"));
            };
            let args = params.get("arguments").cloned().unwrap_or_else(|| json!({}));
            match call(name, args) {
                Ok(result) => ok(&id, result),
                Err(e) => ok(&id, json!({ "content": [{ "type": "text", "text": e }], "isError": true })),
            }
        }
        _ => err(&id, -32601, &format!("Método no soportado: {method}")),
    })
}

/// Comprueba método, ruta, origen (contra páginas web maliciosas) y clave.
pub fn check_request(method: &str, path: &str, origin: Option<&str>, auth: Option<&str>, token: &str) -> Result<(), (u16, &'static str)> {
    if path.split('?').next() != Some("/mcp") {
        return Err((404, "No encontrado"));
    }
    if method != "POST" {
        return Err((405, "Solo se admite POST"));
    }
    if let Some(o) = origin {
        let local = ["http://127.0.0.1", "http://localhost", "https://127.0.0.1", "https://localhost"].iter().any(|p| o == *p || o.starts_with(&format!("{p}:")));
        if !local {
            return Err((403, "Origen no permitido"));
        }
    }
    let expected = format!("Bearer {token}");
    if token.is_empty() || auth != Some(expected.as_str()) {
        return Err((401, "Falta la clave o no es correcta"));
    }
    Ok(())
}

pub type CallFn = std::sync::Arc<dyn Fn(&str, Value) -> Result<Value, String> + Send + Sync>;

fn respond(req: tiny_http::Request, code: u16, body: Option<String>) {
    let ct = tiny_http::Header::from_bytes("Content-Type", "application/json").expect("cabecera");
    let res = match body {
        Some(b) => tiny_http::Response::from_string(b).with_status_code(code).with_header(ct),
        None => tiny_http::Response::from_string(String::new()).with_status_code(code),
    };
    let _ = req.respond(res);
}

/// Atiende peticiones hasta que se llame a `server.unblock()`. Cada una en su hilo,
/// porque una llamada a herramienta espera a que la ventana responda.
pub fn serve(server: std::sync::Arc<tiny_http::Server>, token: String, call: CallFn) {
    for mut req in server.incoming_requests() {
        let token = token.clone();
        let call = call.clone();
        std::thread::spawn(move || {
            let header = |name: &str| req.headers().iter().find(|h| h.field.as_str().as_str().eq_ignore_ascii_case(name)).map(|h| h.value.as_str().to_string());
            let (origin, auth) = (header("Origin"), header("Authorization"));
            let method = req.method().as_str().to_string();
            if let Err((code, msg)) = check_request(&method, req.url(), origin.as_deref(), auth.as_deref(), &token) {
                return respond(req, code, Some(json!({ "error": msg }).to_string()));
            }
            let mut body = String::new();
            if std::io::Read::read_to_string(&mut req.as_reader().take(16 * 1024 * 1024), &mut body).is_err() {
                return respond(req, 400, None);
            }
            let msg: Value = match serde_json::from_str(&body) {
                Ok(v) => v,
                Err(_) => return respond(req, 400, Some(err(&Value::Null, -32700, "JSON no válido").to_string())),
            };
            coffee_core::mcp::mark_call();
            match handle_message(&msg, &|n, a| call(n, a)) {
                Some(reply) => respond(req, 200, Some(reply.to_string())),
                None => respond(req, 202, None),
            }
        });
    }
}

/// Reenvía un mensaje JSON-RPC (una línea de stdin) al servidor de la app abierta.
/// Devuelve la respuesta, o un error JSON-RPC si la app no está abierta.
pub fn relay_line(port: u16, token: &str, line: &str) -> Option<String> {
    use std::io::Write;
    let msg: Value = serde_json::from_str(line).ok()?;
    let id = msg.get("id").cloned().filter(|v| !v.is_null());
    let fail = |text: &str| id.as_ref().map(|id| err(id, -32000, text).to_string());
    let Ok(mut s) = std::net::TcpStream::connect(("127.0.0.1", port)) else {
        return fail("CoffeeAnimate3D no está abierto o el MCP está desactivado. Abre la app y actívalo en el Launcher › Ajustes.");
    };
    let _ = s.set_read_timeout(Some(std::time::Duration::from_secs(120)));
    let req = format!(
        "POST /mcp HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: Bearer {token}\r\nContent-Type: application/json\r\nAccept: application/json, text/event-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{line}",
        line.len()
    );
    if s.write_all(req.as_bytes()).is_err() {
        return fail("No se pudo enviar la petición a CoffeeAnimate3D.");
    }
    let mut out = Vec::new();
    let _ = s.read_to_end(&mut out);
    let text = String::from_utf8_lossy(&out);
    let code: u16 = text.get(9..12).and_then(|c| c.parse().ok()).unwrap_or(0);
    let body = text.split_once("\r\n\r\n").map(|(_, b)| b.trim().to_string()).unwrap_or_default();
    match code {
        200 if !body.is_empty() => Some(body),
        202 => None,
        401 => fail("La clave del MCP no coincide: vuelve a activarlo en el Launcher."),
        _ => fail(&format!("CoffeeAnimate3D respondió con un error ({code}).")),
    }
}

/// Modo puente para la app de escritorio de Claude: stdin/stdout ↔ HTTP local.
pub fn run_stdio_bridge() {
    use std::io::{BufRead, Write};
    let stdin = std::io::stdin();
    let mut stdout = std::io::stdout();
    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        if line.trim().is_empty() {
            continue;
        }
        // Se relee la configuración en cada mensaje por si se regeneró la clave.
        let cfg = coffee_core::mcp::McpConfig::load();
        if let Some(reply) = relay_line(cfg.port, &cfg.token, &line) {
            let _ = writeln!(stdout, "{reply}");
            let _ = stdout.flush();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};

    fn echo(name: &str, args: Value) -> Result<Value, String> {
        if name == "falla" {
            return Err("sin modelo".into());
        }
        Ok(json!({ "content": [{ "type": "text", "text": format!("{name}:{args}") }] }))
    }

    #[test]
    fn initialize_lists_tools_and_calls() {
        let init = handle_message(&json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}), &echo).unwrap();
        assert_eq!(init["result"]["protocolVersion"], "2025-03-26");
        assert_eq!(init["result"]["serverInfo"]["name"], "CoffeeAnimate3D");
        assert!(init["result"]["capabilities"]["tools"].is_object());
        let unknown_ver = handle_message(&json!({"jsonrpc":"2.0","id":2,"method":"initialize","params":{"protocolVersion":"1999-01-01"}}), &echo).unwrap();
        assert_eq!(unknown_ver["result"]["protocolVersion"], PROTOCOL_VERSIONS[0]);
        assert!(handle_message(&json!({"jsonrpc":"2.0","method":"notifications/initialized"}), &echo).is_none());
        let list = handle_message(&json!({"jsonrpc":"2.0","id":3,"method":"tools/list"}), &echo).unwrap();
        let tools = list["result"]["tools"].as_array().unwrap();
        assert!(tools.iter().any(|t| t["name"] == "paint_pixels"));
        assert!(tools.iter().all(|t| t["inputSchema"]["type"] == "object"));
        let call = handle_message(&json!({"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"get_model","arguments":{"a":1}}}), &echo).unwrap();
        assert_eq!(call["id"], 4);
        assert_eq!(call["result"]["content"][0]["text"], "get_model:{\"a\":1}");
        let fail = handle_message(&json!({"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"falla"}}), &echo).unwrap();
        assert_eq!(fail["result"]["isError"], true);
        let nope = handle_message(&json!({"jsonrpc":"2.0","id":6,"method":"resources/list"}), &echo).unwrap();
        assert_eq!(nope["error"]["code"], -32601);
        assert_eq!(handle_message(&json!({"jsonrpc":"2.0","id":7,"method":"ping"}), &echo).unwrap()["result"], json!({}));
    }

    #[test]
    fn requests_need_the_token_and_a_local_origin() {
        assert!(check_request("POST", "/mcp", None, Some("Bearer abc"), "abc").is_ok());
        assert_eq!(check_request("POST", "/mcp", None, Some("Bearer mala"), "abc").unwrap_err().0, 401);
        assert_eq!(check_request("POST", "/mcp", None, None, "abc").unwrap_err().0, 401);
        assert_eq!(check_request("POST", "/mcp", Some("https://evil.example"), Some("Bearer abc"), "abc").unwrap_err().0, 403);
        assert!(check_request("POST", "/mcp", Some("http://localhost:3000"), Some("Bearer abc"), "abc").is_ok());
        assert_eq!(check_request("GET", "/mcp", None, Some("Bearer abc"), "abc").unwrap_err().0, 405);
        assert_eq!(check_request("POST", "/otra", None, Some("Bearer abc"), "abc").unwrap_err().0, 404);
        assert_eq!(check_request("POST", "/mcp", None, Some("Bearer "), "").unwrap_err().0, 401, "sin clave configurada no se acepta nada");
    }

    fn post(port: u16, token: &str, body: &str) -> (u16, String) {
        let mut s = std::net::TcpStream::connect(("127.0.0.1", port)).unwrap();
        write!(s, "POST /mcp HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: Bearer {token}\r\nContent-Type: application/json\r\nAccept: application/json, text/event-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).unwrap();
        let mut out = String::new();
        s.read_to_string(&mut out).unwrap();
        let code = out[9..12].parse().unwrap();
        let body = out.split("\r\n\r\n").nth(1).unwrap_or("").to_string();
        (code, body)
    }

    #[test]
    fn real_http_round_trip() {
        let server = tiny_http::Server::http("127.0.0.1:0").unwrap();
        let port = server.server_addr().to_ip().unwrap().port();
        let srv = std::sync::Arc::new(server);
        let s2 = srv.clone();
        std::thread::spawn(move || serve(s2, "clave".into(), std::sync::Arc::new(|n: &str, a: Value| echo(n, a))));
        let (code, body) = post(port, "clave", r#"{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"preview","arguments":{}}}"#);
        assert_eq!(code, 200);
        assert!(body.contains("preview:{}"), "{body}");
        let (code, _) = post(port, "otra", r#"{"jsonrpc":"2.0","id":1,"method":"ping"}"#);
        assert_eq!(code, 401);
        let (code, body) = post(port, "clave", r#"{"jsonrpc":"2.0","method":"notifications/initialized"}"#);
        assert_eq!(code, 202);
        assert!(body.is_empty());
        let (code, body) = post(port, "clave", "{no es json");
        assert_eq!(code, 400);
        assert!(body.contains("-32700"));
        srv.unblock();
    }

    #[test]
    fn stdio_relay_round_trip_and_app_closed() {
        let server = tiny_http::Server::http("127.0.0.1:0").unwrap();
        let port = server.server_addr().to_ip().unwrap().port();
        let srv = std::sync::Arc::new(server);
        let s2 = srv.clone();
        std::thread::spawn(move || serve(s2, "k".repeat(64), std::sync::Arc::new(|n: &str, a: Value| echo(n, a))));
        let reply = relay_line(port, &"k".repeat(64), r#"{"jsonrpc":"2.0","id":9,"method":"tools/call","params":{"name":"get_model"}}"#).unwrap();
        let v: Value = serde_json::from_str(&reply).unwrap();
        assert_eq!(v["id"], 9);
        assert!(relay_line(port, &"k".repeat(64), r#"{"jsonrpc":"2.0","method":"notifications/initialized"}"#).is_none());
        let bad = relay_line(port, "otra", r#"{"jsonrpc":"2.0","id":1,"method":"ping"}"#).unwrap();
        assert!(bad.contains("clave"));
        srv.unblock();
        // Puerto sin nadie escuchando: error claro para Claude.
        let closed = relay_line(1, "x", r#"{"jsonrpc":"2.0","id":2,"method":"ping"}"#).unwrap();
        assert!(closed.contains("no está abierto"), "{closed}");
    }
}
