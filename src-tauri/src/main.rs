// CoffeWorks Launcher: gestor de aplicaciones y documentos de la suite.
// Evita abrir una consola en las versiones de producción para Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod apps;
mod platform;

use std::fs;
use std::path::Path;
use std::sync::Mutex;

use coffe_core::{RecentDocument, SUITE_DIR};
use serde::Serialize;
use tauri::{State, WebviewWindow};

use apps::{SuiteApp, CATALOG};

/// Estado en memoria del Launcher.
struct AppState {
    focus_mode: Mutex<bool>,
}

// ---------------------------------------------------------------------------
// Aplicaciones de la suite
// ---------------------------------------------------------------------------

#[tauri::command]
fn get_suite_apps() -> Vec<SuiteApp> {
    apps::list_apps()
}

#[tauri::command]
async fn install_app(app_id: String) -> Result<SuiteApp, String> {
    apps::install(&app_id)
}

#[tauri::command]
async fn uninstall_app(app_id: String) -> Result<SuiteApp, String> {
    apps::uninstall(&app_id)
}

#[tauri::command]
fn launch_app(
    app_id: String,
    file: Option<String>,
    new_title: Option<String>,
) -> Result<String, String> {
    apps::launch(&app_id, file.as_deref(), new_title.as_deref())
}

// ---------------------------------------------------------------------------
// Documentos recientes
// ---------------------------------------------------------------------------

/// Devuelve el índice de recientes, descartando los archivos que ya no existen.
#[tauri::command]
fn get_recent_documents() -> Vec<RecentDocument> {
    let docs = coffe_core::load_recent();
    let alive: Vec<RecentDocument> = docs
        .iter()
        .filter(|doc| doc.path.is_empty() || Path::new(&doc.path).is_file())
        .cloned()
        .collect();
    if alive.len() != docs.len() {
        let _ = coffe_core::save_recent(&alive);
    }
    alive
}

#[tauri::command]
fn save_recent_documents(docs: Vec<RecentDocument>) -> Result<(), String> {
    coffe_core::save_recent(&docs)
}

/// Quita un documento del índice y, si vive dentro de la bóveda, borra su archivo.
#[tauri::command]
fn delete_document(id: String) -> Result<Vec<RecentDocument>, String> {
    let mut docs = coffe_core::load_recent();
    if let Some(index) = docs.iter().position(|d| d.id == id) {
        let doc = docs.remove(index);
        let path = Path::new(&doc.path);
        if path.is_file() && path.starts_with(coffe_core::vault_dir()) {
            fs::remove_file(path).map_err(|e| format!("No se pudo borrar el archivo: {e}"))?;
        }
    }
    coffe_core::save_recent(&docs)?;
    Ok(docs)
}

/// Abre un documento reciente con la aplicación que le corresponde.
#[tauri::command]
fn open_document(id: String) -> Result<String, String> {
    let docs = coffe_core::load_recent();
    let doc = docs
        .iter()
        .find(|d| d.id == id)
        .ok_or_else(|| "El documento ya no está en la bóveda".to_string())?;
    let app = apps::app_for_document(&doc.app_id, &doc.name)
        .ok_or_else(|| format!("No hay ninguna aplicación para abrir {}", doc.name))?;
    if doc.path.is_empty() || !Path::new(&doc.path).is_file() {
        return Err(format!("No se encuentra el archivo {}", doc.name));
    }
    apps::launch(app.id, Some(&doc.path), None)
}

#[tauri::command]
fn open_vault_folder() -> Result<String, String> {
    let dir = coffe_core::vault_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("No se pudo crear la bóveda: {e}"))?;
    open::that_detached(&dir).map_err(|e| format!("No se pudo abrir la carpeta: {e}"))?;
    Ok(coffe_core::display_path(&dir))
}

// ---------------------------------------------------------------------------
// Información y ajustes
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct SuiteInfo {
    version: String,
    vault_dir: String,
    apps_dir: String,
    data_dir: String,
    packages_dir: String,
    webview_version: String,
    platform: String,
}

#[tauri::command]
fn get_suite_info() -> SuiteInfo {
    SuiteInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        vault_dir: coffe_core::display_path(&coffe_core::vault_dir()),
        apps_dir: coffe_core::display_path(&coffe_core::apps_dir()),
        data_dir: coffe_core::display_path(&coffe_core::data_dir()),
        packages_dir: coffe_core::display_path(&apps::packages_dir()),
        webview_version: tauri::webview_version().unwrap_or_else(|_| "No detectado".to_string()),
        platform: format!("{} {}", std::env::consts::OS, std::env::consts::ARCH),
    }
}

#[tauri::command]
fn toggle_focus_mode(state: State<'_, AppState>) -> bool {
    let mut focus = state.focus_mode.lock().unwrap();
    *focus = !*focus;
    *focus
}

#[tauri::command]
fn open_external(target: String) -> Result<(), String> {
    open::that_detached(&target).map_err(|e| format!("No se pudo abrir {target}: {e}"))
}

// ---------------------------------------------------------------------------
// Controles de la ventana sin marco
// ---------------------------------------------------------------------------

#[tauri::command]
fn minimize_window(window: WebviewWindow) {
    let _ = window.minimize();
}

#[tauri::command]
fn maximize_window(window: WebviewWindow) {
    if window.is_maximized().unwrap_or(false) {
        let _ = window.unmaximize();
    } else {
        let _ = window.maximize();
    }
}

#[tauri::command]
fn close_window(window: WebviewWindow) {
    let _ = window.close();
}

// ---------------------------------------------------------------------------
// Modo línea de comandos (lo usan el instalador y las pruebas automáticas)
// ---------------------------------------------------------------------------

/// Ejecuta las operaciones de gestión de paquetes sin abrir la ventana.
/// Devuelve `Some(código de salida)` si los argumentos pedían una operación.
///
/// * `--list`                  imprime el catálogo en JSON
/// * `--install <id>`          instala una aplicación
/// * `--uninstall <id>`        desinstala una aplicación
/// * `--install-all`           instala todas las aplicaciones disponibles
/// * `--uninstall-all`         desinstala todas las aplicaciones
fn run_cli(args: &[String]) -> Option<i32> {
    let mut handled = false;
    let mut failed = false;
    let mut index = 0;

    let mut report = |label: &str, result: Result<SuiteApp, String>| match result {
        Ok(app) => println!("{label} {}: {}", app.name, app.status),
        Err(error) => {
            eprintln!("{label}: {error}");
            failed = true;
        }
    };

    while index < args.len() {
        match args[index].as_str() {
            "--list" => {
                handled = true;
                println!(
                    "{}",
                    serde_json::to_string_pretty(&apps::list_apps()).unwrap_or_default()
                );
            }
            "--install" => {
                handled = true;
                index += 1;
                let id = args.get(index).cloned().unwrap_or_default();
                report("Instalación de", apps::install(&id));
            }
            "--uninstall" => {
                handled = true;
                index += 1;
                let id = args.get(index).cloned().unwrap_or_default();
                report("Desinstalación de", apps::uninstall(&id));
            }
            "--install-all" => {
                handled = true;
                for app in CATALOG {
                    report("Instalación de", apps::install(app.id));
                }
            }
            "--uninstall-all" => {
                handled = true;
                for app in CATALOG {
                    if apps::is_installed(app) {
                        report("Desinstalación de", apps::uninstall(app.id));
                    }
                }
                // Limpia las carpetas vacías que deja la suite.
                let _ = fs::remove_dir(coffe_core::apps_dir());
                let _ = fs::remove_dir(coffe_core::local_dir());
            }
            _ => {}
        }
        index += 1;
    }

    handled.then_some(if failed { 1 } else { 0 })
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if let Some(code) = run_cli(&args) {
        std::process::exit(code);
    }

    tauri::Builder::default()
        .manage(AppState {
            focus_mode: Mutex::new(true),
        })
        .invoke_handler(tauri::generate_handler![
            get_suite_apps,
            install_app,
            uninstall_app,
            launch_app,
            get_recent_documents,
            save_recent_documents,
            delete_document,
            open_document,
            open_vault_folder,
            get_suite_info,
            toggle_focus_mode,
            open_external,
            minimize_window,
            maximize_window,
            close_window
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|_| panic!("Error al iniciar el Launcher de {SUITE_DIR}"));
}
