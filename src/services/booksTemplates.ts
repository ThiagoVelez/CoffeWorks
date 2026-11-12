// Plantillas de CoffeeBooks (.cbk): espacios de trabajo completos con
// páginas, subpáginas y bases de datos, listos para abrir en CoffeeBooks.

type Color = "default" | "gray" | "brown" | "orange" | "yellow" | "green" | "blue" | "purple" | "pink" | "red";

let seq = 0;
const id = (p: string) => `${p}_t${(seq++).toString(36)}`;
const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

interface B {
  id: string;
  type: string;
  text: string;
  [k: string]: unknown;
}
const b = (type: string, text = "", extra: Record<string, unknown> = {}): B => ({ id: id("b"), type, text, ...extra });
const p = (text = "") => b("paragraph", text);
const h2 = (t: string) => b("h2", t);
const h3 = (t: string) => b("h3", t);
const li = (t: string) => b("bullet", t);
const num = (t: string) => b("numbered", t);
const todo = (t: string, checked = false) => b("todo", t, { checked });
const callout = (t: string, emoji = "💡", color: Color = "yellow") => b("callout", t, { emoji, color });
const toggle = (t: string, children: B[]) => b("toggle", t, { open: false, children });
const quote = (t: string) => b("quote", t);
const divider = () => b("divider");
const table = (rows: string[][]) => b("table", "", { rows });
const link = (pageId: string) => b("page", "", { pageId });

interface Col {
  id: string;
  name: string;
  type: string;
  options?: { id: string; name: string; color: Color }[];
  width?: number;
}
const col = (name: string, type: string, opts?: [string, Color][], width?: number): Col => ({ id: id("c"), name, type, ...(opts ? { options: opts.map(([n, c]) => ({ id: id("o"), name: n, color: c })) } : {}), ...(width ? { width } : {}) });
const opt = (c: Col, name: string) => c.options!.find((o) => o.name === name)!.id;

interface Page {
  id: string;
  parentId: string | null;
  title: string;
  icon: string;
  cover: string | null;
  kind: "page" | "database";
  blocks: B[];
  db?: unknown;
  fullWidth: boolean;
  expanded: boolean;
  createdAt: number;
  updatedAt: number;
}

function page(parentId: string | null, title: string, icon: string, blocks: B[], cover: string | null = null): Page {
  const now = Date.now();
  return { id: id("p"), parentId, title, icon, cover, kind: "page", blocks, fullWidth: false, expanded: true, createdAt: now, updatedAt: now };
}

function database(parentId: string | null, title: string, icon: string, columns: Col[], rows: Record<string, unknown>[], views: { name: string; kind: "table" | "board" | "list" | "calendar"; groupBy?: Col }[]): Page {
  const pg = page(parentId, title, icon, []);
  pg.kind = "database";
  pg.fullWidth = true;
  const v = views.map((x) => ({ id: id("v"), name: x.name, kind: x.kind, groupBy: x.groupBy?.id }));
  pg.db = {
    columns,
    rows: rows.map((values, i) => ({ id: id("r"), values: Object.fromEntries(columns.map((c) => [c.id, values[c.id] ?? (c.type === "checkbox" ? false : c.type === "multi" ? [] : null)])), blocks: [p("")], createdAt: Date.now() + i })),
    views: v,
    activeView: v[0].id,
  };
  return pg;
}

const workspace = (name: string, pages: Page[], favorites: string[] = []) => JSON.stringify({ app: "CoffeeBooks", version: 1, name, pages, favorites, trash: [] });

// ---------------------------------------------------------------------------

function segundoCerebro(): string {
  const home = page(null, "Mi segundo cerebro", "🧠", [], "lavender");
  const t = col("Nombre", "title", undefined, 260);
  const area = col("Área", "select", [["Trabajo", "blue"], ["Estudio", "purple"], ["Personal", "green"], ["Salud", "red"]]);
  const st = col("Estado", "select", [["Idea", "gray"], ["En curso", "orange"], ["Pausado", "yellow"], ["Terminado", "green"]]);
  const fin = col("Fecha límite", "date");
  const proyectos = database(home.id, "Proyectos", "🚀", [t, area, st, fin], [
    { [t.id]: "Renovar mi portafolio", [area.id]: opt(area, "Trabajo"), [st.id]: opt(st, "En curso"), [fin.id]: day(14) },
    { [t.id]: "Aprender Rust", [area.id]: opt(area, "Estudio"), [st.id]: opt(st, "En curso"), [fin.id]: day(60) },
    { [t.id]: "Correr 10 km", [area.id]: opt(area, "Salud"), [st.id]: opt(st, "Idea") },
  ], [{ name: "Tablero", kind: "board", groupBy: st }, { name: "Tabla", kind: "table" }]);
  const nt = col("Nota", "title", undefined, 280);
  const tags = col("Etiquetas", "multi", [["Idea", "yellow"], ["Lectura", "blue"], ["Reunión", "purple"], ["Referencia", "gray"]]);
  const creada = col("Fecha", "date");
  const notas = database(home.id, "Notas", "🗒️", [nt, tags, creada], [
    { [nt.id]: "Ideas para el blog", [tags.id]: [opt(tags, "Idea")], [creada.id]: day(-2) },
    { [nt.id]: "Resumen: Hábitos atómicos", [tags.id]: [opt(tags, "Lectura")], [creada.id]: day(-5) },
  ], [{ name: "Lista", kind: "list" }, { name: "Tabla", kind: "table" }]);
  const recursos = page(home.id, "Recursos", "📚", [
    p("Enlaces, cursos y herramientas que quiero tener a mano."),
    h3("Cursos"),
    li('<a href="https://doc.rust-lang.org/book/">The Rust Book</a>'),
    h3("Herramientas"),
    li("CoffeeWorks para documentos, notas y diseño"),
  ]);
  home.blocks = [
    callout("Un lugar para todo: proyectos, notas, recursos y metas. Organízalo por <b>áreas</b> y revisa tus proyectos cada semana.", "🧭", "purple"),
    h2("Accesos"),
    link(proyectos.id),
    link(notas.id),
    link(recursos.id),
    h2("Revisión semanal"),
    todo("Vaciar la bandeja de notas rápidas"),
    todo("Revisar el estado de cada proyecto"),
    todo("Elegir las 3 prioridades de la semana"),
    quote("«No tienes que hacerlo todo. Tienes que hacer lo importante.»"),
  ];
  return workspace("Segundo cerebro", [home, proyectos, notas, recursos], [home.id]);
}

function gestorProyectos(): string {
  const home = page(null, "Proyecto: Lanzamiento", "🚀", [], "sunset");
  const t = col("Tarea", "title", undefined, 280);
  const st = col("Estado", "select", [["Por hacer", "gray"], ["En curso", "blue"], ["En revisión", "purple"], ["Hecho", "green"]]);
  const pr = col("Prioridad", "select", [["Alta", "red"], ["Media", "yellow"], ["Baja", "gray"]]);
  const who = col("Responsable", "text");
  const due = col("Entrega", "date");
  const tag = col("Etiquetas", "multi", [["Diseño", "pink"], ["Desarrollo", "blue"], ["Marketing", "orange"], ["Contenido", "green"]]);
  const done = col("Bloqueada", "checkbox");
  const rows: [string, string, string, string, number, string[]][] = [
    ["Definir el mensaje principal", "Hecho", "Alta", "Ana", -6, ["Marketing"]],
    ["Diseñar la página de inicio", "En revisión", "Alta", "Luis", -1, ["Diseño"]],
    ["Programar el formulario de registro", "En curso", "Alta", "Marta", 3, ["Desarrollo"]],
    ["Escribir el artículo de lanzamiento", "En curso", "Media", "Ana", 5, ["Contenido"]],
    ["Preparar las publicaciones en redes", "Por hacer", "Media", "Carlos", 8, ["Marketing", "Diseño"]],
    ["Pruebas finales", "Por hacer", "Alta", "Marta", 10, ["Desarrollo"]],
  ];
  const tareas = database(home.id, "Tareas", "✅", [t, st, pr, who, due, tag, done], rows.map(([a, s, p2, w, d, tg]) => ({ [t.id]: a, [st.id]: opt(st, s), [pr.id]: opt(pr, p2), [who.id]: w, [due.id]: day(d), [tag.id]: tg.map((x) => opt(tag, x)) })), [
    { name: "Tablero", kind: "board", groupBy: st },
    { name: "Tabla", kind: "table" },
    { name: "Calendario", kind: "calendar", groupBy: due },
  ]);
  const reuniones = page(home.id, "Notas de reunión", "🗓️", [
    callout("<b>Seguimiento semanal</b> · lunes 9:00", "👥", "blue"),
    h3("Avances"),
    li(""),
    h3("Bloqueos"),
    li(""),
    h3("Acuerdos"),
    todo(""),
  ]);
  home.blocks = [
    callout("Lanzar la nueva web el <b>" + day(14) + "</b> con registro de usuarios y campaña en redes.", "🎯", "orange"),
    h2("Objetivos"),
    num("500 registros en el primer mes"),
    num("Tiempo de carga menor de 2 segundos"),
    h2("Equipo"),
    table([["Persona", "Rol", "Contacto"], ["Ana", "Marketing y contenido", ""], ["Luis", "Diseño", ""], ["Marta", "Desarrollo", ""], ["Carlos", "Redes sociales", ""]]),
    h2("Trabajo"),
    link(tareas.id),
    link(reuniones.id),
    h2("Riesgos"),
    toggle("Retraso en el desarrollo", [p("Plan B: lanzar primero la página informativa y activar el registro una semana después.")]),
  ];
  return workspace("Gestor de proyectos", [home, tareas, reuniones], [home.id]);
}

function wikiEquipo(): string {
  const home = page(null, "Wiki del equipo", "📘", [], "ocean");
  const onboarding = page(home.id, "Bienvenida (onboarding)", "👋", [
    callout("¡Bienvenido! Esta es tu primera semana con nosotros.", "🎉", "green"),
    h2("Primer día"),
    todo("Recibir el equipo y las cuentas"),
    todo("Leer «Cómo trabajamos»"),
    todo("Conocer al equipo en la reunión de las 10:00"),
    h2("Primera semana"),
    todo("Hacer tu primera tarea pequeña"),
    todo("Agendar un café con tu mentor"),
  ]);
  const procesos = page(home.id, "Procesos", "⚙️", [
    p("Cómo hacemos las cosas. Si algo cambia, actualiza esta página."),
    toggle("Pedir vacaciones", [num("Avisa con dos semanas de antelación"), num("Registra las fechas en el calendario del equipo"), num("Deja tus tareas asignadas")]),
    toggle("Publicar una versión", [num("Revisión del código aprobada"), num("Pruebas en verde"), num("Anuncio en el canal del equipo")]),
    toggle("Gastos y reembolsos", [p("Guarda la factura y envíala antes del día 25 de cada mes.")]),
  ]);
  const titulo = col("Reunión", "title", undefined, 260);
  const tipo = col("Tipo", "select", [["Semanal", "blue"], ["Planificación", "purple"], ["Retrospectiva", "orange"], ["Cliente", "green"]]);
  const fecha = col("Fecha", "date");
  const reuniones = database(home.id, "Reuniones", "🗓️", [titulo, tipo, fecha], [
    { [titulo.id]: "Planificación del mes", [tipo.id]: opt(tipo, "Planificación"), [fecha.id]: day(-7) },
    { [titulo.id]: "Semanal", [tipo.id]: opt(tipo, "Semanal"), [fecha.id]: day(-1) },
    { [titulo.id]: "Retrospectiva", [tipo.id]: opt(tipo, "Retrospectiva"), [fecha.id]: day(6) },
  ], [{ name: "Calendario", kind: "calendar", groupBy: fecha }, { name: "Tabla", kind: "table" }]);
  home.blocks = [
    callout("Todo lo que el equipo necesita saber, en un solo lugar.", "🧭", "blue"),
    h2("Empieza aquí"),
    link(onboarding.id),
    link(procesos.id),
    link(reuniones.id),
    h2("Cómo trabajamos"),
    li("Escribimos las decisiones importantes en esta wiki."),
    li("Las reuniones tienen agenda y acta."),
    li("Preguntar está bien: nadie lo sabe todo."),
    h2("Contactos"),
    table([["Área", "Persona", "Correo"], ["Dirección", "", ""], ["Soporte", "", ""], ["Recursos humanos", "", ""]]),
  ];
  return workspace("Wiki del equipo", [home, onboarding, procesos, reuniones], [home.id]);
}

function planEstudios(): string {
  const home = page(null, "Mi semestre", "🎓", [], "peach");
  const m = col("Materia", "title", undefined, 240);
  const prof = col("Profesor", "text");
  const nota = col("Nota actual", "number");
  const dia = col("Días", "multi", [["Lunes", "blue"], ["Martes", "purple"], ["Miércoles", "green"], ["Jueves", "orange"], ["Viernes", "pink"]]);
  const materias = database(home.id, "Materias", "📚", [m, prof, nota, dia], [
    { [m.id]: "Cálculo II", [prof.id]: "", [nota.id]: 4.2, [dia.id]: [opt(dia, "Lunes"), opt(dia, "Miércoles")] },
    { [m.id]: "Programación", [prof.id]: "", [nota.id]: 4.6, [dia.id]: [opt(dia, "Martes"), opt(dia, "Jueves")] },
    { [m.id]: "Física", [prof.id]: "", [nota.id]: 3.8, [dia.id]: [opt(dia, "Viernes")] },
  ], [{ name: "Tabla", kind: "table" }]);
  const t = col("Entrega", "title", undefined, 260);
  const tipo = col("Tipo", "select", [["Tarea", "blue"], ["Examen", "red"], ["Proyecto", "purple"], ["Lectura", "gray"]]);
  const mat = col("Materia", "select", [["Cálculo II", "orange"], ["Programación", "green"], ["Física", "blue"]]);
  const f = col("Fecha", "date");
  const hecho = col("Hecho", "checkbox");
  const entregas = database(home.id, "Tareas y exámenes", "📝", [t, tipo, mat, f, hecho], [
    { [t.id]: "Taller de integrales", [tipo.id]: opt(tipo, "Tarea"), [mat.id]: opt(mat, "Cálculo II"), [f.id]: day(3) },
    { [t.id]: "Parcial 2", [tipo.id]: opt(tipo, "Examen"), [mat.id]: opt(mat, "Física"), [f.id]: day(9) },
    { [t.id]: "Proyecto final: app de notas", [tipo.id]: opt(tipo, "Proyecto"), [mat.id]: opt(mat, "Programación"), [f.id]: day(30) },
    { [t.id]: "Leer capítulo 5", [tipo.id]: opt(tipo, "Lectura"), [mat.id]: opt(mat, "Física"), [f.id]: day(-1), [hecho.id]: true },
  ], [{ name: "Calendario", kind: "calendar", groupBy: f }, { name: "Por materia", kind: "board", groupBy: mat }, { name: "Tabla", kind: "table" }]);
  const apuntes = page(home.id, "Apuntes (método Cornell)", "✏️", [
    callout("Divide cada clase en <b>ideas clave</b>, <b>notas</b> y <b>resumen</b>. Repasa las ideas clave antes del examen.", "🧠", "purple"),
    h2("Clase: tema de hoy"),
    toggle("Ideas clave y preguntas", [li("")]),
    toggle("Notas de la clase", [p("")]),
    toggle("Resumen en 3 frases", [p("")]),
  ]);
  home.blocks = [
    callout("Organiza tus materias, entregas y apuntes del semestre.", "🎒", "orange"),
    link(materias.id),
    link(entregas.id),
    link(apuntes.id),
    h2("Metas del semestre"),
    todo("Promedio de 4.0 o más"),
    todo("No dejar entregas para el último día"),
    h2("Horario"),
    table([["Hora", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes"], ["7:00", "Cálculo II", "", "Cálculo II", "", ""], ["9:00", "", "Programación", "", "Programación", "Física"]]),
  ];
  return workspace("Planificador de estudios", [home, materias, entregas, apuntes], [home.id]);
}

function diario(): string {
  const home = page(null, "Diario y hábitos", "📔", [], "lemon");
  const t = col("Entrada", "title", undefined, 240);
  const animo = col("Ánimo", "select", [["Genial", "green"], ["Bien", "blue"], ["Normal", "gray"], ["Cansado", "yellow"], ["Mal", "red"]]);
  const f = col("Fecha", "date");
  const ejercicio = col("Ejercicio", "checkbox");
  const lectura = col("Lectura", "checkbox");
  const agua = col("Vasos de agua", "number");
  const entradas = database(home.id, "Diario", "🗓️", [t, f, animo, ejercicio, lectura, agua], [0, -1, -2, -3].map((d, i) => ({ [t.id]: d === 0 ? "Hoy" : `Día ${-d}`, [f.id]: day(d), [animo.id]: opt(animo, ["Bien", "Genial", "Normal", "Cansado"][i]), [ejercicio.id]: i % 2 === 0, [lectura.id]: i !== 2, [agua.id]: 6 + i })), [
    { name: "Calendario", kind: "calendar", groupBy: f },
    { name: "Hábitos", kind: "table" },
  ]);
  const plantilla = page(home.id, "Plantilla de entrada", "✍️", [
    h3("¿Cómo me siento?"),
    p(""),
    h3("Tres cosas por las que estoy agradecido"),
    num(""),
    num(""),
    num(""),
    h3("Lo más importante de hoy"),
    todo(""),
    h3("¿Qué aprendí?"),
    p(""),
  ]);
  home.blocks = [
    quote("«Lo que se mide, mejora.»"),
    callout("Escribe unas líneas cada noche y marca tus hábitos en la vista <b>Hábitos</b>.", "🌙", "yellow"),
    link(entradas.id),
    link(plantilla.id),
    h2("Metas del mes"),
    todo("Hacer ejercicio 12 días"),
    todo("Leer 2 libros"),
    todo("Dormir antes de las 23:00"),
  ];
  return workspace("Diario y hábitos", [home, entradas, plantilla], [home.id]);
}

function crm(): string {
  const home = page(null, "Clientes y ventas", "💼", [], "forest");
  const t = col("Cliente", "title", undefined, 220);
  const st = col("Etapa", "select", [["Contacto", "gray"], ["Reunión", "blue"], ["Propuesta", "purple"], ["Negociación", "orange"], ["Ganado", "green"], ["Perdido", "red"]]);
  const valor = col("Valor", "number");
  const contacto = col("Contacto", "text");
  const web = col("Web", "url");
  const prox = col("Próximo paso", "date");
  const clientes = database(home.id, "Oportunidades", "🤝", [t, st, valor, contacto, web, prox], [
    ["Café La Montaña", "Propuesta", 1200, "Laura Gómez", 4],
    ["Panadería El Trigo", "Reunión", 800, "Pedro Ruiz", 2],
    ["Estudio Lumen", "Negociación", 3500, "Sofía Díaz", 1],
    ["Librería Prosa", "Ganado", 950, "Andrés Mora", -3],
    ["Gimnasio Fuerza", "Contacto", 600, "Diana Paz", 6],
  ].map(([n, s, v, c, d]) => ({ [t.id]: n, [st.id]: opt(st, s as string), [valor.id]: v, [contacto.id]: c, [prox.id]: day(d as number) })), [
    { name: "Embudo", kind: "board", groupBy: st },
    { name: "Tabla", kind: "table" },
    { name: "Seguimiento", kind: "calendar", groupBy: prox },
  ]);
  const guion = page(home.id, "Guion de primera llamada", "📞", [
    num("Presentarte en una frase"),
    num("Preguntar por su mayor problema hoy"),
    num("Contar un caso parecido que resolviste"),
    num("Proponer una reunión de 20 minutos"),
    callout("Escucha más de lo que hablas: 70 % ellos, 30 % tú.", "👂", "green"),
  ]);
  home.blocks = [callout("Sigue cada oportunidad desde el primer contacto hasta la venta.", "📈", "green"), link(clientes.id), link(guion.id), h2("Meta del trimestre"), p("Cerrar <b>10.000</b> en ventas nuevas.")];
  return workspace("Clientes y ventas (CRM)", [home, clientes, guion], [home.id]);
}

function viaje(): string {
  const home = page(null, "Viaje a Cartagena", "✈️", [], "ocean");
  const g = col("Gasto", "title", undefined, 220);
  const cat = col("Categoría", "select", [["Transporte", "blue"], ["Alojamiento", "purple"], ["Comida", "orange"], ["Actividades", "green"]]);
  const monto = col("Monto", "number");
  const pagado = col("Pagado", "checkbox");
  const presupuesto = database(home.id, "Presupuesto", "💰", [g, cat, monto, pagado], [
    ["Vuelos", "Transporte", 420, true],
    ["Hotel (4 noches)", "Alojamiento", 360, true],
    ["Tour islas del Rosario", "Actividades", 90, false],
    ["Comidas", "Comida", 200, false],
  ].map(([n, c, m, pg]) => ({ [g.id]: n, [cat.id]: opt(cat, c as string), [monto.id]: m, [pagado.id]: pg })), [{ name: "Tabla", kind: "table" }, { name: "Por categoría", kind: "board", groupBy: cat }]);
  home.blocks = [
    callout(`Del <b>${day(20)}</b> al <b>${day(24)}</b> · 4 noches`, "📅", "blue"),
    h2("Itinerario"),
    table([["Día", "Mañana", "Tarde", "Noche"], ["1", "Llegada y hotel", "Ciudad amurallada", "Cena en Getsemaní"], ["2", "Islas del Rosario", "Playa", "Atardecer en el Café del Mar"], ["3", "Castillo San Felipe", "Museo del Oro", "Libre"], ["4", "Compras", "Regreso", ""]]),
    h2("Qué llevar"),
    todo("Documento de identidad y reservas"),
    todo("Bloqueador solar y gorra"),
    todo("Traje de baño"),
    todo("Cargador y batería externa"),
    h2("Dinero"),
    link(presupuesto.id),
    divider(),
    toggle("Contactos de emergencia", [p("Hotel: · Aerolínea: · Seguro de viaje:")]),
  ];
  return workspace("Planificador de viajes", [home, presupuesto], [home.id]);
}

export const BOOKS_TEMPLATES: Record<string, () => string> = {
  "books-segundo-cerebro": segundoCerebro,
  "books-proyectos": gestorProyectos,
  "books-wiki": wikiEquipo,
  "books-estudios": planEstudios,
  "books-diario": diario,
  "books-crm": crm,
  "books-viaje": viaje,
};
