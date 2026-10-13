// Prevención de consola en Windows para versiones de producción
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::{State, Window};

// Estructura de documento CoffeDoc (.cfd)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoffeDocument {
    pub id: String,
    pub title: String,
    pub content_html: String,
    pub content_markdown: String,
    pub word_count: usize,
    pub character_count: usize,
    pub last_modified: String,
}

// Comando IPC para guardar un documento en el sistema de archivos local
#[tauri::command]
fn save_document_file(path: String, content: String) -> Result<String, String> {
    let file_path = Path::new(&path);
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Error al crear directorio: {}", e))?;
        }
    }

    fs::write(&path, content).map_err(|e| format!("Error al escribir archivo: {}", e))?;
    Ok(format!("Archivo guardado exitosamente en {}", path))
}

// Comando IPC para cargar un documento desde el disco
#[tauri::command]
fn load_document_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Error al leer archivo: {}", e))
}

// Controles nativos de ventana para CoffeDoc
#[tauri::command]
fn minimize_window(window: Window) {
    let _ = window.minimize();
}

#[tauri::command]
fn maximize_window(window: Window) {
    if window.is_maximized().unwrap_or(false) {
        let _ = window.unmaximize();
    } else {
        let _ = window.maximize();
    }
}

#[tauri::command]
fn close_window(window: Window) {
    let _ = window.close();
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            save_document_file,
            load_document_file,
            minimize_window,
            maximize_window,
            close_window
        ])
        .run(tauri::generate_context!())
        .expect("Error al ejecutar el procesador CoffeDoc");
}
