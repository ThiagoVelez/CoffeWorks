//! Núcleo compartido de la suite CoffeWorks.
//!
//! Reúne todo lo que el Launcher y las aplicaciones (CoffeDoc, CoffeCalc y
//! CoffeView) necesitan en común:
//!
//! * rutas de datos de la suite (bóveda de documentos, índice de recientes,
//!   carpeta de aplicaciones instaladas);
//! * el índice `recent.json` que el Launcher muestra como "Documentos recientes";
//! * los comandos IPC genéricos de archivo, diálogos nativos y ventana que usan
//!   los tres editores.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

pub mod commands;

/// Nombre de la carpeta de la suite dentro de los directorios del sistema.
pub const SUITE_DIR: &str = "CoffeWorks";

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------

/// Datos compartidos de la suite (`%APPDATA%\CoffeWorks` en Windows).
pub fn data_dir() -> PathBuf {
    let base = dirs::data_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| PathBuf::from("."));
    base.join(SUITE_DIR)
}

/// Datos locales de la máquina (`%LOCALAPPDATA%\CoffeWorks` en Windows).
pub fn local_dir() -> PathBuf {
    let base = dirs::data_local_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| PathBuf::from("."));
    base.join(SUITE_DIR)
}

/// Carpeta donde el Launcher instala las aplicaciones de la suite.
pub fn apps_dir() -> PathBuf {
    local_dir().join("Apps")
}

/// Bóveda de documentos del usuario (`Documentos\CoffeWorks`).
pub fn vault_dir() -> PathBuf {
    let base = dirs::document_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| PathBuf::from("."));
    base.join(SUITE_DIR)
}

fn recent_index_path() -> PathBuf {
    data_dir().join("recent.json")
}

/// Escritura atómica: escribe en un temporal y lo renombra sobre el destino,
/// de modo que otro proceso de la suite nunca lea un archivo a medias.
pub fn write_atomic(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let tmp = path.with_extension(format!(
        "{}.tmp{}",
        path.extension().and_then(|e| e.to_str()).unwrap_or(""),
        std::process::id()
    ));
    {
        let mut file = fs::File::create(&tmp)?;
        file.write_all(bytes)?;
        file.sync_all().ok();
    }
    match fs::rename(&tmp, path) {
        Ok(()) => Ok(()),
        Err(_) => {
            // En Windows el renombrado falla si el destino está abierto por otro
            // proceso; en ese caso se escribe directamente.
            let result = fs::write(path, bytes);
            let _ = fs::remove_file(&tmp);
            result
        }
    }
}

/// Elimina los caracteres que Windows no admite en nombres de archivo.
pub fn sanitize_file_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| match c {
            '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect();
    let trimmed = cleaned.trim().trim_end_matches(['.', ' ']).to_string();
    if trimmed.is_empty() {
        "Sin título".to_string()
    } else {
        trimmed
    }
}

pub(crate) fn same_path(a: &str, b: &str) -> bool {
    if cfg!(windows) {
        a.replace('/', "\\")
            .eq_ignore_ascii_case(&b.replace('/', "\\"))
    } else {
        a == b
    }
}

// ---------------------------------------------------------------------------
// Índice de documentos recientes
// ---------------------------------------------------------------------------

/// Entrada del índice de documentos recientes que comparte toda la suite.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RecentDocument {
    pub id: String,
    pub name: String,
    pub app_id: String,
    #[serde(default)]
    pub category: String,
    #[serde(default)]
    pub last_modified: String,
    #[serde(default)]
    pub is_pinned: bool,
    #[serde(default)]
    pub path: String,
    /// Marca de tiempo (milisegundos desde época Unix) de la última edición.
    #[serde(default)]
    pub updated_at: u64,
}

pub fn now_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub fn load_recent() -> Vec<RecentDocument> {
    fs::read_to_string(recent_index_path())
        .ok()
        .and_then(|raw| serde_json::from_str::<Vec<RecentDocument>>(&raw).ok())
        .unwrap_or_default()
}

pub fn save_recent(docs: &[RecentDocument]) -> Result<(), String> {
    let json = serde_json::to_vec_pretty(docs).map_err(|e| e.to_string())?;
    write_atomic(&recent_index_path(), &json)
        .map_err(|e| format!("No se pudo guardar el índice de documentos: {e}"))
}

/// Inserta o actualiza un documento en el índice y lo mueve al principio.
/// Conserva el estado "fijado" de la entrada existente.
pub fn upsert_recent(mut doc: RecentDocument) -> Result<Vec<RecentDocument>, String> {
    let mut docs = load_recent();
    if doc.updated_at == 0 {
        doc.updated_at = now_millis();
    }
    let existing = docs
        .iter()
        .position(|d| d.id == doc.id || (!doc.path.is_empty() && same_path(&d.path, &doc.path)));
    if let Some(index) = existing {
        doc.is_pinned = docs[index].is_pinned;
        docs.remove(index);
    }
    docs.insert(0, doc);
    docs.truncate(200);
    save_recent(&docs)?;
    Ok(docs)
}

// ---------------------------------------------------------------------------
// Argumentos de arranque
// ---------------------------------------------------------------------------

/// Lo que el Launcher (o el Explorador de Windows) le pide a una aplicación al
/// iniciarla: abrir un archivo existente o crear un documento nuevo.
#[derive(Debug, Clone, Serialize, Default)]
pub struct LaunchArgs {
    pub file: Option<String>,
    pub new_title: Option<String>,
}

pub fn parse_launch_args<I: Iterator<Item = String>>(args: I) -> LaunchArgs {
    let mut result = LaunchArgs::default();
    let mut args = args.skip(1);
    while let Some(arg) = args.next() {
        if arg == "--new" {
            result.new_title = Some(args.next().unwrap_or_default());
        } else if let Some(title) = arg.strip_prefix("--new=") {
            result.new_title = Some(title.to_string());
        } else if !arg.starts_with("--") && result.file.is_none() && Path::new(&arg).is_file() {
            let absolute = fs::canonicalize(&arg).unwrap_or_else(|_| PathBuf::from(&arg));
            result.file = Some(display_path(&absolute));
        }
    }
    result
}

/// Convierte una ruta a texto quitando el prefijo `\\?\` que añade
/// `canonicalize` en Windows.
pub fn display_path(path: &Path) -> String {
    let text = path.to_string_lossy().to_string();
    text.strip_prefix(r"\\?\")
        .map(str::to_string)
        .unwrap_or(text)
}

/// Genera el manejador de comandos de un editor de la suite. Todas las
/// aplicaciones comparten los comandos comunes; las que necesitan más (como
/// CoffeCams) los añaden como argumentos: `editor_handler!(mi_comando)`.
#[macro_export]
macro_rules! editor_handler {
    ($($extra:path),* $(,)?) => {
        tauri::generate_handler![
            $crate::commands::core_launch_args,
            $crate::commands::core_read_text,
            $crate::commands::core_write_text,
            $crate::commands::core_read_binary,
            $crate::commands::core_write_binary,
            $crate::commands::core_file_exists,
            $crate::commands::core_vault_path,
            $crate::commands::core_rename_in_vault,
            $crate::commands::core_vault_dir,
            $crate::commands::core_register_recent,
            $crate::commands::core_set_pinned,
            $crate::commands::core_list_recent,
            $crate::commands::core_pick_open,
            $crate::commands::core_pick_save,
            $crate::commands::core_open_external,
            $crate::commands::core_window_minimize,
            $crate::commands::core_window_toggle_maximize,
            $crate::commands::core_window_toggle_fullscreen,
            $crate::commands::core_window_set_fullscreen,
            $crate::commands::core_window_close,
            $crate::commands::core_window_set_title
            $(, $extra)*
        ]
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitiza_nombres_de_archivo() {
        assert_eq!(
            sanitize_file_name("Informe: Q4/2026?.cfd"),
            "Informe_ Q4_2026_.cfd"
        );
        assert_eq!(sanitize_file_name("  "), "Sin título");
        assert_eq!(sanitize_file_name("nombre. "), "nombre");
    }

    #[test]
    fn interpreta_argumentos_de_arranque() {
        let args = vec![
            "app".to_string(),
            "--new".to_string(),
            "Mi informe".to_string(),
        ];
        let parsed = parse_launch_args(args.into_iter());
        assert_eq!(parsed.new_title.as_deref(), Some("Mi informe"));
        assert!(parsed.file.is_none());

        let exe = std::env::current_exe().unwrap();
        let args = vec!["app".to_string(), exe.to_string_lossy().to_string()];
        let parsed = parse_launch_args(args.into_iter());
        assert!(parsed.file.is_some());
    }
}
