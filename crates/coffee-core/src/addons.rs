//! Complementos de la suite: herramientas opcionales que no vienen en el
//! instalador porque solo algunas personas las necesitan.
//!
//! Se descargan una sola vez en `%LOCALAPPDATA%\CoffeeWorks\Addons\<id>` y las
//! comparten todas las aplicaciones. El Launcher los muestra en
//! «Complementos»; una aplicación también puede instalarlos en el momento en
//! que hacen falta.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use serde::Serialize;

use crate::local_dir;

/// Descripción estática de un complemento.
pub struct CatalogAddon {
    pub id: &'static str,
    pub name: &'static str,
    pub summary: &'static str,
    pub description: &'static str,
    /// Aplicaciones que lo usan.
    pub apps: &'static [&'static str],
    pub version: &'static str,
    /// Tamaño aproximado de la descarga.
    pub download_size: &'static str,
    pub publisher: &'static str,
    pub license: &'static str,
    /// Ejecutable principal (sin `.exe`).
    pub executable: &'static str,
    /// Descargas (.zip) que se prueban en orden.
    pub downloads: &'static [&'static str],
    /// Mensaje para sistemas sin descarga automática.
    pub manual_hint: &'static str,
}

pub const ADDONS: &[CatalogAddon] = &[
    CatalogAddon {
        id: "accdb",
        name: "Compatibilidad con Access",
        summary: "Guarda bases de CoffeeDataBase en formato .accdb y .mdb",
        description: "Exporta tablas, datos, claves principales y relaciones a archivos .accdb (Access 2010 o posterior) y .mdb. Es un programa pequeño que solo se ejecuta al exportar: no necesita Java ni deja nada abierto.",
        apps: &["coffeedatabase"],
        version: "1.0.0",
        download_size: "8 MB",
        publisher: "CoffeeWorks",
        license: "Apache 2.0 (Jackcess)",
        executable: "coffee-accdb",
        downloads: &["https://github.com/ThiagoVelez/CoffeWorks/releases/download/addons/coffee-accdb-win64.zip"],
        manual_hint: "Este complemento solo está disponible para Windows.",
    },
    CatalogAddon {
        id: "ffmpeg",
        name: "Motor de video FFmpeg",
        summary: "Transmisión en directo y codificación por hardware en CoffeeLive",
        description: "Codifica el video para Twitch, YouTube, Facebook o cualquier servidor RTMP/SRT, con aceleración NVIDIA NVENC, Intel Quick Sync o AMD AMF si el equipo la tiene. Solo hace falta para transmitir: grabar funciona sin él.",
        apps: &["coffeelive"],
        version: "7.x",
        download_size: "90 MB",
        publisher: "Proyecto FFmpeg",
        license: "GPL",
        executable: "ffmpeg",
        downloads: &[
            "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip",
            "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip",
        ],
        manual_hint: "Instala ffmpeg con el gestor de paquetes del sistema (por ejemplo: sudo apt install ffmpeg).",
    },
    CatalogAddon {
        id: "pdfcheck",
        name: "Revisión del PDF original",
        summary: "Revisa la ortografía del texto que ya trae el PDF, también si está escaneado",
        description: "CoffeePDF revisa por defecto solo los textos que agregas. Con este complemento también revisa el texto original del documento: lo subraya en rojo, lo cuenta en el indicador de faltas y lo corrige con clic derecho (tapa la palabra y escribe la corrección encima). En las páginas escaneadas reconoce el texto con OCR (Tesseract) en español e inglés.",
        apps: &["coffeepdf"],
        version: "5.4",
        download_size: "36 MB",
        publisher: "Proyecto Tesseract OCR",
        license: "Apache 2.0",
        executable: "tesseract",
        downloads: &["https://github.com/ThiagoVelez/CoffeWorks/releases/download/addons/coffee-pdfcheck-win64.zip"],
        manual_hint: "Instala Tesseract con el gestor de paquetes del sistema (por ejemplo: sudo apt install tesseract-ocr tesseract-ocr-spa).",
    },
];

/// Carpeta común de los complementos.
pub fn addons_dir() -> PathBuf {
    local_dir().join("Addons")
}

pub fn find_addon(id: &str) -> Option<&'static CatalogAddon> {
    ADDONS.iter().find(|a| a.id == id)
}

fn exe_name(base: &str) -> String {
    if cfg!(windows) {
        format!("{base}.exe")
    } else {
        base.to_string()
    }
}

/// Ruta del ejecutable del complemento si está instalado.
pub fn addon_executable(id: &str) -> Option<PathBuf> {
    let addon = find_addon(id)?;
    let path = addons_dir().join(addon.id).join(exe_name(addon.executable));
    if path.is_file() {
        return Some(path);
    }
    // Fuera de Windows se usa el programa instalado con el gestor de paquetes.
    if cfg!(windows) {
        return None;
    }
    std::env::var_os("PATH").and_then(|paths| {
        std::env::split_paths(&paths)
            .map(|dir| dir.join(addon.executable))
            .find(|candidate| candidate.is_file())
    })
}

/// Estado de un complemento para mostrarlo en la interfaz.
#[derive(Debug, Clone, Serialize)]
pub struct AddonInfo {
    pub id: String,
    pub name: String,
    pub summary: String,
    pub description: String,
    pub apps: Vec<String>,
    pub version: String,
    pub download_size: String,
    pub publisher: String,
    pub license: String,
    pub installed: bool,
    /// Espacio ocupado en disco (bytes) si está instalado.
    pub installed_bytes: u64,
    /// Si se puede instalar automáticamente en este sistema.
    pub can_install: bool,
    pub manual_hint: String,
}

fn dir_size(path: &Path) -> u64 {
    fs::read_dir(path)
        .map(|entries| {
            entries
                .flatten()
                .map(|e| {
                    let p = e.path();
                    if p.is_dir() {
                        dir_size(&p)
                    } else {
                        e.metadata().map(|m| m.len()).unwrap_or(0)
                    }
                })
                .sum()
        })
        .unwrap_or(0)
}

pub fn addon_info(addon: &CatalogAddon) -> AddonInfo {
    let installed = addon_executable(addon.id).is_some();
    AddonInfo {
        id: addon.id.into(),
        name: addon.name.into(),
        summary: addon.summary.into(),
        description: addon.description.into(),
        apps: addon.apps.iter().map(|a| a.to_string()).collect(),
        version: addon.version.into(),
        download_size: addon.download_size.into(),
        publisher: addon.publisher.into(),
        license: addon.license.into(),
        installed,
        installed_bytes: if installed { dir_size(&addons_dir().join(addon.id)) } else { 0 },
        can_install: cfg!(windows),
        manual_hint: addon.manual_hint.into(),
    }
}

pub fn list_addons() -> Vec<AddonInfo> {
    ADDONS.iter().map(addon_info).collect()
}

/// Evita que aparezca una consola al lanzar procesos en Windows.
pub fn hidden(cmd: &mut Command) -> &mut Command {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

/// Cita un texto para PowerShell.
pub fn ps_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

/// Ejecuta un script de PowerShell oculto y devuelve su salida.
pub fn run_powershell(script: &str) -> Result<String, String> {
    let output = hidden(Command::new("powershell").args([
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script,
    ]))
    .stdin(Stdio::null())
    .output()
    .map_err(|e| format!("No se pudo iniciar PowerShell: {e}"))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(err.lines().last().unwrap_or("Error desconocido").to_string())
    }
}

/// Descarga un archivo (HTTPS) a la ruta indicada.
pub fn download_file(url: &str, target: &Path) -> Result<(), String> {
    let script = format!(
        "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; \
         [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; \
         Invoke-WebRequest -UseBasicParsing -Headers @{{ 'User-Agent'='CoffeeWorks' }} -Uri {url} -OutFile {out}",
        url = ps_quote(url),
        out = ps_quote(&target.to_string_lossy()),
    );
    run_powershell(&script).map(|_| ()).map_err(|e| format!("No se pudo descargar {url}: {e}"))
}

/// Descarga e instala un complemento. Prueba cada descarga en orden.
pub fn install_addon(id: &str) -> Result<AddonInfo, String> {
    let addon = find_addon(id).ok_or_else(|| format!("Complemento desconocido: {id}"))?;
    if !cfg!(windows) {
        return Err(addon.manual_hint.to_string());
    }
    let target_dir = addons_dir().join(addon.id);
    fs::create_dir_all(&target_dir).map_err(|e| format!("No se pudo preparar la carpeta: {e}"))?;
    let exe = exe_name(addon.executable);
    let temp = std::env::temp_dir();
    let zip = temp.join(format!("coffeeworks-addon-{}.zip", addon.id));
    let unpack = temp.join(format!("coffeeworks-addon-{}", addon.id));
    let mut last_error = String::new();
    for url in addon.downloads {
        // Se copia la carpeta del ejecutable completa (algunos traen DLL al lado).
        let script = format!(
            "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; \
             [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; \
             Invoke-WebRequest -UseBasicParsing -Uri {url} -OutFile {zip}; \
             if (Test-Path {unpack}) {{ Remove-Item {unpack} -Recurse -Force }}; \
             Expand-Archive -Path {zip} -DestinationPath {unpack} -Force; \
             $exe = Get-ChildItem {unpack} -Recurse -Filter {exe} | Select-Object -First 1; \
             if (-not $exe) {{ throw 'El paquete no contiene {exe}' }}; \
             Get-ChildItem $exe.DirectoryName -File | Copy-Item -Destination {target} -Force",
            url = ps_quote(url),
            zip = ps_quote(&zip.to_string_lossy()),
            unpack = ps_quote(&unpack.to_string_lossy()),
            exe = ps_quote(&exe),
            target = ps_quote(&target_dir.to_string_lossy()),
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
        if output.status.success() && target_dir.join(&exe).is_file() {
            return Ok(addon_info(addon));
        }
        last_error = String::from_utf8_lossy(&output.stderr).trim().to_string();
    }
    Err(format!(
        "No se pudo descargar «{}». Revisa la conexión a Internet e inténtalo de nuevo.\n{}",
        addon.name,
        last_error.lines().last().unwrap_or_default()
    ))
}

pub fn uninstall_addon(id: &str) -> Result<AddonInfo, String> {
    let addon = find_addon(id).ok_or_else(|| format!("Complemento desconocido: {id}"))?;
    let dir = addons_dir().join(addon.id);
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|e| {
            format!("No se pudo quitar «{}» (¿se está usando ahora mismo?): {e}", addon.name)
        })?;
    }
    Ok(addon_info(addon))
}

/// Ejecuta un complemento instalado. Si se da `input`, se escribe en un archivo
/// temporal y su ruta sustituye a `{input}` en los argumentos.
pub fn run_addon(id: &str, args: &[String], input: Option<&str>) -> Result<String, String> {
    run_addon_with(id, args, input.map(|t| t.as_bytes()), "json")
}

/// Como [`run_addon`], pero con una entrada binaria (por ejemplo, una imagen)
/// que se guarda con la extensión indicada.
pub fn run_addon_with(id: &str, args: &[String], input: Option<&[u8]>, extension: &str) -> Result<String, String> {
    let addon = find_addon(id).ok_or_else(|| format!("Complemento desconocido: {id}"))?;
    let exe = addon_executable(id).ok_or_else(|| format!("El complemento «{}» no está instalado.", addon.name))?;
    let extension: String = extension.chars().filter(|c| c.is_ascii_alphanumeric()).take(8).collect();
    let input_path = std::env::temp_dir().join(format!("coffeeworks-{}-{}.{}", addon.id, crate::now_millis(), extension));
    if let Some(data) = input {
        fs::write(&input_path, data).map_err(|e| format!("No se pudo preparar el archivo temporal: {e}"))?;
    }
    let path_text = input_path.to_string_lossy().to_string();
    let args: Vec<String> = args.iter().map(|a| a.replace("{input}", &path_text)).collect();
    let mut command = Command::new(&exe);
    // Los datos que acompañan al programa (p. ej., los idiomas del OCR) van a su lado.
    if let Some(dir) = exe.parent() {
        let has_data = fs::read_dir(dir)
            .map(|entries| entries.flatten().any(|e| e.path().extension().is_some_and(|x| x == "traineddata")))
            .unwrap_or(false);
        if has_data {
            command.env("TESSDATA_PREFIX", dir);
        }
    }
    let output = hidden(command.args(&args))
        .stdin(Stdio::null())
        .output()
        .map_err(|e| format!("No se pudo ejecutar «{}»: {e}", addon.name));
    let _ = fs::remove_file(&input_path);
    let output = output?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if err.is_empty() { format!("«{}» terminó con un error.", addon.name) } else { err })
    }
}
