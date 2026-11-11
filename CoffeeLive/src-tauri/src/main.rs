// CoffeeLive: grabación de pantalla y transmisión en directo de la suite
// CoffeeWorks. Evita abrir una consola en las versiones de producción para Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod media;

use tauri::Manager;

fn main() {
    // Si la suite se actualizó desde «CoffeWorks», las carpetas pasan al nombre nuevo
    coffee_core::migrate_legacy_dirs();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        // Atajos de teclado que funcionan aunque la ventana no esté activa
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(media::Writers::default())
        .manage(media::Streams::default())
        .invoke_handler(coffee_core::editor_handler!(
            media::cams_videos_dir,
            media::cams_file_open,
            media::cams_file_append,
            media::cams_file_close,
            media::cams_ffmpeg_status,
            media::cams_ffmpeg_install,
            media::cams_stream_start,
            media::cams_stream_write,
            media::cams_stream_stop,
            media::live_pick_folder,
            media::live_open_in_editor,
        ))
        .build(tauri::generate_context!())
        .expect("Error al iniciar CoffeeLive")
        .run(|app, event| {
            // Una transmisión en curso no debe quedar huérfana al cerrar
            if let tauri::RunEvent::Exit = event {
                app.state::<media::Streams>().kill();
            }
        });
}
