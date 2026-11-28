// Plantillas por negocio: un diseño listo, el texto del marco y el tipo de contenido que suele llevar.
import type { Contenido } from "./contenido";
import { DISENO_BASE, type Diseno } from "./diseno";

export interface Plantilla {
  id: string;
  nombre: string;
  descripcion: string;
  contenido: Contenido;
  diseno: Diseno;
}

const d = (p: Partial<Diseno>): Diseno => ({ ...DISENO_BASE, ...p, marco: { ...DISENO_BASE.marco, ...(p.marco ?? {}) } });

export const PLANTILLAS: Plantilla[] = [
  {
    id: "plantas", nombre: "Tienda de plantas", descripcion: "Hojas alrededor y una monstera en el centro.",
    contenido: { tipo: "enlace", url: "https://mi-vivero.co" },
    diseno: d({ modulo: "gotas", ojoMarco: "hoja", ojoCentro: "hoja", color: { tipo: "lineal", colores: ["#237032", "#1b4332"], angulo: 45 }, fondo: "#f4fbf2", tema: "plantas", adornoCentro: true, adornoBorde: true, marco: { texto: "Conoce nuestras plantas", color: "#2b8a3e", estilo: "abajo" } }),
  },
  {
    id: "restaurante", nombre: "Restaurante (menú)", descripcion: "Para el menú en PDF o en imagen, alojado en Drive o en tu web.",
    contenido: { tipo: "archivo", url: "https://drive.google.com/file/d/TU-MENU/view" },
    diseno: d({ modulo: "redondeado", ojoMarco: "redondeado", ojoCentro: "redondeado", color: "#a61e4d", fondo: "#fff9f0", tema: "comida", adornoCentro: true, adornoBorde: false, marco: { texto: "Ver el menú", color: "#a61e4d", estilo: "abajo" } }),
  },
  {
    id: "cafeteria", nombre: "Cafetería (Wi-Fi)", descripcion: "Tus clientes se conectan sin escribir la clave.",
    contenido: { tipo: "wifi", red: "Cafe-Clientes", clave: "cafecito2026", seguridad: "WPA", oculta: false },
    diseno: d({ modulo: "puntos", ojoMarco: "redondeado", ojoCentro: "punto", color: "#5c3d2e", fondo: "#fdf6ec", tema: "cafe", adornoCentro: true, adornoBorde: true, marco: { texto: "Wi-Fi gratis", color: "#5c3d2e", estilo: "burbuja" } }),
  },
  {
    id: "musica", nombre: "Música o evento", descripcion: "Para tu playlist, tu canal o las entradas.",
    contenido: { tipo: "enlace", url: "https://mi-banda.co/entradas" },
    diseno: d({ modulo: "barrasV", ojoMarco: "circulo", ojoCentro: "punto", color: { tipo: "lineal", colores: ["#5f3dc4", "#a61e4d"], angulo: 90 }, fondo: "#ffffff", tema: "musica", adornoCentro: true, adornoBorde: true, marco: { texto: "Escúchanos", color: "#5f3dc4", estilo: "abajo" } }),
  },
  {
    id: "ropa", nombre: "Tienda de ropa", descripcion: "Para tu catálogo o tu Instagram.",
    contenido: { tipo: "enlace", url: "https://instagram.com/mi.tienda" },
    diseno: d({ modulo: "liquido", ojoMarco: "redondeado", ojoCentro: "redondeado", color: "#1864ab", fondo: "#ffffff", tema: "ropa", adornoCentro: true, adornoBorde: false, marco: { texto: "Mira la colección", color: "#1864ab", estilo: "burbuja" } }),
  },
  {
    id: "veterinaria", nombre: "Veterinaria o tienda de mascotas", descripcion: "Huellitas y un WhatsApp para pedir cita.",
    contenido: { tipo: "whatsapp", numero: "+57 300 000 0000", mensaje: "Hola, quiero pedir una cita" },
    diseno: d({ modulo: "redondeado", ojoMarco: "circulo", ojoCentro: "punto", color: "#9c4f0a", fondo: "#fff8ef", tema: "mascotas", adornoCentro: true, adornoBorde: true, marco: { texto: "Pide tu cita", color: "#9c4f0a", estilo: "abajo" } }),
  },
  {
    id: "consultorio", nombre: "Consultorio o salud", descripcion: "Tu contacto, listo para guardar en la agenda.",
    contenido: { tipo: "contacto", nombre: "Ana", apellido: "Pérez", telefono: "+57 300 000 0000", correo: "", empresa: "Consultorio", web: "", direccion: "" },
    diseno: d({ modulo: "redondeado", ojoMarco: "redondeado", ojoCentro: "redondeado", color: "#0b7285", fondo: "#ffffff", tema: "salud", adornoCentro: true, adornoBorde: false, marco: { texto: "Guarda mi contacto", color: "#0b7285", estilo: "abajo" } }),
  },
  {
    id: "tecnologia", nombre: "Tecnología", descripcion: "Para tu web, tu app o tu soporte.",
    contenido: { tipo: "enlace", url: "https://mi-app.dev" },
    diseno: d({ modulo: "cuadrado", ojoMarco: "cuadrado", ojoCentro: "redondeado", color: { tipo: "radial", colores: ["#1c1c3c", "#0b7285"] }, fondo: "#f1f8ff", tema: "tecnologia", adornoCentro: true, adornoBorde: true, marco: { texto: "Escanéame", color: "#1c1c3c", estilo: "abajo" } }),
  },
  {
    id: "fiesta", nombre: "Fiesta o invitación", descripcion: "Globos y estrellas, con la ubicación de la fiesta.",
    contenido: { tipo: "ubicacion", lat: 4.6097, lng: -74.0817, nombre: "" },
    diseno: d({ modulo: "estrellas", ojoMarco: "redondeado", ojoCentro: "punto", color: "#a61e4d", fondo: "#fff5f9", tema: "fiesta", adornoCentro: true, adornoBorde: true, marco: { texto: "¡Te esperamos!", color: "#a61e4d", estilo: "burbuja" } }),
  },
  {
    id: "simple", nombre: "Clásico", descripcion: "Negro sobre blanco, sin adornos: el que mejor se lee.",
    contenido: { tipo: "enlace", url: "" },
    diseno: d({}),
  },
];
