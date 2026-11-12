//! Comandos IPC comunes a los tres editores de la suite.
//!
//! Viven en un módulo propio porque Tauri no permite declarar comandos
//! públicos en la raíz de una biblioteca.

use std::fs;
use std::path::Path;

use base64::Engine;
use serde::Deserialize;
use tauri::{AppHandle, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

use crate::{
    display_path, load_recent, parse_launch_args, same_path, sanitize_file_name, upsert_recent,
    vault_dir, write_atomic, LaunchArgs, RecentDocument,
};

// Todos los comandos son `async`: Tauri ejecuta los comandos síncronos en el
// hilo principal, el mismo que atiende la ventana. Si un guardado tarda (disco
// lento, carpeta sincronizada con OneDrive...) la ventana dejaba de responder
// y los botones de minimizar, maximizar y cerrar se quedaban trabados. El
// trabajo de disco se hace además en un hilo aparte con `spawn_blocking`.

/// Ejecuta una tarea de disco en un hilo de trabajo y espera su resultado.
async fn blocking<T, F>(task: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|e| format!("La operación se interrumpió: {e}"))?
}

#[tauri::command]
pub async fn core_launch_args() -> LaunchArgs {
    parse_launch_args(std::env::args())
}

#[tauri::command]
pub async fn core_read_text(path: String) -> Result<String, String> {
    blocking(move || fs::read_to_string(&path).map_err(|e| format!("No se pudo leer {path}: {e}")))
        .await
}

#[tauri::command]
pub async fn core_write_text(path: String, contents: String) -> Result<(), String> {
    blocking(move || {
        write_atomic(Path::new(&path), contents.as_bytes())
            .map_err(|e| format!("No se pudo escribir {path}: {e}"))
    })
    .await
}

/// Lee un archivo binario y lo devuelve codificado en base64.
#[tauri::command]
pub async fn core_read_binary(path: String) -> Result<String, String> {
    blocking(move || {
        let bytes = fs::read(&path).map_err(|e| format!("No se pudo leer {path}: {e}"))?;
        Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
    })
    .await
}

/// Escribe un archivo binario a partir de su contenido en base64.
#[tauri::command]
pub async fn core_write_binary(path: String, data: String) -> Result<(), String> {
    blocking(move || {
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(data.as_bytes())
            .map_err(|e| format!("Datos no válidos: {e}"))?;
        write_atomic(Path::new(&path), &bytes)
            .map_err(|e| format!("No se pudo escribir {path}: {e}"))
    })
    .await
}

#[tauri::command]
pub async fn core_file_exists(path: String) -> bool {
    blocking(move || Ok(Path::new(&path).is_file()))
        .await
        .unwrap_or(false)
}

/// Devuelve la ruta dentro de la bóveda donde debe guardarse un documento.
/// Si ya existe un archivo con ese nombre que pertenece a otro documento, se
/// añade un sufijo numérico para no sobrescribirlo.
pub fn reserve_vault_path(file_name: String, doc_id: String) -> Result<String, String> {
    let dir = vault_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("No se pudo crear la bóveda: {e}"))?;

    let safe = sanitize_file_name(&file_name);
    let (stem, ext) = match safe.rfind('.') {
        Some(dot) if dot > 0 => (safe[..dot].to_string(), safe[dot..].to_string()),
        _ => (safe.clone(), String::new()),
    };
    let recent = load_recent();

    for attempt in 1..1000 {
        let candidate = if attempt == 1 {
            dir.join(format!("{stem}{ext}"))
        } else {
            dir.join(format!("{stem} ({attempt}){ext}"))
        };
        let candidate_text = display_path(&candidate);
        let owned_by_same_doc = recent
            .iter()
            .any(|d| d.id == doc_id && same_path(&d.path, &candidate_text));
        if !candidate.exists() || owned_by_same_doc {
            return Ok(candidate_text);
        }
    }
    Err("No se pudo reservar un nombre de archivo en la bóveda".to_string())
}

/// Renombra un documento de la bóveda cuando cambia su título. Si el archivo
/// no está dentro de la bóveda (el usuario eligió su ubicación con "Guardar
/// como") se respeta su ruta y se devuelve sin cambios.
pub fn rename_in_vault(path: String, file_name: String, doc_id: String) -> Result<String, String> {
    let current = Path::new(&path);
    let vault = vault_dir();
    if !current.is_file() || !current.starts_with(&vault) {
        return Ok(path);
    }
    let wanted = sanitize_file_name(&file_name);
    let current_name = current
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    if same_path(&current_name, &wanted) {
        return Ok(path);
    }
    let target = reserve_vault_path(wanted, doc_id)?;
    fs::rename(current, &target).map_err(|e| format!("No se pudo renombrar el documento: {e}"))?;
    Ok(target)
}

#[tauri::command]
pub async fn core_vault_path(file_name: String, doc_id: String) -> Result<String, String> {
    blocking(move || reserve_vault_path(file_name, doc_id)).await
}

#[tauri::command]
pub async fn core_rename_in_vault(
    path: String,
    file_name: String,
    doc_id: String,
) -> Result<String, String> {
    blocking(move || rename_in_vault(path, file_name, doc_id)).await
}

#[tauri::command]
pub async fn core_vault_dir() -> String {
    display_path(&vault_dir())
}

#[tauri::command]
pub async fn core_register_recent(doc: RecentDocument) -> Result<(), String> {
    blocking(move || upsert_recent(doc).map(|_| ())).await
}

/// Fija o desfija un documento en la lista de recientes del Launcher.
#[tauri::command]
pub async fn core_set_pinned(id: String, pinned: bool) -> Result<(), String> {
    blocking(move || {
        let mut docs = load_recent();
        if let Some(doc) = docs.iter_mut().find(|d| d.id == id) {
            doc.is_pinned = pinned;
            crate::save_recent(&docs)?;
        }
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn core_list_recent() -> Vec<RecentDocument> {
    blocking(|| Ok(load_recent())).await.unwrap_or_default()
}

/// Filtro de tipos de archivo para los diálogos nativos.
#[derive(Debug, Clone, Deserialize)]
pub struct FileFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

fn apply_filters<'a, R: tauri::Runtime>(
    mut builder: tauri_plugin_dialog::FileDialogBuilder<R>,
    filters: &'a [FileFilter],
) -> tauri_plugin_dialog::FileDialogBuilder<R> {
    for filter in filters {
        let extensions: Vec<&str> = filter.extensions.iter().map(String::as_str).collect();
        builder = builder.add_filter(&filter.name, &extensions);
    }
    builder
}

/// Diálogo nativo "Abrir archivo". Devuelve la ruta elegida o `None`.
#[tauri::command]
pub async fn core_pick_open(
    app: AppHandle,
    title: Option<String>,
    filters: Option<Vec<FileFilter>>,
) -> Option<String> {
    let mut builder = app.dialog().file();
    if let Some(title) = title {
        builder = builder.set_title(title);
    }
    builder = apply_filters(builder, filters.as_deref().unwrap_or(&[]));
    let vault = vault_dir();
    if vault.is_dir() {
        builder = builder.set_directory(vault);
    }
    builder
        .blocking_pick_file()
        .and_then(|file| file.into_path().ok())
        .map(|path| display_path(&path))
}

/// Diálogo nativo "Guardar como". Devuelve la ruta elegida o `None`.
#[tauri::command]
pub async fn core_pick_save(
    app: AppHandle,
    title: Option<String>,
    default_name: Option<String>,
    filters: Option<Vec<FileFilter>>,
) -> Option<String> {
    let mut builder = app.dialog().file();
    if let Some(title) = title {
        builder = builder.set_title(title);
    }
    if let Some(name) = default_name {
        builder = builder.set_file_name(sanitize_file_name(&name));
    }
    builder = apply_filters(builder, filters.as_deref().unwrap_or(&[]));
    let vault = vault_dir();
    if fs::create_dir_all(&vault).is_ok() {
        builder = builder.set_directory(vault);
    }
    builder
        .blocking_save_file()
        .and_then(|file| file.into_path().ok())
        .map(|path| display_path(&path))
}

/// Abre una URL, archivo o carpeta con el programa predeterminado del sistema.
#[tauri::command]
pub async fn core_open_external(target: String) -> Result<(), String> {
    open::that_detached(&target).map_err(|e| format!("No se pudo abrir {target}: {e}"))
}

#[tauri::command]
pub async fn core_window_minimize(window: WebviewWindow) {
    let _ = window.minimize();
}

#[tauri::command]
pub async fn core_window_toggle_maximize(window: WebviewWindow) {
    if window.is_maximized().unwrap_or(false) {
        let _ = window.unmaximize();
    } else {
        let _ = window.maximize();
    }
}

#[tauri::command]
pub async fn core_window_toggle_fullscreen(window: WebviewWindow) -> bool {
    let next = !window.is_fullscreen().unwrap_or(false);
    let _ = window.set_fullscreen(next);
    next
}

#[tauri::command]
pub async fn core_window_set_fullscreen(window: WebviewWindow, fullscreen: bool) {
    let _ = window.set_fullscreen(fullscreen);
}

#[tauri::command]
pub async fn core_window_close(window: WebviewWindow) {
    let _ = window.close();
}

#[tauri::command]
pub async fn core_window_set_title(window: WebviewWindow, title: String) {
    let _ = window.set_title(&title);
}

// ---------------------------------------------------------------------------
// Complementos
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn core_addon_status(id: String) -> Result<crate::addons::AddonInfo, String> {
    blocking(move || {
        crate::addons::find_addon(&id)
            .map(crate::addons::addon_info)
            .ok_or_else(|| format!("Complemento desconocido: {id}"))
    })
    .await
}

#[tauri::command]
pub async fn core_addon_install(id: String) -> Result<crate::addons::AddonInfo, String> {
    blocking(move || crate::addons::install_addon(&id)).await
}

#[tauri::command]
pub async fn core_addon_run(id: String, args: Vec<String>, input: Option<String>) -> Result<String, String> {
    blocking(move || crate::addons::run_addon(&id, &args, input.as_deref())).await
}

/// Ejecuta un complemento con un archivo binario (en base64) como entrada.
#[tauri::command]
pub async fn core_addon_run_file(id: String, args: Vec<String>, data: String, extension: String) -> Result<String, String> {
    use base64::Engine as _;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data.as_bytes())
        .map_err(|e| format!("Datos no válidos: {e}"))?;
    blocking(move || crate::addons::run_addon_with(&id, &args, Some(&bytes), &extension)).await
}

// ---------------------------------------------------------------------------
// Corrector ortográfico
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn core_spell_dictionary(lang: String) -> Result<crate::spell::Dictionary, String> {
    blocking(move || crate::spell::load_dictionary(&lang)).await
}

#[tauri::command]
pub async fn core_spell_user_words() -> Vec<String> {
    blocking(|| Ok(crate::spell::user_words())).await.unwrap_or_default()
}

#[tauri::command]
pub async fn core_spell_add_word(word: String) -> Result<Vec<String>, String> {
    blocking(move || crate::spell::add_user_word(&word)).await
}

#[tauri::command]
pub async fn core_spell_remove_word(word: String) -> Result<Vec<String>, String> {
    blocking(move || crate::spell::remove_user_word(&word)).await
}
