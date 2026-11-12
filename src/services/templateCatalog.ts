// Plantillas añadidas en la versión 2.6: más documentos, hojas y presentaciones,
// y plantillas para CoffeePDF, CoffeePage, CoffeeDataBase, CoffeeEdit y CoffeeLive.

import type { TemplateItem } from "../components/TemplatesView";

/** Colores de cada aplicación en las tarjetas del catálogo. */
export const APP_STYLE: Record<string, { name: string; color: string; bg: string }> = {
  coffeedoc: { name: "CoffeeDoc", color: "#185abd", bg: "#e8f1fc" },
  coffeecalc: { name: "CoffeeCalc", color: "#107c41", bg: "#e1f3e7" },
  coffeeview: { name: "CoffeeView", color: "#c43e1c", bg: "#fbe7e1" },
  coffeepdf: { name: "CoffeePDF", color: "#c62828", bg: "#fdecea" },
  coffeepage: { name: "CoffeePage", color: "#7b1fa2", bg: "#f3e5f5" },
  coffeedatabase: { name: "CoffeeDataBase", color: "#9b111e", bg: "#fbe9eb" },
  coffeeedit: { name: "CoffeeEdit", color: "#26a680", bg: "#e3f6ef" },
  coffeelive: { name: "CoffeeLive", color: "#ef6c00", bg: "#fff1e5" },
  coffeeuiux: { name: "CoffeeUI/UX", color: "#b38600", bg: "#fff6d6" },
  coffeeuml: { name: "CoffeeUML", color: "#2e6b58", bg: "#e3f1ec" },
};

const item = (appId: TemplateItem["appId"], data: Omit<TemplateItem, "appId" | "appName" | "port" | "badgeBg" | "badgeText" | "accentBorder">): TemplateItem => ({
  appId,
  appName: APP_STYLE[appId].name,
  port: 0,
  badgeBg: "",
  badgeText: "",
  accentBorder: "",
  ...data,
});

const th = (text: string) => `<th style="padding:8px 12px; border:1px solid #d2d0ce; text-align:left;">${text}</th>`;
const td = (text = "&nbsp;") => `<td style="padding:8px 12px; border:1px solid #d2d0ce;">${text}</td>`;
const table = (headers: string[], rows: string[][]) =>
  `<table style="width:100%; border-collapse:collapse; margin:12px 0; font-size:13px;"><thead><tr style="background:#185abd; color:#ffffff;">${headers
    .map(th)
    .join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map(td).join("")}</tr>`).join("")}</tbody></table>`;

export const MORE_TEMPLATES: TemplateItem[] = [
  // --- CoffeeDoc ---
  item("coffeedoc", {
    id: "doc-acta-reunion",
    title: "Acta de Reunión",
    category: "Gestión & Equipos",
    description: "Registro formal de una reunión: asistentes, orden del día, desarrollo, decisiones y compromisos con responsables y fechas.",
    features: ["Tabla de asistentes y de compromisos", "Orden del día numerado", "Espacio para firmas de aprobación"],
    initialData: {
      title: "Acta de reunión",
      content: `<h1>Acta de reunión n.º ___</h1>
<p><strong>Fecha:</strong> &nbsp; &nbsp; <strong>Hora:</strong> &nbsp; &nbsp; <strong>Lugar:</strong></p>
<p><strong>Convoca:</strong> &nbsp; &nbsp; <strong>Secretario(a):</strong></p>
<h2>1. Asistentes</h2>
${table(["Nombre", "Cargo / área", "Asistió"], [["", "", "Sí / No"], ["", "", "Sí / No"], ["", "", "Sí / No"]])}
<h2>2. Orden del día</h2>
<ol><li>Verificación de asistencia</li><li>Lectura y aprobación del acta anterior</li><li>Tema principal</li><li>Proposiciones y varios</li></ol>
<h2>3. Desarrollo</h2>
<p>Resumen de lo tratado en cada punto del orden del día.</p>
<h2>4. Decisiones</h2>
<ul><li>Decisión 1</li><li>Decisión 2</li></ul>
<h2>5. Compromisos</h2>
${table(["Compromiso", "Responsable", "Fecha límite"], [["", "", ""], ["", "", ""], ["", "", ""]])}
<p><strong>Próxima reunión:</strong></p>
<p>&nbsp;</p>
<p>______________________________ &nbsp; &nbsp; &nbsp; &nbsp; ______________________________</p>
<p>Presidente(a) de la reunión &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; Secretario(a)</p>`,
    },
  }),
  item("coffeedoc", {
    id: "doc-carta-formal",
    title: "Carta Formal",
    category: "Correspondencia",
    description: "Carta comercial o institucional con fecha, destinatario, asunto, cuerpo en párrafos, despedida y firma, lista para imprimir o exportar a PDF.",
    features: ["Estructura de carta formal en español", "Asunto destacado", "Lista para exportar a Word o PDF"],
    initialData: {
      title: "Carta formal",
      content: `<p>Ciudad, ___ de __________ de 20__</p>
<p>&nbsp;</p>
<p>Señor(a)<br/><strong>Nombre del destinatario</strong><br/>Cargo<br/>Empresa o institución<br/>Ciudad</p>
<p>&nbsp;</p>
<p><strong>Asunto:</strong> Motivo de la carta</p>
<p>&nbsp;</p>
<p>Respetado(a) señor(a):</p>
<p>Escriba aquí el primer párrafo, en el que presenta el motivo de la comunicación de forma clara y directa.</p>
<p>En el segundo párrafo desarrolle los detalles, antecedentes o la información que respalda su solicitud.</p>
<p>Cierre con un párrafo que indique la acción que espera y agradezca la atención prestada.</p>
<p>&nbsp;</p>
<p>Atentamente,</p>
<p>&nbsp;</p>
<p>______________________________<br/><strong>Nombre del remitente</strong><br/>Cargo<br/>Teléfono · Correo electrónico</p>`,
    },
  }),
  item("coffeedoc", {
    id: "doc-plan-proyecto",
    title: "Plan de Proyecto",
    category: "Gestión de Proyectos",
    description: "Documento de planeación con justificación, objetivos, alcance, entregables, cronograma, riesgos y presupuesto resumido.",
    features: ["Tablas de entregables, cronograma y riesgos", "Secciones de alcance incluido y excluido", "Presupuesto resumido"],
    initialData: {
      title: "Plan de proyecto",
      content: `<h1>Plan de proyecto: Nombre del proyecto</h1>
<p><strong>Líder:</strong> &nbsp; &nbsp; <strong>Patrocinador:</strong> &nbsp; &nbsp; <strong>Versión:</strong> 1.0</p>
<h2>1. Justificación</h2><p>¿Qué problema u oportunidad atiende el proyecto y por qué ahora?</p>
<h2>2. Objetivos</h2><p><strong>General:</strong></p><ul><li>Específico 1</li><li>Específico 2</li><li>Específico 3</li></ul>
<h2>3. Alcance</h2><p><strong>Incluye:</strong></p><ul><li></li></ul><p><strong>No incluye:</strong></p><ul><li></li></ul>
<h2>4. Entregables</h2>
${table(["Entregable", "Descripción", "Fecha"], [["", "", ""], ["", "", ""], ["", "", ""]])}
<h2>5. Cronograma</h2>
${table(["Fase", "Inicio", "Fin", "Responsable"], [["Planeación", "", "", ""], ["Ejecución", "", "", ""], ["Cierre", "", "", ""]])}
<h2>6. Riesgos</h2>
${table(["Riesgo", "Probabilidad", "Impacto", "Plan de respuesta"], [["", "Alta / Media / Baja", "", ""], ["", "", "", ""]])}
<h2>7. Presupuesto</h2>
${table(["Concepto", "Valor"], [["Personal", ""], ["Equipos y licencias", ""], ["Otros", ""], ["<strong>Total</strong>", ""]])}`,
    },
  }),
  item("coffeedoc", {
    id: "doc-trabajo-academico",
    title: "Trabajo Académico (normas APA)",
    category: "Educación & Investigación",
    description: "Estructura de trabajo escrito o informe de investigación: portada, introducción, objetivos, marco teórico, metodología, resultados, conclusiones y referencias.",
    features: ["Portada con datos del curso", "Secciones de un informe de investigación", "Referencias con ejemplos en APA 7"],
    initialData: {
      title: "Trabajo académico",
      content: `<p style="text-align:center;">&nbsp;</p>
<h1 style="text-align:center;">Título del trabajo</h1>
<p style="text-align:center;">Nombre del estudiante<br/>Programa académico<br/>Nombre de la institución</p>
<p style="text-align:center;">Asignatura · Docente<br/>Ciudad, fecha</p>
<hr/>
<h2>Resumen</h2><p>Síntesis del trabajo en 150 a 250 palabras.</p><p><strong>Palabras clave:</strong></p>
<h2>1. Introducción</h2><p>Contexto, problema y propósito del trabajo.</p>
<h2>2. Objetivos</h2><p><strong>Objetivo general:</strong></p><p><strong>Objetivos específicos:</strong></p><ol><li></li><li></li></ol>
<h2>3. Marco teórico</h2><p>Conceptos y autores que sustentan el trabajo (Apellido, año).</p>
<h2>4. Metodología</h2><p>Tipo de estudio, población, instrumentos y procedimiento.</p>
<h2>5. Resultados</h2><p>Presentación de los hallazgos con tablas o figuras.</p>
<h2>6. Conclusiones</h2><ul><li></li></ul>
<h2>Referencias</h2>
<p>Apellido, A. A. (Año). <em>Título del libro</em>. Editorial.</p>
<p>Apellido, A. A. y Apellido, B. B. (Año). Título del artículo. <em>Nombre de la Revista, volumen</em>(número), páginas. https://doi.org/xxxx</p>`,
    },
  }),

  // --- CoffeeCalc ---
  item("coffeecalc", {
    id: "calc-presupuesto-personal",
    title: "Presupuesto Personal Mensual",
    category: "Finanzas Personales",
    description: "Ingresos y gastos previstos frente a reales, con diferencias, saldo del mes y porcentaje de ahorro calculados solos.",
    features: ["Previsto vs. real por categoría", "Saldo y % de ahorro automáticos", "Formato de moneda"],
  }),
  item("coffeecalc", {
    id: "calc-cronograma-proyecto",
    title: "Cronograma de Proyecto",
    category: "Gestión de Proyectos",
    description: "Actividades con responsable, fechas, duración y porcentaje de avance; el estado y el avance ponderado del proyecto se calculan solos.",
    features: ["Estado automático (Pendiente, En curso, Terminada)", "Avance ponderado con SUMAPRODUCTO", "Conteo de actividades terminadas"],
  }),
  item("coffeecalc", {
    id: "calc-calificaciones",
    title: "Registro de Calificaciones",
    category: "Educación",
    description: "Notas por estudiante con porcentajes de evaluación, definitiva redondeada, resultado (aprobó o reprobó) y estadísticas del grupo.",
    features: ["Definitiva ponderada (30-30-20-20)", "Nota mínima configurable", "Promedio, máximo y aprobados"],
  }),
  item("coffeecalc", {
    id: "calc-nomina",
    title: "Nómina Mensual",
    category: "Recursos Humanos",
    description: "Liquidación sencilla de nómina con horas extra, aportes de salud y pensión del 4% y neto a pagar por empleado.",
    features: ["Horas extra con recargo del 25%", "Deducciones de salud y pensión", "Totales de la nómina"],
  }),

  // --- CoffeeView ---
  item("coffeeview", {
    id: "view-clase-academica",
    title: "Clase o Exposición Académica",
    category: "Educación",
    description: "Presentación para dictar una clase o exponer un tema: objetivos, conceptos clave, ejemplo resuelto, actividad y tarea.",
    features: ["6 diapositivas con estructura didáctica", "Ejemplo en dos columnas", "Notas del orador"],
  }),
  item("coffeeview", {
    id: "view-sustentacion-investigacion",
    title: "Sustentación de Investigación",
    category: "Investigación",
    description: "Deck para sustentar un proyecto de grado o de semillero: problema, objetivos, metodología, resultados y conclusiones.",
    features: ["Estructura de proyecto de investigación", "Objetivos general y específicos", "Cierre para la ronda de preguntas"],
  }),
  item("coffeeview", {
    id: "view-inicio-proyecto",
    title: "Reunión de Inicio de Proyecto",
    category: "Gestión de Proyectos",
    description: "Presentación de arranque (kick-off) con propósito, alcance, roles del equipo, hitos y próximos pasos.",
    features: ["Alcance incluido y excluido", "Roles y responsables", "Hitos del cronograma"],
  }),

  // --- CoffeePDF ---
  item("coffeepdf", {
    id: "pdf-solicitud",
    title: "Formulario de Solicitud",
    category: "Formularios",
    description: "Formulario imprimible con datos del solicitante, tipo de solicitud con casillas, descripción, adjuntos, firma y espacio de uso interno.",
    features: ["Listo para llenar con la herramienta de texto", "Casillas para marcar", "Espacio de firma"],
  }),
  item("coffeepdf", {
    id: "pdf-acta-entrega",
    title: "Acta de Entrega y Recibido",
    category: "Administración",
    description: "Acta para entregar equipos, bienes o documentos: datos de quien entrega y recibe, tabla de ítems, observaciones y firmas.",
    features: ["Tabla de 12 ítems", "Datos de quien entrega y recibe", "Firmas de ambas partes"],
  }),
  item("coffeepdf", {
    id: "pdf-certificado",
    title: "Certificado de Participación",
    category: "Eventos & Educación",
    description: "Certificado con marco decorativo, nombre del participante, texto del evento, firmas y fecha. Complétalo y fírmalo en CoffeePDF.",
    features: ["Marco doble en color", "Espacios para nombre, horas y fechas", "Dos firmas"],
  }),

  // --- CoffeePage ---
  item("coffeepage", {
    id: "page-cuaderno-clases",
    title: "Cuaderno de Clases",
    category: "Estudio",
    description: "Cuaderno con una sección por materia, páginas con el método Cornell (ideas clave, notas y resumen) y una sección de tareas y exámenes.",
    features: ["Secciones por materia con hojas rayadas", "Método Cornell", "Lista de tareas con casillas"],
  }),
  item("coffeepage", {
    id: "page-bitacora",
    title: "Bitácora de Investigación",
    category: "Investigación",
    description: "Para semilleros y proyectos: pregunta y objetivos, cronograma con casillas, diario de campo por sesión y bibliografía en APA.",
    features: ["Diario de campo por sesión", "Cronograma con tareas", "Plantilla de referencias APA 7"],
  }),
  item("coffeepage", {
    id: "page-planificador",
    title: "Planificador Semanal",
    category: "Productividad",
    description: "Una página por día con tareas y agenda, resumen de la semana con prioridades y hábitos, y metas del mes.",
    features: ["Subpáginas de lunes a domingo", "Prioridades y hábitos", "Hoja cuadriculada"],
  }),

  // --- CoffeeDataBase ---
  item("coffeedatabase", {
    id: "db-tienda",
    title: "Tienda y Pedidos",
    category: "Ventas",
    description: "Clientes, categorías, productos, pedidos y detalle de pedido relacionados, con datos de ejemplo y una vista de ventas por cliente.",
    features: ["5 tablas con relaciones", "Datos de ejemplo realistas", "Vista de ventas por cliente"],
  }),
  item("coffeedatabase", {
    id: "db-semilleros",
    title: "Semilleros de Investigación",
    category: "Investigación",
    description: "Semilleros, estudiantes, proyectos y la tabla intermedia estudiantes_semilleros (con fecha de asignación y estado). Lista para el ETL.",
    features: ["Relación varios a varios", "Observaciones para el ETL de semilleros", "Datos de ejemplo"],
  }),
  item("coffeedatabase", {
    id: "db-biblioteca",
    title: "Biblioteca",
    category: "Educación",
    description: "Autores, libros, socios y préstamos con fechas de devolución, y una vista de préstamos pendientes.",
    features: ["Control de préstamos y devoluciones", "Vista de pendientes", "ISBN único por libro"],
  }),
  item("coffeedatabase", {
    id: "db-inventario",
    title: "Inventario por Bodegas",
    category: "Operaciones & Logística",
    description: "Proveedores, bodegas, artículos y movimientos de entrada y salida, con una vista de existencias calculadas y stock mínimo.",
    features: ["Kardex de movimientos", "Existencias calculadas en una vista", "Proveedores y bodegas"],
  }),

  // --- CoffeeEdit ---
  item("coffeeedit", {
    id: "edit-youtube",
    title: "Video para YouTube (16:9)",
    category: "Redes sociales",
    description: "Proyecto 1920×1080 con título de apertura animado, rótulo con tu nombre y pantalla final de despedida. Solo añade tus clips.",
    features: ["Intro con título y subtítulo", "Rótulo inferior", "Pantalla final al minuto"],
  }),
  item("coffeeedit", {
    id: "edit-reel",
    title: "Reel o Short Vertical (9:16)",
    category: "Redes sociales",
    description: "Proyecto vertical 1080×1920 con gancho inicial, tres textos tipo máquina de escribir y llamada a la acción final.",
    features: ["Formato vertical para Reels, Shorts y TikTok", "Textos con animación", "Cierre con llamada a la acción"],
  }),
  item("coffeeedit", {
    id: "edit-tutorial",
    title: "Tutorial Paso a Paso",
    category: "Educación",
    description: "Proyecto con portada, rótulos de cada paso en la esquina y pantalla de resumen al final, pensado para grabaciones de CoffeeLive.",
    features: ["Rótulos de capítulo", "Portada y cierre", "Ideal con grabaciones de pantalla"],
  }),

  // --- CoffeeLive ---
  item("coffeelive", {
    id: "live-clase",
    title: "Clase en Línea",
    category: "Educación",
    description: "Escenas para dar clase: diapositivas con cámara en la esquina, solo cámara para preguntas, «Empezamos pronto» y cierre.",
    features: ["4 escenas listas", "Rótulo con el nombre de la clase", "Pantalla de despedida"],
  }),
  item("coffeelive", {
    id: "live-gaming",
    title: "Directo de Videojuegos",
    category: "Streaming",
    description: "Juego a pantalla completa con cámara circular, escena de charla, «Empezando pronto», pausa y fin del directo.",
    features: ["5 escenas", "Cámara en círculo", "Barra inferior para redes"],
  }),
  item("coffeelive", {
    id: "live-podcast",
    title: "Podcast o Entrevista",
    category: "Streaming",
    description: "Dos cámaras lado a lado con rótulos de presentador e invitado, planos individuales e intro del episodio.",
    features: ["Pantalla dividida", "Rótulos de nombre", "Intro del episodio"],
  }),

  // --- CoffeeUI/UX ---
  item("coffeeuiux", {
    id: "ux-login-movil",
    title: "App Móvil: Inicio de Sesión",
    category: "Móvil",
    description: "Dos pantallas de iPhone (inicio de sesión e inicio con pedidos) enlazadas como prototipo: pulsa «Iniciar sesión» en Presentar para navegar.",
    features: ["Formulario con campos y botón", "Prototipo navegable con transición", "Barra de pestañas"],
  }),
  item("coffeeuiux", {
    id: "ux-landing-web",
    title: "Página Web de Producto",
    category: "Web",
    description: "Landing page de 1440 px con navegación, sección principal, llamadas a la acción, tres tarjetas de características y pie de página. Lista para exportar a HTML/CSS.",
    features: ["Diseño de escritorio web", "Botones y tarjetas", "Exportable a HTML y CSS"],
  }),
  item("coffeeuiux", {
    id: "ux-panel-escritorio",
    title: "Panel de Administración (Escritorio)",
    category: "Escritorio",
    description: "Ventana de aplicación con barra de título, menú lateral, indicadores y tabla de documentos recientes.",
    features: ["Ventana de 1280×800", "Indicadores con colores", "Tabla con filas alternas"],
  }),

  // --- CoffeeUML ---
  item("coffeeuml", {
    id: "dg-proyecto-uml",
    title: "Proyecto de Software (UML completo)",
    category: "Ingeniería de software",
    description: "Modelo de una tienda en línea con cuatro diagramas: casos de uso, clases (herencia, composición, interfaz y enumeración), secuencia de compra y actividad.",
    features: ["4 diagramas UML enlazados en un modelo", "Genera Java, C#, TypeScript o Python", "Exportable a PDF"],
  }),
  item("coffeeuml", {
    id: "dg-modelo-er",
    title: "Modelo Entidad-Relación de una Tienda",
    category: "Bases de datos",
    description: "Cinco tablas con claves principales y foráneas y cardinalidades en notación pata de gallo. Genera el SQL para crearlas en CoffeeDataBase.",
    features: ["PK, FK, NOT NULL y UNIQUE", "Cardinalidades 1, 0..1, 1..* y 0..*", "Genera SQL CREATE TABLE"],
  }),
  item("coffeeuml", {
    id: "dg-diagrama-flujo",
    title: "Diagrama de Flujo de un Algoritmo",
    category: "Programación",
    description: "Algoritmo «par o impar» con inicio, entrada, decisión, procesos y fin. Ideal para explicar lógica de programación.",
    features: ["Símbolos estándar de diagrama de flujo", "Decisión con ramas Sí/No", "Exportable a Mermaid"],
  }),
];
