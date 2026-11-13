// CoffeeAnimate3D: aplicación de la suite CoffeeWorks empaquetada para escritorio.
// Evita abrir una consola en las versiones de producción para Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    coffee_core::migrate_legacy_dirs();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(coffee_core::editor_handler!())
        .run(tauri::generate_context!())
        .expect("Error al iniciar CoffeeAnimate3D");
}
