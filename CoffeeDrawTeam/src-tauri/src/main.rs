// CoffeeDrawTeam: tablero en equipo de la suite CoffeeWorks, como app de escritorio.
// Evita abrir una consola en las versiones de producción para Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod red;

use base64::Engine as _;
use red::cifrado::{etiqueta_sala, ClaveSala};
use red::par::{EventoRed, Nodo, STUN_PUBLICOS};
use red::senal::{RelesNostr, Senalizacion};
use serde_json::json;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::{mpsc, Mutex};

/// La conexión de esta ventana (una sola a la vez: un tablero compartido).
#[derive(Default)]
struct Red {
    nodo: Mutex<Option<Arc<Nodo>>>,
    reles: Mutex<Vec<Arc<RelesNostr>>>,
}

fn b64() -> base64::engine::GeneralPurpose {
    base64::engine::general_purpose::STANDARD
}

async fn reles_de(sala: &str) -> Result<Arc<RelesNostr>, String> {
    RelesNostr::conectar(&etiqueta_sala(sala)).await.map(Arc::new)
}

fn stun() -> Vec<String> {
    STUN_PUBLICOS.iter().map(|s| s.to_string()).collect()
}

/// Reenvía los eventos de la red a la interfaz.
fn reenviar(app: AppHandle, mut rx: mpsc::UnboundedReceiver<EventoRed>) {
    tauri::async_runtime::spawn(async move {
        while let Some(e) = rx.recv().await {
            let _ = match e {
                EventoRed::Entra(peer) => app.emit("red:entra", json!({ "peer": peer })),
                EventoRed::Sale(peer) => app.emit("red:sale", json!({ "peer": peer })),
                EventoRed::Dato(peer, datos) => app.emit("red:dato", json!({ "peer": peer, "datos": b64().encode(datos) })),
                EventoRed::Estado(estado, mensaje) => app.emit("red:estado", json!({ "estado": estado, "mensaje": mensaje })),
            };
        }
    });
}

async fn cerrar_red(red: &Red) {
    if let Some(n) = red.nodo.lock().await.take() {
        n.cerrar().await;
    }
    for r in red.reles.lock().await.drain(..) {
        r.cerrar().await;
    }
}

#[tauri::command]
async fn red_anfitrion(app: AppHandle, red: State<'_, Red>, sala: String, clave: String) -> Result<String, String> {
    cerrar_red(&red).await;
    let clave = ClaveSala::desde_link(&clave)?;
    let reles = reles_de(&sala).await?;
    let (nodo, rx) = Nodo::anfitrion(reles.clone() as Arc<dyn Senalizacion>, clave, stun()).await;
    let id = nodo.id().to_string();
    reenviar(app, rx);
    *red.nodo.lock().await = Some(Arc::new(nodo));
    red.reles.lock().await.push(reles);
    Ok(id)
}

#[tauri::command]
async fn red_unirse(app: AppHandle, red: State<'_, Red>, sala: String, clave: String) -> Result<String, String> {
    cerrar_red(&red).await;
    let clave = ClaveSala::desde_link(&clave)?;
    let reles = reles_de(&sala).await?;
    let (nodo, rx) = Nodo::invitado(reles.clone() as Arc<dyn Senalizacion>, clave, stun()).await?;
    let id = nodo.id().to_string();
    reenviar(app, rx);
    *red.nodo.lock().await = Some(Arc::new(nodo));
    red.reles.lock().await.push(reles);
    Ok(id)
}

#[tauri::command]
async fn red_enviar(red: State<'_, Red>, destino: Option<String>, datos: String) -> Result<(), String> {
    let datos = b64().decode(datos).map_err(|_| "Datos no válidos".to_string())?;
    let nodo = red.nodo.lock().await.clone();
    if let Some(n) = nodo {
        n.enviar(destino.as_deref(), &datos).await;
    }
    Ok(())
}

#[tauri::command]
async fn red_cortar(red: State<'_, Red>, peer: String) -> Result<(), String> {
    let nodo = red.nodo.lock().await.clone();
    if let Some(n) = nodo {
        n.cortar(&peer).await;
    }
    Ok(())
}

#[tauri::command]
async fn red_cambiar_sala(red: State<'_, Red>, sala: String, clave: String) -> Result<(), String> {
    let clave = ClaveSala::desde_link(&clave)?;
    let nodo = red.nodo.lock().await.clone().ok_or("No hay un tablero compartido")?;
    let reles = reles_de(&sala).await?;
    nodo.cambiar_sala(reles.clone() as Arc<dyn Senalizacion>, clave).await;
    // Deja de escuchar en la sala vieja.
    let viejos: Vec<_> = std::mem::replace(&mut *red.reles.lock().await, vec![reles]);
    for r in viejos {
        r.cerrar().await;
    }
    Ok(())
}

#[tauri::command]
async fn red_cerrar(red: State<'_, Red>) -> Result<(), String> {
    cerrar_red(&red).await;
    Ok(())
}

/// `CoffeeDrawTeam --probar-red`: crea una sala con los relés reales, se une a sí mismo
/// como invitado e intercambia un mensaje. Escribe «red OK» o el error.
fn probar_red() -> i32 {
    let rt = tokio::runtime::Runtime::new().expect("runtime");
    rt.block_on(async {
        let mut b = [0u8; 16];
        rand::RngCore::fill_bytes(&mut rand::thread_rng(), &mut b);
        let sala = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(b);
        rand::RngCore::fill_bytes(&mut rand::thread_rng(), &mut b);
        let clave_txt = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(b);
        let prueba = async {
            let clave = ClaveSala::desde_link(&clave_txt)?;
            let ra = reles_de(&sala).await?;
            let ri = reles_de(&sala).await?;
            let (anf, mut ea) = Nodo::anfitrion(ra as Arc<dyn Senalizacion>, clave.clone(), stun()).await;
            let (inv, _ei) = Nodo::invitado(ri as Arc<dyn Senalizacion>, clave, stun()).await?;
            loop {
                match ea.recv().await {
                    Some(EventoRed::Entra(_)) => break,
                    Some(_) => {}
                    None => return Err("la red se cerró".to_string()),
                }
            }
            inv.enviar(None, b"hola").await;
            loop {
                match ea.recv().await {
                    Some(EventoRed::Dato(_, d)) if d == b"hola" => break,
                    Some(_) => {}
                    None => return Err("la red se cerró".to_string()),
                }
            }
            anf.cerrar().await;
            inv.cerrar().await;
            Ok::<_, String>(())
        };
        match tokio::time::timeout(std::time::Duration::from_secs(40), prueba).await {
            Ok(Ok(())) => {
                println!("red OK");
                0
            }
            Ok(Err(e)) => {
                println!("red ERROR: {e}");
                1
            }
            Err(_) => {
                println!("red ERROR: tiempo agotado");
                1
            }
        }
    })
}

fn main() {
    if std::env::args().any(|a| a == "--probar-red") {
        std::process::exit(probar_red());
    }
    coffee_core::migrate_legacy_dirs();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Red::default())
        .invoke_handler(coffee_core::editor_handler!(red_anfitrion, red_unirse, red_enviar, red_cortar, red_cambiar_sala, red_cerrar))
        .run(tauri::generate_context!())
        .expect("Error al iniciar CoffeeDrawTeam");
}
