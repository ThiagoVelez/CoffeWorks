// CoffePDF: editor de la suite CoffeWorks empaquetado como aplicación de escritorio.
// Evita abrir una consola en las versiones de producción para Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(coffe_core::editor_handler!())
        .run(tauri::generate_context!())
        .expect("Error al iniciar CoffePDF");
}
