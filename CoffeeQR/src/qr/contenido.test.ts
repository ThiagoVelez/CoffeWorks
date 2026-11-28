import { test } from "node:test";
import assert from "node:assert/strict";
import { aTexto, consejoEnlace, esDrive, normalizarEnlace } from "./contenido";

test("enlace sin esquema recibe https://", () => {
  assert.equal(normalizarEnlace("mitienda.com/menu"), "https://mitienda.com/menu");
  assert.equal(normalizarEnlace("  http://a.co  "), "http://a.co");
  assert.equal(aTexto({ tipo: "enlace", url: "plantas.co" }), "https://plantas.co");
});

test("Wi-Fi escapa los caracteres especiales", () => {
  assert.equal(aTexto({ tipo: "wifi", red: "Mi;Red", clave: 'a:b,c\\d"e', seguridad: "WPA", oculta: false }), 'WIFI:T:WPA;S:Mi\\;Red;P:a\\:b\\,c\\\\d\\"e;;');
  assert.equal(aTexto({ tipo: "wifi", red: "Café", clave: "", seguridad: "nopass", oculta: false }), "WIFI:T:nopass;S:Café;;");
  assert.equal(aTexto({ tipo: "wifi", red: "R", clave: "x", seguridad: "WEP", oculta: true }), "WIFI:T:WEP;S:R;P:x;H:true;;");
});

test("contacto en vCard 3.0", () => {
  const v = aTexto({ tipo: "contacto", nombre: "Ana", apellido: "Pérez", telefono: "+57 300 123 4567", correo: "ana@plantas.co", empresa: "Vivero Verde", web: "plantas.co", direccion: "Calle 1 #2-3" });
  assert.ok(v.startsWith("BEGIN:VCARD\nVERSION:3.0\n"));
  assert.ok(v.includes("N:Pérez;Ana;;;\n") && v.includes("FN:Ana Pérez\n"));
  assert.ok(v.includes("TEL;TYPE=CELL:+573001234567\n"));
  assert.ok(v.includes("EMAIL:ana@plantas.co\n") && v.includes("ORG:Vivero Verde\n") && v.includes("URL:https://plantas.co\n"));
  assert.ok(v.endsWith("END:VCARD"));
});

test("WhatsApp, correo, teléfono, SMS y ubicación", () => {
  assert.equal(aTexto({ tipo: "whatsapp", numero: "+57 (300) 123-4567", mensaje: "Hola mundo" }), "https://wa.me/573001234567?text=Hola%20mundo");
  assert.equal(aTexto({ tipo: "whatsapp", numero: "3001234567", mensaje: "" }), "https://wa.me/3001234567");
  assert.equal(aTexto({ tipo: "correo", correo: "a@b.co", asunto: "Pedido #1", cuerpo: "Hola, ¿hay?" }), "mailto:a@b.co?subject=Pedido%20%231&body=Hola%2C%20%C2%BFhay%3F");
  assert.equal(aTexto({ tipo: "telefono", numero: "+57 300 123" }), "tel:+57300123");
  assert.equal(aTexto({ tipo: "sms", numero: "300", mensaje: "Sí" }), "SMSTO:300:Sí");
  assert.equal(aTexto({ tipo: "ubicacion", lat: 4.6, lng: -74.08, nombre: "" }), "https://maps.google.com/?q=4.6,-74.08");
  assert.equal(aTexto({ tipo: "texto", texto: "Hola" }), "Hola");
});

test("archivos alojados: enlaces de Drive y consejos", () => {
  assert.equal(esDrive("https://drive.google.com/file/d/abc123/view?usp=sharing"), true);
  assert.equal(esDrive("https://docs.google.com/document/d/x/edit"), true);
  assert.equal(esDrive("https://plantas.co/menu.pdf"), false);
  assert.match(consejoEnlace("https://drive.google.com/file/d/abc/view") ?? "", /Cualquier persona con el enlace/);
  assert.match(consejoEnlace("C:\\Users\\menu.pdf") ?? "", /no funciona/i);
  assert.match(consejoEnlace("file:///home/menu.png") ?? "", /no funciona/i);
  assert.equal(consejoEnlace("https://plantas.co/menu.pdf"), null);
  assert.equal(aTexto({ tipo: "archivo", url: "drive.google.com/file/d/abc/view" }), "https://drive.google.com/file/d/abc/view");
});
