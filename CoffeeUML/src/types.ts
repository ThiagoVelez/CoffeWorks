// Modelo de datos de CoffeeUML.
//
// Un modelo (.cuml) reúne varios diagramas. Cada diagrama tiene figuras
// (clases, actores, entidades, acciones…) y conexiones entre ellas.

export const ACCENT = "#40826d";
export const ACCENT_LIGHT = "#e3f1ec";
export const SELECT = "#2f80ed";

export type DiagramKind =
  | "class"
  | "object"
  | "package"
  | "usecase"
  | "sequence"
  | "activity"
  | "state"
  | "component"
  | "deployment"
  | "er"
  | "flowchart"
  | "mindmap";

export type ShapeType =
  // Clases y objetos
  | "class"
  | "interface"
  | "enum"
  | "object"
  | "package"
  | "note"
  | "text"
  // Casos de uso
  | "actor"
  | "usecase"
  | "system"
  // Secuencia
  | "lifeline"
  | "actorLifeline"
  | "activation"
  | "fragment"
  // Actividad y estados
  | "initial"
  | "final"
  | "flowFinal"
  | "action"
  | "decision"
  | "fork"
  | "objectNode"
  | "swimlane"
  | "sendSignal"
  | "receiveSignal"
  | "state"
  | "choice"
  | "history"
  // Componentes y despliegue
  | "component"
  | "providedInterface"
  | "node"
  | "device"
  | "artifact"
  // Entidad-relación
  | "entity"
  | "erEntity"
  | "erWeakEntity"
  | "erAttribute"
  | "erRelationship"
  // Diagramas de flujo
  | "terminator"
  | "process"
  | "io"
  | "document"
  | "database"
  | "subprocess"
  | "connector"
  // Mapas mentales
  | "topic"
  | "subtopic";

export type Visibility = "+" | "-" | "#" | "~";

export interface Member {
  id: string;
  visibility: Visibility;
  name: string;
  /** Tipo del atributo o tipo de retorno de la operación. */
  type: string;
  /** Parámetros de una operación, p. ej. «id: int, nombre: String». */
  params: string;
  isStatic: boolean;
  isAbstract: boolean;
  /** Valor inicial (atributos) o valor del objeto (diagramas de objetos). */
  value: string;
  // Columnas de entidades
  pk: boolean;
  fk: boolean;
  nullable: boolean;
  unique: boolean;
  /** Tabla a la que apunta una clave foránea. */
  ref?: string;
}

export interface DNode {
  id: string;
  type: ShapeType;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  stereotype: string;
  /** Texto libre (notas, acciones con varias líneas, guarda de un fragmento). */
  text: string;
  isAbstract: boolean;
  /** Atributos, columnas o actividades internas de un estado. */
  attributes: Member[];
  operations: Member[];
  /** Valores de una enumeración. */
  literals: string[];
  fill: string;
  stroke: string;
  textColor: string;
  /** El tamaño se ajusta solo al contenido (clases, entidades…). */
  autoSize: boolean;
  /** Operador de un fragmento combinado (alt, loop, opt…). */
  operator?: string;
  /** Línea horizontal en un carril (orientación). */
  horizontal?: boolean;
}

export type EdgeKind =
  | "association"
  | "directed"
  | "aggregation"
  | "composition"
  | "generalization"
  | "realization"
  | "dependency"
  | "include"
  | "extend"
  | "link"
  | "message"
  | "reply"
  | "asyncMessage"
  | "createMessage"
  | "flow"
  | "erRelation"
  | "line"
  | "anchor";

export type Cardinality = "" | "1" | "0..1" | "1..*" | "0..*";

export interface DEdge {
  id: string;
  kind: EdgeKind;
  source: string;
  target: string;
  label: string;
  sourceLabel: string;
  targetLabel: string;
  /** Cardinalidades de las relaciones entidad-relación (pata de gallo). */
  sourceCard: Cardinality;
  targetCard: Cardinality;
  routing: "straight" | "orthogonal";
  /** Posición vertical de los mensajes de un diagrama de secuencia. */
  y?: number;
  color: string;
}

export interface Diagram {
  id: string;
  name: string;
  kind: DiagramKind;
  nodes: Record<string, DNode>;
  edges: Record<string, DEdge>;
  /** Orden de dibujo de las figuras (de atrás adelante). */
  order: string[];
}

export interface DiagramDocument {
  format: "coffeeuml";
  version: 1;
  diagrams: Diagram[];
  current: string;
}

export interface PaletteItem {
  type: ShapeType;
  label: string;
  /** Valores iniciales propios de este elemento de la paleta. */
  preset?: Partial<DNode>;
}

export interface PaletteEdge {
  kind: EdgeKind;
  label: string;
}

export interface KindInfo {
  kind: DiagramKind;
  label: string;
  group: "UML estructural" | "UML de comportamiento" | "Datos" | "Otros";
  description: string;
  shapes: PaletteItem[];
  edges: PaletteEdge[];
  /** Conexión que se crea al arrastrar desde el tirador de una figura. */
  defaultEdge: EdgeKind;
}

const note: PaletteItem = { type: "note", label: "Nota" };
const text: PaletteItem = { type: "text", label: "Texto" };

export const KINDS: KindInfo[] = [
  {
    kind: "class",
    label: "Diagrama de clases",
    group: "UML estructural",
    description: "Clases, interfaces y enumeraciones con atributos, operaciones y relaciones.",
    shapes: [
      { type: "class", label: "Clase" },
      { type: "class", label: "Clase abstracta", preset: { isAbstract: true, name: "ClaseAbstracta" } },
      { type: "interface", label: "Interfaz" },
      { type: "enum", label: "Enumeración" },
      { type: "package", label: "Paquete" },
      note,
      text,
    ],
    edges: [
      { kind: "association", label: "Asociación" },
      { kind: "directed", label: "Asociación dirigida" },
      { kind: "aggregation", label: "Agregación" },
      { kind: "composition", label: "Composición" },
      { kind: "generalization", label: "Herencia" },
      { kind: "realization", label: "Realización" },
      { kind: "dependency", label: "Dependencia" },
      { kind: "anchor", label: "Enlace de nota" },
    ],
    defaultEdge: "association",
  },
  {
    kind: "object",
    label: "Diagrama de objetos",
    group: "UML estructural",
    description: "Instancias concretas con los valores de sus atributos.",
    shapes: [{ type: "object", label: "Objeto" }, note, text],
    edges: [
      { kind: "link", label: "Enlace" },
      { kind: "directed", label: "Enlace dirigido" },
      { kind: "anchor", label: "Enlace de nota" },
    ],
    defaultEdge: "link",
  },
  {
    kind: "package",
    label: "Diagrama de paquetes",
    group: "UML estructural",
    description: "Organización del sistema en paquetes y sus dependencias.",
    shapes: [{ type: "package", label: "Paquete" }, { type: "class", label: "Clase" }, note, text],
    edges: [
      { kind: "dependency", label: "Dependencia" },
      { kind: "generalization", label: "Herencia" },
      { kind: "anchor", label: "Enlace de nota" },
    ],
    defaultEdge: "dependency",
  },
  {
    kind: "component",
    label: "Diagrama de componentes",
    group: "UML estructural",
    description: "Componentes de software, interfaces que ofrecen y sus dependencias.",
    shapes: [
      { type: "component", label: "Componente" },
      { type: "providedInterface", label: "Interfaz ofrecida" },
      { type: "artifact", label: "Artefacto" },
      { type: "package", label: "Paquete" },
      note,
      text,
    ],
    edges: [
      { kind: "dependency", label: "Dependencia" },
      { kind: "realization", label: "Realización" },
      { kind: "association", label: "Conector" },
      { kind: "anchor", label: "Enlace de nota" },
    ],
    defaultEdge: "dependency",
  },
  {
    kind: "deployment",
    label: "Diagrama de despliegue",
    group: "UML estructural",
    description: "Servidores, dispositivos y los artefactos que se instalan en ellos.",
    shapes: [
      { type: "node", label: "Nodo" },
      { type: "device", label: "Dispositivo" },
      { type: "artifact", label: "Artefacto" },
      { type: "component", label: "Componente" },
      { type: "database", label: "Base de datos" },
      note,
      text,
    ],
    edges: [
      { kind: "association", label: "Ruta de comunicación" },
      { kind: "dependency", label: "Dependencia / despliegue" },
      { kind: "anchor", label: "Enlace de nota" },
    ],
    defaultEdge: "association",
  },
  {
    kind: "usecase",
    label: "Diagrama de casos de uso",
    group: "UML de comportamiento",
    description: "Actores, casos de uso y el límite del sistema.",
    shapes: [
      { type: "actor", label: "Actor" },
      { type: "usecase", label: "Caso de uso" },
      { type: "system", label: "Sistema" },
      note,
      text,
    ],
    edges: [
      { kind: "link", label: "Asociación" },
      { kind: "include", label: "«include»" },
      { kind: "extend", label: "«extend»" },
      { kind: "generalization", label: "Generalización" },
      { kind: "anchor", label: "Enlace de nota" },
    ],
    defaultEdge: "link",
  },
  {
    kind: "sequence",
    label: "Diagrama de secuencia",
    group: "UML de comportamiento",
    description: "Mensajes entre participantes ordenados en el tiempo.",
    shapes: [
      { type: "lifeline", label: "Participante" },
      { type: "actorLifeline", label: "Actor" },
      { type: "activation", label: "Activación" },
      { type: "fragment", label: "Fragmento (alt, loop…)" },
      note,
    ],
    edges: [
      { kind: "message", label: "Mensaje síncrono" },
      { kind: "asyncMessage", label: "Mensaje asíncrono" },
      { kind: "reply", label: "Respuesta" },
      { kind: "createMessage", label: "Creación" },
      { kind: "anchor", label: "Enlace de nota" },
    ],
    defaultEdge: "message",
  },
  {
    kind: "activity",
    label: "Diagrama de actividad",
    group: "UML de comportamiento",
    description: "Flujo de acciones con decisiones, paralelismo y carriles.",
    shapes: [
      { type: "initial", label: "Inicio" },
      { type: "action", label: "Acción" },
      { type: "decision", label: "Decisión / fusión" },
      { type: "fork", label: "Bifurcación / unión" },
      { type: "objectNode", label: "Objeto" },
      { type: "sendSignal", label: "Enviar señal" },
      { type: "receiveSignal", label: "Recibir señal" },
      { type: "swimlane", label: "Carril" },
      { type: "final", label: "Fin" },
      { type: "flowFinal", label: "Fin de flujo" },
      note,
    ],
    edges: [
      { kind: "flow", label: "Flujo de control" },
      { kind: "anchor", label: "Enlace de nota" },
    ],
    defaultEdge: "flow",
  },
  {
    kind: "state",
    label: "Diagrama de estados",
    group: "UML de comportamiento",
    description: "Estados de un objeto y las transiciones entre ellos.",
    shapes: [
      { type: "initial", label: "Estado inicial" },
      { type: "state", label: "Estado" },
      { type: "state", label: "Estado compuesto", preset: { name: "Compuesto", w: 260, h: 160, autoSize: false } },
      { type: "choice", label: "Elección" },
      { type: "history", label: "Historia" },
      { type: "fork", label: "Bifurcación / unión" },
      { type: "final", label: "Estado final" },
      note,
    ],
    edges: [
      { kind: "flow", label: "Transición" },
      { kind: "anchor", label: "Enlace de nota" },
    ],
    defaultEdge: "flow",
  },
  {
    kind: "er",
    label: "Modelo entidad-relación",
    group: "Datos",
    description: "Tablas con claves y cardinalidades (pata de gallo) o notación de Chen.",
    shapes: [
      { type: "entity", label: "Tabla (entidad)" },
      { type: "erEntity", label: "Entidad (Chen)" },
      { type: "erWeakEntity", label: "Entidad débil (Chen)" },
      { type: "erAttribute", label: "Atributo (Chen)" },
      { type: "erAttribute", label: "Atributo clave (Chen)", preset: { name: "id", isAbstract: true } },
      { type: "erRelationship", label: "Relación (Chen)" },
      note,
      text,
    ],
    edges: [
      { kind: "erRelation", label: "Relación con cardinalidad" },
      { kind: "line", label: "Línea (Chen)" },
      { kind: "anchor", label: "Enlace de nota" },
    ],
    defaultEdge: "erRelation",
  },
  {
    kind: "flowchart",
    label: "Diagrama de flujo",
    group: "Otros",
    description: "Procesos, decisiones, entradas y salidas de un algoritmo o procedimiento.",
    shapes: [
      { type: "terminator", label: "Inicio / fin" },
      { type: "process", label: "Proceso" },
      { type: "decision", label: "Decisión" },
      { type: "io", label: "Entrada / salida" },
      { type: "document", label: "Documento" },
      { type: "database", label: "Base de datos" },
      { type: "subprocess", label: "Subproceso" },
      { type: "connector", label: "Conector" },
      note,
      text,
    ],
    edges: [
      { kind: "flow", label: "Flecha" },
      { kind: "line", label: "Línea" },
    ],
    defaultEdge: "flow",
  },
  {
    kind: "mindmap",
    label: "Mapa mental",
    group: "Otros",
    description: "Ideas organizadas alrededor de un tema central.",
    shapes: [
      { type: "topic", label: "Tema central" },
      { type: "subtopic", label: "Idea" },
      note,
      text,
    ],
    edges: [{ kind: "line", label: "Rama" }],
    defaultEdge: "line",
  },
];

export const kindInfo = (kind: DiagramKind) => KINDS.find((k) => k.kind === kind) || KINDS[0];

export const EDGE_LABEL: Record<EdgeKind, string> = Object.fromEntries(KINDS.flatMap((k) => k.edges.map((e) => [e.kind, e.label]))) as Record<EdgeKind, string>;

export const SHAPE_LABEL: Partial<Record<ShapeType, string>> = Object.fromEntries(KINDS.flatMap((k) => k.shapes.map((s) => [s.type, s.label])));

export const CARDINALITIES: { value: Cardinality; label: string }[] = [
  { value: "", label: "Sin indicar" },
  { value: "1", label: "Uno (1)" },
  { value: "0..1", label: "Cero o uno (0..1)" },
  { value: "1..*", label: "Uno o muchos (1..*)" },
  { value: "0..*", label: "Cero o muchos (0..*)" },
];

/** Figuras que muestran listas de miembros. */
export const hasMembers = (t: ShapeType) => t === "class" || t === "interface" || t === "object" || t === "entity" || t === "state";
