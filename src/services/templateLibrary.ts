// Plantillas de CoffeePDF, CoffeePage, CoffeeDataBase, CoffeeEdit, CoffeeLive,
// CoffeeUI/UX y CoffeeUML.
// Cada función genera el contenido del archivo nativo que abre la aplicación.

import { PAINT_TEMPLATES, PHOTO_TEMPLATES, VECTOR_TEMPLATES } from "./artTemplates";
import { BOOKS_TEMPLATES } from "./booksTemplates";
const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export interface ExtraTemplate {
  extension: string;
  prefix: string;
  contents: string;
}

// ---------------------------------------------------------------------------
// CoffeePDF: PDF sencillos escritos a mano (solo texto ASCII, sin compresión)
// ---------------------------------------------------------------------------

/** Caracteres fuera de Latin-1 que existen en WinAnsiEncoding. */
const WIN_ANSI: Record<string, number> = { "•": 0x95, "—": 0x97, "–": 0x96, "…": 0x85, "“": 0x93, "”": 0x94, "‘": 0x91, "’": 0x92, "€": 0x80 };

function pdfText(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = WIN_ANSI[ch] ?? ch.charCodeAt(0);
    if (ch === "(" || ch === ")" || ch === "\\") out += `\\${ch}`;
    else if (code >= 32 && code < 127) out += ch;
    else if (code < 256) out += `\\${code.toString(8).padStart(3, "0")}`;
    else out += "?";
  }
  return out;
}

const hex = (color: string) => {
  const n = parseInt(color.replace("#", ""), 16);
  return `${(((n >> 16) & 255) / 255).toFixed(3)} ${(((n >> 8) & 255) / 255).toFixed(3)} ${((n & 255) / 255).toFixed(3)}`;
};

/** Lienzo de una página A4 (595 × 842 pt) con el origen arriba a la izquierda. */
class PdfPage {
  ops: string[] = [];
  static readonly W = 595;
  static readonly H = 842;

  text(x: number, y: number, text: string, size = 11, opts: { bold?: boolean; color?: string; align?: "left" | "center" | "right" } = {}) {
    const width = text.length * size * (opts.bold ? 0.56 : 0.5);
    const left = opts.align === "center" ? x - width / 2 : opts.align === "right" ? x - width : x;
    this.ops.push(`BT /${opts.bold ? "F2" : "F1"} ${size} Tf ${hex(opts.color || "#222222")} rg ${left.toFixed(1)} ${(PdfPage.H - y).toFixed(1)} Td (${pdfText(text)}) Tj ET`);
    return this;
  }

  line(x1: number, y1: number, x2: number, y2: number, width = 0.7, color = "#9e9e9e") {
    this.ops.push(`${hex(color)} RG ${width} w ${x1} ${PdfPage.H - y1} m ${x2} ${PdfPage.H - y2} l S`);
    return this;
  }

  rect(x: number, y: number, w: number, h: number, opts: { fill?: string; stroke?: string; width?: number } = {}) {
    const box = `${x} ${PdfPage.H - y - h} ${w} ${h} re`;
    if (opts.fill && opts.stroke) this.ops.push(`${hex(opts.fill)} rg ${hex(opts.stroke)} RG ${opts.width ?? 0.8} w ${box} B`);
    else if (opts.fill) this.ops.push(`${hex(opts.fill)} rg ${box} f`);
    else this.ops.push(`${hex(opts.stroke || "#9e9e9e")} RG ${opts.width ?? 0.8} w ${box} S`);
    return this;
  }

  /** Etiqueta con una línea para escribir a su derecha. */
  field(x: number, y: number, label: string, width: number) {
    this.text(x, y, label, 10, { bold: true, color: "#424242" });
    const start = x + label.length * 5.6 + 8;
    this.line(start, y + 2, x + width, y + 2);
    return this;
  }

  /** Párrafo con ajuste de línea aproximado. */
  paragraph(x: number, y: number, text: string, width: number, size = 11, lineHeight = 16, align: "left" | "center" = "left") {
    const maxChars = Math.floor(width / (size * 0.5));
    const lines: string[] = [];
    let current = "";
    for (const word of text.split(" ")) {
      if ((current + " " + word).trim().length > maxChars) {
        lines.push(current.trim());
        current = word;
      } else current += ` ${word}`;
    }
    if (current.trim()) lines.push(current.trim());
    lines.forEach((l, i) => this.text(align === "center" ? x + width / 2 : x, y + i * lineHeight, l, size, { align }));
    return y + lines.length * lineHeight;
  }
}

function buildPdf(pages: PdfPage[], title: string): string {
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  const kids = pages.map((_, i) => `${5 + i * 2} 0 R`).join(" ");
  objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  pages.forEach((page, i) => {
    const stream = page.ops.join("\n");
    objects[5 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PdfPage.W} ${PdfPage.H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`;
    objects[6 + i * 2] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  const infoId = objects.length;
  objects[infoId] = `<< /Title (${pdfText(title)}) /Producer (CoffeeWorks) >>`;
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = out.length;
    out += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i++) out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return out;
}

const PDF_RED = "#c62828";

function header(page: PdfPage, title: string, subtitle: string) {
  page.rect(0, 0, PdfPage.W, 84, { fill: PDF_RED });
  page.text(48, 46, title, 20, { bold: true, color: "#ffffff" });
  page.text(48, 66, subtitle, 10, { color: "#ffe3e3" });
}

function pdfSolicitud(): string {
  const p = new PdfPage();
  header(p, "FORMULARIO DE SOLICITUD", "Diligencie todos los campos con letra clara · Radicado n.º ________");
  let y = 124;
  p.text(48, y, "1. Datos del solicitante", 12, { bold: true, color: PDF_RED });
  y += 28;
  p.field(48, y, "Nombre completo:", 547);
  y += 30;
  p.field(48, y, "Documento:", 290).field(305, y, "Teléfono:", 547);
  y += 30;
  p.field(48, y, "Correo electrónico:", 547);
  y += 30;
  p.field(48, y, "Dependencia o programa:", 547);
  y += 44;
  p.text(48, y, "2. Tipo de solicitud", 12, { bold: true, color: PDF_RED });
  y += 26;
  ["Certificado", "Permiso", "Soporte técnico", "Reclamo", "Otro"].forEach((label, i) => {
    const x = 48 + i * 104;
    p.rect(x, y - 10, 11, 11, { stroke: "#616161" });
    p.text(x + 17, y, label, 10);
  });
  y += 40;
  p.text(48, y, "3. Descripción de la solicitud", 12, { bold: true, color: PDF_RED });
  y += 12;
  p.rect(48, y, 499, 170, { stroke: "#bdbdbd" });
  for (let k = 1; k < 7; k++) p.line(58, y + k * 24, 537, y + k * 24, 0.4, "#e0e0e0");
  y += 196;
  p.text(48, y, "4. Documentos adjuntos", 12, { bold: true, color: PDF_RED });
  y += 24;
  for (let k = 0; k < 3; k++) {
    p.rect(48, y - 10, 11, 11, { stroke: "#616161" });
    p.line(66, y + 2, 547, y + 2);
    y += 24;
  }
  y += 40;
  p.line(48, y, 260, y, 0.8, "#424242").line(335, y, 547, y, 0.8, "#424242");
  p.text(154, y + 16, "Firma del solicitante", 10, { align: "center", color: "#616161" });
  p.text(441, y + 16, "Fecha (día / mes / año)", 10, { align: "center", color: "#616161" });
  p.rect(48, 770, 499, 40, { fill: "#fafafa", stroke: "#e0e0e0" });
  p.text(58, 786, "Espacio para uso interno · Recibido por: ____________________  Fecha: ___________", 9, { color: "#757575" });
  p.text(58, 800, "Respuesta enviada el: ___________  Estado: ☐ Aprobada  ☐ Rechazada".replace(/☐/g, "[ ]"), 9, { color: "#757575" });
  return buildPdf([p], "Formulario de solicitud");
}

function pdfActaEntrega(): string {
  const p = new PdfPage();
  header(p, "ACTA DE ENTREGA Y RECIBIDO", "Inventario de bienes, equipos o documentos entregados");
  let y = 120;
  p.field(48, y, "Acta n.º:", 230).field(260, y, "Fecha:", 400).field(415, y, "Lugar:", 547);
  y += 30;
  p.field(48, y, "Entrega:", 290).field(305, y, "Cargo:", 547);
  y += 30;
  p.field(48, y, "Recibe:", 290).field(305, y, "Cargo:", 547);
  y += 40;
  const cols = [48, 90, 330, 400, 547];
  const titles = ["Ítem", "Descripción", "Cantidad", "Estado / observación"];
  p.rect(48, y, 499, 24, { fill: PDF_RED });
  titles.forEach((t, i) => p.text(cols[i] + 8, y + 16, t, 10, { bold: true, color: "#ffffff" }));
  y += 24;
  for (let r = 0; r < 12; r++) {
    if (r % 2 === 1) p.rect(48, y, 499, 24, { fill: "#fbf1f1" });
    p.text(cols[0] + 14, y + 16, String(r + 1), 10, { color: "#757575" });
    y += 24;
  }
  p.rect(48, y - 24 * 12 - 24, 499, 24 * 13, { stroke: "#bdbdbd" });
  cols.slice(1, -1).forEach((x) => p.line(x, y - 24 * 13, x, y, 0.6, "#bdbdbd"));
  y += 30;
  p.text(48, y, "Observaciones", 12, { bold: true, color: PDF_RED });
  y += 10;
  p.rect(48, y, 499, 90, { stroke: "#bdbdbd" });
  y += 150;
  p.line(60, y, 270, y, 0.8, "#424242").line(325, y, 535, y, 0.8, "#424242");
  p.text(165, y + 16, "Entrega (nombre y firma)", 10, { align: "center", color: "#616161" });
  p.text(430, y + 16, "Recibe (nombre y firma)", 10, { align: "center", color: "#616161" });
  return buildPdf([p], "Acta de entrega y recibido");
}

function pdfCertificado(): string {
  const p = new PdfPage();
  p.rect(24, 24, 547, 794, { stroke: PDF_RED, width: 3 });
  p.rect(34, 34, 527, 774, { stroke: "#e0a8a8", width: 1 });
  p.text(297, 150, "NOMBRE DE LA INSTITUCIÓN", 13, { bold: true, align: "center", color: "#616161" });
  p.text(297, 230, "CERTIFICADO", 40, { bold: true, align: "center", color: PDF_RED });
  p.text(297, 262, "de participación", 16, { align: "center", color: "#424242" });
  p.text(297, 330, "Se otorga a", 13, { align: "center", color: "#616161" });
  p.line(120, 380, 475, 380, 1, "#424242");
  p.text(297, 400, "Nombre del participante", 9, { align: "center", color: "#9e9e9e" });
  p.paragraph(
    80,
    450,
    "Por su participación en el evento, curso o actividad realizado del ___ al ___ de __________ de ______, con una intensidad de ___ horas.",
    435,
    12,
    18,
    "center"
  );
  p.line(80, 650, 260, 650, 0.8, "#424242").line(335, 650, 515, 650, 0.8, "#424242");
  p.text(170, 666, "Nombre y cargo", 10, { align: "center", color: "#616161" });
  p.text(425, 666, "Nombre y cargo", 10, { align: "center", color: "#616161" });
  p.text(297, 740, "Ciudad, ____ de ______________ de ______", 10, { align: "center", color: "#757575" });
  return buildPdf([p], "Certificado");
}

// ---------------------------------------------------------------------------
// CoffeePage: cuadernos (.cpg)
// ---------------------------------------------------------------------------

const TODO = '<span class="cp-tag" data-tag="todo" data-checked="false" contenteditable="false"></span>&nbsp;';
const IMPORTANT = '<span class="cp-tag" data-tag="important" contenteditable="false"></span>&nbsp;';
const IDEA = '<span class="cp-tag" data-tag="idea" contenteditable="false"></span>&nbsp;';
const QUESTION = '<span class="cp-tag" data-tag="question" contenteditable="false"></span>&nbsp;';

type PaperStyle = "blank" | "lines" | "grid";
type NoteBlock = { x: number; y: number; width: number; html: string };

function page(title: string, blocks: NoteBlock[], paper: PaperStyle = "blank", level: 0 | 1 = 0) {
  const now = Date.now();
  return {
    id: uid("page"),
    title,
    level,
    createdAt: now,
    updatedAt: now,
    paper,
    blocks: blocks.map((b) => ({ id: uid("blk"), kind: "text", ...b })),
    strokes: [],
  };
}

const section = (name: string, color: string, pages: ReturnType<typeof page>[]) => ({ id: uid("sec"), name, color, pages });

const notebook = (sections: ReturnType<typeof section>[]) => JSON.stringify({ format: "coffeepage", version: 1, sections });

function classPage(subject: string) {
  return page(
    `Clase 1 — ${subject}`,
    [
      { x: 48, y: 24, width: 640, html: `<h2>Tema de la clase</h2><p><b>Fecha:</b> &nbsp; &nbsp; <b>Docente:</b></p>` },
      { x: 48, y: 140, width: 300, html: "<h3>Ideas clave</h3><ul><li>Concepto</li><li>Palabra clave</li><li>Pregunta</li></ul>" },
      { x: 380, y: 140, width: 560, html: "<h3>Notas de la clase</h3><p>Escribe aquí las explicaciones, ejemplos y ejercicios.</p>" },
      { x: 48, y: 520, width: 892, html: `<h3>Resumen</h3><p>En pocas líneas: ¿qué aprendí hoy?</p><p>${QUESTION}Dudas para la próxima clase:</p>` },
    ],
    "lines"
  );
}

function pageCuadernoClases(): string {
  return notebook([
    section("Matemáticas", "#1e88e5", [classPage("Matemáticas")]),
    section("Ciencias", "#43a047", [classPage("Ciencias")]),
    section("Idiomas", "#fb8c00", [classPage("Idiomas")]),
    section("Tareas y exámenes", "#e53935", [
      page("Pendientes", [
        {
          x: 48,
          y: 24,
          width: 620,
          html: `<h2>Tareas pendientes</h2><p>${TODO}Taller de Matemáticas — entrega el lunes</p><p>${TODO}Informe de laboratorio de Ciencias</p><p>${TODO}Lectura del capítulo 3</p><p>${IMPORTANT}Examen parcial — semana 8</p>`,
        },
      ]),
      page("Calendario de exámenes", [
        {
          x: 48,
          y: 24,
          width: 640,
          html: "<h2>Calendario de exámenes</h2><table><tr><th>Materia</th><th>Fecha</th><th>Temas</th></tr><tr><td>Matemáticas</td><td></td><td></td></tr><tr><td>Ciencias</td><td></td><td></td></tr><tr><td>Idiomas</td><td></td><td></td></tr></table>",
        },
      ]),
    ]),
  ]);
}

function pageBitacora(): string {
  return notebook([
    section("Planeación", "#8e24aa", [
      page("Pregunta y objetivos", [
        {
          x: 48,
          y: 24,
          width: 720,
          html: `<h2>Proyecto de investigación</h2><p><b>Semillero:</b> &nbsp; &nbsp; <b>Integrantes:</b> &nbsp; &nbsp; <b>Tutor:</b></p><h3>Pregunta de investigación</h3><p>¿…?</p><h3>Objetivo general</h3><p></p><h3>Objetivos específicos</h3><ol><li></li><li></li><li></li></ol>`,
        },
      ]),
      page("Cronograma", [
        {
          x: 48,
          y: 24,
          width: 720,
          html: `<h2>Cronograma</h2><p>${TODO}Revisión bibliográfica</p><p>${TODO}Diseño de instrumentos</p><p>${TODO}Trabajo de campo</p><p>${TODO}Análisis de datos</p><p>${TODO}Informe final y socialización</p>`,
        },
      ]),
    ]),
    section("Diario de campo", "#1e88e5", [
      page(
        "Sesión 1",
        [
          { x: 48, y: 24, width: 720, html: "<h2>Sesión 1</h2><p><b>Fecha:</b> &nbsp; &nbsp; <b>Lugar:</b> &nbsp; &nbsp; <b>Asistentes:</b></p>" },
          { x: 48, y: 130, width: 440, html: "<h3>Actividades realizadas</h3><ul><li></li></ul><h3>Hallazgos</h3><ul><li></li></ul>" },
          { x: 520, y: 130, width: 420, html: `<h3>Próximos pasos</h3><p>${TODO}</p><p>${TODO}</p><h3>Ideas</h3><p>${IDEA}</p>` },
        ],
        "lines"
      ),
    ]),
    section("Referencias", "#43a047", [
      page("Bibliografía", [
        {
          x: 48,
          y: 24,
          width: 760,
          html: "<h2>Bibliografía (APA 7)</h2><p>Apellido, A. A. (Año). <i>Título del libro</i>. Editorial.</p><p>Apellido, A. A. y Apellido, B. B. (Año). Título del artículo. <i>Nombre de la revista, volumen</i>(número), páginas. https://doi.org/…</p>",
        },
      ]),
    ]),
  ]);
}

function pagePlanificador(): string {
  const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  return notebook([
    section("Esta semana", "#fb8c00", [
      page("Resumen de la semana", [
        {
          x: 48,
          y: 24,
          width: 760,
          html: `<h2>Semana del ___ al ___</h2><h3>Tres prioridades</h3><p>${IMPORTANT}</p><p>${IMPORTANT}</p><p>${IMPORTANT}</p><h3>Hábitos</h3><p>${TODO}Ejercicio &nbsp; ${TODO}Lectura &nbsp; ${TODO}Dormir 8 h</p>`,
        },
      ]),
      ...days.map((d) =>
        page(
          d,
          [
            { x: 48, y: 24, width: 420, html: `<h2>${d}</h2><h3>Tareas</h3><p>${TODO}</p><p>${TODO}</p><p>${TODO}</p>` },
            { x: 500, y: 24, width: 420, html: "<h3>Agenda</h3><p>08:00 —</p><p>10:00 —</p><p>14:00 —</p><p>16:00 —</p><h3>Notas</h3>" },
          ],
          "grid",
          1
        )
      ),
    ]),
    section("Metas del mes", "#43a047", [
      page("Metas", [{ x: 48, y: 24, width: 760, html: `<h2>Metas del mes</h2><p>${TODO}Meta personal</p><p>${TODO}Meta de estudio o trabajo</p><p>${TODO}Meta de salud</p><h3>¿Cómo voy?</h3><p></p>` }]),
    ]),
  ]);
}

// ---------------------------------------------------------------------------
// CoffeeDataBase: scripts SQL que la app convierte en una base SQLite
// ---------------------------------------------------------------------------

const DB_SCRIPTS: Record<string, string> = {
  "db-tienda": `
CREATE TABLE clientes (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre VARCHAR(255) NOT NULL, correo VARCHAR(255) UNIQUE, telefono VARCHAR(255), ciudad VARCHAR(255), fecha_alta DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE categorias (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre VARCHAR(255) NOT NULL UNIQUE);
CREATE TABLE productos (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre VARCHAR(255) NOT NULL, categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL, precio DECIMAL(19,4) NOT NULL DEFAULT 0, existencias INTEGER NOT NULL DEFAULT 0, activo BOOLEAN DEFAULT 1);
CREATE TABLE pedidos (id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE, fecha DATETIME DEFAULT CURRENT_TIMESTAMP, estado VARCHAR(255) DEFAULT 'Pendiente');
CREATE TABLE detalle_pedido (id INTEGER PRIMARY KEY AUTOINCREMENT, pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE, producto_id INTEGER NOT NULL REFERENCES productos(id), cantidad INTEGER NOT NULL DEFAULT 1, precio_unitario DECIMAL(19,4) NOT NULL);
INSERT INTO clientes (nombre, correo, telefono, ciudad, fecha_alta) VALUES
 ('Laura Gómez','laura.gomez@correo.com','3104567890','Bogotá','2026-01-12 10:20:00'),
 ('Andrés Pérez','andres.perez@correo.com','3159876543','Medellín','2026-02-03 16:05:00'),
 ('Camila Ruiz','camila.ruiz@correo.com','3201122334','Cali','2026-02-20 09:45:00'),
 ('Jorge Martínez','jorge.martinez@correo.com','3007788990','Barranquilla','2026-03-08 14:30:00');
INSERT INTO categorias (nombre) VALUES ('Café'),('Accesorios'),('Tazas');
INSERT INTO productos (nombre, categoria_id, precio, existencias, activo) VALUES
 ('Café tostado 500 g',1,18500,120,1),('Café molido 250 g',1,11200,35,1),('Prensa francesa',2,74000,18,1),('Molino manual',2,98000,26,1),('Taza de cerámica',3,15900,48,1);
INSERT INTO pedidos (cliente_id, fecha, estado) VALUES (1,'2026-03-10 11:00:00','Entregado'),(2,'2026-03-14 17:20:00','Enviado'),(1,'2026-04-02 09:10:00','Pendiente'),(3,'2026-04-05 15:40:00','Pendiente');
INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario) VALUES (1,1,2,18500),(1,5,2,15900),(2,3,1,74000),(3,2,3,11200),(4,4,1,98000),(4,1,1,18500);
CREATE VIEW ventas_por_cliente AS SELECT c.nombre AS cliente, COUNT(DISTINCT p.id) AS pedidos, SUM(d.cantidad * d.precio_unitario) AS total FROM clientes c JOIN pedidos p ON p.cliente_id = c.id JOIN detalle_pedido d ON d.pedido_id = p.id GROUP BY c.id ORDER BY total DESC;
`,
  "db-semilleros": `
CREATE TABLE semilleros (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre VARCHAR(255) NOT NULL UNIQUE, linea_investigacion VARCHAR(255), tutor VARCHAR(255), descripcion TEXT);
CREATE TABLE estudiantes (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre VARCHAR(255) NOT NULL, documento VARCHAR(255) UNIQUE, programa VARCHAR(255), semestre INTEGER, correo VARCHAR(255));
CREATE TABLE estudiantes_semilleros (id INTEGER PRIMARY KEY AUTOINCREMENT, estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE, semillero_id INTEGER NOT NULL REFERENCES semilleros(id) ON DELETE CASCADE, fecha_asignacion DATETIME DEFAULT CURRENT_TIMESTAMP, estado VARCHAR(255) DEFAULT 'ACTIVO');
CREATE TABLE proyectos (id INTEGER PRIMARY KEY AUTOINCREMENT, semillero_id INTEGER NOT NULL REFERENCES semilleros(id) ON DELETE CASCADE, titulo VARCHAR(255) NOT NULL, descripcion TEXT, fecha_inicio DATETIME, avance INTEGER DEFAULT 0, observaciones TEXT);
INSERT INTO semilleros (nombre, linea_investigacion, tutor, descripcion) VALUES
 ('Datos Abiertos','Ciencia de datos','Mg. Patricia Díaz','Análisis de datos públicos para la toma de decisiones.'),
 ('Software Libre','Ingeniería de software','Ing. Ricardo Moreno','Desarrollo de herramientas de código abierto.'),
 ('Energías Limpias','Sostenibilidad','PhD. Elena Castro','Prototipos de energía solar para zonas rurales.');
INSERT INTO estudiantes (nombre, documento, programa, semestre, correo) VALUES
 ('Valentina Ortiz','1001234567','Ingeniería de Sistemas',6,'vortiz@universidad.edu.co'),
 ('Santiago Rincón','1002345678','Ingeniería de Sistemas',4,'srincon@universidad.edu.co'),
 ('Mariana Jiménez','1003456789','Ingeniería Ambiental',7,'mjimenez@universidad.edu.co'),
 ('Felipe Navarro','1004567890','Estadística',5,'fnavarro@universidad.edu.co');
INSERT INTO estudiantes_semilleros (estudiante_id, semillero_id, fecha_asignacion, estado) VALUES (1,1,'2026-02-01','ACTIVO'),(4,1,'2026-02-01','ACTIVO'),(2,2,'2026-02-15','ACTIVO'),(1,2,'2026-03-01','INACTIVO'),(3,3,'2026-02-10','ACTIVO');
INSERT INTO proyectos (semillero_id, titulo, descripcion, fecha_inicio, avance, observaciones) VALUES
 (1,'Movilidad urbana con datos abiertos','Visualización de rutas y tiempos de viaje.','2026-02-15',45,'Faltan datos del último trimestre.'),
 (2,'Gestor de inventarios libre','Aplicación web para tiendas de barrio.','2026-03-01',30,NULL),
 (3,'Secador solar de café','Prototipo de secado para pequeños productores.','2026-02-20',60,'Primeras pruebas en finca piloto.');
`,
  "db-biblioteca": `
CREATE TABLE autores (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre VARCHAR(255) NOT NULL, pais VARCHAR(255));
CREATE TABLE libros (id INTEGER PRIMARY KEY AUTOINCREMENT, titulo VARCHAR(255) NOT NULL, autor_id INTEGER REFERENCES autores(id) ON DELETE SET NULL, isbn VARCHAR(255) UNIQUE, anio INTEGER, ejemplares INTEGER NOT NULL DEFAULT 1);
CREATE TABLE socios (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre VARCHAR(255) NOT NULL, documento VARCHAR(255) UNIQUE, telefono VARCHAR(255), fecha_alta DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE prestamos (id INTEGER PRIMARY KEY AUTOINCREMENT, libro_id INTEGER NOT NULL REFERENCES libros(id), socio_id INTEGER NOT NULL REFERENCES socios(id) ON DELETE CASCADE, fecha_prestamo DATETIME DEFAULT CURRENT_TIMESTAMP, fecha_devolucion DATETIME, devuelto BOOLEAN DEFAULT 0);
INSERT INTO autores (nombre, pais) VALUES ('Gabriel García Márquez','Colombia'),('Isabel Allende','Chile'),('Julio Cortázar','Argentina'),('Laura Restrepo','Colombia');
INSERT INTO libros (titulo, autor_id, isbn, anio, ejemplares) VALUES
 ('Cien años de soledad',1,'978-0307474728',1967,3),('El amor en los tiempos del cólera',1,'978-0307387264',1985,2),('La casa de los espíritus',2,'978-0525433477',1982,2),('Rayuela',3,'978-8437604572',1963,1),('Delirio',4,'978-8420469805',2004,1);
INSERT INTO socios (nombre, documento, telefono) VALUES ('Diana Castro','52123456','3112223344'),('Mateo Vargas','80234567','3125556677'),('Sofía Londoño','1019876543','3138889900');
INSERT INTO prestamos (libro_id, socio_id, fecha_prestamo, fecha_devolucion, devuelto) VALUES (1,1,'2026-04-01','2026-04-15',1),(4,2,'2026-04-10','2026-04-24',0),(3,3,'2026-04-12','2026-04-26',0);
CREATE VIEW prestamos_pendientes AS SELECT s.nombre AS socio, l.titulo AS libro, p.fecha_prestamo, p.fecha_devolucion FROM prestamos p JOIN socios s ON s.id = p.socio_id JOIN libros l ON l.id = p.libro_id WHERE p.devuelto = 0;
`,
  "db-inventario": `
CREATE TABLE proveedores (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre VARCHAR(255) NOT NULL, nit VARCHAR(255) UNIQUE, contacto VARCHAR(255), telefono VARCHAR(255));
CREATE TABLE bodegas (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre VARCHAR(255) NOT NULL, ciudad VARCHAR(255));
CREATE TABLE articulos (id INTEGER PRIMARY KEY AUTOINCREMENT, codigo VARCHAR(255) NOT NULL UNIQUE, nombre VARCHAR(255) NOT NULL, proveedor_id INTEGER REFERENCES proveedores(id) ON DELETE SET NULL, costo DECIMAL(19,4) DEFAULT 0, stock_minimo INTEGER DEFAULT 0);
CREATE TABLE movimientos (id INTEGER PRIMARY KEY AUTOINCREMENT, articulo_id INTEGER NOT NULL REFERENCES articulos(id) ON DELETE CASCADE, bodega_id INTEGER NOT NULL REFERENCES bodegas(id), tipo VARCHAR(255) NOT NULL DEFAULT 'Entrada', cantidad INTEGER NOT NULL, fecha DATETIME DEFAULT CURRENT_TIMESTAMP, nota TEXT);
INSERT INTO proveedores (nombre, nit, contacto, telefono) VALUES ('Distribuidora Andina S.A.S.','900123456-1','Claudia Mejía','6014567890'),('Suministros del Valle','900654321-7','Hernán Ospina','6023334455');
INSERT INTO bodegas (nombre, ciudad) VALUES ('Bodega principal','Bogotá'),('Punto de venta norte','Bogotá');
INSERT INTO articulos (codigo, nombre, proveedor_id, costo, stock_minimo) VALUES ('A-001','Resma de papel carta',1,14500,20),('A-002','Tóner para impresora',1,189000,3),('A-003','Silla ergonómica',2,420000,2),('A-004','Cuaderno argollado',2,6800,40);
INSERT INTO movimientos (articulo_id, bodega_id, tipo, cantidad, fecha, nota) VALUES (1,1,'Entrada',100,'2026-03-01','Compra mensual'),(1,1,'Salida',35,'2026-03-15','Consumo oficinas'),(2,1,'Entrada',6,'2026-03-02',NULL),(2,1,'Salida',4,'2026-03-20',NULL),(3,2,'Entrada',4,'2026-03-05',NULL),(4,2,'Entrada',60,'2026-03-05',NULL),(4,2,'Salida',28,'2026-03-25','Venta');
CREATE VIEW existencias AS SELECT a.codigo, a.nombre, SUM(CASE WHEN m.tipo = 'Entrada' THEN m.cantidad ELSE -m.cantidad END) AS existencias, a.stock_minimo FROM articulos a LEFT JOIN movimientos m ON m.articulo_id = a.id GROUP BY a.id ORDER BY a.codigo;
`,
};

// ---------------------------------------------------------------------------
// CoffeeEdit: proyectos (.ccm) con textos y pistas listas
// ---------------------------------------------------------------------------

type TextSpec = { track: number; start: number; duration: number; text: string; size: number; x: number; y: number; color?: string; background?: string | null; bold?: boolean; animation?: string };

function editProject(width: number, height: number, background: string, texts: TextSpec[]): string {
  const tracks = [
    { id: uid("trk"), kind: "text", name: "Títulos", muted: false, hidden: false, locked: false },
    { id: uid("trk"), kind: "text", name: "Rótulos", muted: false, hidden: false, locked: false },
    { id: uid("trk"), kind: "video", name: "Video 2", muted: false, hidden: false, locked: false },
    { id: uid("trk"), kind: "video", name: "Video 1", muted: false, hidden: false, locked: false },
    { id: uid("trk"), kind: "audio", name: "Música", muted: false, hidden: false, locked: false },
  ];
  const clips = texts.map((t) => ({
    id: uid("clip"),
    type: "text",
    trackId: tracks[t.track].id,
    start: t.start,
    duration: t.duration,
    fadeIn: 0.3,
    fadeOut: 0.3,
    text: t.text,
    font: "Hanken Grotesk",
    size: t.size,
    color: t.color || "#ffffff",
    bold: t.bold ?? true,
    italic: false,
    align: "center",
    background: t.background ?? null,
    outline: true,
    x: t.x,
    y: t.y,
    animation: t.animation || "fade",
  }));
  return JSON.stringify({ format: "coffeeedit", version: 1, settings: { width, height, fps: 30, background }, media: [], tracks, clips });
}

const EDIT_PROJECTS: Record<string, () => string> = {
  "edit-youtube": () =>
    editProject(1920, 1080, "#101010", [
      { track: 0, start: 0, duration: 4, text: "Título del video", size: 110, x: 0.5, y: 0.45, animation: "pop" },
      { track: 1, start: 0.8, duration: 3.2, text: "Subtítulo o nombre del canal", size: 48, x: 0.5, y: 0.6, bold: false, animation: "slide" },
      { track: 1, start: 6, duration: 5, text: "Tu nombre · Rol", size: 40, x: 0.24, y: 0.85, background: "#26a680", animation: "slide" },
      { track: 0, start: 60, duration: 8, text: "¡Gracias por ver! Suscríbete", size: 84, x: 0.5, y: 0.4, animation: "pop" },
      { track: 1, start: 61, duration: 7, text: "Mira el siguiente video →", size: 44, x: 0.5, y: 0.58, bold: false },
    ]),
  "edit-reel": () =>
    editProject(1080, 1920, "#000000", [
      { track: 0, start: 0, duration: 3, text: "¿Sabías que…?", size: 120, x: 0.5, y: 0.3, animation: "pop" },
      { track: 1, start: 3, duration: 4, text: "Dato o consejo 1", size: 72, x: 0.5, y: 0.75, background: "#000000aa", animation: "typewriter" },
      { track: 1, start: 7, duration: 4, text: "Dato o consejo 2", size: 72, x: 0.5, y: 0.75, background: "#000000aa", animation: "typewriter" },
      { track: 1, start: 11, duration: 4, text: "Dato o consejo 3", size: 72, x: 0.5, y: 0.75, background: "#000000aa", animation: "typewriter" },
      { track: 0, start: 15, duration: 4, text: "Sígueme para más", size: 96, x: 0.5, y: 0.45, color: "#26a680", animation: "pop" },
    ]),
  "edit-tutorial": () =>
    editProject(1920, 1080, "#0d1b16", [
      { track: 0, start: 0, duration: 5, text: "Cómo hacer…", size: 104, x: 0.5, y: 0.42, animation: "fade" },
      { track: 1, start: 1, duration: 4, text: "Tutorial paso a paso", size: 46, x: 0.5, y: 0.58, bold: false },
      { track: 1, start: 6, duration: 4, text: "Paso 1 · Preparación", size: 44, x: 0.2, y: 0.1, background: "#26a680", animation: "slide" },
      { track: 1, start: 30, duration: 4, text: "Paso 2 · Desarrollo", size: 44, x: 0.2, y: 0.1, background: "#26a680", animation: "slide" },
      { track: 1, start: 60, duration: 4, text: "Paso 3 · Resultado", size: 44, x: 0.2, y: 0.1, background: "#26a680", animation: "slide" },
      { track: 0, start: 90, duration: 6, text: "Resumen y recursos en la descripción", size: 64, x: 0.5, y: 0.5 },
    ]),
};

// ---------------------------------------------------------------------------
// CoffeeLive: colecciones de escenas (.clv)
// ---------------------------------------------------------------------------

type SourceSpec = { kind: string; name: string; x: number; y: number; w: number; h: number; [key: string]: unknown };

const source = (spec: SourceSpec) => ({ id: uid("src"), visible: true, locked: false, ...spec });
const scene = (name: string, sources: SourceSpec[]) => ({ id: uid("scn"), name, sources: sources.map(source) });

const banner = (text: string, y: number, h: number, size: number, extra: Record<string, unknown> = {}): SourceSpec => ({
  kind: "text",
  name: "Texto",
  x: 0,
  y,
  w: 1920,
  h,
  text,
  size,
  font: "Hanken Grotesk",
  color: "#ffffff",
  bold: true,
  outline: true,
  background: null,
  align: "center",
  ...extra,
});
const fill = (color: string, name = "Fondo"): SourceSpec => ({ kind: "color", name, x: 0, y: 0, w: 1920, h: 1080, color });

function liveCollection(scenes: ReturnType<typeof scene>[]): string {
  return JSON.stringify({ format: "coffeelive", version: 1, scenes, currentSceneId: scenes[0].id });
}

const LIVE_COLLECTIONS: Record<string, () => string> = {
  "live-clase": () =>
    liveCollection([
      scene("Presentación", [
        banner("Nombre de la clase · Docente", 1000, 80, 40, { name: "Rótulo", background: "#1d1410cc", align: "left", x: 40, w: 1300 }),
        { kind: "camera", name: "Cámara", x: 1500, y: 700, w: 384, h: 216, radius: 18 },
        { kind: "screen", name: "Diapositivas", x: 0, y: 0, w: 1920, h: 1080 },
      ]),
      scene("Solo cámara", [
        banner("Preguntas y respuestas", 960, 90, 48, { name: "Rótulo", background: "#ef6c00cc" }),
        { kind: "camera", name: "Cámara", x: 0, y: 0, w: 1920, h: 1080, fit: "cover" },
      ]),
      scene("Empezamos pronto", [banner("La clase empieza en unos minutos", 470, 140, 80, { name: "Aviso" }), fill("#1d1410")]),
      scene("Fin", [banner("¡Gracias por asistir!", 430, 140, 96, { name: "Despedida" }), banner("Material y tareas en la plataforma del curso", 590, 80, 40, { name: "Detalle", bold: false }), fill("#3b1d0a")]),
    ]),
  "live-gaming": () =>
    liveCollection([
      scene("Juego", [
        { kind: "camera", name: "Cámara", x: 1560, y: 40, w: 320, h: 320, round: true },
        banner("¡Sígueme! · Redes", 1010, 60, 32, { name: "Barra inferior", background: "#000000aa", x: 0, w: 1920 }),
        { kind: "screen", name: "Captura del juego", x: 0, y: 0, w: 1920, h: 1080, fit: "cover" },
      ]),
      scene("Charla", [
        { kind: "camera", name: "Cámara", x: 160, y: 90, w: 1600, h: 900, radius: 24, fit: "cover" },
        fill("#120c0a"),
      ]),
      scene("Empezando pronto", [banner("EMPEZANDO PRONTO", 440, 160, 120, { name: "Aviso", color: "#ff8a2a" }), banner("Prepara las palomitas 🍿", 610, 80, 44, { name: "Detalle", bold: false }), fill("#120c0a")]),
      scene("Pausa", [banner("VOLVEMOS ENSEGUIDA", 470, 140, 110, { name: "Aviso" }), fill("#2c1609")]),
      scene("Fin del directo", [banner("¡GRACIAS POR VER!", 440, 160, 110, { name: "Despedida", color: "#ff8a2a" }), banner("Nos vemos en el próximo directo", 610, 80, 44, { name: "Detalle", bold: false }), fill("#120c0a")]),
    ]),
  "live-podcast": () =>
    liveCollection([
      scene("Dos cámaras", [
        banner("Invitado · Tema", 900, 70, 36, { name: "Rótulo invitado", background: "#ef6c00", x: 990, w: 860, align: "left" }),
        banner("Presentador", 900, 70, 36, { name: "Rótulo presentador", background: "#1d1410", x: 70, w: 860, align: "left" }),
        { kind: "camera", name: "Cámara invitado", x: 980, y: 180, w: 880, h: 660, radius: 20, fit: "cover" },
        { kind: "camera", name: "Cámara presentador", x: 60, y: 180, w: 880, h: 660, radius: 20, fit: "cover" },
        banner("NOMBRE DEL PODCAST · Episodio 1", 60, 80, 44, { name: "Título" }),
        fill("#1d1410"),
      ]),
      scene("Presentador", [
        banner("Presentador", 960, 80, 40, { name: "Rótulo", background: "#ef6c00", x: 60, w: 700, align: "left" }),
        { kind: "camera", name: "Cámara presentador", x: 0, y: 0, w: 1920, h: 1080, fit: "cover" },
      ]),
      scene("Invitado", [
        banner("Invitado · Tema", 960, 80, 40, { name: "Rótulo", background: "#ef6c00", x: 60, w: 700, align: "left" }),
        { kind: "camera", name: "Cámara invitado", x: 0, y: 0, w: 1920, h: 1080, fit: "cover" },
      ]),
      scene("Intro", [banner("NOMBRE DEL PODCAST", 420, 160, 110, { name: "Título", color: "#ff8a2a" }), banner("Episodio 1 · Tema del día", 600, 80, 48, { name: "Episodio", bold: false }), fill("#1d1410")]),
    ]),
};

// ---------------------------------------------------------------------------
// CoffeeUI/UX: diseños (.cux). La app completa los valores que falten.
// ---------------------------------------------------------------------------

type UxNode = Record<string, unknown> & { id: string; type: string; children?: string[] };

class UxBuilder {
  nodes: Record<string, UxNode> = {};
  add(type: string, props: Record<string, unknown>, children: UxNode[] = []): UxNode {
    const n: UxNode = { id: uid(type.slice(0, 3)), type, name: type, x: 0, y: 0, w: 100, h: 100, ...props };
    if (children.length || ["frame", "group", "component"].includes(type)) n.children = children.map((c) => c.id);
    this.nodes[n.id] = n;
    return n;
  }
  solid = (color: string, opacity = 1) => ({ type: "solid", color, color2: "#ffffff", angle: 90, opacity });
  text(text: string, x: number, y: number, size = 16, weight = 400, color = "#1e1e1e", extra: Record<string, unknown> = {}) {
    return this.add("text", { name: text.slice(0, 30), text, x, y, w: 300, h: size * 1.3, fill: this.solid(color), font: { size, weight, autoSize: "width" }, ...extra });
  }
  rect(x: number, y: number, w: number, h: number, color: string, radius = 0, extra: Record<string, unknown> = {}) {
    return this.add("rect", { name: "Rectángulo", x, y, w, h, fill: this.solid(color), radius, ...extra });
  }
  button(label: string, x: number, y: number, w: number, color = "#0d99ff", textColor = "#ffffff", extra: Record<string, unknown> = {}) {
    const t = this.text(label, 0, 0, 16, 600, textColor);
    return this.add(
      "frame",
      {
        name: `Botón ${label}`,
        x,
        y,
        w,
        h: 52,
        fill: this.solid(color),
        radius: 14,
        clip: false,
        layout: { mode: "row", gap: 8, padding: { top: 15, right: 20, bottom: 15, left: 20 }, justify: "center", align: "center" },
        sizing: { w: "fixed", h: "hug" },
        ...extra,
      },
      [t]
    );
  }
  input(label: string, placeholder: string, x: number, y: number, w: number) {
    return this.add("group", { name: `Campo ${label}`, x, y, w, h: 76, fill: null }, [
      this.text(label, 0, 0, 13, 600, "#444444"),
      this.rect(0, 24, w, 50, "#ffffff", 12, { name: "Entrada", stroke: { color: "#d0d0d0", width: 1, opacity: 1, dash: false } }),
      this.text(placeholder, 16, 39, 15, 400, "#9e9e9e"),
    ]);
  }
  frame(name: string, x: number, y: number, w: number, h: number, device: string, children: UxNode[], extra: Record<string, unknown> = {}) {
    return this.add("frame", { name, x, y, w, h, device, fill: this.solid("#ffffff"), clip: true, layout: { mode: "none", gap: 12, padding: { top: 16, right: 16, bottom: 16, left: 16 }, justify: "start", align: "start" }, ...extra }, children);
  }
  doc(platform: string, roots: UxNode[], start?: string) {
    const page = { id: uid("pg"), name: "Página 1", background: "#f5f5f5", nodes: this.nodes, children: roots.map((r) => r.id), startFrame: start };
    return JSON.stringify({ format: "coffeeuiux", version: 1, platform, pages: [page], currentPage: page.id, colorStyles: [{ id: uid("cs"), name: "Primario", color: "#0d99ff" }, { id: uid("cs"), name: "Texto", color: "#1e1e1e" }] });
  }
}

function uxLoginApp(): string {
  const b = new UxBuilder();
  const status = (y = 14) => [b.text("9:41", 24, y, 15, 600), b.text("▂▄▆ ▮", 330, y + 2, 12, 600)];
  const home = b.frame("Inicio", 473, 0, 393, 852, "iphone-15", [
    ...status(),
    b.text("Hola, Ana 👋", 24, 70, 28, 800),
    b.text("Tus pedidos de hoy", 24, 112, 15, 400, "#6b6b6b"),
    ...[0, 1, 2].flatMap((i) => [
      b.rect(24, 160 + i * 96, 345, 80, "#f5f7fa", 16, { name: `Pedido ${i + 1}` }),
      b.rect(40, 176 + i * 96, 48, 48, ["#ffe0b2", "#d6ecff", "#e1f3e7"][i], 12, { name: "Miniatura" }),
      b.text(["Café de origen", "Taza de cerámica", "Molino manual"][i], 104, 180 + i * 96, 16, 600),
      b.text(["En camino", "Preparando", "Entregado"][i], 104, 204 + i * 96, 13, 400, "#6b6b6b"),
    ]),
    b.rect(0, 768, 393, 84, "#ffffff", 0, { name: "Barra de pestañas", stroke: { color: "#ececec", width: 1, opacity: 1, dash: false } }),
    b.text("⌂  Inicio", 40, 792, 13, 700, "#0d99ff"),
    b.text("⌕  Buscar", 160, 792, 13, 500, "#6b6b6b"),
    b.text("☺  Perfil", 284, 792, 13, 500, "#6b6b6b"),
  ]);
  const btn = b.button("Iniciar sesión", 24, 520, 345);
  btn.link = { target: home.id, transition: "slide-left", duration: 300 };
  const login = b.frame("Inicio de sesión", 0, 0, 393, 852, "iphone-15", [
    ...status(),
    b.rect(24, 110, 64, 64, "#0d99ff", 18, { name: "Logo" }),
    b.text("Bienvenido de nuevo", 24, 200, 28, 800),
    b.text("Entra con tu correo para continuar", 24, 242, 15, 400, "#6b6b6b"),
    b.input("Correo electrónico", "nombre@correo.com", 24, 300, 345),
    b.input("Contraseña", "••••••••", 24, 396, 345),
    b.text("¿Olvidaste tu contraseña?", 24, 484, 14, 600, "#0d99ff"),
    btn,
    b.text("¿No tienes cuenta? Regístrate", 92, 600, 14, 500, "#444444"),
  ]);
  return b.doc("mobile", [login, home], login.id);
}

function uxLanding(): string {
  const b = new UxBuilder();
  const cards = [0, 1, 2].map((i) =>
    b.add("group", { name: `Característica ${i + 1}`, x: 120 + i * 416, y: 640, w: 384, h: 220, fill: null }, [
      b.rect(0, 0, 384, 220, "#ffffff", 20, { name: "Tarjeta", stroke: { color: "#ececec", width: 1, opacity: 1, dash: false } }),
      b.rect(32, 32, 48, 48, "#e6f4ff", 12, { name: "Icono" }),
      b.text(["Rápido", "Seguro", "En equipo"][i], 32, 104, 22, 700),
      b.text(["Carga en milisegundos y funciona sin conexión.", "Tus datos se quedan en tu equipo, cifrados.", "Comenta y comparte con todo tu equipo."][i], 32, 144, 16, 400, "#6b6b6b", { w: 320, font: { size: 16, autoSize: "height" } }),
    ])
  );
  const web = b.frame("Página principal", 0, 0, 1440, 1024, "web-1440", [
    b.rect(0, 0, 1440, 80, "#ffffff", 0, { name: "Navegación", stroke: { color: "#eeeeee", width: 1, opacity: 1, dash: false } }),
    b.rect(120, 26, 28, 28, "#0d99ff", 8, { name: "Logo" }),
    b.text("Marca", 160, 28, 20, 800),
    ...["Producto", "Precios", "Blog", "Contacto"].map((l, i) => b.text(l, 760 + i * 110, 30, 15, 500, "#333333")),
    b.button("Empezar", 1200, 14, 120, "#0d99ff", "#ffffff", { radius: 999 }),
    b.text("NUEVO · Versión 2.0", 640, 200, 14, 700, "#0d99ff"),
    b.text("Diseña, prueba y lanza más rápido", 280, 240, 60, 800, "#111111"),
    b.text("Una plataforma para crear productos digitales con tu equipo.", 450, 330, 20, 400, "#6b6b6b"),
    b.button("Comenzar gratis", 520, 400, 200, "#0d99ff", "#ffffff", { radius: 999 }),
    b.button("Ver demostración", 740, 400, 200, "#ffffff", "#0d99ff", { radius: 999, stroke: { color: "#0d99ff", width: 1.5, opacity: 1, dash: false } }),
    ...cards,
    b.rect(0, 924, 1440, 100, "#111827", 0, { name: "Pie de página" }),
    b.text("© 2026 Marca. Todos los derechos reservados.", 120, 962, 14, 400, "#a0a0a0"),
  ]);
  return b.doc("web", [web], web.id);
}

function uxDashboard(): string {
  const b = new UxBuilder();
  const stat = (i: number, label: string, value: string, color: string) =>
    b.add("group", { name: `Indicador ${label}`, x: 280 + i * 245, y: 120, w: 225, h: 110, fill: null }, [
      b.rect(0, 0, 225, 110, "#ffffff", 14, { name: "Tarjeta", stroke: { color: "#ececec", width: 1, opacity: 1, dash: false } }),
      b.text(label, 20, 20, 13, 600, "#6b6b6b"),
      b.text(value, 20, 48, 30, 800, color),
    ]);
  const rows = ["Informe anual · Listo · 12/03/2026", "Presupuesto · En revisión · 18/03/2026", "Contrato · Pendiente · 21/03/2026", "Nómina de marzo · Listo · 28/03/2026"];
  const win = b.frame("Panel de administración", 0, 0, 1280, 800, "desktop-app", [
    b.rect(0, 0, 1280, 36, "#f3f3f3", 0, { name: "Barra de título" }),
    b.text("Mi aplicación", 16, 9, 13, 600),
    b.text("—   ☐   ✕", 1180, 9, 13, 400, "#444444"),
    b.rect(0, 36, 240, 764, "#fafafa", 0, { name: "Barra lateral", stroke: { color: "#e6e6e6", width: 1, opacity: 1, dash: false } }),
    b.rect(12, 60, 216, 38, "#e6f4ff", 8, { name: "Elemento activo" }),
    ...["⌂  Inicio", "▤  Documentos", "☺  Clientes", "⚙  Ajustes"].map((l, i) => b.text(l, 28, 70 + i * 48, 14, i ? 400 : 700, i ? "#333333" : "#0d99ff")),
    b.text("Resumen", 280, 64, 26, 800),
    stat(0, "Ventas del mes", "$48.200", "#1e1e1e"),
    stat(1, "Pedidos", "1.284", "#1e1e1e"),
    stat(2, "Clientes nuevos", "312", "#1aa260"),
    stat(3, "Devoluciones", "1,8%", "#d93025"),
    b.rect(280, 260, 960, 460, "#ffffff", 14, { name: "Tabla", stroke: { color: "#ececec", width: 1, opacity: 1, dash: false } }),
    b.text("Documentos recientes", 304, 284, 17, 700),
    ...rows.flatMap((r, i) => [b.rect(300, 330 + i * 56, 920, 48, i % 2 ? "#ffffff" : "#fafafa", 8, { name: `Fila ${i + 1}` }), b.text(r, 320, 344 + i * 56, 14, 400, "#333333")]),
  ]);
  return b.doc("desktop", [win], win.id);
}

// ---------------------------------------------------------------------------
// CoffeeUML: modelos (.cuml)
// ---------------------------------------------------------------------------

type DgNode = Record<string, unknown> & { id: string };

class DgBuilder {
  nodes: Record<string, DgNode> = {};
  edges: Record<string, Record<string, unknown>> = {};
  order: string[] = [];
  node(type: string, name: string, x: number, y: number, extra: Record<string, unknown> = {}): DgNode {
    const n: DgNode = { id: uid("n"), type, name, x, y, ...extra };
    this.nodes[n.id] = n;
    if (["system", "swimlane", "package", "fragment"].includes(type)) this.order.unshift(n.id);
    else this.order.push(n.id);
    return n;
  }
  cls(name: string, x: number, y: number, attrs: string[], ops: string[] = [], extra: Record<string, unknown> = {}) {
    const attributes = attrs.map((a) => {
      const [vis, rest] = [a[0], a.slice(1).trim()];
      const [nm, type] = rest.split(":").map((t) => t.trim());
      return { id: uid("m"), visibility: vis, name: nm, type: type || "" };
    });
    const operations = ops.map((o) => {
      const m = o.match(/^([+\-#~])\s*(\w+)\(([^)]*)\)\s*(?::\s*(.+))?$/)!;
      return { id: uid("m"), visibility: m[1], name: m[2], params: m[3], type: m[4] || "" };
    });
    return this.node("class", name, x, y, { attributes, operations, autoSize: true, ...extra });
  }
  table(name: string, x: number, y: number, cols: [string, string, string?][]) {
    return this.node("entity", name, x, y, {
      autoSize: true,
      attributes: cols.map(([n, t, flags = ""]) => ({ id: uid("m"), name: n, type: t, pk: flags.includes("PK"), fk: flags.includes("FK"), nullable: !flags.includes("NN") && !flags.includes("PK"), unique: flags.includes("UQ") })),
    });
  }
  edge(kind: string, a: DgNode, b: DgNode, extra: Record<string, unknown> = {}) {
    const id = uid("e");
    this.edges[id] = { id, kind, source: a.id, target: b.id, routing: kind === "flow" || kind === "erRelation" ? "orthogonal" : "straight", ...extra };
  }
  diagram(name: string, kind: string) {
    const d = { id: uid("d"), name, kind, nodes: this.nodes, edges: this.edges, order: this.order };
    this.nodes = {};
    this.edges = {};
    this.order = [];
    return d;
  }
}

const cuml = (diagrams: Record<string, unknown>[]) => JSON.stringify({ format: "coffeeuml", version: 1, diagrams, current: diagrams[0].id });

function dgProyectoUml(): string {
  const b = new DgBuilder();
  // Casos de uso
  const sys = b.node("system", "Tienda en línea", 220, 40, { w: 380, h: 470 });
  const cliente = b.node("actor", "Cliente", 60, 160);
  const admin = b.node("actor", "Administrador", 690, 300);
  const pasarela = b.node("actor", "Pasarela de pago", 690, 110);
  const uc = (n: string, y: number) => b.node("usecase", n, 300, y, { autoSize: true });
  const buscar = uc("Buscar productos", 90);
  const comprar = uc("Realizar compra", 180);
  const pagar = uc("Pagar pedido", 270);
  const cupon = uc("Aplicar cupón", 360);
  const gestionar = uc("Gestionar catálogo", 440);
  void sys;
  b.edge("link", cliente, buscar);
  b.edge("link", cliente, comprar);
  b.edge("include", comprar, pagar, { label: "«include»" });
  b.edge("extend", cupon, comprar, { label: "«extend»" });
  b.edge("link", pagar, pasarela);
  b.edge("link", admin, gestionar);
  const casos = b.diagram("Casos de uso", "usecase");
  // Clases
  const persona = b.cls("Persona", 300, 30, ["- id: int", "- nombre: String", "- correo: String"], ["+ getNombre(): String"], { isAbstract: true });
  const cl = b.cls("Cliente", 120, 260, ["- direccion: String"], ["+ realizarPedido(carrito: Carrito): Pedido"]);
  const ad = b.cls("Administrador", 480, 260, ["- nivel: int"], ["+ publicarProducto(p: Producto): void"]);
  const pedido = b.cls("Pedido", 120, 480, ["- fecha: Date", "- estado: EstadoPedido", "- total: double"], ["+ calcularTotal(): double", "+ confirmar(): void"]);
  const linea = b.cls("LineaPedido", 480, 480, ["- cantidad: int", "- precioUnitario: double"], ["+ subtotal(): double"]);
  const producto = b.cls("Producto", 820, 480, ["- nombre: String", "- precio: double", "- existencias: int"]);
  const estado = b.node("enum", "EstadoPedido", 120, 720, { literals: ["PENDIENTE", "PAGADO", "ENVIADO", "ENTREGADO"], stereotype: "enumeration", autoSize: true });
  const pagable = b.node("interface", "Pagable", 820, 260, { stereotype: "interface", operations: [{ id: uid("m"), visibility: "+", name: "pagar", params: "importe: double", type: "boolean", isAbstract: true }], autoSize: true });
  b.edge("generalization", cl, persona);
  b.edge("generalization", ad, persona);
  b.edge("association", cl, pedido, { sourceLabel: "1", targetLabel: "0..*", label: "realiza" });
  b.edge("composition", pedido, linea, { sourceLabel: "1", targetLabel: "1..*" });
  b.edge("association", linea, producto, { sourceLabel: "0..*", targetLabel: "1" });
  b.edge("realization", pedido, pagable);
  b.edge("dependency", pedido, estado);
  const clases = b.diagram("Modelo de clases", "class");
  // Secuencia
  const L = (type: string, name: string, x: number) => b.node(type, name, x, 40, { h: 430 });
  const u = L("actorLifeline", "Cliente", 40);
  const web = L("lifeline", ":Tienda", 260);
  const srv = L("lifeline", ":ServicioPedidos", 480);
  const pay = L("lifeline", ":Pasarela", 720);
  const msgs: [DgNode, DgNode, string, string][] = [
    [u, web, "message", "confirmarCompra()"],
    [web, srv, "message", "crearPedido(carrito)"],
    [srv, pay, "message", "cobrar(total)"],
    [pay, srv, "reply", "autorizado"],
    [srv, web, "reply", "pedido #1024"],
    [web, u, "reply", "mostrar recibo"],
  ];
  msgs.forEach(([a, c, k, l], i) => b.edge(k, a, c, { y: 170 + i * 48, label: l }));
  b.node("fragment", "", 450, 250, { w: 420, h: 110, operator: "alt", text: "[saldo suficiente]" });
  const secuencia = b.diagram("Confirmar compra (secuencia)", "sequence");
  // Actividad
  const ini = b.node("initial", "", 186, 30);
  const a1 = b.node("action", "Elegir productos", 120, 100, { autoSize: true });
  const a2 = b.node("action", "Revisar carrito", 120, 190, { autoSize: true });
  const dec = b.node("decision", "", 172, 280);
  const a3 = b.node("action", "Pagar con tarjeta", 30, 380, { autoSize: true });
  const a4 = b.node("action", "Iniciar sesión", 260, 380, { autoSize: true });
  const fin = b.node("final", "", 184, 490);
  b.edge("flow", ini, a1);
  b.edge("flow", a1, a2);
  b.edge("flow", a2, dec);
  b.edge("flow", dec, a3, { label: "[sesión iniciada]" });
  b.edge("flow", dec, a4, { label: "[sin sesión]" });
  b.edge("flow", a4, a2);
  b.edge("flow", a3, fin);
  const actividad = b.diagram("Proceso de compra (actividad)", "activity");
  return cuml([casos, clases, secuencia, actividad]);
}

function dgModeloEr(): string {
  const b = new DgBuilder();
  const clientes = b.table("clientes", 40, 40, [["id", "INTEGER", "PK"], ["nombre", "VARCHAR(100)", "NN"], ["correo", "VARCHAR(255)", "UQ"], ["ciudad", "VARCHAR(80)"]]);
  const pedidos = b.table("pedidos", 380, 40, [["id", "INTEGER", "PK"], ["cliente_id", "INTEGER", "FK NN"], ["fecha", "DATE", "NN"], ["estado", "VARCHAR(20)"]]);
  const detalle = b.table("detalle_pedido", 380, 300, [["id", "INTEGER", "PK"], ["pedido_id", "INTEGER", "FK NN"], ["producto_id", "INTEGER", "FK NN"], ["cantidad", "INTEGER", "NN"], ["precio_unitario", "DECIMAL(10,2)", "NN"]]);
  const productos = b.table("productos", 740, 300, [["id", "INTEGER", "PK"], ["nombre", "VARCHAR(120)", "NN"], ["categoria_id", "INTEGER", "FK"], ["precio", "DECIMAL(10,2)", "NN"]]);
  const categorias = b.table("categorias", 740, 40, [["id", "INTEGER", "PK"], ["nombre", "VARCHAR(80)", "NN UQ"]]);
  b.edge("erRelation", clientes, pedidos, { sourceCard: "1", targetCard: "0..*", label: "realiza" });
  b.edge("erRelation", pedidos, detalle, { sourceCard: "1", targetCard: "1..*", label: "contiene" });
  b.edge("erRelation", productos, detalle, { sourceCard: "1", targetCard: "0..*" });
  b.edge("erRelation", categorias, productos, { sourceCard: "0..1", targetCard: "0..*", label: "agrupa" });
  return cuml([b.diagram("Modelo de la tienda", "er")]);
}

function dgFlujo(): string {
  const b = new DgBuilder();
  const s = b.node("terminator", "Inicio", 140, 20);
  const leer = b.node("io", "Leer número n", 135, 100);
  const dec = b.node("decision", "¿n es par?", 155, 200, { w: 140, h: 90 });
  const par = b.node("process", "Mostrar «par»", 20, 330);
  const impar = b.node("process", "Mostrar «impar»", 280, 330);
  const fin = b.node("terminator", "Fin", 150, 450, { name: "Fin" });
  b.edge("flow", s, leer);
  b.edge("flow", leer, dec);
  b.edge("flow", dec, par, { label: "Sí" });
  b.edge("flow", dec, impar, { label: "No" });
  b.edge("flow", par, fin);
  b.edge("flow", impar, fin);
  return cuml([b.diagram("Par o impar", "flowchart")]);
}

// ---------------------------------------------------------------------------

const PDF_TEMPLATES: Record<string, () => string> = {
  "pdf-solicitud": pdfSolicitud,
  "pdf-acta-entrega": pdfActaEntrega,
  "pdf-certificado": pdfCertificado,
};

const PAGE_TEMPLATES: Record<string, () => string> = {
  "page-cuaderno-clases": pageCuadernoClases,
  "page-bitacora": pageBitacora,
  "page-planificador": pagePlanificador,
};

const UX_TEMPLATES: Record<string, () => string> = {
  "ux-login-movil": uxLoginApp,
  "ux-landing-web": uxLanding,
  "ux-panel-escritorio": uxDashboard,
};

const DG_TEMPLATES: Record<string, () => string> = {
  "dg-proyecto-uml": dgProyectoUml,
  "dg-modelo-er": dgModeloEr,
  "dg-diagrama-flujo": dgFlujo,
};

/** Contenido de las plantillas de CoffeePDF, CoffeePage, CoffeeDataBase, CoffeeEdit y CoffeeLive. */
export function buildExtraTemplate(templateId: string, appId: string, title: string): ExtraTemplate | null {
  if (appId === "coffeepdf" && PDF_TEMPLATES[templateId]) return { extension: "pdf", prefix: "pdf", contents: PDF_TEMPLATES[templateId]() };
  if (appId === "coffeepage" && PAGE_TEMPLATES[templateId]) return { extension: "cpg", prefix: "cpg", contents: PAGE_TEMPLATES[templateId]() };
  if (appId === "coffeebooks" && BOOKS_TEMPLATES[templateId]) return { extension: "cbk", prefix: "cbk", contents: BOOKS_TEMPLATES[templateId]() };
  if (appId === "coffeedatabase" && DB_SCRIPTS[templateId]) {
    // La primera línea marca el archivo como plantilla; CoffeeDataBase lo convierte en SQLite
    return { extension: "cdb", prefix: "cdb", contents: `-- CoffeeWorks plantilla: ${title}\n${DB_SCRIPTS[templateId].trim()}\n` };
  }
  if (appId === "coffeeedit" && EDIT_PROJECTS[templateId]) return { extension: "ccm", prefix: "ccm", contents: EDIT_PROJECTS[templateId]() };
  if (appId === "coffeelive" && LIVE_COLLECTIONS[templateId]) return { extension: "clv", prefix: "clv", contents: LIVE_COLLECTIONS[templateId]() };
  if (appId === "coffeeuiux" && UX_TEMPLATES[templateId]) return { extension: "cux", prefix: "cux", contents: UX_TEMPLATES[templateId]() };
  if (appId === "coffeeuml" && DG_TEMPLATES[templateId]) return { extension: "cuml", prefix: "cuml", contents: DG_TEMPLATES[templateId]() };
  if (appId === "coffeephoto" && PHOTO_TEMPLATES[templateId]) return { extension: "cph", prefix: "cph", contents: PHOTO_TEMPLATES[templateId]() };
  if (appId === "coffeevector" && VECTOR_TEMPLATES[templateId]) return { extension: "cvc", prefix: "cvc", contents: VECTOR_TEMPLATES[templateId]() };
  if (appId === "coffeepaint" && PAINT_TEMPLATES[templateId]) return { extension: "cpt", prefix: "cpt", contents: PAINT_TEMPLATES[templateId]() };
  return null;
}

/** Para las pruebas: genera todas las plantillas. */
export const EXTRA_TEMPLATE_IDS = {
  coffeepdf: Object.keys(PDF_TEMPLATES),
  coffeepage: Object.keys(PAGE_TEMPLATES),
  coffeebooks: Object.keys(BOOKS_TEMPLATES),
  coffeedatabase: Object.keys(DB_SCRIPTS),
  coffeeedit: Object.keys(EDIT_PROJECTS),
  coffeelive: Object.keys(LIVE_COLLECTIONS),
  coffeeuiux: Object.keys(UX_TEMPLATES),
  coffeeuml: Object.keys(DG_TEMPLATES),
  coffeephoto: Object.keys(PHOTO_TEMPLATES),
  coffeevector: Object.keys(VECTOR_TEMPLATES),
  coffeepaint: Object.keys(PAINT_TEMPLATES),
};
