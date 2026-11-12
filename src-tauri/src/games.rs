//! CoffeeWorks Games: instalar, abrir, actualizar y desinstalar los juegos.
//!
//! Cada juego publica en su repositorio de GitHub un `manifest.json` con la
//! versión y, por plataforma, el archivo, su tamaño y su SHA-256. El Launcher lo
//! lee de `releases/latest/download/manifest.json`, descarga el paquete, comprueba
//! el SHA-256 y lo instala en `<datos locales>/CoffeeWorks/Games/<id>`.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// Juego del catálogo.
pub struct CatalogGame {
    pub id: &'static str,
    pub name: &'static str,
    /// Repositorio `dueño/nombre` donde se publican las versiones.
    pub repo: &'static str,
}

pub const GAMES: &[CatalogGame] = &[CatalogGame { id: "survivalforest", name: "SurvivalForest", repo: "ThiagoVelez/juego-rust" }];

#[derive(Deserialize, Serialize, Debug, Clone, PartialEq)]
pub struct PlatformFile {
    pub file: String,
    pub url: String,
    pub size: u64,
    pub sha256: String,
    pub exe: String,
}

#[derive(Deserialize, Serialize, Debug, Clone, PartialEq)]
pub struct GameManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub stage: String,
    pub platforms: HashMap<String, PlatformFile>,
}

pub fn find_game(id: &str) -> Option<&'static CatalogGame> {
    GAMES.iter().find(|g| g.id == id)
}

/// Carpeta de los juegos: `<datos locales>/CoffeeWorks/Games`.
pub fn games_dir() -> PathBuf {
    coffee_core::local_dir().join("Games")
}

pub fn platform_key() -> &'static str {
    if cfg!(windows) { "windows-x64" } else { "linux-x64" }
}

pub fn parse_manifest(text: &str) -> Result<GameManifest, String> {
    serde_json::from_str(text).map_err(|e| format!("El manifiesto del juego no es válido: {e}"))
}

pub fn platform_file(m: &GameManifest) -> Result<&PlatformFile, String> {
    m.platforms.get(platform_key()).ok_or_else(|| format!("{} todavía no está disponible para este sistema.", m.name))
}

/// ¿`a` es una versión más nueva que `b`?
pub fn is_newer(a: &str, b: &str) -> bool {
    match (semver::Version::parse(a), semver::Version::parse(b)) {
        (Ok(a), Ok(b)) => a > b,
        _ => a != b,
    }
}

/// Solo se descargan archivos publicados en el repositorio del propio juego.
pub fn check_urls(game: &CatalogGame, m: &GameManifest) -> Result<(), String> {
    let prefix = format!("https://github.com/{}/releases/download/", game.repo);
    for p in m.platforms.values() {
        if !p.url.starts_with(&prefix) || p.exe.contains(['/', '\\']) || p.exe.contains("..") {
            return Err(format!("El manifiesto de {} apunta a un archivo no permitido.", game.name));
        }
    }
    Ok(())
}

pub fn verify_sha256(path: &Path, expected: &str) -> Result<(), String> {
    use sha2::{Digest, Sha256};
    let bytes = std::fs::read(path).map_err(|e| format!("No se pudo leer la descarga: {e}"))?;
    let actual: String = Sha256::digest(&bytes).iter().map(|b| format!("{b:02x}")).collect();
    if actual.eq_ignore_ascii_case(expected.trim()) {
        Ok(())
    } else {
        Err("La descarga está dañada (el SHA-256 no coincide). Vuelve a intentarlo.".into())
    }
}

#[derive(Serialize, Deserialize)]
struct Installed {
    version: String,
    #[serde(default)]
    exe: String,
}

fn read_installed(root: &Path, id: &str) -> Option<Installed> {
    let text = std::fs::read_to_string(root.join(id).join("coffeeworks-game.json")).ok()?;
    serde_json::from_str(&text).ok()
}

pub fn installed_version(root: &Path, id: &str) -> Option<String> {
    read_installed(root, id).map(|i| i.version)
}

fn extract(archive: &Path, dest: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dest).map_err(|e| format!("No se pudo crear la carpeta del juego: {e}"))?;
    if cfg!(windows) {
        let script = format!(
            "$ErrorActionPreference='Stop'; Expand-Archive -Path {} -DestinationPath {} -Force",
            coffee_core::addons::ps_quote(&archive.to_string_lossy()),
            coffee_core::addons::ps_quote(&dest.to_string_lossy())
        );
        coffee_core::addons::run_powershell(&script).map(|_| ()).map_err(|e| format!("No se pudo descomprimir el juego: {e}"))
    } else {
        let out = std::process::Command::new("tar")
            .arg("-xzf")
            .arg(archive)
            .arg("-C")
            .arg(dest)
            .output()
            .map_err(|e| format!("No se pudo ejecutar tar: {e}"))?;
        if out.status.success() {
            Ok(())
        } else {
            Err(format!("No se pudo descomprimir el juego: {}", String::from_utf8_lossy(&out.stderr).trim()))
        }
    }
}

/// Instala (o actualiza) desde un paquete ya descargado y verificado.
/// Se descomprime aparte y solo se reemplaza lo instalado si el paquete trae el ejecutable.
pub fn install_from_archive(root: &Path, id: &str, version: &str, archive: &Path, exe: &str) -> Result<PathBuf, String> {
    let target = root.join(id);
    let staging = root.join(format!(".{id}.nuevo"));
    let _ = std::fs::remove_dir_all(&staging);
    extract(archive, &staging)?;
    let exe_path = staging.join(exe);
    if !exe_path.is_file() {
        let _ = std::fs::remove_dir_all(&staging);
        return Err(format!("El paquete no contiene {exe}."));
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&exe_path, std::fs::Permissions::from_mode(0o755));
    }
    let text = serde_json::to_string(&Installed { version: version.to_string(), exe: exe.to_string() }).map_err(|e| e.to_string())?;
    std::fs::write(staging.join("coffeeworks-game.json"), text).map_err(|e| format!("No se pudo guardar la versión: {e}"))?;
    if target.exists() {
        std::fs::remove_dir_all(&target).map_err(|e| format!("No se pudo reemplazar la versión anterior (¿el juego está abierto?): {e}"))?;
    }
    std::fs::rename(&staging, &target).map_err(|e| format!("No se pudo instalar el juego: {e}"))?;
    Ok(target.join(exe))
}

pub fn uninstall_from(root: &Path, id: &str) -> Result<(), String> {
    let dir = root.join(id);
    if dir.exists() {
        std::fs::remove_dir_all(&dir).map_err(|e| format!("No se pudo desinstalar (¿el juego está abierto?): {e}"))?;
    }
    Ok(())
}

/// Descarga y lee el manifiesto más reciente del juego.
pub fn fetch_manifest(game: &CatalogGame) -> Result<GameManifest, String> {
    let url = format!("https://github.com/{}/releases/latest/download/manifest.json", game.repo);
    let tmp = std::env::temp_dir().join(format!("coffeeworks-{}-manifest.json", game.id));
    coffee_core::addons::download_file(&url, &tmp)
        .map_err(|_| format!("No se pudo consultar {}. Comprueba tu conexión a internet.", game.name))?;
    let text = std::fs::read_to_string(&tmp).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&tmp);
    let m = parse_manifest(&text)?;
    check_urls(game, &m)?;
    Ok(m)
}

#[derive(Serialize, Clone, Debug)]
pub struct GameStatus {
    pub id: String,
    pub installed: Option<String>,
    pub latest: Option<String>,
    pub stage: Option<String>,
    /// Tamaño de la descarga en bytes.
    pub size: Option<u64>,
    pub update_available: bool,
    /// Mensaje si no se pudo consultar la versión más reciente.
    pub error: Option<String>,
}

pub fn status(id: &str, online: bool) -> Result<GameStatus, String> {
    let game = find_game(id).ok_or_else(|| format!("Juego desconocido: {id}"))?;
    let installed = installed_version(&games_dir(), id);
    let mut st = GameStatus { id: id.into(), installed, latest: None, stage: None, size: None, update_available: false, error: None };
    if online {
        match fetch_manifest(game) {
            Ok(m) => {
                st.size = platform_file(&m).ok().map(|p| p.size);
                st.update_available = st.installed.as_deref().is_some_and(|v| is_newer(&m.version, v));
                st.latest = Some(m.version);
                st.stage = Some(m.stage);
            }
            Err(e) => st.error = Some(e),
        }
    }
    Ok(st)
}

/// Instala o actualiza a la última versión.
pub fn install(id: &str) -> Result<GameStatus, String> {
    let game = find_game(id).ok_or_else(|| format!("Juego desconocido: {id}"))?;
    let m = fetch_manifest(game)?;
    let p = platform_file(&m)?.clone();
    let root = games_dir();
    std::fs::create_dir_all(&root).map_err(|e| format!("No se pudo crear la carpeta de juegos: {e}"))?;
    let tmp = std::env::temp_dir().join(&p.file);
    coffee_core::addons::download_file(&p.url, &tmp)?;
    let checked = verify_sha256(&tmp, &p.sha256);
    let installed = checked.and_then(|_| install_from_archive(&root, id, &m.version, &tmp, &p.exe));
    let _ = std::fs::remove_file(&tmp);
    let exe = installed?;
    crate::platform::create_shortcut(game.name, &exe, &format!("{} (CoffeeWorks Games)", game.name));
    status(id, false).map(|mut s| {
        s.latest = Some(m.version);
        s.stage = Some(m.stage);
        s
    })
}

pub fn uninstall(id: &str) -> Result<(), String> {
    let game = find_game(id).ok_or_else(|| format!("Juego desconocido: {id}"))?;
    uninstall_from(&games_dir(), id)?;
    crate::platform::remove_shortcut(game.name);
    Ok(())
}

pub fn launch(id: &str) -> Result<(), String> {
    let game = find_game(id).ok_or_else(|| format!("Juego desconocido: {id}"))?;
    let dir = games_dir().join(id);
    let name = read_installed(&games_dir(), id).map(|i| i.exe).filter(|e| !e.is_empty()).unwrap_or_else(|| {
        if cfg!(windows) { format!("{id}.exe") } else { id.to_string() }
    });
    let exe = dir.join(name);
    if !exe.is_file() {
        return Err(format!("{} no está instalado.", game.name));
    }
    std::process::Command::new(&exe)
        .current_dir(&dir)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("No se pudo abrir {}: {e}", game.name))
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"{
      "id": "survivalforest", "name": "SurvivalForest", "version": "0.2.0", "stage": "Etapa 1 (mundo)",
      "platforms": {
        "linux-x64": {"file": "survivalforest-0.2.0-linux-x64.tar.gz",
          "url": "https://github.com/ThiagoVelez/juego-rust/releases/download/v0.2.0/survivalforest-0.2.0-linux-x64.tar.gz",
          "size": 10, "sha256": "aa", "exe": "survivalforest"},
        "windows-x64": {"file": "survivalforest-0.2.0-windows-x64.zip",
          "url": "https://github.com/ThiagoVelez/juego-rust/releases/download/v0.2.0/survivalforest-0.2.0-windows-x64.zip",
          "size": 10, "sha256": "bb", "exe": "survivalforest.exe"}
      }
    }"#;

    #[test]
    fn parses_manifest_and_picks_platform() {
        let m = parse_manifest(SAMPLE).unwrap();
        assert_eq!(m.version, "0.2.0");
        let p = platform_file(&m).unwrap();
        assert_eq!(p.exe, if cfg!(windows) { "survivalforest.exe" } else { "survivalforest" });
        assert!(parse_manifest("{nope").is_err());
    }

    #[test]
    fn version_comparison() {
        assert!(is_newer("0.10.0", "0.9.3"));
        assert!(is_newer("1.0.0", "0.99.99"));
        assert!(!is_newer("0.2.0", "0.2.0"));
        assert!(!is_newer("0.1.9", "0.2.0"));
    }

    #[test]
    fn only_downloads_from_the_game_repo() {
        let game = &GAMES[0];
        let mut m = parse_manifest(SAMPLE).unwrap();
        assert!(check_urls(game, &m).is_ok());
        m.platforms.get_mut(platform_key()).unwrap().url = "https://evil.example/x.zip".into();
        assert!(check_urls(game, &m).is_err());
    }

    #[test]
    fn sha256_mismatch_is_rejected() {
        let d = tempfile::tempdir().unwrap();
        let f = d.path().join("a.bin");
        std::fs::write(&f, b"abc").unwrap();
        assert!(verify_sha256(&f, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad").is_ok());
        assert!(verify_sha256(&f, "00").is_err());
    }

    #[cfg(unix)]
    #[test]
    fn installs_and_updates_from_archive() {
        let d = tempfile::tempdir().unwrap();
        let src = d.path().join("src");
        std::fs::create_dir_all(src.join("assets")).unwrap();
        std::fs::write(src.join("survivalforest"), b"#!/bin/sh\necho hola\n").unwrap();
        std::fs::write(src.join("assets").join("a.txt"), b"x").unwrap();
        let tgz = d.path().join("p.tar.gz");
        let ok = std::process::Command::new("tar").arg("-czf").arg(&tgz).arg("-C").arg(&src).arg(".").status().unwrap();
        assert!(ok.success());
        let root = d.path().join("Games");
        install_from_archive(&root, "survivalforest", "0.1.0", &tgz, "survivalforest").unwrap();
        let exe = root.join("survivalforest").join("survivalforest");
        assert!(exe.exists());
        assert_eq!(installed_version(&root, "survivalforest").as_deref(), Some("0.1.0"));
        use std::os::unix::fs::PermissionsExt;
        assert!(std::fs::metadata(&exe).unwrap().permissions().mode() & 0o111 != 0, "ejecutable");
        // Actualizar reemplaza la carpeta completa y no deja restos.
        std::fs::write(root.join("survivalforest").join("viejo.txt"), b"x").unwrap();
        install_from_archive(&root, "survivalforest", "0.2.0", &tgz, "survivalforest").unwrap();
        assert_eq!(installed_version(&root, "survivalforest").as_deref(), Some("0.2.0"));
        assert!(!root.join("survivalforest").join("viejo.txt").exists());
        // Un paquete sin el ejecutable no rompe lo instalado.
        let bad = d.path().join("bad.tar.gz");
        std::process::Command::new("tar").arg("-czf").arg(&bad).arg("-C").arg(src.join("assets")).arg(".").status().unwrap();
        assert!(install_from_archive(&root, "survivalforest", "0.3.0", &bad, "survivalforest").is_err());
        assert_eq!(installed_version(&root, "survivalforest").as_deref(), Some("0.2.0"));
        uninstall_from(&root, "survivalforest").unwrap();
        assert!(installed_version(&root, "survivalforest").is_none());
    }
}
