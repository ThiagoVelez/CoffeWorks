// Lo que lleva el QR: cada tipo de contenido se convierte al texto que entienden los lectores de
// los celulares (enlaces, WIFI:, vCard, wa.me, mailto:, tel:, SMSTO:, mapas).

export type Contenido =
  | { tipo: "enlace"; url: string }
  | { tipo: "archivo"; url: string }
  | { tipo: "texto"; texto: string }
  | { tipo: "wifi"; red: string; clave: string; seguridad: "WPA" | "WEP" | "nopass"; oculta: boolean }
  | { tipo: "contacto"; nombre: string; apellido: string; telefono: string; correo: string; empresa: string; web: string; direccion: string }
  | { tipo: "whatsapp"; numero: string; mensaje: string }
  | { tipo: "correo"; correo: string; asunto: string; cuerpo: string }
  | { tipo: "telefono"; numero: string }
  | { tipo: "sms"; numero: string; mensaje: string }
  | { tipo: "ubicacion"; lat: number; lng: number; nombre: string };

export type TipoContenido = Contenido["tipo"];

export const TIPOS: { tipo: TipoContenido; nombre: string; ayuda: string }[] = [
  { tipo: "enlace", nombre: "Enlace", ayuda: "Una página web, tu tienda o tus redes." },
  { tipo: "archivo", nombre: "Imagen o PDF", ayuda: "Un menú, un catálogo o una foto guardados en Drive, en tu web o en Instagram." },
  { tipo: "wifi", nombre: "Wi-Fi", ayuda: "Quien lo escanea se conecta sin escribir la clave." },
  { tipo: "contacto", nombre: "Contacto", ayuda: "Se guarda en la agenda del celular." },
  { tipo: "whatsapp", nombre: "WhatsApp", ayuda: "Abre un chat contigo, con un mensaje ya escrito." },
  { tipo: "texto", nombre: "Texto", ayuda: "Un texto corto que se muestra al escanear." },
  { tipo: "correo", nombre: "Correo", ayuda: "Abre un correo nuevo para ti." },
  { tipo: "telefono", nombre: "Llamada", ayuda: "Marca tu número." },
  { tipo: "sms", nombre: "SMS", ayuda: "Abre un mensaje de texto para ti." },
  { tipo: "ubicacion", nombre: "Ubicación", ayuda: "Abre el mapa en tu negocio." },
];

export function vacio(tipo: TipoContenido): Contenido {
  switch (tipo) {
    case "enlace": return { tipo, url: "" };
    case "archivo": return { tipo, url: "" };
    case "texto": return { tipo, texto: "" };
    case "wifi": return { tipo, red: "", clave: "", seguridad: "WPA", oculta: false };
    case "contacto": return { tipo, nombre: "", apellido: "", telefono: "", correo: "", empresa: "", web: "", direccion: "" };
    case "whatsapp": return { tipo, numero: "", mensaje: "" };
    case "correo": return { tipo, correo: "", asunto: "", cuerpo: "" };
    case "telefono": return { tipo, numero: "" };
    case "sms": return { tipo, numero: "", mensaje: "" };
    case "ubicacion": return { tipo, lat: 0, lng: 0, nombre: "" };
  }
}

export function normalizarEnlace(url: string): string {
  const u = url.trim();
  if (!u) return "";
  return /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : `https://${u}`;
}

const escWifi = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");
const soloDigitos = (s: string) => s.replace(/[^\d+]/g, "");
const vcard = (s: string) => s.replace(/([\\;,])/g, "\\$1").replace(/\n/g, "\\n");

export function aTexto(c: Contenido): string {
  switch (c.tipo) {
    case "enlace":
    case "archivo":
      return normalizarEnlace(c.url);
    case "texto":
      return c.texto;
    case "wifi":
      return `WIFI:T:${c.seguridad};S:${escWifi(c.red)};${c.seguridad !== "nopass" && c.clave ? `P:${escWifi(c.clave)};` : ""}${c.oculta ? "H:true;" : ""};`;
    case "contacto": {
      const l = ["BEGIN:VCARD", "VERSION:3.0", `N:${vcard(c.apellido)};${vcard(c.nombre)};;;`, `FN:${vcard(`${c.nombre} ${c.apellido}`.trim())}`];
      if (c.telefono.trim()) l.push(`TEL;TYPE=CELL:${soloDigitos(c.telefono)}`);
      if (c.correo.trim()) l.push(`EMAIL:${c.correo.trim()}`);
      if (c.empresa.trim()) l.push(`ORG:${vcard(c.empresa.trim())}`);
      if (c.web.trim()) l.push(`URL:${normalizarEnlace(c.web)}`);
      if (c.direccion.trim()) l.push(`ADR:;;${vcard(c.direccion.trim())};;;;`);
      l.push("END:VCARD");
      return l.join("\n");
    }
    case "whatsapp": {
      const n = c.numero.replace(/\D/g, "");
      return `https://wa.me/${n}${c.mensaje.trim() ? `?text=${encodeURIComponent(c.mensaje)}` : ""}`;
    }
    case "correo": {
      const q = [c.asunto && `subject=${encodeURIComponent(c.asunto)}`, c.cuerpo && `body=${encodeURIComponent(c.cuerpo)}`].filter(Boolean).join("&");
      return `mailto:${c.correo.trim()}${q ? `?${q}` : ""}`;
    }
    case "telefono":
      return `tel:${soloDigitos(c.numero)}`;
    case "sms":
      return `SMSTO:${soloDigitos(c.numero)}:${c.mensaje}`;
    case "ubicacion":
      return `https://maps.google.com/?q=${c.lat},${c.lng}`;
  }
}

export const esDrive = (url: string) => /(^|\/\/)(drive|docs)\.google\.com\//i.test(url.trim());

/** Consejo para que el enlace de una imagen o un PDF funcione en cualquier celular. */
export function consejoEnlace(url: string): string | null {
  const u = url.trim();
  if (!u) return null;
  if (/^(file:|[a-z]:\\|\\\\|\/home\/|\/Users\/)/i.test(u)) return "Un archivo de tu equipo no funciona en el celular de otra persona: súbelo a Google Drive, a tu web o a Instagram y pega aquí el enlace.";
  if (esDrive(u)) return "En Google Drive: clic derecho en el archivo › Compartir › en «Acceso general» elige «Cualquier persona con el enlace» y copia el enlace.";
  return null;
}
