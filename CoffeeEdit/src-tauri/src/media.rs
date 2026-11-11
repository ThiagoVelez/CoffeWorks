//! Comandos nativos propios de CoffeeEdit: escritura de exportaciones e
//! importaciones por fragmentos, directamente en el disco, para que un video
//! largo no tenga que caber en memoria.

use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufWriter, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};

use tauri::ipc::{InvokeBody, Request};
use tauri::State;

async fn blocking<T, F>(task: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|e| format!("La operación se interrumpió: {e}"))?
}

fn raw_body<'a>(request: &'a Request<'_>) -> Result<&'a [u8], String> {
    match request.body() {
        InvokeBody::Raw(data) => Ok(data.as_slice()),
        InvokeBody::Json(_) => Err("Se esperaban datos binarios".into()),
    }
}

fn header_u32(request: &Request<'_>, name: &str) -> Result<u32, String> {
    request
        .headers()
        .get(name)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse().ok())
        .ok_or_else(|| format!("Falta la cabecera {name}"))
}

// ---------------------------------------------------------------------------
// Carpeta de videos
// ---------------------------------------------------------------------------

/// `Videos\CoffeeWorks`: destino de las grabaciones.
pub fn videos_dir() -> PathBuf {
    dirs::video_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| PathBuf::from("."))
        .join(coffee_core::SUITE_DIR)
}

#[tauri::command]
pub async fn cams_videos_dir() -> Result<String, String> {
    blocking(|| {
        let dir = videos_dir();
        fs::create_dir_all(&dir)
            .map_err(|e| format!("No se pudo crear la carpeta de videos: {e}"))?;
        Ok(dir.to_string_lossy().to_string())
    })
    .await
}

// ---------------------------------------------------------------------------
// Escritura por fragmentos
// ---------------------------------------------------------------------------

#[derive(Default)]
pub struct Writers {
    next: AtomicU32,
    files: Arc<Mutex<HashMap<u32, (PathBuf, BufWriter<File>)>>>,
}

#[tauri::command]
pub async fn cams_file_open(state: State<'_, Writers>, path: String) -> Result<u32, String> {
    let id = state.next.fetch_add(1, Ordering::SeqCst) + 1;
    let files = state.files.clone();
    blocking(move || {
        let path = PathBuf::from(path);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("No se pudo crear la carpeta: {e}"))?;
        }
        let file = File::create(&path).map_err(|e| format!("No se pudo crear el archivo: {e}"))?;
        files
            .lock()
            .map_err(|_| "Estado interno no disponible".to_string())?
            .insert(id, (path, BufWriter::with_capacity(1 << 20, file)));
        Ok(id)
    })
    .await
}

#[tauri::command]
pub async fn cams_file_append(
    state: State<'_, Writers>,
    request: Request<'_>,
) -> Result<(), String> {
    let id = header_u32(&request, "x-handle")?;
    let data = raw_body(&request)?.to_vec();
    let files = state.files.clone();
    blocking(move || {
        let mut files = files
            .lock()
            .map_err(|_| "Estado interno no disponible".to_string())?;
        let (_, writer) = files.get_mut(&id).ok_or("El archivo ya está cerrado")?;
        writer
            .write_all(&data)
            .map_err(|e| format!("No se pudo escribir el video (¿disco lleno?): {e}"))
    })
    .await
}

/// Cierra el archivo. Con `discard` lo borra (grabación cancelada).
#[tauri::command]
pub async fn cams_file_close(
    state: State<'_, Writers>,
    handle: u32,
    discard: bool,
) -> Result<String, String> {
    let files = state.files.clone();
    blocking(move || {
        let entry = files
            .lock()
            .map_err(|_| "Estado interno no disponible".to_string())?
            .remove(&handle);
        let (path, mut writer) = entry.ok_or("El archivo ya está cerrado")?;
        let flushed = writer.flush();
        drop(writer);
        if discard {
            let _ = fs::remove_file(&path);
            return Ok(String::new());
        }
        flushed.map_err(|e| format!("No se pudo terminar de guardar el video: {e}"))?;
        Ok(path.to_string_lossy().to_string())
    })
    .await
}
