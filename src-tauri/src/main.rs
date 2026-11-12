// CoffeeWorks Launcher: gestor de aplicaciones y documentos de la suite.
// Evita abrir una consola en las versiones de producción para Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod games;
mod apps;
mod platform;
mod updater;

use std::fs;
use std::path::Path;

use coffee_core::{RecentDocument, SUITE_DIR};
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
        let docs = coffee_core::load_recent();
        let alive: Vec<RecentDocument> = docs
            .iter()
            .filter(|doc| doc.path.is_empty() || Path::new(&doc.path).is_file())
            .cloned()
            .collect();
        if alive.len() != docs.len() {
            let _ = coffee_core::save_recent(&alive);
        }
        Ok(alive)
    })
    .await
}

#[tauri::command]
async fn save_recent_documents(docs: Vec<RecentDocument>) -> Result<(), String> {
    blocking(move || coffee_core::save_recent(&docs)).await
}

/// Quita un documento del índice y, si vive dentro de la bóveda, borra su archivo.
#[tauri::command]
async fn delete_document(id: String) -> Result<Vec<RecentDocument>, String> {
    blocking(move || {
        let mut docs = coffee_core::load_recent();
        if let Some(index) = docs.iter().position(|d| d.id == id) {
            let doc = docs.remove(index);
            let path = Path::new(&doc.path);
            if path.is_file() && path.starts_with(coffee_core::vault_dir()) {
                fs::remove_file(path).map_err(|e| format!("No se pudo borrar el archivo: {e}"))?;
            }
        }
        coffee_core::save_recent(&docs)?;
        Ok(docs)
    })
    .await
}

/// Abre un documento reciente con la aplicación que le corresponde.
#[tauri::command]
async fn open_document(id: String) -> Result<String, String> {
    blocking(move || {
        let docs = coffee_core::load_recent();
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
        let path = coffee_core::commands::reserve_vault_path(file_name, doc_id.clone())?;
        coffee_core::write_atomic(Path::new(&path), contents.as_bytes())
            .map_err(|e| format!("No se pudo crear el documento: {e}"))?;
        let name = Path::new(&path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        coffee_core::upsert_recent(RecentDocument {
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

// ---------------------------------------------------------------------------
// Complementos
// ---------------------------------------------------------------------------

#[tauri::command]
async fn get_addons() -> Result<Vec<coffee_core::addons::AddonInfo>, String> {
    blocking(|| Ok(coffee_core::addons::list_addons())).await
}

#[tauri::command]
async fn install_addon(id: String) -> Result<coffee_core::addons::AddonInfo, String> {
    blocking(move || coffee_core::addons::install_addon(&id)).await
}

#[tauri::command]
async fn uninstall_addon(id: String) -> Result<coffee_core::addons::AddonInfo, String> {
    blocking(move || coffee_core::addons::uninstall_addon(&id)).await
}

#[tauri::command]
async fn open_addons_folder() -> Result<(), String> {
    blocking(|| {
        let dir = coffee_core::addons::addons_dir();
        fs::create_dir_all(&dir).map_err(|e| format!("No se pudo crear la carpeta: {e}"))?;
        open::that_detached(&dir).map_err(|e| format!("No se pudo abrir la carpeta: {e}"))
    })
    .await
}

// ---------------------------------------------------------------------------
// Actualizaciones
// ---------------------------------------------------------------------------

#[tauri::command]
async fn update_status() -> updater::UpdateInfo {
    updater::status()
}

#[tauri::command]
async fn update_check() -> Result<updater::UpdateInfo, String> {
    blocking(updater::check_and_download).await
}

#[tauri::command]
async fn update_apply(app: tauri::AppHandle) -> Result<(), String> {
    blocking(updater::apply_now).await?;
    // El instalador necesita que el Launcher esté cerrado; lo vuelve a abrir al terminar
    app.exit(0);
    Ok(())
}

#[tauri::command]
async fn update_set_auto(enabled: bool) -> updater::UpdateInfo {
    updater::set_auto_install(enabled)
}

#[tauri::command]
async fn open_vault_folder() -> Result<String, String> {
    blocking(move || {
        let dir = coffee_core::vault_dir();
        fs::create_dir_all(&dir).map_err(|e| format!("No se pudo crear la bóveda: {e}"))?;
        open::that_detached(&dir).map_err(|e| format!("No se pudo abrir la carpeta: {e}"))?;
        Ok(coffee_core::display_path(&dir))
    })
    .await
}

// ---------------------------------------------------------------------------
// Información y ajustes
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct SuiteInfo {
    version: String,
    stage: String,
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
        stage: updater::stage_label(),
        vault_dir: coffee_core::display_path(&coffee_core::vault_dir()),
        apps_dir: coffee_core::display_path(&coffee_core::apps_dir()),
        data_dir: coffee_core::display_path(&coffee_core::data_dir()),
        packages_dir: coffee_core::display_path(&apps::packages_dir()),
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
/// * `--install-addon <id>`    instala un complemento (descarga incluida)
/// * `--refresh-apps`          copia los paquetes nuevos sobre las apps instaladas
fn run_cli(args: &[String]) -> Option<i32> {
    let mut handled = false;
    let mut failed = false;
    let mut addon_failed = false;
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
            "--install-addon" => {
                handled = true;
                index += 1;
                let id = args.get(index).cloned().unwrap_or_default();
                match coffee_core::addons::install_addon(&id) {
                    Ok(info) => println!("Complemento {}: {}", info.name, if info.installed { "instalado" } else { "no instalado" }),
                    Err(error) => {
                        eprintln!("Complemento {id}: {error}");
                        addon_failed = true;
                    }
                }
            }
            "--install-game" => {
                handled = true;
                index += 1;
                let id = args.get(index).cloned().unwrap_or_default();
                match games::install(&id) {
                    Ok(st) => println!("Juego {id}: instalado (v{})", st.installed.unwrap_or_default()),
                    Err(error) => {
                        eprintln!("Juego {id}: {error}");
                        addon_failed = true;
                    }
                }
            }
            "--uninstall-game" => {
                handled = true;
                index += 1;
                let id = args.get(index).cloned().unwrap_or_default();
                if let Err(error) = games::uninstall(&id) {
                    eprintln!("Juego {id}: {error}");
                    addon_failed = true;
                }
            }
            "--refresh-apps" => {
                handled = true;
                coffee_core::spell::sync_dictionaries(&apps::packages_dir().join("dictionaries"));
                for name in apps::refresh_installed() {
                    println!("Actualizada {name}");
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
                let _ = fs::remove_dir(coffee_core::apps_dir());
                let _ = fs::remove_dir(coffee_core::local_dir());
            }
            _ => {}
        }
        index += 1;
    }

    handled.then_some(if failed || addon_failed { 1 } else { 0 })
}

/// Estado de un juego: versión instalada y, si `online`, la más reciente publicada.
#[tauri::command]
async fn game_status(id: String, online: bool) -> Result<games::GameStatus, String> {
    tauri::async_runtime::spawn_blocking(move || games::status(&id, online)).await.map_err(|e| e.to_string())?
}

/// Descarga, verifica e instala (o actualiza) un juego.
#[tauri::command]
async fn game_install(id: String) -> Result<games::GameStatus, String> {
    tauri::async_runtime::spawn_blocking(move || games::install(&id)).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn game_uninstall(id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || games::uninstall(&id)).await.map_err(|e| e.to_string())?
}

#[tauri::command]
fn game_launch(id: String) -> Result<(), String> {
    games::launch(&id)
}

fn main() {
    // Primera ejecución tras actualizar desde «CoffeWorks»: carpetas, recientes
    // y aplicaciones instaladas pasan a los nombres nuevos.
    coffee_core::migrate_legacy_dirs();
    apps::migrate_legacy_apps();

    let args: Vec<String> = std::env::args().skip(1).collect();
    if let Some(code) = run_cli(&args) {
        std::process::exit(code);
    }

    // Tras una actualización: limpia el instalador descargado y pone al día las apps
    updater::cleanup_after_update();
    std::thread::spawn(|| {
        // Linux: el paquete .deb se instala para todo el equipo; la primera vez
        // que cada usuario abre el Launcher se le instalan todas las apps.
        if cfg!(target_os = "linux") {
            let marker = coffee_core::local_dir().join("linux-primera-vez.txt");
            if !marker.exists() && apps::packages_dir().is_dir() {
                for app in CATALOG {
                    if !apps::is_installed(app) {
                        let _ = apps::install(app.id);
                    }
                }
                let _ = fs::create_dir_all(coffee_core::local_dir());
                let _ = fs::write(&marker, "Apps instaladas automáticamente la primera vez.");
            }
        }
        apps::refresh_installed();
        // Diccionarios del corrector ortográfico para todas las apps
        coffee_core::spell::sync_dictionaries(&apps::packages_dir().join("dictionaries"));
    });

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
            close_window,
            get_addons,
            install_addon,
            uninstall_addon,
            open_addons_folder,
            update_status,
            update_check,
            update_apply,
            update_set_auto,
            game_status,
            game_install,
            game_uninstall,
            game_launch,
            coffee_core::commands::core_get_theme,
            coffee_core::commands::core_set_theme
        ])
        .build(tauri::generate_context!())
        .unwrap_or_else(|_| panic!("Error al iniciar el Launcher de {SUITE_DIR}"))
        .run(|_, event| {
            // Al cerrar el Launcher se instala la actualización descargada (si la hay)
            if let tauri::RunEvent::Exit = event {
                updater::apply_on_exit();
            }
        });
}
