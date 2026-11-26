//! Cifrado de los mensajes de presentación que pasan por los relés públicos.
//! La clave sale de la clave del link; los relés solo ven bytes cifrados y una etiqueta
//! que no revela la sala.

use base64::Engine as _;
use chacha20poly1305::aead::{Aead, KeyInit};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use hkdf::Hkdf;
use rand::RngCore;
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use sha2::{Digest, Sha256};

#[derive(Clone)]
pub struct ClaveSala([u8; 32]);

impl ClaveSala {
    pub fn desde_link(clave_b64: &str) -> Result<Self, String> {
        let crudo = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .decode(clave_b64.trim())
            .map_err(|_| "La clave del link no es válida".to_string())?;
        if crudo.len() != 16 {
            return Err("La clave del link no es válida".into());
        }
        let hk = Hkdf::<Sha256>::new(None, &crudo);
        let mut k = [0u8; 32];
        hk.expand(b"coffeedrawteam/senal/v1", &mut k).map_err(|_| "No se pudo derivar la clave".to_string())?;
        Ok(Self(k))
    }

    pub fn sellar(&self, texto: &[u8]) -> Vec<u8> {
        let cifra = XChaCha20Poly1305::new((&self.0).into());
        let mut nonce = [0u8; 24];
        rand::thread_rng().fill_bytes(&mut nonce);
        let mut out = nonce.to_vec();
        out.extend(cifra.encrypt(XNonce::from_slice(&nonce), texto).expect("cifrar no falla"));
        out
    }

    pub fn abrir(&self, datos: &[u8]) -> Option<Vec<u8>> {
        if datos.len() < 24 + 16 {
            return None;
        }
        let cifra = XChaCha20Poly1305::new((&self.0).into());
        cifra.decrypt(XNonce::from_slice(&datos[..24]), &datos[24..]).ok()
    }
}

/// Lo único que va en claro en el relé: un resumen de la sala.
pub fn etiqueta_sala(sala: &str) -> String {
    hex::encode(Sha256::digest(format!("coffeedrawteam:{sala}").as_bytes()))
}

/// Llave nueva del anfitrión: (secreto en base64, pública en base64url de 43 caracteres para el link).
pub fn nueva_llave() -> (String, String) {
    let k = SigningKey::generate(&mut rand::rngs::OsRng);
    (
        base64::engine::general_purpose::STANDARD.encode(k.to_bytes()),
        base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(k.verifying_key().to_bytes()),
    )
}

pub fn firma_desde(secreto: &str) -> Result<SigningKey, String> {
    let b: [u8; 32] = base64::engine::general_purpose::STANDARD
        .decode(secreto.trim())
        .ok()
        .and_then(|v| v.try_into().ok())
        .ok_or("La llave del anfitrión no es válida")?;
    Ok(SigningKey::from_bytes(&b))
}

pub fn publica_desde(publica: &str) -> Result<VerifyingKey, String> {
    let b: [u8; 32] = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(publica.trim())
        .ok()
        .and_then(|v| v.try_into().ok())
        .ok_or("La llave del link no es válida")?;
    VerifyingKey::from_bytes(&b).map_err(|_| "La llave del link no es válida".to_string())
}

pub fn firmar(k: &SigningKey, msg: &[u8]) -> String {
    base64::engine::general_purpose::STANDARD.encode(k.sign(msg).to_bytes())
}

pub fn verificar(v: &VerifyingKey, msg: &[u8], firma: &str) -> bool {
    let Some(b) = base64::engine::general_purpose::STANDARD.decode(firma).ok().and_then(|v| <[u8; 64]>::try_from(v).ok()) else {
        return false;
    };
    v.verify(msg, &Signature::from_bytes(&b)).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    const A: &str = "AAAAAAAAAAAAAAAAAAAAAA";
    const B: &str = "BBBBBBBBBBBBBBBBBBBBBA";

    #[test]
    fn sellar_y_abrir() {
        let k = ClaveSala::desde_link(A).unwrap();
        let s = k.sellar(b"hola");
        assert_eq!(k.abrir(&s).as_deref(), Some(&b"hola"[..]));
    }

    #[test]
    fn abrir_rechaza_alterado() {
        let k = ClaveSala::desde_link(A).unwrap();
        let mut s = k.sellar(b"hola");
        let n = s.len() - 1;
        s[n] ^= 1;
        assert!(k.abrir(&s).is_none());
    }

    #[test]
    fn clave_vieja_rechazada() {
        let a = ClaveSala::desde_link(A).unwrap();
        let b = ClaveSala::desde_link(B).unwrap();
        assert!(b.abrir(&a.sellar(b"hola")).is_none());
    }

    #[test]
    fn etiqueta_no_revela_sala() {
        let sala = "abcdefghijklmnopqrstuv";
        let e = etiqueta_sala(sala);
        assert!(!e.contains(sala));
        assert_eq!(e.len(), 64);
        assert_ne!(e, etiqueta_sala("abcdefghijklmnopqrstuw"));
    }

    #[test]
    fn firma_del_anfitrion() {
        let (secreto, publica) = nueva_llave();
        assert_eq!(publica.len(), 43);
        let firma = firma_desde(&secreto).unwrap();
        let llave = publica_desde(&publica).unwrap();
        let f = firmar(&firma, b"respuesta");
        assert!(verificar(&llave, b"respuesta", &f));
        assert!(!verificar(&llave, b"otra cosa", &f));
        let (_, otra) = nueva_llave();
        assert!(!verificar(&publica_desde(&otra).unwrap(), b"respuesta", &f));
        assert!(!verificar(&llave, b"respuesta", "basura"));
    }

    #[test]
    fn clave_mal_formada_da_error() {
        assert!(ClaveSala::desde_link("corta").is_err());
    }
}
