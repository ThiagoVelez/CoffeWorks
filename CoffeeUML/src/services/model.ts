// Operaciones sobre el modelo: crear figuras y conexiones, tamaños
// automáticos, documento y lectura de archivos.

import type { Cardinality, DEdge, DNode, Diagram, DiagramDocument, DiagramKind, EdgeKind, Member, ShapeType } from "../types";
import { kindInfo } from "../types";

let counter = 0;
export const newId = (prefix = "n") => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const FONT = "'Hanken Grotesk', 'Segoe UI', sans-serif";
export const MONO = "'JetBrains Mono', monospace";
export const LINE = 18;
export const PAD = 8;

const SIZES: Partial<Record<ShapeType, [number, number]>> = {
  class: [180, 90],
  interface: [180, 80],
  enum: [170, 90],
  object: [180, 70],
  package: [220, 150],
  note: [170, 80],
  text: [140, 26],
  actor: [70, 96],
  usecase: [170, 64],
  system: [340, 400],
  lifeline: [130, 420],
  actorLifeline: [110, 420],
  activation: [16, 90],
  fragment: [340, 190],
  initial: [28, 28],
  final: [32, 32],
  flowFinal: [30, 30],
  action: [160, 56],
  decision: [56, 56],
  fork: [140, 8],
  objectNode: [140, 52],
  swimlane: [260, 460],
  sendSignal: [150, 52],
  receiveSignal: [150, 52],
  state: [160, 60],
  choice: [36, 36],
  history: [32, 32],
  component: [180, 80],
  providedInterface: [26, 26],
  node: [200, 120],
  device: [200, 120],
  artifact: [150, 64],
  entity: [220, 110],
  erEntity: [140, 54],
  erWeakEntity: [140, 54],
  erAttribute: [120, 48],
  erRelationship: [130, 70],
  terminator: [150, 52],
  process: [150, 64],
  io: [160, 64],
  document: [150, 72],
  database: [96, 90],
  subprocess: [160, 64],
  connector: [38, 38],
  topic: [200, 76],
  subtopic: [150, 46],
};

const NAMES: Partial<Record<ShapeType, string>> = {
  class: "Clase",
  interface: "Interfaz",
  enum: "Enumeracion",
  object: "objeto : Clase",
  package: "paquete",
  note: "Nota",
  text: "Texto",
  actor: "Actor",
  usecase: "Caso de uso",
  system: "Sistema",
  lifeline: "Participante",
  actorLifeline: "Usuario",
  activation: "",
  fragment: "",
  initial: "",
  final: "",
  flowFinal: "",
  action: "Acción",
  decision: "",
  fork: "",
  objectNode: "Objeto",
  swimlane: "Carril",
  sendSignal: "Enviar señal",
  receiveSignal: "Recibir señal",
  state: "Estado",
  choice: "",
  history: "H",
  component: "Componente",
  providedInterface: "IServicio",
  node: "Servidor",
  device: "Dispositivo",
  artifact: "app.jar",
  entity: "tabla",
  erEntity: "Entidad",
  erWeakEntity: "Entidad débil",
  erAttribute: "atributo",
  erRelationship: "relación",
  terminator: "Inicio",
  process: "Proceso",
  io: "Leer datos",
  document: "Informe",
  database: "Base de datos",
  subprocess: "Subproceso",
  connector: "A",
  topic: "Tema central",
  subtopic: "Idea",
};

const FILLS: Partial<Record<ShapeType, string>> = {
  class: "#fffdf3",
  interface: "#f4fbf6",
  enum: "#fbf6ff",
  object: "#fffdf3",
  package: "#f6f8fb",
  note: "#fff8c4",
  text: "transparent",
  actor: "#ffffff",
  usecase: "#f2f7ff",
  system: "#fbfcfe",
  lifeline: "#f2f7ff",
  actorLifeline: "#ffffff",
  activation: "#e6eefb",
  fragment: "transparent",
  initial: "#1e2a38",
  final: "#1e2a38",
  flowFinal: "#ffffff",
  action: "#eef5ff",
  decision: "#fff7e6",
  fork: "#1e2a38",
  objectNode: "#ffffff",
  swimlane: "#fbfcfe",
  sendSignal: "#eef5ff",
  receiveSignal: "#eef5ff",
  state: "#f1f8f4",
  choice: "#fff7e6",
  history: "#ffffff",
  component: "#f2f7ff",
  providedInterface: "#ffffff",
  node: "#ecf5f1",
  device: "#ecf5f1",
  artifact: "#ffffff",
  entity: "#ffffff",
  erEntity: "#f2f7ff",
  erWeakEntity: "#f2f7ff",
  erAttribute: "#ffffff",
  erRelationship: "#fff7e6",
  terminator: "#e8f5e9",
  process: "#eef5ff",
  io: "#f3eefe",
  document: "#ffffff",
  database: "#fff3e0",
  subprocess: "#eef5ff",
  connector: "#ffffff",
  topic: "#ffd54f",
  subtopic: "#e3f2fd",
};

export function member(patch: Partial<Member> = {}): Member {
  return { id: newId("m"), visibility: "+", name: "", type: "", params: "", isStatic: false, isAbstract: false, value: "", pk: false, fk: false, nullable: true, unique: false, ...patch };
}

export function makeNode(type: ShapeType, patch: Partial<DNode> = {}): DNode {
  const [w, h] = SIZES[type] || [140, 60];
  const node: DNode = {
    id: newId("n"),
    type,
    name: NAMES[type] ?? "",
    x: 0,
    y: 0,
    w,
    h,
    stereotype: type === "interface" ? "interface" : type === "enum" ? "enumeration" : type === "device" ? "device" : type === "artifact" ? "artifact" : type === "component" ? "component" : "",
    text: type === "note" ? "Escribe aquí tu nota" : type === "fragment" ? "[condición]" : "",
    isAbstract: false,
    attributes: [],
    operations: [],
    literals: type === "enum" ? ["VALOR_A", "VALOR_B"] : [],
    fill: FILLS[type] || "#ffffff",
    stroke: "#33475b",
    textColor: "#1b2733",
    autoSize: ["class", "interface", "enum", "object", "entity", "state", "usecase", "action"].includes(type),
    ...(type === "fragment" ? { operator: "alt" } : {}),
    ...(type === "topic" ? { stroke: "#c79a00" } : {}),
  };
  if (type === "class") {
    node.attributes = [member({ visibility: "-", name: "id", type: "int" }), member({ visibility: "-", name: "nombre", type: "String" })];
    node.operations = [member({ name: "getNombre", type: "String" })];
  } else if (type === "interface") {
    node.operations = [member({ name: "ejecutar", type: "void", isAbstract: true })];
  } else if (type === "object") {
    node.attributes = [member({ name: "nombre", value: "\"Ana\"" })];
  } else if (type === "entity") {
    node.attributes = [member({ name: "id", type: "INTEGER", pk: true, nullable: false }), member({ name: "nombre", type: "VARCHAR(100)", nullable: false })];
  }
  return autoSize({ ...node, ...patch });
}

export function makeEdge(kind: EdgeKind, source: string, target: string, patch: Partial<DEdge> = {}): DEdge {
  return {
    id: newId("e"),
    kind,
    source,
    target,
    label: kind === "include" ? "«include»" : kind === "extend" ? "«extend»" : "",
    sourceLabel: "",
    targetLabel: "",
    sourceCard: kind === "erRelation" ? "1" : "",
    targetCard: (kind === "erRelation" ? "0..*" : "") as Cardinality,
    routing: kind === "flow" || kind === "erRelation" ? "orthogonal" : "straight",
    color: "#33475b",
    ...patch,
  };
}

// ---------------------------------------------------------------------------
// Texto y tamaños
// ---------------------------------------------------------------------------

let ctx: CanvasRenderingContext2D | null = null;

export function textWidth(text: string, size = 13, weight = 400, family = FONT): number {
  if (!ctx) ctx = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  if (!ctx) return text.length * size * 0.56;
  ctx.font = `${weight} ${size}px ${family}`;
  return ctx.measureText(text).width;
}

export const memberText = (m: Member, kind: "attr" | "op", node: DNode): string => {
  if (node.type === "object") return `${m.name}${m.value ? ` = ${m.value}` : ""}`;
  if (node.type === "state") return m.name;
  if (node.type === "entity") return `${m.name}  ${m.type}`;
  const vis = m.visibility ? `${m.visibility} ` : "";
  if (kind === "attr") return `${vis}${m.name}${m.type ? `: ${m.type}` : ""}${m.value ? ` = ${m.value}` : ""}`;
  return `${vis}${m.name}(${m.params})${m.type ? `: ${m.type}` : ""}`;
};

/** Medidas de las figuras con compartimentos (cabecera y listas). */
export function compartments(n: DNode) {
  const stereo = n.stereotype && ["class", "interface", "enum", "component", "state"].includes(n.type) ? 1 : 0;
  const header = n.type === "entity" ? 32 : 26 + stereo * 15;
  const attrLines = n.type === "enum" ? n.literals.length : n.attributes.length;
  const showOps = n.type === "class" || n.type === "interface";
  const attrH = n.type === "state" ? (attrLines ? attrLines * LINE + PAD : 0) : Math.max(n.type === "entity" ? 0 : 10, attrLines * LINE + (attrLines ? PAD : 0));
  const opH = showOps ? Math.max(10, n.operations.length * LINE + (n.operations.length ? PAD : 0)) : 0;
  return { header, attrH, opH, stereo };
}

/** Ajusta el tamaño de la figura a su contenido (si tiene tamaño automático). */
export function autoSize(n: DNode): DNode {
  if (!n.autoSize) return n;
  if (n.type === "usecase" || n.type === "action") {
    const lines = n.name.split("\n");
    const w = Math.max(n.type === "usecase" ? 150 : 120, ...lines.map((l) => textWidth(l, 13, 500) + (n.type === "usecase" ? 56 : 32)));
    const h = Math.max(n.type === "usecase" ? 60 : 50, lines.length * LINE + 26);
    return { ...n, w: Math.ceil(w), h: Math.ceil(h) };
  }
  if (!["class", "interface", "enum", "object", "entity", "state"].includes(n.type)) return n;
  const c = compartments(n);
  const nameW = textWidth(n.type === "entity" ? n.name : n.name, 14, 700) + 28;
  const stereoW = c.stereo ? textWidth(`«${n.stereotype}»`, 11) + 28 : 0;
  const attrW = (n.type === "enum" ? n.literals : n.attributes.map((m) => memberText(m, "attr", n))).map((t) => textWidth(t, 12.5, 400) + (n.type === "entity" ? 70 : 24));
  const opW = n.type === "class" || n.type === "interface" ? n.operations.map((m) => textWidth(memberText(m, "op", n), 12.5) + 24) : [];
  const min = n.type === "state" ? 120 : n.type === "entity" ? 200 : 150;
  const w = Math.max(min, nameW, stereoW, ...attrW, ...opW);
  const h = n.type === "state" ? Math.max(52, c.header + c.attrH + 8) : c.header + c.attrH + c.opH;
  return { ...n, w: Math.ceil(w), h: Math.ceil(h) };
}

// ---------------------------------------------------------------------------
// Diagramas y documento
// ---------------------------------------------------------------------------

export function newDiagram(kind: DiagramKind, name?: string): Diagram {
  return { id: newId("d"), name: name || kindInfo(kind).label, kind, nodes: {}, edges: {}, order: [] };
}

export function newDocument(kind: DiagramKind = "class"): DiagramDocument {
  const d = newDiagram(kind);
  return { format: "coffeeuml", version: 1, diagrams: [d], current: d.id };
}

export function currentDiagram(doc: DiagramDocument): Diagram {
  return doc.diagrams.find((d) => d.id === doc.current) || doc.diagrams[0];
}

export function withDiagram(doc: DiagramDocument, d: Diagram): DiagramDocument {
  return { ...doc, diagrams: doc.diagrams.map((x) => (x.id === d.id ? d : x)) };
}

export function addNodes(d: Diagram, nodes: DNode[]): Diagram {
  const all = { ...d.nodes };
  for (const n of nodes) all[n.id] = n;
  // Los contenedores (sistema, carriles, paquetes, fragmentos) van detrás
  const back = new Set<ShapeType>(["system", "swimlane", "package", "fragment"]);
  const order = [...d.order];
  for (const n of nodes) {
    if (back.has(n.type)) order.unshift(n.id);
    else order.push(n.id);
  }
  return { ...d, nodes: all, order };
}

export function updateNodes(d: Diagram, patches: Record<string, Partial<DNode>>): Diagram {
  const nodes = { ...d.nodes };
  for (const [id, p] of Object.entries(patches)) if (nodes[id]) nodes[id] = autoSize({ ...nodes[id], ...p });
  return { ...d, nodes };
}

export function updateEdges(d: Diagram, patches: Record<string, Partial<DEdge>>): Diagram {
  const edges = { ...d.edges };
  for (const [id, p] of Object.entries(patches)) if (edges[id]) edges[id] = { ...edges[id], ...p };
  return { ...d, edges };
}

export function addEdge(d: Diagram, e: DEdge): Diagram {
  return { ...d, edges: { ...d.edges, [e.id]: e } };
}

export function removeItems(d: Diagram, ids: string[]): Diagram {
  const set = new Set(ids);
  const nodes: Record<string, DNode> = {};
  for (const [id, n] of Object.entries(d.nodes)) if (!set.has(id)) nodes[id] = n;
  const edges: Record<string, DEdge> = {};
  for (const [id, e] of Object.entries(d.edges)) if (!set.has(id) && nodes[e.source] && nodes[e.target]) edges[id] = e;
  return { ...d, nodes, edges, order: d.order.filter((id) => nodes[id]) };
}

/** Copia figuras (y las conexiones entre ellas) con identificadores nuevos. */
export function cloneItems(d: Diagram, ids: string[], dx = 24, dy = 24): { nodes: DNode[]; edges: DEdge[] } {
  const map = new Map<string, string>();
  const nodes = ids
    .filter((id) => d.nodes[id])
    .map((id) => {
      const n = d.nodes[id];
      const copy = { ...n, id: newId("n"), x: n.x + dx, y: n.y + dy, attributes: n.attributes.map((m) => ({ ...m, id: newId("m") })), operations: n.operations.map((m) => ({ ...m, id: newId("m") })), literals: [...n.literals] };
      map.set(id, copy.id);
      return copy;
    });
  const edges = Object.values(d.edges)
    .filter((e) => map.has(e.source) && map.has(e.target))
    .map((e) => ({ ...e, id: newId("e"), source: map.get(e.source)!, target: map.get(e.target)!, y: e.y !== undefined ? e.y + dy : undefined }));
  return { nodes, edges };
}

export function reorder(d: Diagram, ids: string[], front: boolean): Diagram {
  const rest = d.order.filter((id) => !ids.includes(id));
  return { ...d, order: front ? [...rest, ...ids] : [...ids, ...rest] };
}

const isNum = (v: unknown, def: number) => (typeof v === "number" && Number.isFinite(v) ? v : def);

export function parseDocument(text: string): DiagramDocument {
  let raw: Partial<DiagramDocument>;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("El archivo no es un modelo de CoffeeUML válido.");
  }
  if (!raw || raw.format !== "coffeeuml" || !Array.isArray(raw.diagrams)) throw new Error("El archivo no es un modelo de CoffeeUML válido.");
  const diagrams: Diagram[] = raw.diagrams.map((d) => {
    const nodes: Record<string, DNode> = {};
    for (const [id, n] of Object.entries(d.nodes || {})) {
      if (!n?.type) continue;
      const base = makeNode(n.type);
      nodes[id] = {
        ...base,
        ...n,
        id,
        x: isNum(n.x, 0),
        y: isNum(n.y, 0),
        w: isNum(n.w, base.w),
        h: isNum(n.h, base.h),
        attributes: (n.attributes || []).map((m) => member(m)),
        operations: (n.operations || []).map((m) => member(m)),
        literals: Array.isArray(n.literals) ? n.literals : [],
      };
    }
    const edges: Record<string, DEdge> = {};
    for (const [id, e] of Object.entries(d.edges || {})) if (e && nodes[e.source] && nodes[e.target]) edges[id] = { ...makeEdge(e.kind, e.source, e.target), ...e, id };
    const order = (d.order || []).filter((id) => nodes[id]);
    for (const id of Object.keys(nodes)) if (!order.includes(id)) order.push(id);
    return { id: d.id || newId("d"), name: d.name || "Diagrama", kind: d.kind || "class", nodes, edges, order };
  });
  if (!diagrams.length) diagrams.push(newDiagram("class"));
  return { format: "coffeeuml", version: 1, diagrams, current: diagrams.some((d) => d.id === raw.current) ? raw.current! : diagrams[0].id };
}

export const serializeDocument = (doc: DiagramDocument) => JSON.stringify(doc);

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function boundsOf(d: Diagram, ids?: string[]): Box | null {
  const list = (ids || Object.keys(d.nodes)).map((id) => d.nodes[id]).filter(Boolean);
  if (!list.length) return null;
  const x0 = Math.min(...list.map((n) => n.x));
  const y0 = Math.min(...list.map((n) => n.y));
  const x1 = Math.max(...list.map((n) => n.x + n.w));
  const y1 = Math.max(...list.map((n) => n.y + n.h));
  // Los mensajes de secuencia pueden quedar fuera de las cajas
  const ys = Object.values(d.edges).filter((e) => e.y !== undefined && (!ids || ids.includes(e.source))).map((e) => e.y!);
  return { x: x0, y: y0, w: x1 - x0, h: Math.max(y1, ...ys) - y0 };
}
