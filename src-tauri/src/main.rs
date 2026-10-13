// Prevención de consola en ejecutable de Windows para versiones de producción
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State, Window};

// Estructura que describe cada aplicación dentro de la suite CoffeWorks
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuiteApp {
    pub id: String,
    pub name: String,
    pub subtitle: String,
    pub description: String,
    pub version: String,
    pub installed: bool,
    pub size_mb: u32,
    pub status: String,
    pub color_badge: String,
    pub icon_name: String,
}

// Estructura que representa un documento reciente en la bóveda local
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentDocument {
    pub id: String,
    pub name: String,
    pub app_id: String,
    pub category: String,
    pub last_modified: String,
    pub is_pinned: bool,
    pub path: String,
}

// Estado compartido de la aplicación en memoria
pub struct AppState {
    pub focus_mode: Mutex<bool>,
    pub recent_docs: Mutex<Vec<RecentDocument>>,
}

// Comando IPC para obtener las aplicaciones disponibles en la suite
#[tauri::command]
fn get_suite_apps() -> Vec<SuiteApp> {
    vec![
        SuiteApp {
            id: "coffedoc".to_string(),
            name: "CoffeDoc".to_string(),
            subtitle: "Procesador de textos colaborativo & Markdown enriquecido".to_string(),
            description: "Documentos ágiles, redacción con IA contextual y plantillas ejecutivas preparadas para impresión y web.".to_string(),
            version: "v1.4".to_string(),
            installed: true,
            size_mb: 184,
            status: "Instalada (184 MB)".to_string(),
            color_badge: "primary".to_string(),
            icon_name: "file-text".to_string(),
        },
    ]
}

// Comando IPC para abrir o ejecutar una aplicación de la suite
#[tauri::command]
fn launch_app(app_id: String) -> Result<String, String> {
    // Aquí se orquesta la ejecución del binario independiente de cada aplicación
    match app_id.as_str() {
        "coffedoc" | "coffesheet" | "coffeslides" | "coffenotes" | "coffeflow" => {
            Ok(format!("Aplicación {} iniciada correctamente", app_id))
        }
        _ => Err(format!("Aplicación desconocida: {}", app_id)),
    }
}

// Comando IPC para obtener la lista de documentos recientes
#[tauri::command]
fn get_recent_documents(state: State<'_, AppState>) -> Vec<RecentDocument> {
    let docs = state.recent_docs.lock().unwrap();
    docs.clone()
}

// Comando IPC para crear un nuevo documento rápido en la suite
#[tauri::command]
fn create_document(doc_type: String, title: String, state: State<'_, AppState>) -> Result<RecentDocument, String> {
    let extension = match doc_type.as_str() {
        "coffedoc" => "cfd",
        "coffesheet" => "cfs",
        "coffeslides" => "csl",
        "coffenotes" => "cfn",
        _ => "cfd",
    };

    let filename = if title.trim().is_empty() {
        format!("Nuevo Documento.{}", extension)
    } else {
        format!("{}.{}", title.trim(), extension)
    };

    let new_doc = RecentDocument {
        id: format!("doc_{}", chrono::Utc::now().timestamp_millis()),
        name: filename.clone(),
        app_id: doc_type.clone(),
        category: match doc_type.as_str() {
            "coffedoc" => "Producto".to_string(),
            "coffesheet" => "Finanzas".to_string(),
            "coffeslides" => "Presentación".to_string(),
            "coffenotes" => "Creativo".to_string(),
            _ => "General".to_string(),
        },
        last_modified: "Hace unos instantes".to_string(),
        is_pinned: false,
        path: format!("./vault/{}", filename),
    };

    let mut docs = state.recent_docs.lock().unwrap();
    docs.insert(0, new_doc.clone());
    Ok(new_doc)
}

// Comando IPC para alternar el modo enfoque
#[tauri::command]
fn toggle_focus_mode(state: State<'_, AppState>) -> bool {
    let mut focus = state.focus_mode.lock().unwrap();
    *focus = !*focus;
    *focus
}

// Controles de ventana nativa de escritorio
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
    let initial_docs: Vec<RecentDocument> = Vec::new();

    tauri::Builder::default()
        .manage(AppState {
            focus_mode: Mutex::new(true),
            recent_docs: Mutex::new(initial_docs),
        })
        .invoke_handler(tauri::generate_handler![
            get_suite_apps,
            launch_app,
            get_recent_documents,
            create_document,
            toggle_focus_mode,
            minimize_window,
            maximize_window,
            close_window
        ])
        .run(tauri::generate_context!())
        .expect("Error al ejecutar el orquestador de CoffeWorks");
}
