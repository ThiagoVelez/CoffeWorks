// Biblioteca de elementos de interfaz listos para usar: kits para móvil,
// escritorio y web. Cada elemento se construye con diseño automático, así se
// puede editar y crece con su contenido.

import type { AutoLayout, NodeType, Platform, UNode } from "../types";
import { DEFAULT_FONT, makeNode, solid, stroke } from "./model";

type Spec = Partial<UNode> & { type: NodeType; kids?: Spec[] };

export interface KitItem {
  id: string;
  name: string;
  platform: Platform | "common";
  /** Dónde se coloca dentro de una pantalla: arriba, abajo o debajo de lo último. */
  dock?: "top" | "bottom" | "left";
  build: () => Spec;
}

/** Crea los nodos de una especificación y devuelve la raíz. */
export function buildSpec(spec: Spec): { nodes: UNode[]; root: string } {
  const nodes: UNode[] = [];
  const make = (s: Spec): string => {
    const { kids, ...props } = s;
    const children = kids?.map(make);
    const node = makeNode(s.type, { ...props, ...(children ? { children } : {}) });
    nodes.push(node);
    return node.id;
  };
  const root = make(spec);
  return { nodes, root };
}

const pad = (v: number, h = v) => ({ top: v, right: h, bottom: v, left: h });
const layout = (mode: "row" | "column", gap: number, padding = pad(0), align: AutoLayout["align"] = "center", justify: AutoLayout["justify"] = "start"): AutoLayout => ({
  mode,
  gap,
  padding,
  align,
  justify,
});

const hug = { w: "hug", h: "hug" } as const;
const fillW = { w: "fill", h: "hug" } as const;

function T(text: string, size = 14, weight = 400, color = "#1e1e1e", extra: Partial<UNode> = {}): Spec {
  return { type: "text", name: text.slice(0, 24), text, fill: solid(color), font: { ...DEFAULT_FONT, size, weight }, ...extra };
}

function F(name: string, lay: AutoLayout, kids: Spec[], extra: Partial<UNode> = {}): Spec {
  return { type: "frame", name, fill: null, clip: false, layout: lay, sizing: hug, kids, ...extra };
}

const R = (w: number, h: number, color: string, radius = 0, extra: Partial<UNode> = {}): Spec => ({ type: "rect", w, h, fill: solid(color), radius, ...extra });
const E = (w: number, h: number, color: string, extra: Partial<UNode> = {}): Spec => ({ type: "ellipse", w, h, fill: solid(color), ...extra });
const I = (w: number, h: number, extra: Partial<UNode> = {}): Spec => ({ type: "image", name: "Imagen", w, h, fit: "cover", ...extra });
const icon = (glyph: string, size = 20, color = "#1e1e1e") => T(glyph, size, 400, color, { name: "Icono", font: { ...DEFAULT_FONT, size, family: "Segoe UI Symbol", align: "center" } });

const PRIMARY = "#0d99ff";
const MUTED = "#6b6b6b";

const button = (label: string, filled = true, radius = 10): Spec =>
  F("Botón", layout("row", 8, pad(12, 20), "center", "center"), [T(label, 15, 600, filled ? "#ffffff" : PRIMARY)], {
    fill: filled ? solid(PRIMARY) : null,
    stroke: filled ? null : stroke(PRIMARY, 1.5),
    radius,
  });

export const KITS: KitItem[] = [
  // ------------------------------------------------------------------ Móvil
  {
    id: "m-status",
    dock: "top",
    name: "Barra de estado",
    platform: "mobile",
    build: () =>
      F("Barra de estado", layout("row", 0, pad(14, 24), "center", "space-between"), [T("9:41", 15, 600), T("▂▄▆ ᯤ ▮", 12, 600)], {
        w: 393,
        h: 47,
        sizing: { w: "fixed", h: "hug" },
      }),
  },
  {
    id: "m-appbar",
    dock: "top",
    name: "Barra superior",
    platform: "mobile",
    build: () =>
      F("Barra superior", layout("row", 12, pad(12, 16), "center", "space-between"), [icon("←", 22), T("Título", 18, 700), icon("⋮", 22)], {
        w: 393,
        fill: solid("#ffffff"),
        sizing: { w: "fixed", h: "hug" },
        stroke: stroke("#ececec"),
      }),
  },
  {
    id: "m-tabbar",
    dock: "bottom",
    name: "Barra de pestañas",
    platform: "mobile",
    build: () =>
      F(
        "Barra de pestañas",
        layout("row", 0, pad(8, 12), "center", "space-between"),
        [
          ["⌂", "Inicio", true],
          ["⌕", "Buscar", false],
          ["♡", "Favoritos", false],
          ["☺", "Perfil", false],
        ].map(([g, l, active]) =>
          F(String(l), layout("column", 2, pad(4, 10), "center"), [icon(String(g), 22, active ? PRIMARY : MUTED), T(String(l), 11, 600, active ? PRIMARY : MUTED)])
        ),
        { w: 393, fill: solid("#ffffff"), sizing: { w: "fixed", h: "hug" }, stroke: stroke("#ececec") }
      ),
  },
  { id: "m-button", name: "Botón principal", platform: "mobile", build: () => ({ ...button("Continuar", true, 14), w: 345, sizing: { w: "fixed", h: "hug" }, layout: layout("row", 8, pad(15, 20), "center", "center") }) },
  { id: "m-button2", name: "Botón secundario", platform: "mobile", build: () => ({ ...button("Cancelar", false, 14), w: 345, sizing: { w: "fixed", h: "hug" }, layout: layout("row", 8, pad(15, 20), "center", "center") }) },
  {
    id: "m-input",
    name: "Campo de texto",
    platform: "mobile",
    build: () =>
      F(
        "Campo de texto",
        layout("column", 6, pad(0), "start"),
        [
          T("Correo electrónico", 13, 600, "#444"),
          F("Entrada", layout("row", 8, pad(13, 14), "center"), [T("nombre@correo.com", 15, 400, "#9e9e9e")], {
            stroke: stroke("#d0d0d0"),
            radius: 12,
            fill: solid("#ffffff"),
            sizing: fillW,
          }),
        ],
        { w: 345, sizing: { w: "fixed", h: "hug" } }
      ),
  },
  {
    id: "m-card",
    name: "Tarjeta",
    platform: "mobile",
    build: () =>
      F(
        "Tarjeta",
        layout("column", 0, pad(0), "start"),
        [
          I(345, 180),
          F(
            "Contenido",
            layout("column", 8, pad(16), "start"),
            [T("Título de la tarjeta", 17, 700), T("Una descripción breve que explica el contenido.", 14, 400, MUTED, { sizing: fillW, font: { ...DEFAULT_FONT, size: 14, autoSize: "height" }, w: 313 }), button("Ver más", true, 10)],
            { sizing: fillW }
          ),
        ],
        { w: 345, fill: solid("#ffffff"), radius: 16, clip: true, sizing: { w: "fixed", h: "hug" }, shadow: { x: 0, y: 4, blur: 16, color: "#000000", opacity: 0.1, inner: false } }
      ),
  },
  {
    id: "m-listitem",
    name: "Elemento de lista",
    platform: "mobile",
    build: () =>
      F(
        "Elemento de lista",
        layout("row", 12, pad(12, 16), "center"),
        [
          E(44, 44, "#d6ecff", { name: "Avatar" }),
          F("Textos", layout("column", 2, pad(0), "start"), [T("Ana Martínez", 15, 600), T("Hola, ¿cómo vas con el proyecto?", 13, 400, MUTED)], { sizing: fillW }),
          icon("›", 22, "#9e9e9e"),
        ],
        { w: 393, fill: solid("#ffffff"), sizing: { w: "fixed", h: "hug" } }
      ),
  },
  {
    id: "m-switch",
    name: "Interruptor",
    platform: "mobile",
    build: () =>
      F("Interruptor", layout("row", 0, pad(2), "center", "end"), [E(27, 27, "#ffffff", { shadow: { x: 0, y: 2, blur: 4, color: "#000000", opacity: 0.2, inner: false } })], {
        w: 51,
        h: 31,
        sizing: { w: "fixed", h: "fixed" },
        fill: solid("#34c759"),
        radius: 16,
      }),
  },
  {
    id: "m-fab",
    name: "Botón flotante",
    platform: "mobile",
    build: () =>
      F("Botón flotante", layout("row", 0, pad(0), "center", "center"), [T("+", 30, 400, "#ffffff")], {
        w: 56,
        h: 56,
        sizing: { w: "fixed", h: "fixed" },
        fill: solid(PRIMARY),
        radius: 28,
        shadow: { x: 0, y: 6, blur: 14, color: "#0d99ff", opacity: 0.35, inner: false },
      }),
  },
  {
    id: "m-sheet",
    dock: "bottom",
    name: "Hoja inferior",
    platform: "mobile",
    build: () =>
      F(
        "Hoja inferior",
        layout("column", 14, pad(12, 24), "center"),
        [R(40, 5, "#d0d0d0", 3, { name: "Asa" }), T("Compartir", 17, 700), T("Elige cómo quieres compartir este elemento.", 14, 400, MUTED), button("Copiar enlace", true, 12), button("Cancelar", false, 12)],
        { w: 393, fill: solid("#ffffff"), radius: 24, sizing: { w: "fixed", h: "hug" }, shadow: { x: 0, y: -4, blur: 20, color: "#000000", opacity: 0.12, inner: false } }
      ),
  },
  {
    id: "m-alert",
    name: "Alerta",
    platform: "mobile",
    build: () =>
      F(
        "Alerta",
        layout("column", 10, pad(20), "center"),
        [T("¿Eliminar elemento?", 17, 700), T("Esta acción no se puede deshacer.", 14, 400, MUTED), F("Acciones", layout("row", 10, pad(0), "center"), [button("Cancelar", false), button("Eliminar", true)])],
        { w: 300, fill: solid("#ffffff"), radius: 18, sizing: { w: "fixed", h: "hug" }, shadow: { x: 0, y: 10, blur: 30, color: "#000000", opacity: 0.18, inner: false } }
      ),
  },
  // ------------------------------------------------------------- Escritorio
  {
    id: "d-titlebar",
    dock: "top",
    name: "Barra de título",
    platform: "desktop",
    build: () =>
      F(
        "Barra de título",
        layout("row", 10, pad(8, 12), "center", "space-between"),
        [
          F("Título", layout("row", 8, pad(0), "center"), [R(16, 16, PRIMARY, 4, { name: "Logo" }), T("Mi aplicación", 13, 600)]),
          F("Controles", layout("row", 18, pad(0, 6), "center"), [icon("—", 13), icon("☐", 13), icon("✕", 13)]),
        ],
        { w: 1280, fill: solid("#f3f3f3"), sizing: { w: "fixed", h: "hug" }, stroke: stroke("#e0e0e0") }
      ),
  },
  {
    id: "d-menubar",
    dock: "top",
    name: "Barra de menús",
    platform: "desktop",
    build: () =>
      F("Barra de menús", layout("row", 4, pad(4, 8), "center"), ["Archivo", "Editar", "Ver", "Herramientas", "Ayuda"].map((m) => F(m, layout("row", 0, pad(5, 10)), [T(m, 13)], { radius: 4 })), {
        w: 1280,
        fill: solid("#ffffff"),
        sizing: { w: "fixed", h: "hug" },
      }),
  },
  {
    id: "d-sidebar",
    dock: "left",
    name: "Barra lateral",
    platform: "desktop",
    build: () =>
      F(
        "Barra lateral",
        layout("column", 4, pad(16, 12), "start"),
        [
          T("NAVEGACIÓN", 11, 700, "#8a8a8a"),
          ...[
            ["⌂", "Inicio", true],
            ["▤", "Documentos", false],
            ["☆", "Favoritos", false],
            ["⚙", "Ajustes", false],
          ].map(([g, l, a]) =>
            F(String(l), layout("row", 10, pad(9, 12), "center"), [icon(String(g), 15, a ? PRIMARY : "#555"), T(String(l), 14, a ? 600 : 400, a ? PRIMARY : "#333")], {
              fill: a ? solid("#e6f4ff") : null,
              radius: 8,
              sizing: fillW,
            })
          ),
        ],
        { w: 240, h: 720, fill: solid("#fafafa"), sizing: { w: "fixed", h: "fixed" }, stroke: stroke("#e6e6e6") }
      ),
  },
  {
    id: "d-toolbar",
    name: "Barra de herramientas",
    platform: "desktop",
    build: () =>
      F("Barra de herramientas", layout("row", 6, pad(6, 10), "center"), ["✚", "✎", "⎘", "⌫", "|", "⟲", "⟳"].map((g) => F("Botón", layout("row", 0, pad(6, 9)), [icon(g, 15, "#444")], { radius: 6 })), {
        fill: solid("#ffffff"),
        stroke: stroke("#e6e6e6"),
        radius: 8,
      }),
  },
  {
    id: "d-dialog",
    name: "Cuadro de diálogo",
    platform: "desktop",
    build: () =>
      F(
        "Diálogo",
        layout("column", 14, pad(20, 24), "start"),
        [
          T("Guardar cambios", 17, 700),
          T("¿Quieres guardar los cambios antes de cerrar?", 14, 400, "#444"),
          F("Botones", layout("row", 8, pad(0), "center", "end"), [button("No guardar", false, 6), button("Guardar", true, 6)], { sizing: fillW }),
        ],
        { w: 420, fill: solid("#ffffff"), radius: 10, sizing: { w: "fixed", h: "hug" }, shadow: { x: 0, y: 12, blur: 32, color: "#000000", opacity: 0.2, inner: false } }
      ),
  },
  { id: "d-button", name: "Botón", platform: "desktop", build: () => button("Aceptar", true, 6) },
  {
    id: "d-checkbox",
    name: "Casilla de verificación",
    platform: "desktop",
    build: () =>
      F("Casilla", layout("row", 8, pad(0), "center"), [F("Caja", layout("row", 0, pad(0), "center", "center"), [T("✓", 12, 700, "#ffffff")], { w: 18, h: 18, sizing: { w: "fixed", h: "fixed" }, fill: solid(PRIMARY), radius: 4 }), T("Recordar mi elección", 14)]),
  },
  {
    id: "d-select",
    name: "Lista desplegable",
    platform: "desktop",
    build: () =>
      F("Lista desplegable", layout("row", 8, pad(8, 12), "center", "space-between"), [T("Seleccionar…", 14, 400, "#555"), icon("⌄", 14, "#555")], {
        w: 220,
        sizing: { w: "fixed", h: "hug" },
        fill: solid("#ffffff"),
        stroke: stroke("#cfcfcf"),
        radius: 6,
      }),
  },
  {
    id: "d-tabs",
    name: "Pestañas",
    platform: "desktop",
    build: () =>
      F("Pestañas", layout("row", 0, pad(0), "end"), ["General", "Avanzado", "Acerca de"].map((t, i) => F(t, layout("row", 0, pad(10, 16)), [T(t, 14, i ? 400 : 600, i ? "#555" : PRIMARY)], { stroke: i ? null : stroke(PRIMARY, 2) }))),
  },
  {
    id: "d-table",
    name: "Tabla",
    platform: "desktop",
    build: () =>
      F(
        "Tabla",
        layout("column", 0, pad(0), "start"),
        [
          ["Nombre", "Estado", "Fecha"],
          ["Informe anual", "Listo", "12/03/2026"],
          ["Presupuesto", "En revisión", "18/03/2026"],
          ["Contrato", "Pendiente", "21/03/2026"],
        ].map((row, r) =>
          F(`Fila ${r}`, layout("row", 0, pad(10, 14), "center"), row.map((c) => T(c, 13, r ? 400 : 700, r ? "#333" : "#555", { w: 180, sizing: { w: "fixed", h: "hug" }, font: { ...DEFAULT_FONT, size: 13, weight: r ? 400 : 700, autoSize: "height" } })), {
            fill: solid(r ? "#ffffff" : "#f5f5f5"),
            stroke: stroke("#ececec"),
            sizing: fillW,
          })
        ),
        { w: 568, sizing: { w: "fixed", h: "hug" }, stroke: stroke("#e0e0e0"), radius: 8, clip: true }
      ),
  },
  {
    id: "d-statusbar",
    dock: "bottom",
    name: "Barra de estado",
    platform: "desktop",
    build: () =>
      F("Barra de estado", layout("row", 16, pad(4, 12), "center", "space-between"), [T("Listo", 12, 400, "#ffffff"), T("Línea 1, columna 1 · UTF-8", 12, 400, "#ffffff")], {
        w: 1280,
        fill: solid("#3d3d3d"),
        sizing: { w: "fixed", h: "hug" },
      }),
  },
  // -------------------------------------------------------------------- Web
  {
    id: "w-navbar",
    dock: "top",
    name: "Barra de navegación",
    platform: "web",
    build: () =>
      F(
        "Navegación",
        layout("row", 24, pad(18, 48), "center", "space-between"),
        [
          F("Marca", layout("row", 8, pad(0), "center"), [R(28, 28, PRIMARY, 8, { name: "Logo" }), T("Marca", 18, 800)]),
          F("Enlaces", layout("row", 28, pad(0), "center"), ["Producto", "Precios", "Blog", "Contacto"].map((l) => T(l, 15, 500, "#333"))),
          button("Empezar", true, 999),
        ],
        { w: 1440, fill: solid("#ffffff"), sizing: { w: "fixed", h: "hug" }, stroke: stroke("#eeeeee") }
      ),
  },
  {
    id: "w-hero",
    name: "Sección principal",
    platform: "web",
    build: () =>
      F(
        "Sección principal",
        layout("column", 20, pad(96, 48), "center"),
        [
          T("NUEVO · Versión 2.0", 13, 700, PRIMARY),
          T("Diseña, prueba y lanza más rápido", 56, 800, "#111", { font: { ...DEFAULT_FONT, size: 56, weight: 800, align: "center" } }),
          T("Una plataforma para crear productos digitales con tu equipo.", 20, 400, MUTED, { font: { ...DEFAULT_FONT, size: 20, align: "center" } }),
          F("Acciones", layout("row", 12, pad(8, 0), "center"), [button("Comenzar gratis", true, 999), button("Ver demostración", false, 999)]),
        ],
        { w: 1440, fill: { type: "linear", color: "#f0f8ff", color2: "#ffffff", angle: 180, opacity: 1 }, sizing: { w: "fixed", h: "hug" } }
      ),
  },
  {
    id: "w-feature",
    name: "Tarjeta de característica",
    platform: "web",
    build: () =>
      F(
        "Característica",
        layout("column", 12, pad(28), "start"),
        [
          F("Icono", layout("row", 0, pad(0), "center", "center"), [icon("⚡", 22, PRIMARY)], { w: 48, h: 48, sizing: { w: "fixed", h: "fixed" }, fill: solid("#e6f4ff"), radius: 12 }),
          T("Rápido de verdad", 20, 700),
          T("Carga en milisegundos y funciona sin conexión.", 15, 400, MUTED, { w: 296, sizing: fillW, font: { ...DEFAULT_FONT, size: 15, autoSize: "height" } }),
        ],
        { w: 352, fill: solid("#ffffff"), radius: 16, sizing: { w: "fixed", h: "hug" }, stroke: stroke("#ececec") }
      ),
  },
  {
    id: "w-pricing",
    name: "Tarjeta de precio",
    platform: "web",
    build: () =>
      F(
        "Precio",
        layout("column", 14, pad(32), "start"),
        [
          T("Profesional", 16, 700, PRIMARY),
          F("Importe", layout("row", 4, pad(0), "end"), [T("$19", 44, 800), T("/mes", 15, 400, MUTED)]),
          ...["Proyectos ilimitados", "Colaboración en equipo", "Exportación a código"].map((f) => F("Ventaja", layout("row", 8, pad(0), "center"), [T("✓", 15, 700, "#1aa260"), T(f, 15, 400, "#333")])),
          { ...button("Elegir plan", true, 10), sizing: fillW },
        ],
        { w: 320, fill: solid("#ffffff"), radius: 20, sizing: { w: "fixed", h: "hug" }, stroke: stroke(PRIMARY, 2) }
      ),
  },
  {
    id: "w-form",
    name: "Formulario de contacto",
    platform: "web",
    build: () =>
      F(
        "Formulario",
        layout("column", 14, pad(32), "start"),
        [
          T("Escríbenos", 24, 800),
          ...["Nombre", "Correo electrónico", "Mensaje"].map((l, i) =>
            F(l, layout("column", 6, pad(0), "start"), [T(l, 13, 600, "#444"), F("Entrada", layout("row", 0, pad(12, 14)), [T(i === 2 ? "¿En qué podemos ayudarte?" : "", 14, 400, "#9e9e9e")], { sizing: { w: "fill", h: i === 2 ? "fixed" : "hug" }, h: 96, stroke: stroke("#d0d0d0"), radius: 8 })], { sizing: fillW })
          ),
          { ...button("Enviar mensaje", true, 8), sizing: fillW },
        ],
        { w: 420, fill: solid("#ffffff"), radius: 16, sizing: { w: "fixed", h: "hug" }, shadow: { x: 0, y: 8, blur: 24, color: "#000000", opacity: 0.08, inner: false } }
      ),
  },
  {
    id: "w-testimonial",
    name: "Testimonio",
    platform: "web",
    build: () =>
      F(
        "Testimonio",
        layout("column", 16, pad(28), "start"),
        [
          T("«La mejor herramienta que hemos usado para diseñar nuestro producto.»", 17, 500, "#222", { w: 344, sizing: fillW, font: { ...DEFAULT_FONT, size: 17, weight: 500, italic: true, autoSize: "height" } }),
          F("Autor", layout("row", 12, pad(0), "center"), [E(40, 40, "#ffe0b2", { name: "Avatar" }), F("Datos", layout("column", 0, pad(0), "start"), [T("Laura Gómez", 14, 700), T("Directora de producto", 13, 400, MUTED)])]),
        ],
        { w: 400, fill: solid("#fafafa"), radius: 16, sizing: { w: "fixed", h: "hug" } }
      ),
  },
  {
    id: "w-footer",
    dock: "bottom",
    name: "Pie de página",
    platform: "web",
    build: () =>
      F(
        "Pie de página",
        layout("row", 24, pad(40, 48), "start", "space-between"),
        [
          F("Marca", layout("column", 8, pad(0), "start"), [T("Marca", 18, 800, "#ffffff"), T("© 2026 Marca. Todos los derechos reservados.", 13, 400, "#a0a0a0")]),
          ...[
            ["Producto", "Funciones", "Precios"],
            ["Empresa", "Nosotros", "Empleo"],
            ["Ayuda", "Soporte", "Contacto"],
          ].map((col) => F(col[0], layout("column", 8, pad(0), "start"), [T(col[0], 14, 700, "#ffffff"), ...col.slice(1).map((l) => T(l, 14, 400, "#c4c4c4"))])),
        ],
        { w: 1440, fill: solid("#111827"), sizing: { w: "fixed", h: "hug" } }
      ),
  },
  { id: "w-button", name: "Botón", platform: "web", build: () => button("Saber más", true, 999) },
  {
    id: "w-badge",
    name: "Insignia",
    platform: "web",
    build: () => F("Insignia", layout("row", 0, pad(4, 10)), [T("Nuevo", 12, 700, "#0b6bcb")], { fill: solid("#e6f4ff"), radius: 999 }),
  },
  // ----------------------------------------------------------------- Comunes
  { id: "c-avatar", name: "Avatar", platform: "common", build: () => E(48, 48, "#d6ecff", { name: "Avatar" }) },
  { id: "c-divider", name: "Separador", platform: "common", build: () => R(320, 1, "#e0e0e0", 0, { name: "Separador" }) },
  { id: "c-image", name: "Imagen", platform: "common", build: () => I(320, 200, { radius: 12 }) },
  {
    id: "c-chip",
    name: "Chip",
    platform: "common",
    build: () => F("Chip", layout("row", 6, pad(6, 12), "center"), [T("Etiqueta", 13, 500, "#333")], { fill: solid("#f0f0f0"), radius: 999 }),
  },
  {
    id: "c-progress",
    name: "Barra de progreso",
    platform: "common",
    build: () => F("Progreso", layout("row", 0, pad(0), "start"), [R(180, 8, PRIMARY, 4, { name: "Avance" })], { w: 300, h: 8, sizing: { w: "fixed", h: "fixed" }, fill: solid("#e6e6e6"), radius: 4, clip: true }),
  },
];
