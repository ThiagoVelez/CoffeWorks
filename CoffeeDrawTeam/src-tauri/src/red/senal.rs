//! Presentación entre equipos: por dónde viajan (cifradas) las ofertas y respuestas WebRTC.
//! En la app, relés Nostr públicos; en las pruebas, un bus en memoria.

use async_trait::async_trait;
use base64::Engine as _;
use nostr_sdk::prelude::*;
use std::pin::Pin;
use tokio::sync::Mutex;
#[cfg(test)]
use {std::sync::Arc, tokio::sync::broadcast};

#[async_trait]
pub trait Senalizacion: Send + Sync {
    async fn publicar(&self, msg: Vec<u8>) -> Result<(), String>;
    /// Siguiente mensaje de otro equipo (nunca los propios). `None` si se cerró.
    async fn recibir(&self) -> Option<Vec<u8>>;
}

/// Eventos efímeros (los relés no los guardan).
const TIPO_EVENTO: u16 = 25050;

pub const RELES: &[&str] = &["wss://relay.damus.io", "wss://nos.lol", "wss://relay.nostr.band", "wss://nostr.mom"];

type Avisos = Pin<Box<dyn futures::Stream<Item = ClientNotification> + Send>>;

pub struct RelesNostr {
    cliente: Client,
    claves: Keys,
    etiqueta: String,
    rx: Mutex<Avisos>,
}

impl RelesNostr {
    pub async fn conectar(etiqueta: &str) -> Result<Self, String> {
        let claves = Keys::generate();
        let cliente = Client::new();
        let mut alguno = false;
        for r in RELES {
            alguno |= cliente.add_relay(*r).await.is_ok();
        }
        if !alguno {
            return Err("No se pudo usar ningún servidor de presentación".into());
        }
        cliente.connect().await;
        let rx = cliente.notifications();
        let filtro = Filter::new()
            .kind(Kind::Custom(TIPO_EVENTO))
            .hashtag(etiqueta)
            .since(Timestamp::now() - 30u64);
        cliente
            .subscribe(filtro)
            .await
            .map_err(|e| format!("No se pudo escuchar en los servidores de presentación: {e}"))?;
        Ok(Self { cliente, claves, etiqueta: etiqueta.to_string(), rx: Mutex::new(rx) })
    }

    pub async fn cerrar(&self) {
        self.cliente.shutdown().await;
    }
}

#[async_trait]
impl Senalizacion for RelesNostr {
    async fn publicar(&self, msg: Vec<u8>) -> Result<(), String> {
        let contenido = base64::engine::general_purpose::STANDARD.encode(msg);
        let ev = EventBuilder::new(Kind::Custom(TIPO_EVENTO), contenido)
            .tag(Tag::hashtag(&self.etiqueta))
            .finalize(&self.claves)
            .map_err(|e| format!("No se pudo preparar el mensaje: {e}"))?;
        self.cliente
            .send_event(&ev)
            .await
            .map(|_| ())
            .map_err(|e| format!("No se pudo enviar a los servidores de presentación: {e}"))
    }

    async fn recibir(&self) -> Option<Vec<u8>> {
        let mut rx = self.rx.lock().await;
        // El cliente ya descarta eventos repetidos y los propios.
        while let Some(aviso) = rx.next().await {
            match aviso {
                ClientNotification::Event { event, .. } => {
                    if event.kind != Kind::Custom(TIPO_EVENTO) || event.pubkey == self.claves.public_key() {
                        continue;
                    }
                    if let Ok(b) = base64::engine::general_purpose::STANDARD.decode(event.content.as_bytes()) {
                        return Some(b);
                    }
                }
                ClientNotification::Shutdown => return None,
                _ => {}
            }
        }
        None
    }
}

/// Bus en memoria (pruebas): lo que publica un nodo lo reciben todos los demás.
#[cfg(test)]
#[derive(Clone)]
pub struct BusMemoria {
    tx: broadcast::Sender<(usize, Vec<u8>)>,
    siguiente: Arc<std::sync::atomic::AtomicUsize>,
}

#[cfg(test)]
impl BusMemoria {
    pub fn nuevo() -> Self {
        Self { tx: broadcast::channel(256).0, siguiente: Arc::new(0.into()) }
    }

    pub fn nodo(&self) -> SenalMemoria {
        let id = self.siguiente.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        SenalMemoria { id, tx: self.tx.clone(), rx: Mutex::new(self.tx.subscribe()) }
    }
}

#[cfg(test)]
pub struct SenalMemoria {
    id: usize,
    tx: broadcast::Sender<(usize, Vec<u8>)>,
    rx: Mutex<broadcast::Receiver<(usize, Vec<u8>)>>,
}

#[cfg(test)]
#[async_trait]
impl Senalizacion for SenalMemoria {
    async fn publicar(&self, msg: Vec<u8>) -> Result<(), String> {
        let _ = self.tx.send((self.id, msg));
        Ok(())
    }

    async fn recibir(&self) -> Option<Vec<u8>> {
        let mut rx = self.rx.lock().await;
        loop {
            match rx.recv().await {
                Ok((de, m)) if de != self.id => return Some(m),
                Ok(_) | Err(broadcast::error::RecvError::Lagged(_)) => {}
                Err(broadcast::error::RecvError::Closed) => return None,
            }
        }
    }
}
