//! Diccionarios del corrector ortográfico (Hunspell) compartidos por las apps.
//!
//! El instalador deja los diccionarios en `packages\dictionaries`; el Launcher
//! los copia a `%LOCALAPPDATA%\CoffeeWorks\Dictionaries` y de ahí los leen
//! todas las aplicaciones. Las palabras añadidas por el usuario se guardan en
//! `%APPDATA%\CoffeeWorks\diccionario-usuario.txt`.

use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::{data_dir, local_dir, write_atomic};

pub const LANGUAGES: &[&str] = &["es", "en"];

pub fn dictionaries_dir() -> PathBuf {
    local_dir().join("Dictionaries")
}

fn exe_dir() -> Option<PathBuf> {
    std::env::current_exe().ok().and_then(|e| e.parent().map(Path::to_path_buf))
}

/// Carpetas donde se buscan los diccionarios, en orden.
fn candidates() -> Vec<PathBuf> {
    let mut out = vec![dictionaries_dir()];
    if let Some(dir) = exe_dir() {
        out.push(dir.join("dictionaries"));
        out.push(dir.join("packages").join("dictionaries"));
    }
    // Compilaciones de desarrollo: la carpeta del repositorio
    out.push(Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join("..").join("dictionaries"));
    out
}

#[derive(Debug, Clone, Serialize)]
pub struct Dictionary {
    pub aff: String,
    pub dic: String,
}

pub fn load_dictionary(lang: &str) -> Result<Dictionary, String> {
    if !LANGUAGES.contains(&lang) {
        return Err(format!("Idioma no disponible: {lang}"));
    }
    for dir in candidates() {
        let aff = dir.join(format!("{lang}.aff"));
        let dic = dir.join(format!("{lang}.dic"));
        if aff.is_file() && dic.is_file() {
            let read = |p: &Path| fs::read_to_string(p).map_err(|e| format!("No se pudo leer {}: {e}", p.display()));
            return Ok(Dictionary { aff: read(&aff)?, dic: read(&dic)? });
        }
    }
    Err("No se encontraron los diccionarios. Reinstala CoffeeWorks para restaurarlos.".into())
}

/// Copia los diccionarios del paquete a la carpeta común (si cambiaron).
pub fn sync_dictionaries(source: &Path) {
    if !source.is_dir() {
        return;
    }
    let target = dictionaries_dir();
    if fs::create_dir_all(&target).is_err() {
        return;
    }
    if let Ok(entries) = fs::read_dir(source) {
        for entry in entries.flatten() {
            let from = entry.path();
            if !from.is_file() {
                continue;
            }
            let to = target.join(entry.file_name());
            let same = match (fs::metadata(&from), fs::metadata(&to)) {
                (Ok(a), Ok(b)) => a.len() == b.len() && a.modified().ok() <= b.modified().ok(),
                _ => false,
            };
            if !same {
                let _ = fs::copy(&from, &to);
            }
        }
    }
}

fn user_words_path() -> PathBuf {
    data_dir().join("diccionario-usuario.txt")
}

pub fn user_words() -> Vec<String> {
    fs::read_to_string(user_words_path())
        .map(|t| t.lines().map(|l| l.trim().to_string()).filter(|l| !l.is_empty()).collect())
        .unwrap_or_default()
}

pub fn add_user_word(word: &str) -> Result<Vec<String>, String> {
    let word = word.trim();
    if word.is_empty() || word.contains(char::is_whitespace) {
        return Err("La palabra no es válida.".into());
    }
    let mut words = user_words();
    if !words.iter().any(|w| w == word) {
        words.push(word.to_string());
        words.sort_by_key(|w| w.to_lowercase());
        write_atomic(&user_words_path(), (words.join("\n") + "\n").as_bytes()).map_err(|e| format!("No se pudo guardar el diccionario: {e}"))?;
    }
    Ok(words)
}

pub fn remove_user_word(word: &str) -> Result<Vec<String>, String> {
    let words: Vec<String> = user_words().into_iter().filter(|w| w != word.trim()).collect();
    write_atomic(&user_words_path(), (words.join("\n") + "\n").as_bytes()).map_err(|e| format!("No se pudo guardar el diccionario: {e}"))?;
    Ok(words)
}
