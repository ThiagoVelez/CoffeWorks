// Contenido de las plantillas del catálogo. Cada plantilla se convierte en un
// archivo nativo (.cfd, .cfs, .csl, .pdf, .cpg, .cdb, .ccm o .clv) que la
// aplicación correspondiente abre.

import { buildExtraTemplate } from "./templateLibrary";

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
  "calc-presupuesto-personal": () => [
    sheetFromRows(
      "Presupuesto",
      [
        ["PRESUPUESTO PERSONAL MENSUAL", "", "", ""],
        ["", "", "", ""],
        ["Ingresos", "Previsto", "Real", "Diferencia"],
        ["Salario", "3200000", "3200000", "=C4-B4"],
        ["Trabajos extra", "400000", "550000", "=C5-B5"],
        ["Otros", "0", "80000", "=C6-B6"],
        ["Total ingresos", "=SUMA(B4:B6)", "=SUMA(C4:C6)", "=C7-B7"],
        ["", "", "", ""],
        ["Gastos", "Previsto", "Real", "Diferencia"],
        ["Vivienda", "1100000", "1100000", "=B10-C10"],
        ["Alimentación", "650000", "712000", "=B11-C11"],
        ["Transporte", "220000", "198000", "=B12-C12"],
        ["Servicios", "260000", "243000", "=B13-C13"],
        ["Educación", "300000", "300000", "=B14-C14"],
        ["Ocio", "200000", "265000", "=B15-C15"],
        ["Ahorro", "400000", "400000", "=B16-C16"],
        ["Total gastos", "=SUMA(B10:B16)", "=SUMA(C10:C16)", "=B17-C17"],
        ["", "", "", ""],
        ["Saldo del mes", "=B7-B17", "=C7-C17", ""],
        ["% del ingreso ahorrado", "=B16/B7", "=C16/C7", ""],
      ],
      {
        A1: titleStyle,
        r3: header,
        A3: { ...header, align: "left" },
        r9: header,
        A9: { ...header, align: "left" },
        cB: money,
        cC: money,
        cD: money,
        r7: totalRow,
        r17: { bold: true, bg: "#fce8e6" },
        r19: { bold: true, bg: "#d3e3fd" },
        r20: { format: "percent", decimals: 1, align: "right", italic: true },
      },
      { A: 210, B: 130, C: 130, D: 130 }
    ),
  ],
  "calc-cronograma-proyecto": () => [
    sheetFromRows(
      "Cronograma",
      [
        ["CRONOGRAMA DEL PROYECTO", "", "", "", "", "", ""],
        ["Proyecto:", "Nombre del proyecto", "", "Responsable:", "", "", ""],
        ["", "", "", "", "", "", ""],
        ["Actividad", "Responsable", "Inicio", "Fin", "Días", "Avance", "Estado"],
        ["Planeación y alcance", "Coordinación", "2026-02-02", "2026-02-13", "10", "100%", '=SI(F5>=1;"Terminada";SI(F5>0;"En curso";"Pendiente"))'],
        ["Levantamiento de requisitos", "Análisis", "2026-02-16", "2026-03-06", "15", "80%", '=SI(F6>=1;"Terminada";SI(F6>0;"En curso";"Pendiente"))'],
        ["Diseño", "Diseño", "2026-03-09", "2026-03-27", "15", "40%", '=SI(F7>=1;"Terminada";SI(F7>0;"En curso";"Pendiente"))'],
        ["Desarrollo", "Equipo técnico", "2026-03-30", "2026-05-22", "40", "0%", '=SI(F8>=1;"Terminada";SI(F8>0;"En curso";"Pendiente"))'],
        ["Pruebas", "Calidad", "2026-05-25", "2026-06-12", "15", "0%", '=SI(F9>=1;"Terminada";SI(F9>0;"En curso";"Pendiente"))'],
        ["Entrega y cierre", "Coordinación", "2026-06-15", "2026-06-19", "5", "0%", '=SI(F10>=1;"Terminada";SI(F10>0;"En curso";"Pendiente"))'],
        ["", "", "", "", "", "", ""],
        ["", "", "", "Total días", "=SUMA(E5:E10)", "", ""],
        ["", "", "", "Avance ponderado", "=SUMAPRODUCTO(E5:E10;F5:F10)/E12", "", ""],
        ["", "", "", "Actividades terminadas", '=CONTAR.SI(G5:G10;"Terminada")', "", ""],
      ],
      {
        A1: titleStyle,
        A2: { bold: true },
        D2: { bold: true, align: "right" },
        r4: header,
        A4: { ...header, align: "left" },
        cC: { format: "date", align: "center" },
        cD: { format: "date", align: "center" },
        cE: { align: "right" },
        cF: { format: "percent", align: "right" },
        cG: { align: "center" },
        D12: { bold: true, align: "right" },
        D13: { bold: true, align: "right" },
        D14: { bold: true, align: "right" },
        E13: { format: "percent", decimals: 1, bold: true, align: "right", bg: "#dff6dd" },
        r12: { bold: true },
      },
      { A: 230, B: 140, C: 110, D: 160, E: 110, F: 90, G: 110 }
    ),
  ],
  "calc-calificaciones": () => [
    sheetFromRows(
      "Calificaciones",
      [
        ["REGISTRO DE CALIFICACIONES", "", "", "", "", "", ""],
        ["Asignatura:", "Nombre de la materia", "", "Nota mínima:", "3", "", ""],
        ["", "", "", "", "", "", ""],
        ["Estudiante", "Parcial 1 (30%)", "Parcial 2 (30%)", "Trabajo (20%)", "Final (20%)", "Definitiva", "Resultado"],
        ["Ana María López", "4.2", "3.8", "4.5", "4", "=REDONDEAR(B5*0.3+C5*0.3+D5*0.2+E5*0.2;1)", '=SI(F5>=$E$2;"Aprobó";"Reprobó")'],
        ["Carlos Ramírez", "3", "2.6", "3.5", "2.8", "=REDONDEAR(B6*0.3+C6*0.3+D6*0.2+E6*0.2;1)", '=SI(F6>=$E$2;"Aprobó";"Reprobó")'],
        ["Daniela Torres", "4.8", "4.6", "5", "4.7", "=REDONDEAR(B7*0.3+C7*0.3+D7*0.2+E7*0.2;1)", '=SI(F7>=$E$2;"Aprobó";"Reprobó")'],
        ["Juan Pablo Gil", "2.5", "3.2", "3", "3.4", "=REDONDEAR(B8*0.3+C8*0.3+D8*0.2+E8*0.2;1)", '=SI(F8>=$E$2;"Aprobó";"Reprobó")'],
        ["Laura Méndez", "3.9", "4.1", "4", "3.6", "=REDONDEAR(B9*0.3+C9*0.3+D9*0.2+E9*0.2;1)", '=SI(F9>=$E$2;"Aprobó";"Reprobó")'],
        ["", "", "", "", "", "", ""],
        ["Promedio del grupo", "=PROMEDIO(B5:B9)", "=PROMEDIO(C5:C9)", "=PROMEDIO(D5:D9)", "=PROMEDIO(E5:E9)", "=PROMEDIO(F5:F9)", ""],
        ["Nota más alta", "=MAX(B5:B9)", "=MAX(C5:C9)", "=MAX(D5:D9)", "=MAX(E5:E9)", "=MAX(F5:F9)", ""],
        ["Aprobados", "", "", "", "", "", '=CONTAR.SI(G5:G9;"Aprobó")'],
      ],
      {
        A1: titleStyle,
        A2: { bold: true },
        D2: { bold: true, align: "right" },
        r4: header,
        A4: { ...header, align: "left" },
        cB: { align: "center", decimals: 1 },
        cC: { align: "center", decimals: 1 },
        cD: { align: "center", decimals: 1 },
        cE: { align: "center", decimals: 1 },
        cF: { align: "center", bold: true, decimals: 1 },
        cG: { align: "center" },
        r11: totalRow,
        r12: { bold: true },
        r13: { bold: true },
      },
      { A: 200, B: 110, C: 110, D: 110, E: 100, F: 100, G: 100 }
    ),
  ],
  "calc-nomina": () => [
    sheetFromRows(
      "Nómina",
      [
        ["NÓMINA MENSUAL", "", "", "", "", "", "", ""],
        ["Periodo:", "Mes y año", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", ""],
        ["Empleado", "Cargo", "Salario base", "Horas extra", "Valor horas extra", "Salud (4%)", "Pensión (4%)", "Neto a pagar"],
        ["Marta Rojas", "Coordinadora", "4200000", "4", "=C5/240*1.25*D5", "=(C5+E5)*0.04", "=(C5+E5)*0.04", "=C5+E5-F5-G5"],
        ["Andrés Cárdenas", "Analista", "3100000", "10", "=C6/240*1.25*D6", "=(C6+E6)*0.04", "=(C6+E6)*0.04", "=C6+E6-F6-G6"],
        ["Paula Herrera", "Auxiliar", "1750000", "0", "=C7/240*1.25*D7", "=(C7+E7)*0.04", "=(C7+E7)*0.04", "=C7+E7-F7-G7"],
        ["Sergio Patiño", "Técnico", "2300000", "6", "=C8/240*1.25*D8", "=(C8+E8)*0.04", "=(C8+E8)*0.04", "=C8+E8-F8-G8"],
        ["", "", "", "", "", "", "", ""],
        ["TOTALES", "", "=SUMA(C5:C8)", "=SUMA(D5:D8)", "=SUMA(E5:E8)", "=SUMA(F5:F8)", "=SUMA(G5:G8)", "=SUMA(H5:H8)"],
      ],
      {
        A1: titleStyle,
        A2: { bold: true },
        r4: header,
        A4: { ...header, align: "left" },
        cC: money,
        cD: { align: "center" },
        cE: money,
        cF: money,
        cG: money,
        cH: { ...money, bold: true },
        r10: totalRow,
      },
      { A: 170, B: 130, C: 130, D: 100, E: 140, F: 120, G: 120, H: 140 }
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
  "view-clase-academica": {
    themeId: "theme_latte",
    slides: [
      { layout: "title", title: "Tema de la clase", subtitle: "Asignatura · Docente · Fecha" },
      { layout: "title-content", title: "Objetivos de aprendizaje", body: "Al final de la sesión podrás:\n• Explicar el concepto principal\n• Aplicarlo en un ejemplo práctico\n• Relacionarlo con lo visto antes" },
      { layout: "title-content", title: "Conceptos clave", body: "• Concepto 1: definición breve\n• Concepto 2: definición breve\n• Concepto 3: definición breve" },
      { layout: "two-columns", title: "Ejemplo resuelto", body: "Planteamiento\nDescribe el problema o caso.", second: "Solución\nPaso 1 → Paso 2 → Resultado." },
      { layout: "title-content", title: "Actividad en clase", body: "• Forma grupos de 3 personas\n• Resuelve el ejercicio propuesto (15 min)\n• Comparte la respuesta con el grupo" },
      { layout: "title-content", title: "Resumen y tarea", body: "• Ideas principales de hoy\n• Lectura para la próxima clase\n• Fecha de entrega del taller", notes: "Dejar 5 minutos para preguntas." },
    ],
  },
  "view-sustentacion-investigacion": {
    themeId: "theme_ocean",
    slides: [
      { layout: "title", title: "Título del proyecto de investigación", subtitle: "Semillero · Investigadores · Tutor" },
      { layout: "title-content", title: "Planteamiento del problema", body: "• Contexto y antecedentes\n• Pregunta de investigación\n• Justificación" },
      { layout: "two-columns", title: "Objetivos", body: "Objetivo general\nQué se busca lograr con el proyecto.", second: "Objetivos específicos\n• Objetivo 1\n• Objetivo 2\n• Objetivo 3" },
      { layout: "title-content", title: "Metodología", body: "• Tipo de investigación y enfoque\n• Población y muestra\n• Instrumentos de recolección\n• Fases del trabajo" },
      { layout: "title-content", title: "Resultados", body: "• Hallazgo principal\n• Datos que lo respaldan\n• Comparación con estudios previos" },
      { layout: "title-content", title: "Conclusiones y trabajo futuro", body: "• Conclusiones\n• Limitaciones\n• Próximos pasos", notes: "Cerrar agradeciendo al jurado y abrir la ronda de preguntas." },
    ],
  },
  "view-inicio-proyecto": {
    themeId: "theme_espresso",
    slides: [
      { layout: "title", title: "Inicio del proyecto", subtitle: "Reunión de arranque con el equipo" },
      { layout: "title-content", title: "¿Por qué este proyecto?", body: "• Necesidad que resuelve\n• Beneficio esperado\n• Cómo mediremos el éxito" },
      { layout: "two-columns", title: "Alcance", body: "Incluye\n• Entregable 1\n• Entregable 2\n• Entregable 3", second: "No incluye\n• Fuera de alcance 1\n• Fuera de alcance 2" },
      { layout: "title-content", title: "Equipo y roles", body: "• Patrocinador: decide y prioriza\n• Líder del proyecto: coordina\n• Equipo: ejecuta y reporta avances" },
      { layout: "title-content", title: "Cronograma e hitos", body: "• Hito 1 — fecha\n• Hito 2 — fecha\n• Entrega final — fecha" },
      { layout: "title-content", title: "Próximos pasos", body: "• Acuerdos de esta reunión\n• Responsables y fechas\n• Próxima reunión de seguimiento" },
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
  const extra = buildExtraTemplate(templateId, appId, title);
  if (extra) {
    const docId = newId(extra.prefix);
    return { docId, fileName: `${title}.${extra.extension}`, contents: extra.contents };
  }
  return null;
}
