// CoffeeAnimate3D: aplicación de la suite CoffeeWorks empaquetada para escritorio.
// Modelado y animación 3D con cubos, con servidor MCP para Claude.
// Evita abrir una consola en las versiones de producción para Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod mcp_server;

use serde_json::{Value, json};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};

/// Llamadas de Claude esperando respuesta de la ventana.
#[derive(Default)]
struct Bridge {
    pending: Mutex<HashMap<u64, mpsc::Sender<Value>>>,
    next: AtomicU64,
    /// Estado del servidor para la ventana: (en marcha, dirección, error).
    running: Mutex<(bool, String, Option<String>)>,
}

impl Bridge {
    fn call(&self, app: &AppHandle, name: &str, args: Value) -> Result<Value, String> {
        let id = self.next.fetch_add(1, Ordering::SeqCst) + 1;
        let (tx, rx) = mpsc::channel();
        self.pending.lock().map_err(|e| e.to_string())?.insert(id, tx);
        app.emit("mcp-call", json!({ "id": id, "name": name, "arguments": args })).map_err(|e| e.to_string())?;
        let res = rx.recv_timeout(Duration::from_secs(60));
        if let Ok(mut p) = self.pending.lock() {
            p.remove(&id);
        }
        res.map_err(|_| "CoffeeAnimate3D no respondió a tiempo (¿hay un diálogo abierto?).".to_string())
    }
}

#[tauri::command]
fn mcp_reply(id: u64, result: Value, bridge: State<'_, Arc<Bridge>>) {
    if let Ok(p) = bridge.pending.lock() {
        if let Some(tx) = p.get(&id) {
            let _ = tx.send(result);
        }
    }
}

#[tauri::command]
fn mcp_info(bridge: State<'_, Arc<Bridge>>) -> Value {
    let cfg = coffee_core::mcp::McpConfig::load();
    let (running, address, error) = bridge.running.lock().map(|r| r.clone()).unwrap_or_default();
    json!({ "enabled": cfg.enabled, "running": running, "address": address, "connected": running && coffee_core::mcp::connected(), "error": error })
}

/// Guarda el .glb o el .zip (OBJ) que pide Claude en Documentos/CoffeeWorks/Exportaciones.
#[tauri::command]
fn mcp_save_export(file_name: String, data: String) -> Result<String, String> {
    use base64::Engine;
    let name: String = std::path::Path::new(&file_name).file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    let lower = name.to_lowercase();
    if name.is_empty() || !(lower.ends_with(".glb") || lower.ends_with(".zip")) {
        return Err("Nombre de archivo no válido".into());
    }
    let bytes = base64::engine::general_purpose::STANDARD.decode(data).map_err(|e| e.to_string())?;
    let dir = coffee_core::vault_dir().join("Exportaciones");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(name);
    std::fs::write(&path, bytes).map_err(|e| format!("No se pudo guardar: {e}"))?;
    Ok(path.to_string_lossy().into_owned())
}

/// Arranca, para o reinicia el servidor cuando cambia el interruptor del Launcher.
fn mcp_manager(app: AppHandle, bridge: Arc<Bridge>) {
    let mut current: Option<(coffee_core::mcp::McpConfig, Arc<tiny_http::Server>)> = None;
    loop {
        let cfg = coffee_core::mcp::McpConfig::load();
        let want = cfg.enabled && !cfg.token.is_empty();
        let same = current.as_ref().is_some_and(|(c, _)| *c == cfg);
        if current.is_some() && (!want || !same) {
            if let Some((_, srv)) = current.take() {
                srv.unblock();
            }
            if let Ok(mut r) = bridge.running.lock() {
                *r = (false, String::new(), None);
            }
        }
        if want && current.is_none() {
            match tiny_http::Server::http(("127.0.0.1", cfg.port)) {
                Ok(server) => {
                    let server = Arc::new(server);
                    let (app2, br2) = (app.clone(), bridge.clone());
                    let call: mcp_server::CallFn = Arc::new(move |name: &str, args: Value| br2.call(&app2, name, args));
                    let (srv2, token) = (server.clone(), cfg.token.clone());
                    std::thread::spawn(move || mcp_server::serve(srv2, token, call));
                    if let Ok(mut r) = bridge.running.lock() {
                        *r = (true, cfg.url(), None);
                    }
                    current = Some((cfg, server));
                }
                Err(e) => {
                    if let Ok(mut r) = bridge.running.lock() {
                        *r = (false, cfg.url(), Some(format!("No se pudo abrir el puerto {}: {e}", cfg.port)));
                    }
                }
            }
        }
        std::thread::sleep(Duration::from_secs(2));
    }
}

fn main() {
    // Modo puente para la app de escritorio de Claude (sin ventana).
    if std::env::args().any(|a| a == "--mcp-stdio") {
        mcp_server::run_stdio_bridge();
        return;
    }
    coffee_core::migrate_legacy_dirs();

    let bridge = Arc::new(Bridge::default());
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(bridge.clone())
        .setup(move |app| {
            let handle = app.handle().clone();
            let br = app.state::<Arc<Bridge>>().inner().clone();
            std::thread::spawn(move || mcp_manager(handle, br));
            Ok(())
        })
        .invoke_handler(coffee_core::editor_handler!(mcp_reply, mcp_info, mcp_save_export))
        .run(tauri::generate_context!())
        .expect("Error al iniciar CoffeeAnimate3D");
    drop(bridge);
}
