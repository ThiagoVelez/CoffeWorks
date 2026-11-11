// CoffeWorks Launcher: gestor de aplicaciones y documentos de la suite.
// Evita abrir una consola en las versiones de producción para Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod apps;
mod platform;

use std::fs;
use std::path::Path;

use coffe_core::{RecentDocument, SUITE_DIR};
use serde::Serialize;
use tauri::WebviewWindow;

use apps::{SuiteApp, CATALOG};

/// Ejecuta trabajo de disco fuera del hilo de la ventana. Todos los comandos
/// son `async` para que la interfaz (y sus botones de minimizar, maximizar y
/// cerrar) siga respondiendo mientras se copian archivos o se leen índices.
async fn blocking<T, F>(task: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|e| format!("La operación se interrumpió: {e}"))?
}

// ---------------------------------------------------------------------------
// Aplicaciones de la suite
// ---------------------------------------------------------------------------

#[tauri::command]
async fn get_suite_apps() -> Result<Vec<SuiteApp>, String> {
    blocking(|| Ok(apps::list_apps())).await
}

#[tauri::command]
async fn install_app(app_id: String) -> Result<SuiteApp, String> {
    blocking(move || apps::install(&app_id)).await
}

#[tauri::command]
async fn uninstall_app(app_id: String) -> Result<SuiteApp, String> {
    blocking(move || apps::uninstall(&app_id)).await
}

#[tauri::command]
async fn launch_app(
    app_id: String,
    file: Option<String>,
    new_title: Option<String>,
) -> Result<String, String> {
    blocking(move || apps::launch(&app_id, file.as_deref(), new_title.as_deref())).await
}

// ---------------------------------------------------------------------------
// Documentos recientes
// ---------------------------------------------------------------------------

/// Devuelve el índice de recientes, descartando los archivos que ya no existen.
#[tauri::command]
async fn get_recent_documents() -> Result<Vec<RecentDocument>, String> {
    blocking(move || {
        let docs = coffe_core::load_recent();
        let alive: Vec<RecentDocument> = docs
            .iter()
            .filter(|doc| doc.path.is_empty() || Path::new(&doc.path).is_file())
            .cloned()
            .collect();
        if alive.len() != docs.len() {
            let _ = coffe_core::save_recent(&alive);
        }
        Ok(alive)
    })
    .await
}

#[tauri::command]
async fn save_recent_documents(docs: Vec<RecentDocument>) -> Result<(), String> {
    blocking(move || coffe_core::save_recent(&docs)).await
}

/// Quita un documento del índice y, si vive dentro de la bóveda, borra su archivo.
#[tauri::command]
async fn delete_document(id: String) -> Result<Vec<RecentDocument>, String> {
    blocking(move || {
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
    })
    .await
}

/// Abre un documento reciente con la aplicación que le corresponde.
#[tauri::command]
async fn open_document(id: String) -> Result<String, String> {
    blocking(move || {
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
    })
    .await
}

/// Crea un documento en la bóveda a partir de un contenido ya preparado (una
/// plantilla) y lo abre con su aplicación.
#[tauri::command]
async fn create_document_file(
    app_id: String,
    doc_id: String,
    file_name: String,
    contents: String,
) -> Result<String, String> {
    blocking(move || {
        let app =
            apps::find_app(&app_id).ok_or_else(|| format!("Aplicación desconocida: {app_id}"))?;
        if !apps::is_installed(app) {
            return Err(format!(
                "{} no está instalada. Instálala desde la Tienda de Apps.",
                app.name
            ));
        }
        let path = coffe_core::commands::reserve_vault_path(file_name, doc_id.clone())?;
        coffe_core::write_atomic(Path::new(&path), contents.as_bytes())
            .map_err(|e| format!("No se pudo crear el documento: {e}"))?;
        let name = Path::new(&path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        coffe_core::upsert_recent(RecentDocument {
            id: doc_id,
            name,
            app_id: app.id.to_string(),
            path: path.clone(),
            ..Default::default()
        })?;
        apps::launch(app.id, Some(&path), None)
    })
    .await
}

#[tauri::command]
async fn open_vault_folder() -> Result<String, String> {
    blocking(move || {
        let dir = coffe_core::vault_dir();
        fs::create_dir_all(&dir).map_err(|e| format!("No se pudo crear la bóveda: {e}"))?;
        open::that_detached(&dir).map_err(|e| format!("No se pudo abrir la carpeta: {e}"))?;
        Ok(coffe_core::display_path(&dir))
    })
    .await
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
async fn get_suite_info() -> SuiteInfo {
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
async fn open_external(target: String) -> Result<(), String> {
    open::that_detached(&target).map_err(|e| format!("No se pudo abrir {target}: {e}"))
}

// ---------------------------------------------------------------------------
// Controles de la ventana sin marco
// ---------------------------------------------------------------------------

#[tauri::command]
async fn minimize_window(window: WebviewWindow) {
    let _ = window.minimize();
}

#[tauri::command]
async fn maximize_window(window: WebviewWindow) {
    if window.is_maximized().unwrap_or(false) {
        let _ = window.unmaximize();
    } else {
        let _ = window.maximize();
    }
}

#[tauri::command]
async fn close_window(window: WebviewWindow) {
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
        .invoke_handler(tauri::generate_handler![
            get_suite_apps,
            install_app,
            uninstall_app,
            launch_app,
            get_recent_documents,
            save_recent_documents,
            delete_document,
            open_document,
            create_document_file,
            open_vault_folder,
            get_suite_info,
            open_external,
            minimize_window,
            maximize_window,
            close_window
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|_| panic!("Error al iniciar el Launcher de {SUITE_DIR}"));
}
