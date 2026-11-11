// Contenido de las plantillas del catálogo. Cada plantilla se convierte en un
// archivo nativo (.cfd, .cfs o .csl) que la aplicación correspondiente abre.

type Cell = { raw: string; [style: string]: unknown };

const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const columnName = (index: number) => String.fromCharCode(65 + index);

/**
 * Construye las celdas de una hoja a partir de filas de texto. `styles` asigna
 * formato a filas (`r3`), columnas (`cB`) o celdas concretas (`B3`).
 */
function sheetFromRows(
  name: string,
  rows: string[][],
  styles: Record<string, Record<string, unknown>>,
  colWidths: Record<string, number>
) {
  const data: Record<string, Cell> = {};
  rows.forEach((row, r) => {
    row.forEach((raw, c) => {
      const key = `${columnName(c)}${r + 1}`;
      const style = { ...(styles[`c${columnName(c)}`] || {}), ...(styles[`r${r + 1}`] || {}), ...(styles[key] || {}) };
      if (raw === "" && Object.keys(style).length === 0) return;
      data[key] = { raw, ...style };
    });
  });
  return { id: newId("sheet"), name, data, colWidths };
}

const header = { bold: true, bg: "#107c41", color: "#ffffff", align: "center" };
const money = { format: "currency", align: "right" };
const totalRow = { bold: true, bg: "#dff6dd" };
const titleStyle = { bold: true, fontSize: 14, color: "#107c41" };

const SPREADSHEETS: Record<string, () => unknown[]> = {
  "calc-presupuesto-flujo": () => [
    sheetFromRows(
      "Flujo de caja",
      [
        ["PRESUPUESTO FINANCIERO Y FLUJO DE CAJA", "", "", "", ""],
        ["", "", "", "", ""],
        ["Concepto", "Enero", "Febrero", "Marzo", "Total trimestre"],
        ["Ventas", "18500000", "21200000", "24800000", "=SUMA(B4:D4)"],
        ["Servicios", "6400000", "7100000", "7900000", "=SUMA(B5:D5)"],
        ["Otros ingresos", "1200000", "900000", "1500000", "=SUMA(B6:D6)"],
        ["TOTAL INGRESOS", "=SUMA(B4:B6)", "=SUMA(C4:C6)", "=SUMA(D4:D6)", "=SUMA(E4:E6)"],
        ["", "", "", "", ""],
        ["Nómina", "9800000", "9800000", "10200000", "=SUMA(B9:D9)"],
        ["Arriendo y servicios", "3200000", "3200000", "3200000", "=SUMA(B10:D10)"],
        ["Proveedores", "5400000", "6100000", "7300000", "=SUMA(B11:D11)"],
        ["Impuestos", "1900000", "2200000", "2600000", "=SUMA(B12:D12)"],
        ["TOTAL EGRESOS", "=SUMA(B9:B12)", "=SUMA(C9:C12)", "=SUMA(D9:D12)", "=SUMA(E9:E12)"],
        ["", "", "", "", ""],
        ["FLUJO NETO", "=B7-B13", "=C7-C13", "=D7-D13", "=E7-E13"],
        ["Saldo acumulado", "=B15", "=B16+C15", "=C16+D15", ""],
        ["Margen sobre ingresos", "=B15/B7", "=C15/C7", "=D15/D7", "=E15/E7"],
      ],
      {
        A1: titleStyle,
        r3: header,
        A3: { ...header, align: "left" },
        cB: money,
        cC: money,
        cD: money,
        cE: { ...money, bold: true },
        r7: totalRow,
        r13: { bold: true, bg: "#fce8e6" },
        r15: { bold: true, bg: "#d3e3fd" },
        r17: { format: "percent", decimals: 1, align: "right", italic: true },
      },
      { A: 220, B: 130, C: 130, D: 130, E: 150 }
    ),
  ],
  "calc-inventario-kardex": () => [
    sheetFromRows(
      "Inventario",
      [
        ["CONTROL DE INVENTARIO", "", "", "", "", "", ""],
        ["", "", "", "", "", "", ""],
        ["Código", "Producto", "Existencias", "Mínimo", "Costo unitario", "Valor total", "Estado"],
        ["P-001", "Café tostado 500 g", "120", "40", "18500", "=C4*E4", '=SI(C4<=D4;"Reponer";"Correcto")'],
        ["P-002", "Café molido 250 g", "35", "50", "11200", "=C5*E5", '=SI(C5<=D5;"Reponer";"Correcto")'],
        ["P-003", "Filtros de papel x100", "210", "60", "6400", "=C6*E6", '=SI(C6<=D6;"Reponer";"Correcto")'],
        ["P-004", "Prensa francesa", "18", "10", "74000", "=C7*E7", '=SI(C7<=D7;"Reponer";"Correcto")'],
        ["P-005", "Taza de cerámica", "8", "25", "15900", "=C8*E8", '=SI(C8<=D8;"Reponer";"Correcto")'],
        ["P-006", "Molino manual", "26", "12", "98000", "=C9*E9", '=SI(C9<=D9;"Reponer";"Correcto")'],
        ["", "", "", "", "", "", ""],
        ["", "Totales", "=SUMA(C4:C9)", "", "", "=SUMA(F4:F9)", ""],
        ["", "Productos por reponer", '=CONTAR.SI(G4:G9;"Reponer")', "", "", "", ""],
      ],
      {
        A1: titleStyle,
        r3: header,
        cC: { align: "right" },
        cD: { align: "right" },
        cE: money,
        cF: money,
        cG: { align: "center" },
        r11: totalRow,
        r12: { bold: true },
      },
      { A: 90, B: 210, C: 110, D: 90, E: 130, F: 140, G: 110 }
    ),
  ],
  "calc-factura-comercial": () => [
    sheetFromRows(
      "Factura",
      [
        ["FACTURA COMERCIAL", "", "", "", ""],
        ["Cliente:", "Nombre del cliente", "", "Factura n.º:", "0001"],
        ["NIT / Documento:", "", "", "Fecha:", "=HOY()"],
        ["", "", "", "", ""],
        ["Descripción", "Cantidad", "Precio unitario", "Descuento", "Importe"],
        ["Servicio de consultoría", "10", "180000", "0%", "=B6*C6*(1-D6)"],
        ["Licencia anual", "2", "950000", "10%", "=B7*C7*(1-D7)"],
        ["Soporte técnico", "5", "120000", "0%", "=B8*C8*(1-D8)"],
        ["", "", "", "", ""],
        ["", "", "", "Subtotal", "=SUMA(E6:E8)"],
        ["", "", "", "IVA (19%)", "=E10*0.19"],
        ["", "", "", "TOTAL A PAGAR", "=E10+E11"],
      ],
      {
        A1: titleStyle,
        A2: { bold: true },
        A3: { bold: true },
        D2: { bold: true, align: "right" },
        D3: { bold: true, align: "right" },
        E3: { format: "date", align: "right" },
        r5: header,
        A5: { ...header, align: "left" },
        cB: { align: "right" },
        cC: money,
        D6: { format: "percent", align: "right" },
        D7: { format: "percent", align: "right" },
        D8: { format: "percent", align: "right" },
        cE: money,
        D10: { bold: true, align: "right" },
        D11: { bold: true, align: "right" },
        D12: { bold: true, align: "right", bg: "#dff6dd" },
        E12: { ...money, bold: true, bg: "#dff6dd" },
      },
      { A: 240, B: 100, C: 140, D: 140, E: 150 }
    ),
  ],
};

type SlideSpec = {
  layout: string;
  title: string;
  body?: string;
  second?: string;
  subtitle?: string;
  notes?: string;
};

function slideFromSpec(spec: SlideSpec) {
  const element = (type: string, box: number[], content: string, options: Record<string, unknown> = {}) => ({
    id: newId("el"),
    type,
    x: box[0],
    y: box[1],
    width: box[2],
    height: box[3],
    content,
    ...options,
  });
  const elements: unknown[] = [];
  if (spec.layout === "title") {
    elements.push(element("title", [10, 26, 80, 24], spec.title, { fontSize: 48, fontWeight: "bold", align: "center" }));
    elements.push(element("subtitle", [15, 54, 70, 14], spec.subtitle || "", { fontSize: 24, align: "center" }));
  } else if (spec.layout === "two-columns") {
    elements.push(element("title", [6, 7, 88, 15], spec.title, { fontSize: 34, fontWeight: "bold", align: "left" }));
    elements.push(element("text", [6, 26, 42, 64], spec.body || "", { fontSize: 20, align: "left", valign: "top" }));
    elements.push(element("text", [52, 26, 42, 64], spec.second || "", { fontSize: 20, align: "left", valign: "top" }));
  } else {
    elements.push(element("title", [6, 7, 88, 15], spec.title, { fontSize: 34, fontWeight: "bold", align: "left" }));
    elements.push(element("text", [6, 26, 88, 64], spec.body || "", { fontSize: 22, align: "left", valign: "top" }));
  }
  return { id: newId("slide"), layout: spec.layout, elements, notes: spec.notes || "", transition: "fade" };
}

const DECKS: Record<string, { themeId: string; slides: SlideSpec[] }> = {
  "view-pitch-deck": {
    themeId: "theme_espresso",
    slides: [
      { layout: "title", title: "Nombre de la empresa", subtitle: "Presentación para inversionistas" },
      { layout: "title-content", title: "El problema", body: "• ¿Qué dolor tiene el cliente hoy?\n• ¿Cuánto le cuesta no resolverlo?\n• ¿Por qué las soluciones actuales no bastan?" },
      { layout: "title-content", title: "Nuestra solución", body: "• Qué hacemos en una frase\n• Tres beneficios clave\n• Qué nos hace diferentes" },
      { layout: "two-columns", title: "Mercado y modelo de negocio", body: "Mercado\n• Tamaño total\n• Segmento objetivo\n• Crecimiento anual", second: "Modelo\n• Cómo ganamos dinero\n• Precio y márgenes\n• Canales de venta" },
      { layout: "title-content", title: "Tracción", body: "• Clientes y usuarios activos\n• Ingresos de los últimos meses\n• Alianzas y hitos alcanzados" },
      { layout: "title-content", title: "La ronda", body: "• Monto que buscamos\n• En qué se invertirá\n• Hitos a 18 meses", notes: "Cerrar con la petición concreta y los próximos pasos." },
    ],
  },
  "view-qbr-estrategia": {
    themeId: "theme_ocean",
    slides: [
      { layout: "title", title: "Resultados trimestrales", subtitle: "Revisión de negocio del trimestre" },
      { layout: "title-content", title: "Resumen ejecutivo", body: "• Resultado frente al objetivo\n• Principales logros\n• Principales desviaciones" },
      { layout: "two-columns", title: "Indicadores clave", body: "Ventas\n• Ingresos\n• Clientes nuevos\n• Ticket medio", second: "Operación\n• Satisfacción\n• Plazos de entrega\n• Incidencias" },
      { layout: "title-content", title: "Lecciones aprendidas", body: "• Qué funcionó\n• Qué no funcionó\n• Qué cambiaremos" },
      { layout: "title-content", title: "Plan del próximo trimestre", body: "• Objetivo 1 y responsable\n• Objetivo 2 y responsable\n• Objetivo 3 y responsable" },
    ],
  },
  "view-portafolio-corporativo": {
    themeId: "theme_latte",
    slides: [
      { layout: "title", title: "Portafolio de soluciones", subtitle: "Quiénes somos y qué ofrecemos" },
      { layout: "title-content", title: "Sobre nosotros", body: "• Historia y propósito\n• Equipo y experiencia\n• Clientes que confían en nosotros" },
      { layout: "two-columns", title: "Nuestros servicios", body: "Servicio 1\nDescripción breve del servicio y de su beneficio principal.", second: "Servicio 2\nDescripción breve del servicio y de su beneficio principal." },
      { layout: "title-content", title: "Casos de éxito", body: "• Cliente A: reto, solución y resultado\n• Cliente B: reto, solución y resultado" },
      { layout: "title-content", title: "Contacto", body: "Nombre y cargo\nCorreo electrónico\nTeléfono\nSitio web" },
    ],
  },
};

export interface TemplateFile {
  docId: string;
  fileName: string;
  contents: string;
}

/** Genera el archivo nativo de una plantilla. Devuelve `null` si no tiene contenido. */
export function buildTemplateFile(
  templateId: string,
  appId: string,
  title: string,
  docHtml?: string
): TemplateFile | null {
  const now = new Date().toISOString();
  const metadata = { title, author: "Usuario CoffeeWorks", createdAt: now, updatedAt: now };

  if (appId === "coffeedoc" && docHtml) {
    const docId = newId("doc");
    return {
      docId,
      fileName: `${title}.cfd`,
      contents: JSON.stringify({ format: "coffeedoc", version: 2, metadata: { ...metadata, id: docId }, content: docHtml }),
    };
  }
  if (appId === "coffeecalc" && SPREADSHEETS[templateId]) {
    const docId = newId("cfs");
    const sheets = SPREADSHEETS[templateId]();
    return {
      docId,
      fileName: `${title}.cfs`,
      contents: JSON.stringify({ format: "coffeecalc", version: 2, metadata: { ...metadata, id: docId }, sheets }),
    };
  }
  if (appId === "coffeeview" && DECKS[templateId]) {
    const docId = newId("pres");
    const deck = DECKS[templateId];
    return {
      docId,
      fileName: `${title}.csl`,
      contents: JSON.stringify({
        format: "coffeeview",
        version: 2,
        metadata: { ...metadata, id: docId, themeId: deck.themeId, aspectRatio: "16:9" },
        slides: deck.slides.map(slideFromSpec),
        assets: [],
      }),
    };
  }
  return null;
}
