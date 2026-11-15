// CoffeeConvert: conversión de documentos de la suite CoffeeWorks, como app de escritorio.
// Evita abrir una consola en las versiones de producción para Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::Engine as _;
use std::process::{Command, Stdio};

/// Word, Excel, PowerPoint, OpenDocument, RTF o EPUB → PDF con LibreOffice (complemento
/// «Motor de conversión»). Recibe y devuelve el archivo en base64.
#[tauri::command]
async fn office_to_pdf(file_name: String, data: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || convert(&file_name, &data))
        .await
        .map_err(|e| format!("La conversión se interrumpió: {e}"))?
}

fn convert(file_name: &str, data: &str) -> Result<String, String> {
    let soffice = coffee_core::addons::addon_executable("officeconv")
        .ok_or("Instala el complemento «Motor de conversión (LibreOffice)» desde el Launcher › Complementos.")?;
    let ext: String = std::path::Path::new(file_name)
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .take(5)
        .collect();
    if ext.is_empty() {
        return Err("El archivo no tiene extensión".into());
    }
    let bytes = base64::engine::general_purpose::STANDARD.decode(data).map_err(|e| e.to_string())?;
    let dir = std::env::temp_dir().join(format!("coffeeconvert-{}", coffee_core::now_millis()));
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let input = dir.join(format!("documento.{ext}"));
    std::fs::write(&input, bytes).map_err(|e| e.to_string())?;
    // Perfil propio: no choca con un LibreOffice que el usuario tenga abierto.
    let profile = format!("-env:UserInstallation=file:///{}", dir.join("perfil").to_string_lossy().replace('\\', "/").trim_start_matches('/'));
    let mut cmd = Command::new(&soffice);
    cmd.args([profile.as_str(), "--headless", "--norestore", "--convert-to", "pdf", "--outdir"])
        .arg(&dir)
        .arg(&input)
        .stdin(Stdio::null());
    let out = coffee_core::addons::hidden(&mut cmd).output().map_err(|e| format!("No se pudo ejecutar LibreOffice: {e}"));
    let pdf = dir.join("documento.pdf");
    let result = match out {
        Ok(_) if pdf.is_file() => std::fs::read(&pdf).map(|b| base64::engine::general_purpose::STANDARD.encode(b)).map_err(|e| e.to_string()),
        Ok(o) => Err(format!("LibreOffice no pudo convertir el archivo. {}", String::from_utf8_lossy(&o.stderr).trim())),
        Err(e) => Err(e),
    };
    let _ = std::fs::remove_dir_all(&dir);
    result
}

fn main() {
    coffee_core::migrate_legacy_dirs();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(coffee_core::editor_handler!(office_to_pdf))
        .run(tauri::generate_context!())
        .expect("Error al iniciar CoffeeConvert");
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Solo si hay LibreOffice en el equipo (en CI de Linux se instala aparte).
    #[test]
    fn convierte_un_documento_con_libreoffice() {
        if coffee_core::addons::addon_executable("officeconv").is_none() {
            eprintln!("LibreOffice no está instalado: se omite");
            return;
        }
        let txt = base64::engine::general_purpose::STANDARD.encode("Hola, café y ñandú\nSegunda línea");
        let pdf = base64::engine::general_purpose::STANDARD.decode(convert("nota.txt", &txt).expect("convierte")).unwrap();
        assert!(pdf.starts_with(b"%PDF"));
    }

    #[test]
    fn sin_extension_da_error() {
        assert!(convert("sinextension", "AAAA").is_err() || coffee_core::addons::addon_executable("officeconv").is_none());
    }
}
