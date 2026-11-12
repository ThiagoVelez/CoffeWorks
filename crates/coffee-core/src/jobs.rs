//! Trabajos largos con un complemento (sobre todo FFmpeg): se ejecutan con
//! rutas reales, informan del progreso con eventos y se pueden cancelar.
//!
//! Lo usan CoffeeEncoder (cola de codificación), CoffeeMotion y CoffeeAnimate
//! (exportar video) y CoffeeEdit.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex, OnceLock};

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tauri_plugin_dialog::DialogExt;

use crate::addons::{addon_executable, find_addon, hidden};

fn running() -> &'static Mutex<HashMap<String, Arc<Mutex<Child>>>> {
    static JOBS: OnceLock<Mutex<HashMap<String, Arc<Mutex<Child>>>>> = OnceLock::new();
    JOBS.get_or_init(|| Mutex::new(HashMap::new()))
}

#[derive(Clone, Serialize)]
struct JobProgress {
    id: String,
    /// Pares clave=valor de `-progress pipe:1` (out_time_us, fps, speed...).
    data: HashMap<String, String>,
}

#[derive(Clone, Serialize)]
struct JobEnded {
    id: String,
    ok: bool,
    cancelled: bool,
    message: String,
    /// Tamaño del archivo resultante (el último argumento) en bytes.
    size: u64,
}

/// Arranca un trabajo. El programa debe escribir su progreso en la salida
/// estándar como `clave=valor` (FFmpeg: `-progress pipe:1 -nostats`).
/// Emite `coffee-job-progress` y, al terminar, `coffee-job-ended`.
#[tauri::command]
pub async fn core_job_start(app: AppHandle, id: String, addon: String, args: Vec<String>) -> Result<(), String> {
    let info = find_addon(&addon).ok_or_else(|| format!("Complemento desconocido: {addon}"))?;
    let exe = addon_executable(&addon).ok_or_else(|| format!("El complemento «{}» no está instalado.", info.name))?;
    let mut child = hidden(Command::new(&exe).args(&args))
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("No se pudo ejecutar «{}»: {e}", info.name))?;
    let output_path = args.last().cloned().unwrap_or_default();
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let child = Arc::new(Mutex::new(child));
    running().lock().unwrap().insert(id.clone(), child.clone());

    // Errores: se guardan las últimas líneas para explicar un fallo
    let tail = Arc::new(Mutex::new(Vec::<String>::new()));
    let err_thread = stderr.map(|err| {
        let tail = tail.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(err).lines().map_while(Result::ok) {
                let mut t = tail.lock().unwrap();
                t.push(line);
                if t.len() > 30 {
                    t.remove(0);
                }
            }
        })
    });

    std::thread::spawn(move || {
        if let Some(out) = stdout {
            let mut block = HashMap::new();
            for line in BufReader::new(out).lines().map_while(Result::ok) {
                if let Some((k, v)) = line.split_once('=') {
                    let k = k.trim().to_string();
                    let v = v.trim().to_string();
                    let end = k == "progress";
                    block.insert(k, v);
                    if end {
                        let _ = app.emit("coffee-job-progress", JobProgress { id: id.clone(), data: std::mem::take(&mut block) });
                    }
                }
            }
        }
        if let Some(t) = err_thread {
            let _ = t.join();
        }
        let status = child.lock().unwrap().wait();
        let cancelled = running().lock().unwrap().remove(&id).is_none();
        let ok = status.map(|s| s.success()).unwrap_or(false);
        let message = if ok || cancelled {
            String::new()
        } else {
            let t = tail.lock().unwrap();
            let useful: Vec<&String> = t.iter().filter(|l| !l.trim().is_empty()).collect();
            useful.iter().rev().take(4).rev().map(|s| s.as_str()).collect::<Vec<_>>().join("\n")
        };
        let size = std::fs::metadata(&output_path).map(|m| m.len()).unwrap_or(0);
        if cancelled {
            let _ = std::fs::remove_file(&output_path);
        }
        let _ = app.emit("coffee-job-ended", JobEnded { id, ok: ok && !cancelled, cancelled, message, size });
    });
    Ok(())
}

/// Cancela un trabajo en curso.
#[tauri::command]
pub async fn core_job_cancel(id: String) -> bool {
    let child = running().lock().unwrap().remove(&id);
    match child {
        Some(c) => c.lock().unwrap().kill().is_ok(),
        None => false,
    }
}

/// Información de un archivo multimedia (la salida de `ffmpeg -i`, que la app
/// interpreta: duración, flujos, resolución, fps...).
#[tauri::command]
pub async fn core_media_probe(path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let exe = addon_executable("ffmpeg").ok_or("El complemento «Motor de video FFmpeg» no está instalado.")?;
        let mut child = hidden(Command::new(exe).args(["-hide_banner", "-i", &path]))
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("No se pudo ejecutar FFmpeg: {e}"))?;
        let mut text = String::new();
        if let Some(mut err) = child.stderr.take() {
            let _ = err.read_to_string(&mut text);
        }
        let _ = child.wait();
        Ok(text)
    })
    .await
    .map_err(|e| format!("La operación se interrumpió: {e}"))?
}

/// Elige varios archivos y devuelve solo sus rutas (sin leerlos: pueden ser videos enormes).
#[tauri::command]
pub async fn core_pick_paths(app: AppHandle, title: Option<String>, filters: Option<Vec<crate::commands::FileFilter>>) -> Vec<String> {
    let mut builder = app.dialog().file();
    if let Some(title) = title {
        builder = builder.set_title(title);
    }
    for f in filters.unwrap_or_default() {
        let ext: Vec<&str> = f.extensions.iter().map(String::as_str).collect();
        builder = builder.add_filter(&f.name, &ext);
    }
    builder
        .blocking_pick_files()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|f| f.into_path().ok())
        .map(|p| crate::display_path(&p))
        .collect()
}

/// Elige una carpeta.
#[tauri::command]
pub async fn core_pick_folder(app: AppHandle, title: Option<String>) -> Option<String> {
    let mut builder = app.dialog().file();
    if let Some(title) = title {
        builder = builder.set_title(title);
    }
    builder.blocking_pick_folder().and_then(|f| f.into_path().ok()).map(|p| crate::display_path(&p))
}

/// Carpeta de videos del usuario (destino predeterminado de las exportaciones).
#[tauri::command]
pub async fn core_videos_dir() -> String {
    dirs::video_dir()
        .or_else(dirs::home_dir)
        .map(|p| crate::display_path(&p))
        .unwrap_or_default()
}

/// Ruta en la carpeta temporal del sistema (archivos intermedios de una exportación).
#[tauri::command]
pub async fn core_temp_path(name: String) -> String {
    let clean: String = name.chars().filter(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_')).collect();
    crate::display_path(&std::env::temp_dir().join(format!("coffeeworks-{clean}")))
}

/// Borra un archivo temporal creado con [`core_temp_path`].
#[tauri::command]
pub async fn core_remove_temp(path: String) -> bool {
    let p = std::path::PathBuf::from(&path);
    let in_temp = p.parent().is_some_and(|d| crate::same_path(&d.to_string_lossy(), &std::env::temp_dir().to_string_lossy()));
    let ours = p.file_name().is_some_and(|n| n.to_string_lossy().starts_with("coffeeworks-"));
    in_temp && ours && std::fs::remove_file(p).is_ok()
}

/// Carpeta de un complemento instalado (para leer sus archivos de datos).
#[tauri::command]
pub async fn core_addon_dir(id: String) -> Option<String> {
    crate::addons::addon_executable(&id).and_then(|p| p.parent().map(crate::display_path))
}
