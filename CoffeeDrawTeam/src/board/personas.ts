// Nombre y color de cada persona en el tablero.

export interface Persona {
  id: string;
  nombre: string;
  color: string;
}

/** 12 colores que se leen bien sobre fondo claro y oscuro (contraste ≥ 3:1). */
export const PALETA = [
  "#e5484d", "#e5702a", "#b07d48", "#4c9a2a", "#1f9d6b", "#0f9aa8",
  "#2f80ed", "#5b6cf0", "#8e4ec6", "#c2449f", "#d6336c", "#7a8a99",
];

/** El color preferido si está libre; si no, el siguiente libre de la paleta. */
export function colorLibre(preferido: string, usados: string[]): string {
  if (!usados.includes(preferido)) return preferido;
  const inicio = Math.max(0, PALETA.indexOf(preferido));
  for (let i = 1; i <= PALETA.length; i++) {
    const c = PALETA[(inicio + i) % PALETA.length];
    if (!usados.includes(c)) return c;
  }
  return preferido;
}

export function nombreValido(n: string): string | null {
  const limpio = n.trim().replace(/\s+/g, " ");
  return limpio.length >= 1 && limpio.length <= 24 ? limpio : null;
}

const PERFIL = "coffeedrawteam_perfil";

export function cargarPerfil(): { nombre: string; color: string } | null {
  try {
    const p = JSON.parse(localStorage.getItem(PERFIL) || "null");
    if (p && typeof p.nombre === "string" && nombreValido(p.nombre) && PALETA.includes(p.color)) return p;
  } catch {
    /* sin almacenamiento */
  }
  return null;
}

export function guardarPerfil(p: { nombre: string; color: string }): void {
  try {
    localStorage.setItem(PERFIL, JSON.stringify(p));
  } catch {
    /* sin almacenamiento */
  }
}
