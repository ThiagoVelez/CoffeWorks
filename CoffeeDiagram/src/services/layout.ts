// Organización automática de los diagramas.

import type { Diagram, DNode } from "../types";
import { updateEdges, updateNodes } from "./model";

const CONTAINERS = new Set(["system", "swimlane", "package", "fragment", "note", "text"]);

/** Organiza por capas: lo de arriba (padres, inicios) primero. */
export function autoLayout(d: Diagram): Diagram {
  if (d.kind === "sequence") return layoutSequence(d);
  if (d.kind === "mindmap") return layoutMindmap(d);
  const nodes = Object.values(d.nodes).filter((n) => !CONTAINERS.has(n.type) && n.type !== "activation");
  if (!nodes.length) return d;
  const ids = new Set(nodes.map((n) => n.id));
  const out = new Map<string, string[]>();
  const inc = new Map<string, number>();
  for (const n of nodes) {
    out.set(n.id, []);
    inc.set(n.id, 0);
  }
  for (const e of Object.values(d.edges)) {
    if (!ids.has(e.source) || !ids.has(e.target) || e.source === e.target || e.kind === "anchor") continue;
    // En la herencia el padre (destino) va arriba
    const [a, b] = e.kind === "generalization" || e.kind === "realization" ? [e.target, e.source] : [e.source, e.target];
    out.get(a)!.push(b);
    inc.set(b, (inc.get(b) || 0) + 1);
  }
  // Rango por el camino más largo desde las raíces (ignorando ciclos)
  const rank = new Map<string, number>();
  const visiting = new Set<string>();
  const visit = (id: string, r: number) => {
    if (visiting.has(id)) return;
    if ((rank.get(id) ?? -1) >= r) return;
    rank.set(id, r);
    visiting.add(id);
    for (const nxt of out.get(id) || []) visit(nxt, r + 1);
    visiting.delete(id);
  };
  const roots = nodes.filter((n) => !inc.get(n.id));
  (roots.length ? roots : [nodes[0]]).forEach((n) => visit(n.id, 0));
  for (const n of nodes) if (!rank.has(n.id)) visit(n.id, 0);

  const rows: DNode[][] = [];
  for (const n of nodes) {
    const r = rank.get(n.id) || 0;
    (rows[r] ||= []).push(n);
  }
  // Orden dentro de cada fila según la posición media de sus antecesores
  const pos = new Map<string, number>();
  rows.forEach((row, r) => {
    if (r === 0) row.sort((a, b) => a.x - b.x);
    else {
      const bary = (n: DNode) => {
        const parents = nodes.filter((p) => out.get(p.id)?.includes(n.id) && pos.has(p.id));
        return parents.length ? parents.reduce((s, p) => s + pos.get(p.id)!, 0) / parents.length : n.x;
      };
      row.sort((a, b) => bary(a) - bary(b));
    }
    row.forEach((n, i) => pos.set(n.id, i));
  });
  const gapX = d.kind === "activity" || d.kind === "flowchart" || d.kind === "state" ? 60 : 80;
  const gapY = d.kind === "class" || d.kind === "er" ? 90 : 60;
  const widths = rows.map((row) => row.reduce((s, n) => s + n.w, 0) + gapX * Math.max(0, (row?.length || 1) - 1));
  const maxW = Math.max(...widths);
  const patches: Record<string, Partial<DNode>> = {};
  let y = 40;
  rows.forEach((row, r) => {
    if (!row) return;
    let x = 40 + (maxW - widths[r]) / 2;
    const h = Math.max(...row.map((n) => n.h));
    for (const n of row) {
      patches[n.id] = { x: Math.round(x), y: Math.round(y + (h - n.h) / 2) };
      x += n.w + gapX;
    }
    y += h + gapY;
  });
  return updateNodes(d, patches);
}

function layoutSequence(d: Diagram): Diagram {
  const lifelines = Object.values(d.nodes)
    .filter((n) => n.type === "lifeline" || n.type === "actorLifeline")
    .sort((a, b) => a.x - b.x);
  const patches: Record<string, Partial<DNode>> = {};
  const messages = Object.values(d.edges)
    .filter((e) => e.y !== undefined)
    .sort((a, b) => (a.y || 0) - (b.y || 0));
  const height = Math.max(300, 130 + messages.length * 48 + 60);
  let x = 40;
  const shift = new Map<string, number>();
  for (const l of lifelines) {
    shift.set(l.id, x - l.x);
    patches[l.id] = { x, y: 40, h: height };
    x += Math.max(l.w, 120) + 70;
  }
  // Las activaciones acompañan a su participante
  for (const a of Object.values(d.nodes).filter((n) => n.type === "activation")) {
    const owner = lifelines.find((l) => Math.abs(l.x + l.w / 2 - (a.x + a.w / 2)) < l.w / 2);
    if (owner) patches[a.id] = { x: a.x + (shift.get(owner.id) || 0) };
  }
  let next = updateNodes(d, patches);
  const edgePatches: Record<string, { y: number }> = {};
  messages.forEach((m, i) => (edgePatches[m.id] = { y: 40 + 110 + i * 48 }));
  next = updateEdges(next, edgePatches);
  return next;
}

function layoutMindmap(d: Diagram): Diagram {
  const nodes = Object.values(d.nodes).filter((n) => n.type === "topic" || n.type === "subtopic");
  const root = nodes.find((n) => n.type === "topic") || nodes[0];
  if (!root) return d;
  const adj = new Map<string, string[]>();
  for (const e of Object.values(d.edges)) {
    (adj.get(e.source) || adj.set(e.source, []).get(e.source)!).push(e.target);
    (adj.get(e.target) || adj.set(e.target, []).get(e.target)!).push(e.source);
  }
  const patches: Record<string, Partial<DNode>> = {};
  const cx = 600;
  const cy = 400;
  patches[root.id] = { x: cx - root.w / 2, y: cy - root.h / 2 };
  const seen = new Set([root.id]);
  const first = (adj.get(root.id) || []).filter((id) => d.nodes[id]);
  first.forEach((id, i) => {
    seen.add(id);
    const a = (i / Math.max(1, first.length)) * Math.PI * 2 - Math.PI / 2;
    const n = d.nodes[id];
    const px = cx + Math.cos(a) * 280;
    const py = cy + Math.sin(a) * 200;
    patches[id] = { x: px - n.w / 2, y: py - n.h / 2 };
    const kids = (adj.get(id) || []).filter((k) => !seen.has(k) && d.nodes[k]);
    kids.forEach((k, j) => {
      seen.add(k);
      const spread = 0.5;
      const b = a + (j - (kids.length - 1) / 2) * spread;
      const kn = d.nodes[k];
      patches[k] = { x: px + Math.cos(b) * 210 - kn.w / 2, y: py + Math.sin(b) * 150 - kn.h / 2 };
    });
  });
  return updateNodes(d, patches);
}
