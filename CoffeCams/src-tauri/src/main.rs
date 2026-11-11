// CoffeCams: editor de video, grabador de pantalla y transmisión en directo
// de la suite CoffeWorks.
// Evita abrir una consola en las versiones de producción para Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod media;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(media::Writers::default())
        .manage(media::Streams::default())
        .invoke_handler(coffe_core::editor_handler!(
            media::cams_videos_dir,
            media::cams_file_open,
            media::cams_file_append,
            media::cams_file_close,
            media::cams_ffmpeg_status,
            media::cams_ffmpeg_install,
            media::cams_stream_start,
            media::cams_stream_write,
            media::cams_stream_stop,
        ))
        .build(tauri::generate_context!())
        .expect("Error al iniciar CoffeCams")
        .run(|app, event| {
            // Una transmisión en curso no debe quedar huérfana al cerrar
            if let tauri::RunEvent::Exit = event {
                app.state::<media::Streams>().kill();
            }
        });
}
