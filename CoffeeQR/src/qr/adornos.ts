// Adornos por tema: dibujos originales (SVG en una caja de 24×24) para la insignia del centro y
// para el borde decorativo, que va fuera de la zona de lectura del QR.

export type TemaId = "plantas" | "cafe" | "comida" | "musica" | "ropa" | "mascotas" | "fiesta" | "salud" | "tecnologia";

export interface Tema {
  id: TemaId;
  nombre: string;
  /** Color sugerido para los módulos. */
  color: string;
  /** Color de acento (adornos). */
  acento: string;
  /** Dibujo de la insignia (relleno con `currentColor`). */
  icono: string;
  /** Dibujos pequeños para el borde (se alternan). */
  borde: string[];
}

// Cada dibujo es un trozo de SVG en 24×24 que usa fill="currentColor". Los del borde no llevan
// cuadros con un cuadro dentro: el lector los confundiría con las esquinas del QR.
const HOJA = '<path d="M5 19c0-8 5-14 15-15-1 10-7 15-15 15z" fill="currentColor"/><path d="M5 19c4-5 7-8 11-11" stroke="#fff" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".8"/>';
const MONSTERA = '<path d="M12 21c-5 0-9-4-9-9 0-5 4-9 9-9 5 0 9 4 9 9 0 5-4 9-9 9z" fill="currentColor"/><path d="M12 21V8M12 12l-5-4M12 15l5-4M12 18l-4-2" stroke="#fff" stroke-width="1.3" stroke-linecap="round" fill="none"/>';
const BROTE = '<path d="M12 22v-9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 13c-1-5-5-7-9-6 0 4 4 7 9 6zM12 11c1-5 5-7 9-6 0 4-4 7-9 6z" fill="currentColor"/>';
const TAZA = '<path d="M4 9h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9z" fill="currentColor"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 3c-1 1.5 1 2.5 0 4M12 3c-1 1.5 1 2.5 0 4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>';
const GRANO = '<ellipse cx="12" cy="12" rx="6.5" ry="9" transform="rotate(30 12 12)" fill="currentColor"/><path d="M9 5c4 4 2 10 6 14" stroke="#fff" stroke-width="1.3" fill="none" opacity=".8"/>';
const PLATO = '<circle cx="12" cy="13" r="7" fill="currentColor"/><circle cx="12" cy="13" r="4" fill="#fff" opacity=".35"/><path d="M3 4v6M2 4v3a1 1 0 0 0 2 0V4M21 4c-2 1-2 4-2 6h2V4z" stroke="currentColor" stroke-width="1.3" fill="currentColor"/>';
const HAMBURGUESA = '<path d="M4 11a8 6 0 0 1 16 0z" fill="currentColor"/><rect x="3" y="12.5" width="18" height="2.5" rx="1.2" fill="currentColor" opacity=".7"/><path d="M4 16.5h16v1a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" fill="currentColor"/>';
const NOTA = '<path d="M9 18V5l11-2v13" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="6.5" cy="18" r="3" fill="currentColor"/><circle cx="17.5" cy="16" r="3" fill="currentColor"/>';
const CORCHEA = '<path d="M12 4v11" stroke="currentColor" stroke-width="2"/><path d="M12 4c3 1 5 3 5 6" stroke="currentColor" stroke-width="2" fill="none"/><ellipse cx="9.5" cy="16.5" rx="3.5" ry="2.7" fill="currentColor"/>';
const CAMISETA = '<path d="M8 3l-5 3 2 5 3-1v11h8V10l3 1 2-5-5-3c-1 2-2 3-4 3s-3-1-4-3z" fill="currentColor"/>';
const PERCHA = '<path d="M12 7a2 2 0 1 1 2-2M12 7v2L3 15h18l-9-6" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round" stroke-linecap="round"/>';
const HUELLA = '<ellipse cx="12" cy="16" rx="5" ry="4" fill="currentColor"/><circle cx="6" cy="10" r="2.2" fill="currentColor"/><circle cx="10" cy="6.5" r="2.2" fill="currentColor"/><circle cx="14" cy="6.5" r="2.2" fill="currentColor"/><circle cx="18" cy="10" r="2.2" fill="currentColor"/>';
const HUESO = '<path d="M7 9a2.5 2.5 0 1 1 1-4 2.5 2.5 0 1 1 3 3l5 5a2.5 2.5 0 1 1 3 3 2.5 2.5 0 1 1-4 1 2.5 2.5 0 0 1-1-1L9 11a2.5 2.5 0 0 1-2-2z" fill="currentColor"/>';
const GLOBO = '<ellipse cx="12" cy="9" rx="6" ry="7" fill="currentColor"/><path d="M12 16l-1 2h2zM12 18c0 2-2 2-1 4" stroke="currentColor" stroke-width="1.2" fill="currentColor"/>';
const ESTRELLA = '<path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z" fill="currentColor"/>';
const CORAZON = '<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" fill="currentColor"/>';
const CRUZ = '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" fill="currentColor"/>';
const PULSO = '<path d="M2 12h5l2-5 3 10 3-7 2 2h5" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>';
const CHIP = '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/><rect x="9.5" y="9.5" width="5" height="5" rx="1" fill="#fff" opacity=".4"/><path d="M9 2v3M12 2v3M15 2v3M9 19v3M12 19v3M15 19v3M2 9h3M2 12h3M2 15h3M19 9h3M19 12h3M19 15h3" stroke="currentColor" stroke-width="1.5"/>';
const ONDAS = '<path d="M3 9a13 13 0 0 1 18 0M6 12.5a8.5 8.5 0 0 1 12 0M9 16a4 4 0 0 1 6 0" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="12" cy="19.5" r="1.6" fill="currentColor"/>';
const RAYO = '<path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="currentColor"/>';

export const TEMAS: Tema[] = [
  { id: "plantas", nombre: "Plantas", color: "#2b8a3e", acento: "#66a80f", icono: MONSTERA, borde: [HOJA, BROTE] },
  { id: "cafe", nombre: "Café", color: "#5c3d2e", acento: "#a9714b", icono: TAZA, borde: [GRANO, TAZA] },
  { id: "comida", nombre: "Comida", color: "#c92a2a", acento: "#f08c00", icono: PLATO, borde: [HAMBURGUESA, PLATO] },
  { id: "musica", nombre: "Música", color: "#5f3dc4", acento: "#e64980", icono: NOTA, borde: [CORCHEA, NOTA] },
  { id: "ropa", nombre: "Ropa", color: "#1864ab", acento: "#f06595", icono: CAMISETA, borde: [PERCHA, CAMISETA] },
  { id: "mascotas", nombre: "Mascotas", color: "#e67700", acento: "#8d5524", icono: HUELLA, borde: [HUESO, HUELLA] },
  { id: "fiesta", nombre: "Fiesta", color: "#c2255c", acento: "#fab005", icono: GLOBO, borde: [ESTRELLA, GLOBO] },
  { id: "salud", nombre: "Salud", color: "#0b7285", acento: "#e03131", icono: CRUZ, borde: [CORAZON, PULSO] },
  { id: "tecnologia", nombre: "Tecnología", color: "#1c1c3c", acento: "#15aabf", icono: CHIP, borde: [RAYO, ONDAS] },
];

export const tema = (id: TemaId | null | undefined) => TEMAS.find((t) => t.id === id) ?? null;
