//! Conexiones WebRTC en estrella: el anfitrión acepta una conexión por invitado y los
//! invitados solo se conectan al anfitrión. La presentación (oferta y respuesta) viaja
//! cifrada por una `Senalizacion`; luego los datos van directos por un canal fiable y
//! ordenado, troceados en partes de 16 KB.

use super::cifrado::{firmar, verificar, ClaveSala};
use ed25519_dalek::{SigningKey, VerifyingKey};
use super::senal::Senalizacion;
use bytes::Bytes;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::{mpsc, Mutex};
use tokio::task::JoinHandle;
use webrtc::api::APIBuilder;
use webrtc::data_channel::data_channel_message::DataChannelMessage;
use webrtc::data_channel::RTCDataChannel;
use webrtc::ice_transport::ice_server::RTCIceServer;
use webrtc::peer_connection::configuration::RTCConfiguration;
use webrtc::peer_connection::peer_connection_state::RTCPeerConnectionState;
use webrtc::peer_connection::sdp::session_description::RTCSessionDescription;
use webrtc::peer_connection::RTCPeerConnection;

pub const STUN_PUBLICOS: &[&str] = &["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"];
const PARTE: usize = 16_000;
/// Hasta 8192 partes de 16 KB (unos 130 MB) por mensaje: un tablero con muchas fotos cabe.
const MAX_PARTES: u16 = 8192;
/// Mensajes a medio llegar que se guardan por canal; los más viejos se descartan.
const MAX_PENDIENTES: usize = 8;
/// Invitados a medio conectar que el anfitrión atiende a la vez.
const MAX_SIN_CONECTAR: usize = 24;
const REPETIR_OFERTA: Duration = Duration::from_secs(4);
const ESPERA_MAXIMA: Duration = Duration::from_secs(60);
/// Mensajes de presentación más viejos que esto se ignoran (evita repeticiones).
const VIGENCIA_S: u64 = 600;

#[derive(Debug, Clone, PartialEq)]
pub enum EventoRed {
    Entra(String),
    Sale(String),
    Dato(String, Vec<u8>),
    Estado(String, Option<String>),
}

#[derive(Serialize, Deserialize)]
struct MensajeSenal {
    de: String,
    para: String,
    tipo: String,
    sdp: String,
    t: u64,
    /// Firma del anfitrión en las respuestas (si el link trae su llave).
    #[serde(default)]
    firma: String,
}

impl MensajeSenal {
    fn a_firmar(&self) -> Vec<u8> {
        format!("{}|{}|{}|{}|{}", self.de, self.para, self.tipo, self.t, self.sdp).into_bytes()
    }
}

/// Ofertas ya atendidas: una repetida (por ejemplo, reenviada por alguien) no crea otra conexión.
#[derive(Default)]
struct OfertasVistas {
    vistas: HashMap<(String, u64), std::time::Instant>,
}

impl OfertasVistas {
    const MAX: usize = 256;

    /// `true` si la oferta es nueva (y la recuerda).
    fn nueva(&mut self, de: &str, sdp: &str) -> bool {
        use std::hash::{Hash, Hasher};
        let mut h = std::collections::hash_map::DefaultHasher::new();
        sdp.hash(&mut h);
        let k = (de.to_string(), h.finish());
        let ahora = std::time::Instant::now();
        self.vistas.retain(|_, t| ahora.duration_since(*t).as_secs() <= VIGENCIA_S);
        if self.vistas.contains_key(&k) {
            return false;
        }
        while self.vistas.len() >= Self::MAX {
            let viejo = self.vistas.iter().min_by_key(|(_, t)| **t).map(|(k, _)| k.clone());
            match viejo {
                Some(v) => self.vistas.remove(&v),
                None => break,
            };
        }
        self.vistas.insert(k, ahora);
        true
    }

    #[cfg(test)]
    fn len(&self) -> usize {
        self.vistas.len()
    }
}

fn ahora_s() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

fn id_aleatorio() -> String {
    let mut b = [0u8; 8];
    rand::thread_rng().fill_bytes(&mut b);
    hex::encode(b)
}

/// Divide un mensaje en partes con cabecera [id u32][parte u16][total u16].
fn trocear(id: u32, datos: &[u8]) -> Vec<Vec<u8>> {
    let total = datos.len().div_ceil(PARTE).max(1);
    (0..total)
        .map(|i| {
            let trozo = &datos[(i * PARTE).min(datos.len())..((i + 1) * PARTE).min(datos.len())];
            let mut f = Vec::with_capacity(8 + trozo.len());
            f.extend_from_slice(&id.to_be_bytes());
            f.extend_from_slice(&(i as u16).to_be_bytes());
            f.extend_from_slice(&(total as u16).to_be_bytes());
            f.extend_from_slice(trozo);
            f
        })
        .collect()
}

/// Partes recibidas de un mensaje: total esperado y las que ya llegaron.
type Piezas = (u16, Vec<Option<Vec<u8>>>);

#[derive(Default)]
struct Rearmado {
    piezas: HashMap<u32, Piezas>,
    /// Ids pendientes, del más viejo al más nuevo.
    orden: Vec<u32>,
}

impl Rearmado {
    /// Devuelve el mensaje completo cuando llega su última parte.
    fn meter(&mut self, f: &[u8]) -> Option<Vec<u8>> {
        if f.len() < 8 {
            return None;
        }
        let id = u32::from_be_bytes([f[0], f[1], f[2], f[3]]);
        let parte = u16::from_be_bytes([f[4], f[5]]);
        let total = u16::from_be_bytes([f[6], f[7]]);
        if total == 0 || total > MAX_PARTES || parte >= total {
            return None;
        }
        if !self.piezas.contains_key(&id) {
            while self.piezas.len() >= MAX_PENDIENTES {
                let viejo = *self.orden.first().expect("hay pendientes");
                self.orden.remove(0);
                self.piezas.remove(&viejo);
            }
            self.orden.push(id);
        }
        let entrada = self.piezas.entry(id).or_insert_with(|| (total, vec![None; total as usize]));
        if entrada.0 != total {
            self.piezas.remove(&id);
            self.orden.retain(|x| *x != id);
            return None;
        }
        entrada.1[parte as usize] = Some(f[8..].to_vec());
        if entrada.1.iter().all(Option::is_some) {
            self.orden.retain(|x| *x != id);
            let (_, partes) = self.piezas.remove(&id)?;
            return Some(partes.into_iter().flatten().flatten().collect());
        }
        None
    }
}

struct Par {
    pc: Arc<RTCPeerConnection>,
    dc: Option<Arc<RTCDataChannel>>,
    oferta: String,
    respuesta: Option<Vec<u8>>,
}

struct Interior {
    id: String,
    /// Los invitados avisan «conectado» cuando abre el canal con el anfitrión.
    invitado: bool,
    /// Anfitrión: firma sus respuestas. Invitado: solo acepta respuestas firmadas con esta llave.
    firma: Option<SigningKey>,
    llave: Option<VerifyingKey>,
    vistas: Mutex<OfertasVistas>,
    pares: Mutex<HashMap<String, Par>>,
    eventos: mpsc::UnboundedSender<EventoRed>,
    stun: Vec<String>,
    siguiente_msg: std::sync::atomic::AtomicU32,
}

pub struct Nodo {
    interior: Arc<Interior>,
    escucha: Mutex<Option<JoinHandle<()>>>,
}

impl Interior {
    fn emitir(&self, e: EventoRed) {
        let _ = self.eventos.send(e);
    }

    async fn nueva_conexion(&self) -> Result<Arc<RTCPeerConnection>, String> {
        let api = APIBuilder::new().build();
        let config = RTCConfiguration {
            ice_servers: if self.stun.is_empty() {
                vec![]
            } else {
                vec![RTCIceServer { urls: self.stun.clone(), ..Default::default() }]
            },
            ..Default::default()
        };
        api.new_peer_connection(config).await.map(Arc::new).map_err(|e| format!("No se pudo crear la conexión: {e}"))
    }

    /// Quita un par y avisa una sola vez que salió.
    async fn quitar(self: &Arc<Self>, peer: &str) {
        let par = self.pares.lock().await.remove(peer);
        if let Some(par) = par {
            if let Some(dc) = &par.dc {
                let _ = dc.close().await;
            }
            let _ = par.pc.close().await;
            self.emitir(EventoRed::Sale(peer.to_string()));
        }
    }

    /// Quita el par solo si sigue siendo esa misma conexión (una vieja que se cierra
    /// tarde no debe quitar a la nueva del mismo invitado).
    async fn quitar_si(self: &Arc<Self>, peer: &str, pc: &std::sync::Weak<RTCPeerConnection>) {
        let mismo = {
            let pares = self.pares.lock().await;
            match (pares.get(peer), pc.upgrade()) {
                (Some(par), Some(pc)) => Arc::ptr_eq(&par.pc, &pc),
                _ => false,
            }
        };
        if mismo {
            self.quitar(peer).await;
        }
    }

    /// Prepara los avisos de un canal de datos ya asociado a `peer` y a la conexión `pc`.
    fn preparar_canal(self: &Arc<Self>, peer: String, dc: Arc<RTCDataChannel>, pc: std::sync::Weak<RTCPeerConnection>) {
        let yo = Arc::downgrade(self);
        let p = peer.clone();
        dc.on_open(Box::new(move || {
            let yo = yo.clone();
            let p = p.clone();
            Box::pin(async move {
                if let Some(yo) = yo.upgrade() {
                    yo.emitir(EventoRed::Entra(p));
                    if yo.invitado {
                        yo.emitir(EventoRed::Estado("conectado".into(), None));
                    }
                }
            })
        }));
        let yo = Arc::downgrade(self);
        let p = peer.clone();
        let rearmado = Arc::new(std::sync::Mutex::new(Rearmado::default()));
        dc.on_message(Box::new(move |m: DataChannelMessage| {
            let completo = rearmado.lock().ok().and_then(|mut r| r.meter(&m.data));
            if let (Some(datos), Some(yo)) = (completo, yo.upgrade()) {
                yo.emitir(EventoRed::Dato(p.clone(), datos));
            }
            Box::pin(async {})
        }));
        let yo = Arc::downgrade(self);
        dc.on_close(Box::new(move || {
            let yo = yo.clone();
            let p = peer.clone();
            let pc = pc.clone();
            Box::pin(async move {
                if let Some(yo) = yo.upgrade() {
                    yo.quitar_si(&p, &pc).await;
                }
            })
        }));
    }

    fn vigilar_conexion(self: &Arc<Self>, peer: String, pc: &Arc<RTCPeerConnection>) {
        let yo = Arc::downgrade(self);
        let debil = Arc::downgrade(pc);
        pc.on_peer_connection_state_change(Box::new(move |s| {
            let yo = yo.clone();
            let p = peer.clone();
            let pc = debil.clone();
            Box::pin(async move {
                if let Some(yo) = yo.upgrade() {
                    // El invitado no espera los ~30 s de «Failed»: sin anfitrión, lo que edite se perdería.
                    let perdida = matches!(s, RTCPeerConnectionState::Failed | RTCPeerConnectionState::Closed)
                        || (yo.invitado && s == RTCPeerConnectionState::Disconnected);
                    if perdida {
                        yo.quitar_si(&p, &pc).await;
                    }
                }
            })
        }));
    }

    fn sellado(&self, clave: &ClaveSala, para: &str, tipo: &str, sdp: String) -> Vec<u8> {
        let mut m = MensajeSenal { de: self.id.clone(), para: para.to_string(), tipo: tipo.to_string(), sdp, t: ahora_s(), firma: String::new() };
        if let Some(k) = &self.firma {
            m.firma = firmar(k, &m.a_firmar());
        }
        clave.sellar(&serde_json::to_vec(&m).unwrap_or_default())
    }

    fn abrir(&self, clave: &ClaveSala, datos: &[u8]) -> Option<MensajeSenal> {
        let m: MensajeSenal = serde_json::from_slice(&clave.abrir(datos)?).ok()?;
        if m.de == self.id || ahora_s().abs_diff(m.t) > VIGENCIA_S {
            return None;
        }
        // Con la llave del link, solo vale una respuesta firmada por el anfitrión de verdad.
        if m.tipo == "respuesta" {
            if let Some(v) = &self.llave {
                if !verificar(v, &m.a_firmar(), &m.firma) {
                    return None;
                }
            }
        }
        Some(m)
    }

    /// Anfitrión: responde a una oferta (o repite la respuesta si la oferta ya se atendió).
    async fn atender_oferta(self: &Arc<Self>, senal: &Arc<dyn Senalizacion>, clave: &ClaveSala, m: MensajeSenal) -> Result<(), String> {
        {
            let pares = self.pares.lock().await;
            if let Some(par) = pares.get(&m.de) {
                if par.oferta == m.sdp {
                    if let Some(r) = &par.respuesta {
                        senal.publicar(r.clone()).await?;
                    }
                    return Ok(());
                }
            }
        }
        if !self.pares.lock().await.contains_key(&m.de) && !self.vistas.lock().await.nueva(&m.de, &m.sdp) {
            return Ok(());
        }
        {
            let pares = self.pares.lock().await;
            let sin_conectar = pares.values().filter(|p| p.dc.is_none()).count();
            if !pares.contains_key(&m.de) && sin_conectar >= MAX_SIN_CONECTAR {
                return Err("demasiadas conexiones a medio abrir".into());
            }
        }
        self.quitar(&m.de).await;
        let pc = self.nueva_conexion().await?;
        let peer = m.de.clone();
        self.vigilar_conexion(peer.clone(), &pc);
        let yo = Arc::downgrade(self);
        let p = peer.clone();
        let debil = Arc::downgrade(&pc);
        pc.on_data_channel(Box::new(move |dc: Arc<RTCDataChannel>| {
            let yo = yo.clone();
            let p = p.clone();
            let pc = debil.clone();
            Box::pin(async move {
                if let Some(yo) = yo.upgrade() {
                    if let Some(par) = yo.pares.lock().await.get_mut(&p) {
                        par.dc = Some(dc.clone());
                    }
                    yo.preparar_canal(p, dc, pc);
                }
            })
        }));
        self.pares.lock().await.insert(peer.clone(), Par { pc: pc.clone(), dc: None, oferta: m.sdp.clone(), respuesta: None });
        let oferta = RTCSessionDescription::offer(m.sdp).map_err(|e| e.to_string())?;
        pc.set_remote_description(oferta).await.map_err(|e| e.to_string())?;
        let respuesta = pc.create_answer(None).await.map_err(|e| e.to_string())?;
        let mut listo = pc.gathering_complete_promise().await;
        pc.set_local_description(respuesta).await.map_err(|e| e.to_string())?;
        let _ = listo.recv().await;
        let sdp = pc.local_description().await.map(|d| d.sdp).unwrap_or_default();
        let sellado = self.sellado(clave, &peer, "respuesta", sdp);
        if let Some(par) = self.pares.lock().await.get_mut(&peer) {
            par.respuesta = Some(sellado.clone());
        }
        senal.publicar(sellado).await
    }
}

impl Nodo {
    fn nuevo(stun: Vec<String>, invitado: bool, firma: Option<SigningKey>, llave: Option<VerifyingKey>) -> (Self, mpsc::UnboundedReceiver<EventoRed>) {
        let (tx, rx) = mpsc::unbounded_channel();
        let interior = Arc::new(Interior {
            id: id_aleatorio(),
            invitado,
            firma,
            llave,
            vistas: Mutex::new(OfertasVistas::default()),
            pares: Mutex::new(HashMap::new()),
            eventos: tx,
            stun,
            siguiente_msg: 0.into(),
        });
        (Self { interior, escucha: Mutex::new(None) }, rx)
    }

    pub fn id(&self) -> &str {
        &self.interior.id
    }

    /// Crea el anfitrión y empieza a escuchar ofertas en la sala.
    pub async fn anfitrion(senal: Arc<dyn Senalizacion>, clave: ClaveSala, stun: Vec<String>, firma: Option<SigningKey>) -> (Self, mpsc::UnboundedReceiver<EventoRed>) {
        let (nodo, rx) = Self::nuevo(stun, false, firma, None);
        nodo.escuchar(senal, clave).await;
        nodo.interior.emitir(EventoRed::Estado("conectado".into(), None));
        (nodo, rx)
    }

    async fn escuchar(&self, senal: Arc<dyn Senalizacion>, clave: ClaveSala) {
        let interior = self.interior.clone();
        let tarea = tokio::spawn(async move {
            while let Some(datos) = senal.recibir().await {
                let Some(m) = interior.abrir(&clave, &datos) else { continue };
                if m.tipo == "oferta" && m.para == "anfitrion" {
                    if let Err(e) = interior.atender_oferta(&senal, &clave, m).await {
                        eprintln!("CoffeeDrawTeam: no se pudo atender a un invitado: {e}");
                    }
                }
            }
        });
        if let Some(vieja) = self.escucha.lock().await.replace(tarea) {
            vieja.abort();
        }
    }

    /// Anfitrión: deja de atender ofertas (antes de cambiar de sala).
    pub async fn dejar_de_escuchar(&self) {
        if let Some(t) = self.escucha.lock().await.take() {
            t.abort();
        }
    }

    /// Anfitrión: escuchar desde ahora en otra sala. Las conexiones abiertas siguen.
    pub async fn cambiar_sala(&self, senal: Arc<dyn Senalizacion>, clave: ClaveSala) {
        self.escuchar(senal, clave).await;
    }

    /// Crea un invitado que busca al anfitrión de la sala.
    pub async fn invitado(senal: Arc<dyn Senalizacion>, clave: ClaveSala, stun: Vec<String>, llave: Option<VerifyingKey>) -> Result<(Self, mpsc::UnboundedReceiver<EventoRed>), String> {
        let (nodo, rx) = Self::nuevo(stun, true, None, llave);
        let interior = nodo.interior.clone();
        interior.emitir(EventoRed::Estado("conectando".into(), None));
        let pc = interior.nueva_conexion().await?;
        let dc = pc.create_data_channel("datos", None).await.map_err(|e| e.to_string())?;
        let oferta = pc.create_offer(None).await.map_err(|e| e.to_string())?;
        let mut listo = pc.gathering_complete_promise().await;
        pc.set_local_description(oferta).await.map_err(|e| e.to_string())?;
        let _ = listo.recv().await;
        let sdp = pc.local_description().await.map(|d| d.sdp).unwrap_or_default();
        let oferta_sellada = interior.sellado(&clave, "anfitrion", "oferta", sdp.clone());

        let tarea = tokio::spawn(async move {
            let inicio = tokio::time::Instant::now();
            let mut repetir = tokio::time::interval(REPETIR_OFERTA);
            loop {
                tokio::select! {
                    _ = repetir.tick() => {
                        if inicio.elapsed() > ESPERA_MAXIMA {
                            interior.emitir(EventoRed::Estado(
                                "error".into(),
                                Some("No se pudo conectar: el anfitrión no responde o tu red bloquea la conexión directa".into()),
                            ));
                            let _ = pc.close().await;
                            return;
                        }
                        if let Err(e) = senal.publicar(oferta_sellada.clone()).await {
                            interior.emitir(EventoRed::Estado("error".into(), Some(e)));
                        }
                    }
                    datos = senal.recibir() => {
                        let Some(datos) = datos else { return };
                        let Some(m) = interior.abrir(&clave, &datos) else { continue };
                        if m.tipo != "respuesta" || m.para != interior.id { continue }
                        let anfitrion = m.de.clone();
                        let Ok(resp) = RTCSessionDescription::answer(m.sdp) else { continue };
                        interior.vigilar_conexion(anfitrion.clone(), &pc);
                        interior.pares.lock().await.insert(
                            anfitrion.clone(),
                            Par { pc: pc.clone(), dc: Some(dc.clone()), oferta: sdp.clone(), respuesta: None },
                        );
                        interior.preparar_canal(anfitrion, dc.clone(), Arc::downgrade(&pc));
                        if let Err(e) = pc.set_remote_description(resp).await {
                            interior.emitir(EventoRed::Estado("error".into(), Some(format!("No se pudo conectar: {e}"))));
                            return;
                        }
                        // Ya no hace falta la presentación.
                        return;
                    }
                }
            }
        });
        *nodo.escucha.lock().await = Some(tarea);
        Ok((nodo, rx))
    }

    /// Envía a un par concreto o a todos (`None`).
    pub async fn enviar(&self, destino: Option<&str>, datos: &[u8]) {
        if datos.len() > MAX_PARTES as usize * PARTE {
            self.interior.emitir(EventoRed::Estado(
                "error".into(),
                Some("El tablero es demasiado grande para enviarlo: borra algunas imágenes".into()),
            ));
            return;
        }
        let id = self.interior.siguiente_msg.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        let partes = trocear(id, datos);
        let canales: Vec<Arc<RTCDataChannel>> = {
            let pares = self.interior.pares.lock().await;
            pares
                .iter()
                .filter(|(p, _)| destino.is_none_or(|d| d == p.as_str()))
                .filter_map(|(_, par)| par.dc.clone())
                .collect()
        };
        for dc in canales {
            for f in &partes {
                if dc.send(&Bytes::from(f.clone())).await.is_err() {
                    break;
                }
            }
        }
    }

    /// Corta a un par (tras un momento, para que le llegue el último mensaje).
    pub async fn cortar(&self, peer: &str) {
        let interior = self.interior.clone();
        let peer = peer.to_string();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(400)).await;
            interior.quitar(&peer).await;
        });
    }

    pub async fn cerrar(&self) {
        if let Some(t) = self.escucha.lock().await.take() {
            t.abort();
        }
        let pares: Vec<String> = self.interior.pares.lock().await.keys().cloned().collect();
        for p in pares {
            self.interior.quitar(&p).await;
        }
        self.interior.emitir(EventoRed::Estado("cerrado".into(), None));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::red::cifrado::{firma_desde, nueva_llave, publica_desde};
    use crate::red::senal::BusMemoria;

    const CLAVE: &str = "AAAAAAAAAAAAAAAAAAAAAA";

    #[test]
    fn trocear_y_rearmar() {
        let datos: Vec<u8> = (0..50_000u32).map(|i| (i % 251) as u8).collect();
        let mut r = Rearmado::default();
        let partes = trocear(7, &datos);
        assert_eq!(partes.len(), 4);
        let mut fin = None;
        for p in partes.iter().rev() {
            fin = r.meter(p).or(fin);
        }
        assert_eq!(fin.as_deref(), Some(&datos[..]));
    }

    #[test]
    fn rearmar_no_guarda_mensajes_sin_limite() {
        let mut r = Rearmado::default();
        // Un par malicioso empieza muchos mensajes y nunca los termina.
        for id in 0..100u32 {
            let mut f = id.to_be_bytes().to_vec();
            f.extend_from_slice(&0u16.to_be_bytes());
            f.extend_from_slice(&MAX_PARTES.to_be_bytes());
            f.extend_from_slice(&[7; 100]);
            assert!(r.meter(&f).is_none());
        }
        assert!(r.piezas.len() <= MAX_PENDIENTES);
    }

    #[test]
    fn trocear_admite_tableros_grandes() {
        // 40 MB (unas 25 fotos) caben en un solo mensaje.
        assert!(MAX_PARTES as usize * PARTE >= 40_000_000);
    }

    #[test]
    fn ofertas_repetidas_se_ignoran() {
        let mut v = OfertasVistas::default();
        assert!(v.nueva("a", "sdp1"));
        assert!(!v.nueva("a", "sdp1"));
        assert!(v.nueva("a", "sdp2"));
        assert!(v.nueva("b", "sdp1"));
        for i in 0..1000 {
            v.nueva("x", &format!("s{i}"));
        }
        assert!(v.len() <= 256);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn invitado_solo_acepta_al_anfitrion_de_la_llave() {
        let bus = BusMemoria::nuevo();
        let clave = ClaveSala::desde_link(CLAVE).unwrap();
        let (secreto, _) = nueva_llave();
        let (_, publica_otra) = nueva_llave();
        // Un impostor con el link (pero sin la llave) responde: el invitado no se conecta.
        let (impostor, mut ra) = Nodo::anfitrion(Arc::new(bus.nodo()), clave.clone(), vec![], Some(firma_desde(&secreto).unwrap())).await;
        let (_inv, _ri) = Nodo::invitado(Arc::new(bus.nodo()), clave, vec![], Some(publica_desde(&publica_otra).unwrap())).await.unwrap();
        let r = tokio::time::timeout(Duration::from_secs(6), async {
            loop {
                if let Some(EventoRed::Entra(_)) = ra.recv().await {
                    return;
                }
            }
        })
        .await;
        assert!(r.is_err(), "el invitado no debe conectarse con quien no tiene la llave");
        impostor.cerrar().await;
    }

    #[test]
    fn rearmar_rechaza_basura() {
        let mut r = Rearmado::default();
        assert!(r.meter(&[1, 2, 3]).is_none());
        assert!(r.meter(&[0, 0, 0, 1, 0, 5, 0, 2, 9]).is_none());
        assert!(r.meter(&[0, 0, 0, 1, 0, 0, 0xff, 0xff]).is_none());
    }

    async fn esperar(rx: &mut mpsc::UnboundedReceiver<EventoRed>, f: impl Fn(&EventoRed) -> bool) -> EventoRed {
        tokio::time::timeout(Duration::from_secs(20), async {
            loop {
                let e = rx.recv().await.expect("canal abierto");
                if f(&e) {
                    return e;
                }
            }
        })
        .await
        .expect("llega a tiempo")
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn dos_nodos_hablan() {
        let bus = BusMemoria::nuevo();
        let clave = ClaveSala::desde_link(CLAVE).unwrap();
        let (secreto, publica) = nueva_llave();
        let (anf, mut ra) = Nodo::anfitrion(Arc::new(bus.nodo()), clave.clone(), vec![], Some(firma_desde(&secreto).unwrap())).await;
        let (inv, mut ri) = Nodo::invitado(Arc::new(bus.nodo()), clave, vec![], Some(publica_desde(&publica).unwrap())).await.unwrap();

        let EventoRed::Entra(quien) = esperar(&mut ra, |e| matches!(e, EventoRed::Entra(_))).await else { unreachable!() };
        assert_eq!(quien, inv.id());
        let EventoRed::Entra(host) = esperar(&mut ri, |e| matches!(e, EventoRed::Entra(_))).await else { unreachable!() };
        assert_eq!(host, anf.id());
        assert_eq!(
            esperar(&mut ri, |e| matches!(e, EventoRed::Estado(s, _) if s != "conectando")).await,
            EventoRed::Estado("conectado".into(), None)
        );

        inv.enviar(None, b"hola").await;
        assert_eq!(esperar(&mut ra, |e| matches!(e, EventoRed::Dato(..))).await, EventoRed::Dato(inv.id().into(), b"hola".to_vec()));

        let grande: Vec<u8> = (0..1_000_000u32).map(|i| (i % 253) as u8).collect();
        anf.enviar(Some(inv.id()), &grande).await;
        anf.enviar(None, b"tres").await;
        assert_eq!(esperar(&mut ri, |e| matches!(e, EventoRed::Dato(..))).await, EventoRed::Dato(anf.id().into(), grande));
        assert_eq!(esperar(&mut ri, |e| matches!(e, EventoRed::Dato(..))).await, EventoRed::Dato(anf.id().into(), b"tres".to_vec()));

        inv.cerrar().await;
        assert_eq!(esperar(&mut ra, |e| matches!(e, EventoRed::Sale(_))).await, EventoRed::Sale(inv.id().into()));
        anf.cerrar().await;
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn clave_vieja_no_entra() {
        let bus = BusMemoria::nuevo();
        let buena = ClaveSala::desde_link(CLAVE).unwrap();
        let vieja = ClaveSala::desde_link("BBBBBBBBBBBBBBBBBBBBBA").unwrap();
        let (anf, mut ra) = Nodo::anfitrion(Arc::new(bus.nodo()), buena, vec![], None).await;
        let (_inv, _ri) = Nodo::invitado(Arc::new(bus.nodo()), vieja, vec![], None).await.unwrap();
        let r = tokio::time::timeout(Duration::from_secs(6), async {
            loop {
                if let Some(EventoRed::Entra(_)) = ra.recv().await {
                    return;
                }
            }
        })
        .await;
        assert!(r.is_err(), "no debe entrar nadie con otra clave");
        anf.cerrar().await;
    }
}
