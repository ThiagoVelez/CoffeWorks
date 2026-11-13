//! Configuración del servidor MCP de las apps (por ahora CoffeeAnimate3D), compartida
//! entre el Launcher (Ajustes › interruptor) y la app que lo sirve.
//!
//! `<datos locales>/CoffeeWorks/mcp.json`: activado, puerto y clave. El servidor solo
//! escucha en 127.0.0.1 y exige `Authorization: Bearer <clave>`.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Puerto por defecto (poco usado; se puede cambiar en mcp.json).
pub const DEFAULT_PORT: u16 = 48631;
/// Se considera «Claude conectado» si hubo una llamada en los últimos 2 minutos.
pub const CONNECTED_SECS: u64 = 120;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct McpConfig {
    pub enabled: bool,
    pub port: u16,
    pub token: String,
}

impl Default for McpConfig {
    fn default() -> Self {
        McpConfig { enabled: false, port: DEFAULT_PORT, token: String::new() }
    }
}

pub fn config_path() -> PathBuf {
    crate::local_dir().join("mcp.json")
}

pub fn status_path() -> PathBuf {
    crate::local_dir().join("mcp-status.json")
}

impl McpConfig {
    pub fn load_from(path: &Path) -> Self {
        std::fs::read_to_string(path).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default()
    }
    pub fn load() -> Self {
        Self::load_from(&config_path())
    }
    pub fn save_to(&self, path: &Path) -> Result<(), String> {
        if let Some(d) = path.parent() {
            std::fs::create_dir_all(d).map_err(|e| e.to_string())?;
        }
        let text = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        std::fs::write(path, text).map_err(|e| format!("No se pudo guardar la configuración MCP: {e}"))
    }
    pub fn url(&self) -> String {
        format!("http://127.0.0.1:{}/mcp", self.port)
    }
}

/// 32 bytes aleatorios del sistema, en hexadecimal.
pub fn new_token() -> Result<String, String> {
    let mut buf = [0u8; 32];
    getrandom::fill(&mut buf).map_err(|e| format!("No se pudo generar la clave: {e}"))?;
    Ok(buf.iter().map(|b| format!("{b:02x}")).collect())
}

pub fn set_enabled_at(path: &Path, enabled: bool) -> Result<McpConfig, String> {
    let mut c = McpConfig::load_from(path);
    c.enabled = enabled;
    if enabled && c.token.len() < 32 {
        c.token = new_token()?;
    }
    c.save_to(path)?;
    Ok(c)
}

pub fn regenerate_token_at(path: &Path) -> Result<McpConfig, String> {
    let mut c = McpConfig::load_from(path);
    c.token = new_token()?;
    c.save_to(path)?;
    Ok(c)
}

pub fn set_enabled(enabled: bool) -> Result<McpConfig, String> {
    set_enabled_at(&config_path(), enabled)
}

pub fn regenerate_token() -> Result<McpConfig, String> {
    regenerate_token_at(&config_path())
}

/// Orden para Claude Code (servidor HTTP con la clave en la cabecera).
pub fn claude_code_command(c: &McpConfig) -> String {
    format!("claude mcp add --transport http coffeeanimate3d {} --header \"Authorization: Bearer {}\"", c.url(), c.token)
}

/// Configuración para la app de escritorio de Claude: lanza CoffeeAnimate3D en modo
/// puente (`--mcp-stdio`), que reenvía a la app abierta usando la clave guardada.
pub fn claude_desktop_json(exe: &Path) -> String {
    let v = serde_json::json!({
        "mcpServers": { "coffeeanimate3d": { "command": exe.to_string_lossy(), "args": ["--mcp-stdio"] } }
    });
    serde_json::to_string_pretty(&v).unwrap_or_default()
}

fn now() -> u64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

#[derive(Serialize, Deserialize, Default)]
struct Status {
    last_call: u64,
}

pub fn mark_call_at(path: &Path, at: u64) {
    if let Ok(t) = serde_json::to_string(&Status { last_call: at }) {
        let _ = std::fs::write(path, t);
    }
}

pub fn connected_at(path: &Path, at: u64) -> bool {
    let s: Status = std::fs::read_to_string(path).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default();
    s.last_call > 0 && at.saturating_sub(s.last_call) <= CONNECTED_SECS
}

/// La app la llama en cada petición de Claude.
pub fn mark_call() {
    mark_call_at(&status_path(), now())
}

pub fn connected() -> bool {
    connected_at(&status_path(), now())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enabling_creates_a_token_and_regenerating_changes_it() {
        let d = tempfile::tempdir().unwrap();
        let path = d.path().join("mcp.json");
        let cfg = McpConfig::load_from(&path);
        assert!(!cfg.enabled, "desactivado por defecto");
        let cfg = set_enabled_at(&path, true).unwrap();
        assert!(cfg.enabled);
        assert_eq!(cfg.token.len(), 64);
        assert!(cfg.token.chars().all(|c| c.is_ascii_hexdigit()));
        assert_eq!(McpConfig::load_from(&path), cfg, "se guarda");
        let again = set_enabled_at(&path, true).unwrap();
        assert_eq!(again.token, cfg.token, "activar otra vez no cambia la clave");
        let new = regenerate_token_at(&path).unwrap();
        assert_ne!(new.token, cfg.token);
        assert!(!set_enabled_at(&path, false).unwrap().enabled);
    }

    #[test]
    fn damaged_config_falls_back_to_disabled() {
        let d = tempfile::tempdir().unwrap();
        let path = d.path().join("mcp.json");
        std::fs::write(&path, "{nope").unwrap();
        let c = McpConfig::load_from(&path);
        assert!(!c.enabled);
        assert_eq!(c.port, DEFAULT_PORT);
    }

    #[test]
    fn snippets_for_claude() {
        let c = McpConfig { enabled: true, port: 48700, token: "ab".repeat(32) };
        assert_eq!(c.url(), "http://127.0.0.1:48700/mcp");
        let code = claude_code_command(&c);
        assert!(code.starts_with("claude mcp add --transport http coffeeanimate3d http://127.0.0.1:48700/mcp"));
        assert!(code.contains(&format!("Authorization: Bearer {}", c.token)));
        let desktop: serde_json::Value = serde_json::from_str(&claude_desktop_json(std::path::Path::new("/opt/CoffeeAnimate3D"))).unwrap();
        assert_eq!(desktop["mcpServers"]["coffeeanimate3d"]["command"], "/opt/CoffeeAnimate3D");
        assert_eq!(desktop["mcpServers"]["coffeeanimate3d"]["args"][0], "--mcp-stdio");
    }

    #[test]
    fn connection_is_recent_calls_only() {
        let d = tempfile::tempdir().unwrap();
        let path = d.path().join("mcp-status.json");
        assert!(!connected_at(&path, 1000));
        mark_call_at(&path, 1000);
        assert!(connected_at(&path, 1100));
        assert!(!connected_at(&path, 1000 + CONNECTED_SECS + 1));
    }
}
