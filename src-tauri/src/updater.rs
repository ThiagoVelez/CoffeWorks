//! Actualizaciones automáticas de la suite.
//!
//! El Launcher consulta las versiones publicadas en GitHub
//! (`releases` de ThiagoVelez/CoffeWorks). Si hay una más nueva, descarga su
//! instalador, comprueba la suma SHA-256 publicada junto a él y lo deja listo.
//! Se instala en silencio al cerrar el Launcher (o al pulsar «Reiniciar y
//! actualizar»). Después, el Launcher actualiza las apps instaladas con los
//! paquetes nuevos (`apps::refresh_installed`).

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use semver::Version;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// Repositorio del que se descargan las actualizaciones.
const REPO: &str = "ThiagoVelez/CoffeWorks";

/// Fase de desarrollo: "alpha", "beta" o "" (versión estable). Mientras no sea
/// estable, las versiones se publican como «pre-release» y el Launcher las acepta.
pub const STAGE: &str = "alpha";

pub fn current_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

/// Nombre de la fase para mostrar ("Alpha", "Beta" o vacío).
pub fn stage_label() -> String {
    let mut chars = STAGE.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => String::new(),
    }
}

// ---------------------------------------------------------------------------
// Estado guardado
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingUpdate {
    pub version: String,
    pub installer: String,
    pub notes: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
struct UpdateState {
    /// Instalar sola la actualización descargada al cerrar el Launcher.
    auto_install: bool,
    pending: Option<PendingUpdate>,
    last_check: u64,
}

impl Default for UpdateState {
    fn default() -> Self {
        Self { auto_install: true, pending: None, last_check: 0 }
    }
}

fn state_path() -> PathBuf {
    coffee_core::data_dir().join("updates.json")
}

fn updates_dir() -> PathBuf {
    coffee_core::local_dir().join("Updates")
}

fn load_state() -> UpdateState {
    fs::read_to_string(state_path())
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

fn save_state(state: &UpdateState) {
    if let Ok(text) = serde_json::to_string_pretty(state) {
        let _ = coffee_core::write_atomic(&state_path(), text.as_bytes());
    }
}

fn parse_version(text: &str) -> Option<Version> {
    Version::parse(text.trim().trim_start_matches('v')).ok()
}

/// Al arrancar: si la actualización pendiente ya se instaló, se borra su instalador.
pub fn cleanup_after_update() {
    let mut state = load_state();
    let Some(pending) = state.pending.clone() else { return };
    let current = parse_version(current_version());
    let applied = match (parse_version(&pending.version), current) {
        (Some(p), Some(c)) => p <= c,
        _ => true,
    };
    if applied || !Path::new(&pending.installer).is_file() {
        let _ = fs::remove_dir_all(updates_dir());
        state.pending = None;
        save_state(&state);
    }
}

// ---------------------------------------------------------------------------
// Consulta de versiones
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct Release {
    pub tag_name: String,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub html_url: String,
    #[serde(default)]
    pub draft: bool,
    #[serde(default)]
    pub prerelease: bool,
    #[serde(default)]
    pub assets: Vec<Asset>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Asset {
    pub name: String,
    pub browser_download_url: String,
    #[serde(default)]
    pub size: u64,
}

/// Instalador de esta plataforma: el .exe en Windows y el paquete .deb en Linux.
pub fn is_installer(name: &str) -> bool {
    if cfg!(windows) {
        name.starts_with("CoffeeWorks-Setup") && name.ends_with(".exe")
    } else {
        name.starts_with("coffeeworks_") && name.ends_with("_amd64.deb")
    }
}

/// Linux con apt (Debian, Ubuntu y derivadas).
fn linux_supported() -> bool {
    cfg!(target_os = "linux") && Path::new("/usr/bin/dpkg").exists()
}

/// Elige la versión más nueva que tenga instalador y suma SHA-256.
pub fn choose_release(releases: &[Release], current: &str, include_prerelease: bool) -> Option<(Release, Version)> {
    let current = parse_version(current)?;
    releases
        .iter()
        .filter(|r| !r.draft && (include_prerelease || !r.prerelease))
        .filter_map(|r| {
            let version = parse_version(r.tag_name.strip_prefix('v')?)?;
            let installer = r.assets.iter().find(|a| is_installer(&a.name))?;
            let checksum = format!("{}.sha256", installer.name);
            r.assets.iter().any(|a| a.name == checksum).then(|| (r.clone(), version))
        })
        .filter(|(_, version)| *version > current)
        .max_by(|a, b| a.1.cmp(&b.1))
}

/// Estado de las actualizaciones para la interfaz.
#[derive(Debug, Clone, Serialize)]
pub struct UpdateInfo {
    pub current: String,
    pub stage: String,
    pub supported: bool,
    pub auto_install: bool,
    pub last_check: u64,
    /// Versión nueva encontrada (vacío si no hay).
    pub latest: String,
    pub notes: String,
    pub url: String,
    pub size: u64,
    /// El instalador ya está descargado y comprobado.
    pub ready: bool,
}

fn info_from_state(state: &UpdateState) -> UpdateInfo {
    let pending = state.pending.as_ref().filter(|p| Path::new(&p.installer).is_file());
    UpdateInfo {
        current: current_version().into(),
        stage: stage_label(),
        supported: cfg!(windows) || linux_supported(),
        auto_install: state.auto_install,
        last_check: state.last_check,
        latest: pending.map(|p| p.version.clone()).unwrap_or_default(),
        notes: pending.map(|p| p.notes.clone()).unwrap_or_default(),
        url: pending.map(|p| p.url.clone()).unwrap_or_default(),
        size: 0,
        ready: pending.is_some(),
    }
}

pub fn status() -> UpdateInfo {
    info_from_state(&load_state())
}

pub fn set_auto_install(enabled: bool) -> UpdateInfo {
    let mut state = load_state();
    state.auto_install = enabled;
    save_state(&state);
    info_from_state(&state)
}

fn fetch_releases() -> Result<Vec<Release>, String> {
    let temp = std::env::temp_dir().join(format!("coffeeworks-releases-{}.json", coffee_core::now_millis()));
    if !cfg!(windows) {
        coffee_core::addons::download_file(&format!("https://api.github.com/repos/{REPO}/releases?per_page=30"), &temp)?;
        let text = fs::read_to_string(&temp).map_err(|e| format!("No se pudo leer la respuesta: {e}"));
        let _ = fs::remove_file(&temp);
        return serde_json::from_str(&text?).map_err(|e| format!("Respuesta inesperada de GitHub: {e}"));
    }
    let script = format!(
        "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; \
         [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; \
         Invoke-WebRequest -UseBasicParsing -Headers @{{ 'User-Agent'='CoffeeWorks-Updater'; 'Accept'='application/vnd.github+json' }} \
         -Uri 'https://api.github.com/repos/{REPO}/releases?per_page=30' -OutFile {out}",
        out = coffee_core::addons::ps_quote(&temp.to_string_lossy())
    );
    coffee_core::addons::run_powershell(&script).map_err(|e| format!("No se pudo consultar las actualizaciones: {e}"))?;
    let text = fs::read_to_string(&temp).map_err(|e| format!("No se pudo leer la respuesta: {e}"));
    let _ = fs::remove_file(&temp);
    serde_json::from_str(&text?).map_err(|e| format!("Respuesta inesperada de GitHub: {e}"))
}

/// Busca una versión nueva. Si la encuentra, la descarga y la deja lista.
pub fn check_and_download() -> Result<UpdateInfo, String> {
    if !cfg!(windows) && !linux_supported() {
        return Err("Las actualizaciones automáticas están disponibles en Windows y en Linux con apt (Debian y Ubuntu).".into());
    }
    let mut state = load_state();
    let releases = fetch_releases()?;
    state.last_check = coffee_core::now_millis();
    let Some((release, version)) = choose_release(&releases, current_version(), !STAGE.is_empty()) else {
        state.pending = None;
        save_state(&state);
        return Ok(info_from_state(&state));
    };
    let version_text = version.to_string();
    if state.pending.as_ref().is_some_and(|p| p.version == version_text && Path::new(&p.installer).is_file()) {
        save_state(&state);
        return Ok(info_from_state(&state));
    }

    let installer = release
        .assets
        .iter()
        .find(|a| is_installer(&a.name))
        .ok_or("La versión publicada no tiene instalador para este sistema.")?;
    let checksum = release
        .assets
        .iter()
        .find(|a| a.name == format!("{}.sha256", installer.name))
        .ok_or("La versión publicada no tiene suma de comprobación.")?;

    let dir = updates_dir();
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).map_err(|e| format!("No se pudo preparar la carpeta de descargas: {e}"))?;
    let exe_path = dir.join(&installer.name);
    let sum_path = dir.join(&checksum.name);
    coffee_core::addons::download_file(&installer.browser_download_url, &exe_path)?;
    coffee_core::addons::download_file(&checksum.browser_download_url, &sum_path)?;

    let expected = fs::read_to_string(&sum_path)
        .ok()
        .and_then(|t| t.split_whitespace().next().map(|s| s.to_ascii_lowercase()))
        .ok_or("La suma de comprobación no es válida.")?;
    let bytes = fs::read(&exe_path).map_err(|e| format!("No se pudo leer la descarga: {e}"))?;
    let actual = Sha256::digest(&bytes).iter().map(|b| format!("{b:02x}")).collect::<String>();
    if actual != expected {
        let _ = fs::remove_dir_all(&dir);
        return Err("La descarga de la actualización está dañada (la suma SHA-256 no coincide). Se volverá a intentar más tarde.".into());
    }

    state.pending = Some(PendingUpdate {
        version: version_text,
        installer: exe_path.to_string_lossy().to_string(),
        notes: release.body.clone().unwrap_or_default(),
        url: release.html_url.clone(),
    });
    save_state(&state);
    let mut info = info_from_state(&state);
    info.size = installer.size;
    Ok(info)
}

// ---------------------------------------------------------------------------
// Instalación
// ---------------------------------------------------------------------------

fn launcher_dir() -> PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(Path::to_path_buf))
        .unwrap_or_else(|| PathBuf::from("."))
}

/// Lanza el instalador descargado en modo silencioso. Con `relaunch`, el
/// instalador vuelve a abrir el Launcher al terminar.
fn launch_installer(pending: &PendingUpdate, relaunch: bool) -> Result<(), String> {
    if !Path::new(&pending.installer).is_file() {
        return Err("No se encuentra la actualización descargada.".into());
    }
    if !cfg!(windows) {
        // Linux: apt instala el paquete (pkexec pide la contraseña) y se vuelve a abrir el Launcher
        let deb = pending.installer.clone();
        let exe = std::env::current_exe().ok();
        std::thread::spawn(move || {
            let ok = Command::new("pkexec").args(["apt-get", "install", "-y", "--allow-downgrades"]).arg(&deb).status().map(|s| s.success()).unwrap_or(false);
            if !ok {
                // Sin pkexec (o cancelado): se abre con el instalador de software del sistema
                let _ = Command::new("xdg-open").arg(&deb).spawn();
                return;
            }
            if relaunch {
                if let Some(exe) = exe {
                    let _ = Command::new(exe).spawn();
                }
                std::process::exit(0);
            }
        });
        return Ok(());
    }
    Command::new(&pending.installer)
        .args([
            "/VERYSILENT".to_string(),
            "/SUPPRESSMSGBOXES".to_string(),
            "/NORESTART".to_string(),
            format!("/DIR={}", launcher_dir().to_string_lossy()),
            format!("/AUTOUPDATE={}", if relaunch { 1 } else { 0 }),
        ])
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("No se pudo iniciar la actualización: {e}"))
}

/// «Reiniciar y actualizar»: instala ahora y vuelve a abrir el Launcher.
pub fn apply_now() -> Result<(), String> {
    let state = load_state();
    let pending = state.pending.as_ref().ok_or("No hay ninguna actualización descargada.")?;
    launch_installer(pending, true)
}

/// Al cerrar el Launcher: si hay una actualización lista y la instalación
/// automática está activada, se instala en silencio.
pub fn apply_on_exit() {
    let state = load_state();
    if !state.auto_install || !cfg!(windows) {
        return;
    }
    if let Some(pending) = state.pending.as_ref() {
        let _ = launch_installer(pending, false);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn release(tag: &str, prerelease: bool, with_assets: bool) -> Release {
        let version = tag.trim_start_matches('v');
        let assets = if with_assets {
            vec![
                Asset { name: format!("CoffeeWorks-Setup-{version}.exe"), browser_download_url: String::new(), size: 1 },
                Asset { name: format!("CoffeeWorks-Setup-{version}.exe.sha256"), browser_download_url: String::new(), size: 1 },
                Asset { name: format!("coffeeworks_{version}_amd64.deb"), browser_download_url: String::new(), size: 1 },
                Asset { name: format!("coffeeworks_{version}_amd64.deb.sha256"), browser_download_url: String::new(), size: 1 },
            ]
        } else {
            vec![]
        };
        Release { tag_name: tag.into(), body: None, html_url: String::new(), draft: false, prerelease, assets }
    }

    #[test]
    fn elige_la_version_mas_nueva_con_instalador() {
        let releases = vec![
            release("addons", false, false),
            release("v2.6.0", true, true),
            release("v2.8.0", true, false),
            release("v2.7.1", true, true),
            release("v2.7.0", true, true),
        ];
        let (r, v) = choose_release(&releases, "2.6.0", true).unwrap();
        assert_eq!(r.tag_name, "v2.7.1");
        assert_eq!(v.to_string(), "2.7.1");
        assert!(choose_release(&releases, "2.7.1", true).is_none());
        assert!(choose_release(&releases, "2.6.0", false).is_none());
    }
}
