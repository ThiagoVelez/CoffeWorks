// CoffeeEdit: editor de video de la suite CoffeeWorks.
// Evita abrir una consola en las versiones de producción para Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod media;

fn main() {
    // Si la suite se actualizó desde «CoffeWorks», las carpetas pasan al nombre nuevo
    coffee_core::migrate_legacy_dirs();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(media::Writers::default())
        .invoke_handler(coffee_core::editor_handler!(
            media::cams_videos_dir,
            media::cams_file_open,
            media::cams_file_append,
            media::cams_file_close,
        ))
        .run(tauri::generate_context!())
        .expect("Error al iniciar CoffeeEdit");
}
