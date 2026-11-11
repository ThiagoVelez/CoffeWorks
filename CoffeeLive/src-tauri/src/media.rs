//! Comandos nativos propios de CoffeeLive.
//!
//! - Escritura de grabaciones y exportaciones por fragmentos, directamente en
//!   el disco, para que un video largo no tenga que caber en memoria.
//! - Transmisión en directo (RTMP): la interfaz envía el video que compone
//!   y ffmpeg lo codifica y lo publica en Twitch, YouTube, Facebook, etc.
//! - Localización e instalación de ffmpeg, que solo hace falta para transmitir.

use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufWriter, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::mpsc::{self, SyncSender};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, Emitter, Manager, State};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// Evita que aparezca una consola al lanzar ffmpeg o PowerShell en Windows.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn hidden(command: &mut Command) -> &mut Command {
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    command
}

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

// ---------------------------------------------------------------------------
// ffmpeg
// ---------------------------------------------------------------------------

const FFMPEG_EXE: &str = if cfg!(windows) {
    "ffmpeg.exe"
} else {
    "ffmpeg"
};

/// Builds de ffmpeg para Windows (con x264 y AAC). Se prueba en orden.
const FFMPEG_DOWNLOADS: &[&str] = &[
    "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip",
    "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip",
];

/// Carpeta donde se instala ffmpeg: junto a CoffeeCams, para que se borre al
/// desinstalar la aplicación desde el Launcher.
fn tools_dir() -> PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(Path::to_path_buf))
        .unwrap_or_else(|| coffee_core::local_dir().join("Tools"))
}

fn find_ffmpeg() -> Option<PathBuf> {
    let local = tools_dir().join(FFMPEG_EXE);
    if local.is_file() {
        return Some(local);
    }
    let path = std::env::var_os("PATH")?;
    std::env::split_paths(&path)
        .map(|dir| dir.join(FFMPEG_EXE))
        .find(|candidate| candidate.is_file())
}

#[derive(Debug, Clone, Serialize)]
pub struct FfmpegStatus {
    pub available: bool,
    pub path: String,
    pub version: String,
    /// Codificador por software: libx264, o el mejor disponible.
    pub encoder: String,
    /// Codificador por hardware que funciona en este equipo (vacío si ninguno).
    pub hardware: String,
    pub can_install: bool,
}

fn encoder_list(ffmpeg: &Path) -> String {
    hidden(Command::new(ffmpeg).args(["-hide_banner", "-encoders"]))
        .stdin(Stdio::null())
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
        .unwrap_or_default()
}

/// Comprueba de verdad un codificador por hardware (que esté en la lista no
/// garantiza que el equipo tenga la tarjeta gráfica correspondiente).
fn encoder_works(ffmpeg: &Path, encoder: &str) -> bool {
    hidden(Command::new(ffmpeg).args([
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=size=256x144:rate=30",
        "-frames:v",
        "5",
        "-c:v",
        encoder,
        "-f",
        "null",
        "-",
    ]))
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::null())
    .status()
    .map(|s| s.success())
    .unwrap_or(false)
}

fn ffmpeg_status() -> FfmpegStatus {
    let can_install = cfg!(windows);
    let Some(path) = find_ffmpeg() else {
        return FfmpegStatus {
            available: false,
            path: String::new(),
            version: String::new(),
            encoder: String::new(),
            hardware: String::new(),
            can_install,
        };
    };
    let version = hidden(Command::new(&path).arg("-version"))
        .stdin(Stdio::null())
        .output()
        .ok()
        .and_then(|o| {
            String::from_utf8_lossy(&o.stdout)
                .lines()
                .next()
                .map(str::to_string)
        })
        .unwrap_or_default();
    let list = encoder_list(&path);
    let software = if list.contains("libx264") {
        "libx264"
    } else {
        "copy"
    };
    let hardware = ["h264_nvenc", "h264_qsv", "h264_amf", "h264_mf"]
        .into_iter()
        .find(|e| list.contains(e) && encoder_works(&path, e))
        .unwrap_or("");
    FfmpegStatus {
        available: true,
        encoder: software.into(),
        hardware: hardware.into(),
        path: path.to_string_lossy().to_string(),
        version,
        can_install,
    }
}

#[tauri::command]
pub async fn cams_ffmpeg_status() -> Result<FfmpegStatus, String> {
    blocking(|| Ok(ffmpeg_status())).await
}

fn ps_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

/// Descarga ffmpeg (una sola vez) para poder transmitir.
#[tauri::command]
pub async fn cams_ffmpeg_install() -> Result<FfmpegStatus, String> {
    blocking(|| {
        if !cfg!(windows) {
            return Err("Instala ffmpeg con el gestor de paquetes del sistema (por ejemplo: sudo apt install ffmpeg).".into());
        }
        let target_dir = tools_dir();
        fs::create_dir_all(&target_dir).map_err(|e| format!("No se pudo preparar la carpeta: {e}"))?;
        let target = target_dir.join(FFMPEG_EXE);
        let temp = std::env::temp_dir();
        let zip = temp.join("coffeecams-ffmpeg.zip");
        let unpack = temp.join("coffeecams-ffmpeg");
        let mut last_error = String::new();
        for url in FFMPEG_DOWNLOADS {
            let script = format!(
                "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; \
                 [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; \
                 Invoke-WebRequest -UseBasicParsing -Uri {url} -OutFile {zip}; \
                 if (Test-Path {unpack}) {{ Remove-Item {unpack} -Recurse -Force }}; \
                 Expand-Archive -Path {zip} -DestinationPath {unpack} -Force; \
                 $exe = Get-ChildItem {unpack} -Recurse -Filter ffmpeg.exe | Select-Object -First 1; \
                 if (-not $exe) {{ throw 'El paquete no contiene ffmpeg.exe' }}; \
                 Copy-Item $exe.FullName {target} -Force",
                url = ps_quote(url),
                zip = ps_quote(&zip.to_string_lossy()),
                unpack = ps_quote(&unpack.to_string_lossy()),
                target = ps_quote(&target.to_string_lossy()),
            );
            let output = hidden(Command::new("powershell").args([
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                &script,
            ]))
            .stdin(Stdio::null())
            .output()
            .map_err(|e| format!("No se pudo iniciar PowerShell: {e}"))?;
            let _ = fs::remove_file(&zip);
            let _ = fs::remove_dir_all(&unpack);
            if output.status.success() && target.is_file() {
                return Ok(ffmpeg_status());
            }
            last_error = String::from_utf8_lossy(&output.stderr).trim().to_string();
        }
        Err(format!(
            "No se pudo descargar ffmpeg. Revisa la conexión a Internet e inténtalo de nuevo.\n{}",
            last_error.lines().last().unwrap_or_default()
        ))
    })
    .await
}

// ---------------------------------------------------------------------------
// Transmisión en directo
// ---------------------------------------------------------------------------

struct LiveStream {
    sender: Option<SyncSender<Vec<u8>>>,
    child: Arc<Mutex<Option<Child>>>,
}

#[derive(Default)]
pub struct Streams {
    current: Mutex<Option<LiveStream>>,
}

impl Streams {
    /// Detiene ffmpeg al salir de la aplicación.
    pub fn kill(&self) {
        if let Ok(mut current) = self.current.lock() {
            if let Some(stream) = current.take() {
                if let Ok(mut child) = stream.child.lock() {
                    if let Some(child) = child.as_mut() {
                        let _ = child.kill();
                    }
                }
            }
        }
    }
}

#[derive(Debug, Clone, Serialize)]
struct StreamEnded {
    ok: bool,
    message: String,
}

#[derive(Debug, Clone, Serialize)]
struct StreamLog {
    line: String,
}

fn mask(text: &str, secret: &str) -> String {
    if secret.len() >= 4 {
        text.replace(secret, "••••")
    } else {
        text.to_string()
    }
}

/// Opciones de la transmisión (pestañas Transmisión, Salida, Video y Audio).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamOptions {
    pub server: String,
    pub key: String,
    pub fps: u32,
    pub video_kbps: u32,
    pub audio_kbps: u32,
    /// "auto", "x264" o "hardware".
    pub encoder: String,
    /// "cbr" o "vbr".
    pub rate_control: String,
    pub preset: String,
    pub profile: String,
    pub keyframe_sec: u32,
    pub out_width: u32,
    pub out_height: u32,
    pub downscale: String,
    pub sample_rate: u32,
    pub channels: u32,
}

/// Elige el codificador según la preferencia y lo que hay en el equipo.
pub fn choose_encoder(preference: &str, software: &str, hardware: &str) -> String {
    let hw = (!hardware.is_empty()).then_some(hardware);
    let sw = (software == "libx264").then_some("libx264");
    let chosen = match preference {
        "x264" => sw.or(hw),
        "hardware" => hw.or(sw),
        _ => hw.or(sw),
    };
    chosen.unwrap_or("copy").to_string()
}

const PRESETS: &[&str] = &[
    "ultrafast",
    "superfast",
    "veryfast",
    "faster",
    "fast",
    "medium",
];
const PROFILES: &[&str] = &["baseline", "main", "high"];

/// Argumentos de ffmpeg: lee el video que envía la interfaz por la entrada
/// estándar y lo publica en `url` con H.264 + AAC en FLV.
pub fn stream_args(url: &str, encoder: &str, o: &StreamOptions) -> Vec<String> {
    let fps = o.fps.clamp(1, 120);
    let gop = (fps * o.keyframe_sec.clamp(1, 10)).to_string();
    let vb = format!("{}k", o.video_kbps);
    let cbr = o.rate_control != "vbr";
    let maxrate = if cbr {
        vb.clone()
    } else {
        format!("{}k", o.video_kbps * 3 / 2)
    };
    let bufsize = format!("{}k", o.video_kbps * 2);
    let preset = if PRESETS.contains(&o.preset.as_str()) {
        o.preset.as_str()
    } else {
        "veryfast"
    };
    let profile = if PROFILES.contains(&o.profile.as_str()) {
        o.profile.as_str()
    } else {
        "high"
    };
    let mut args: Vec<String> = Vec::new();
    let mut push = |items: &[&str]| args.extend(items.iter().map(|s| s.to_string()));
    push(&[
        "-hide_banner",
        "-loglevel",
        "warning",
        "-stats",
        "-fflags",
        "+genpts",
        "-thread_queue_size",
        "1024",
        "-i",
        "pipe:0",
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
    ]);
    if encoder != "copy" && o.out_width > 0 && o.out_height > 0 {
        let flags = match o.downscale.as_str() {
            "bilinear" | "lanczos" => o.downscale.as_str(),
            _ => "bicubic",
        };
        let filter = format!(
            "scale={}:{}:flags={flags}",
            o.out_width / 2 * 2,
            o.out_height / 2 * 2
        );
        push(&["-vf", &filter]);
    }
    match encoder {
        "libx264" => {
            push(&[
                "-c:v",
                "libx264",
                "-preset",
                preset,
                "-tune",
                "zerolatency",
                "-profile:v",
                profile,
                "-pix_fmt",
                "yuv420p",
            ]);
            push(&["-b:v", &vb, "-maxrate", &maxrate, "-bufsize", &bufsize]);
            if cbr {
                push(&["-minrate", &vb, "-x264-params", "nal-hrd=cbr"]);
            }
        }
        "h264_nvenc" => push(&[
            "-c:v",
            "h264_nvenc",
            "-preset",
            "p4",
            "-tune",
            "ll",
            "-rc",
            if cbr { "cbr" } else { "vbr" },
            "-profile:v",
            profile,
            "-b:v",
            &vb,
            "-maxrate",
            &maxrate,
            "-bufsize",
            &bufsize,
            "-pix_fmt",
            "yuv420p",
        ]),
        "h264_qsv" => push(&[
            "-c:v", "h264_qsv", "-preset", "veryfast", "-b:v", &vb, "-maxrate", &maxrate,
            "-bufsize", &bufsize,
        ]),
        "h264_amf" => push(&[
            "-c:v",
            "h264_amf",
            "-usage",
            "lowlatency",
            "-rc",
            if cbr { "cbr" } else { "vbr_peak" },
            "-b:v",
            &vb,
            "-maxrate",
            &maxrate,
            "-bufsize",
            &bufsize,
        ]),
        "h264_mf" => push(&["-c:v", "h264_mf", "-b:v", &vb, "-pix_fmt", "nv12"]),
        _ => push(&["-c:v", "copy"]),
    }
    if encoder != "copy" {
        push(&["-g", &gop, "-keyint_min", &gop, "-r", &fps.to_string()]);
        if encoder == "libx264" {
            push(&["-sc_threshold", "0"]);
        }
    }
    let ab = format!("{}k", o.audio_kbps.clamp(64, 320));
    let ar = if o.sample_rate == 44100 {
        "44100"
    } else {
        "48000"
    };
    let ac = if o.channels == 1 { "1" } else { "2" };
    push(&[
        "-c:a", "aac", "-b:a", &ab, "-ar", ar, "-ac", ac, "-f", "flv", url,
    ]);
    args
}

#[tauri::command]
pub async fn cams_stream_start(
    app: AppHandle,
    state: State<'_, Streams>,
    options: StreamOptions,
) -> Result<String, String> {
    let server = options.server.clone();
    let key = options.key.clone();
    {
        let current = state
            .current
            .lock()
            .map_err(|_| "Estado interno no disponible")?;
        if current.is_some() {
            return Err("Ya hay una transmisión en curso.".into());
        }
    }
    let server = server.trim().trim_end_matches('/').to_string();
    if !(server.starts_with("rtmp://")
        || server.starts_with("rtmps://")
        || server.starts_with("srt://"))
    {
        return Err("La dirección del servidor debe empezar por rtmp://, rtmps:// o srt://".into());
    }
    let key = key.trim().to_string();
    let url = if key.is_empty() {
        server.clone()
    } else {
        format!("{server}/{key}")
    };

    let (status, mut child) = blocking({
        let url = url.clone();
        move || {
            let status = ffmpeg_status();
            if !status.available {
                return Err(
                    "Para transmitir hace falta ffmpeg. Instálalo desde la ventana de transmisión."
                        .into(),
                );
            }
            let encoder = choose_encoder(&options.encoder, &status.encoder, &status.hardware);
            let args = stream_args(&url, &encoder, &options);
            let child = hidden(Command::new(&status.path).args(&args))
                .stdin(Stdio::piped())
                .stdout(Stdio::null())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| format!("No se pudo iniciar ffmpeg: {e}"))?;
            Ok((encoder, child))
        }
    })
    .await?;

    let mut stdin = child.stdin.take().ok_or("ffmpeg no aceptó datos")?;
    let mut stderr = child
        .stderr
        .take()
        .ok_or("ffmpeg no devolvió su registro")?;
    let child = Arc::new(Mutex::new(Some(child)));

    // Escritura ordenada en ffmpeg desde un hilo propio
    let (sender, receiver) = mpsc::sync_channel::<Vec<u8>>(256);
    std::thread::spawn(move || {
        for chunk in receiver {
            if stdin.write_all(&chunk).is_err() {
                break;
            }
        }
        // Al soltar stdin, ffmpeg termina de enviar lo pendiente y sale
    });

    // Registro de ffmpeg (progreso y errores) y aviso al terminar
    let watcher = child.clone();
    let secret = key.clone();
    std::thread::spawn(move || {
        let mut tail: Vec<String> = Vec::new();
        let mut line = Vec::new();
        let mut buffer = [0u8; 4096];
        loop {
            let read = match stderr.read(&mut buffer) {
                Ok(0) | Err(_) => break,
                Ok(n) => n,
            };
            for &byte in &buffer[..read] {
                if byte == b'\r' || byte == b'\n' {
                    if !line.is_empty() {
                        let text = mask(&String::from_utf8_lossy(&line), &secret);
                        let _ = app.emit("cams-stream-log", StreamLog { line: text.clone() });
                        if !text.starts_with("frame=") {
                            tail.push(text);
                            if tail.len() > 6 {
                                tail.remove(0);
                            }
                        }
                        line.clear();
                    }
                } else {
                    line.push(byte);
                }
            }
        }
        let code = watcher
            .lock()
            .ok()
            .and_then(|mut c| c.take())
            .and_then(|mut c| c.wait().ok());
        let ok = code.map(|c| c.success()).unwrap_or(false);
        let message = if ok {
            "Transmisión finalizada".to_string()
        } else if tail.is_empty() {
            "La transmisión se detuvo".to_string()
        } else {
            tail.join("\n")
        };
        if let Some(state) = app.try_state::<Streams>() {
            if let Ok(mut current) = state.current.lock() {
                *current = None;
            }
        }
        let _ = app.emit("cams-stream-ended", StreamEnded { ok, message });
    });

    *state
        .current
        .lock()
        .map_err(|_| "Estado interno no disponible")? = Some(LiveStream {
        sender: Some(sender),
        child,
    });
    Ok(status)
}

#[tauri::command]
pub async fn cams_stream_write(
    state: State<'_, Streams>,
    request: Request<'_>,
) -> Result<(), String> {
    let data = raw_body(&request)?.to_vec();
    let sender = {
        let current = state
            .current
            .lock()
            .map_err(|_| "Estado interno no disponible")?;
        current
            .as_ref()
            .and_then(|s| s.sender.clone())
            .ok_or("La transmisión no está activa")?
    };
    blocking(move || {
        sender
            .send(data)
            .map_err(|_| "ffmpeg dejó de recibir datos".to_string())
    })
    .await
}

#[tauri::command]
pub async fn cams_stream_stop(state: State<'_, Streams>) -> Result<(), String> {
    let child = {
        let mut current = state
            .current
            .lock()
            .map_err(|_| "Estado interno no disponible")?;
        match current.as_mut() {
            Some(stream) => {
                stream.sender = None; // cierra la entrada de ffmpeg
                stream.child.clone()
            }
            None => return Ok(()),
        }
    };
    // Si ffmpeg no termina por sí solo en unos segundos, se detiene
    blocking(move || {
        let deadline = Instant::now() + Duration::from_secs(6);
        while Instant::now() < deadline {
            let finished = match child.lock() {
                Ok(mut guard) => match guard.as_mut() {
                    Some(c) => c.try_wait().map(|s| s.is_some()).unwrap_or(true),
                    None => true,
                },
                Err(_) => true,
            };
            if finished {
                return Ok(());
            }
            std::thread::sleep(Duration::from_millis(150));
        }
        if let Ok(mut guard) = child.lock() {
            if let Some(c) = guard.as_mut() {
                let _ = c.kill();
            }
        }
        Ok(())
    })
    .await
}

// ---------------------------------------------------------------------------
// Utilidades de CoffeeLive
// ---------------------------------------------------------------------------

/// Elige una carpeta (destino de las grabaciones).
#[tauri::command]
pub async fn live_pick_folder(app: AppHandle) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    app.dialog()
        .file()
        .set_title("Carpeta de grabaciones")
        .blocking_pick_folder()
        .and_then(|folder| folder.into_path().ok())
        .map(|path| coffee_core::display_path(&path))
}

/// Abre una grabación en CoffeeEdit, si está instalado.
#[tauri::command]
pub async fn live_open_in_editor(path: String) -> Result<(), String> {
    blocking(move || {
        let name = format!("CoffeeEdit{}", std::env::consts::EXE_SUFFIX);
        let candidates = [
            coffee_core::apps_dir().join("CoffeeEdit").join(&name),
            std::env::current_exe()
                .ok()
                .and_then(|exe| exe.parent().map(|dir| dir.join(&name)))
                .unwrap_or_default(),
        ];
        let exe = candidates
            .into_iter()
            .find(|candidate| candidate.is_file())
            .ok_or("Instala CoffeeEdit desde el Launcher para editar la grabación.")?;
        Command::new(exe)
            .arg(&path)
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("No se pudo abrir CoffeeEdit: {e}"))
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn options() -> StreamOptions {
        StreamOptions {
            server: "rtmp://example/app".into(),
            key: "key".into(),
            fps: 30,
            video_kbps: 4500,
            audio_kbps: 160,
            encoder: "auto".into(),
            rate_control: "cbr".into(),
            preset: "veryfast".into(),
            profile: "high".into(),
            keyframe_sec: 2,
            out_width: 1280,
            out_height: 720,
            downscale: "lanczos".into(),
            sample_rate: 48000,
            channels: 2,
        }
    }

    #[test]
    fn x264_cbr_with_scaling_and_keyframes() {
        let joined = stream_args("rtmp://example/app/key", "libx264", &options()).join(" ");
        assert!(joined.contains("-c:v libx264 -preset veryfast"));
        assert!(joined.contains("scale=1280:720:flags=lanczos"));
        assert!(joined.contains("-minrate 4500k"));
        assert!(joined.contains("-g 60"));
        assert!(joined.ends_with("-ar 48000 -ac 2 -f flv rtmp://example/app/key"));
    }

    #[test]
    fn hardware_vbr_and_copy() {
        let mut o = options();
        o.rate_control = "vbr".into();
        let nvenc = stream_args("rtmp://x", "h264_nvenc", &o).join(" ");
        assert!(nvenc.contains("-rc vbr") && nvenc.contains("-maxrate 6750k"));
        let copy = stream_args("rtmp://x", "copy", &o).join(" ");
        assert!(copy.contains("-c:v copy") && !copy.contains("scale="));
    }

    #[test]
    fn encoder_preference() {
        assert_eq!(
            choose_encoder("auto", "libx264", "h264_nvenc"),
            "h264_nvenc"
        );
        assert_eq!(choose_encoder("x264", "libx264", "h264_nvenc"), "libx264");
        assert_eq!(choose_encoder("hardware", "libx264", ""), "libx264");
        assert_eq!(choose_encoder("auto", "copy", ""), "copy");
    }

    #[test]
    fn mask_hides_stream_key() {
        assert_eq!(
            mask("error rtmp://x/live/abcd1234", "abcd1234"),
            "error rtmp://x/live/••••"
        );
    }
}
