// Panel derecho: propiedades del diagrama, de la figura o de la conexión.

import React from "react";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowLeftRight,
  AlignLeft,
  AlignCenterHorizontal,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  LayoutGrid,
  Code2,
  Key,
  Link,
} from "lucide-react";
import type { Cardinality, DEdge, DNode, Diagram, Member, Visibility } from "../types";
import { CARDINALITIES, EDGE_LABEL, KINDS, SHAPE_LABEL, hasMembers, kindInfo } from "../types";
import { member, updateEdges, updateNodes } from "../services/model";

interface Props {
  diagram: Diagram;
  selection: string[];
  onChange: (d: Diagram, key?: string) => void;
  onAutoLayout: () => void;
  onCode: () => void;
}

const field = "h-7 rounded-md bg-[#f4f7fb] hover:bg-[#eef3f9] px-2 text-[12px] outline-none focus:ring-1 focus:ring-[#2f80ed] focus:bg-white min-w-0";

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="flex items-center gap-2">
    <span className="text-[11px] text-[#5b6b7b] w-[70px] shrink-0">{label}</span>
    <div className="flex-1 flex items-center gap-1.5 min-w-0">{children}</div>
  </label>
);

const Section: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode; dataId?: string }> = ({ title, children, action, dataId }) => (
  <section className="px-3 py-3 border-b border-[#eef1f5]" data-section={dataId}>
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#5b6b7b]">{title}</h3>
      {action}
    </div>
    <div className="flex flex-col gap-2">{children}</div>
  </section>
);

const Text: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string; dataField?: string; className?: string; multiline?: boolean }> = ({ value, onChange, placeholder, dataField, className = "", multiline }) =>
  multiline ? (
    <textarea data-field={dataField} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.stopPropagation()} rows={4} className={`${field} h-auto py-1.5 resize-y w-full ${className}`} />
  ) : (
    <input data-field={dataField} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.stopPropagation()} className={`${field} flex-1 ${className}`} />
  );

const Num: React.FC<{ value: number; onChange: (v: number) => void; label: string }> = ({ value, onChange, label }) => (
  <label className={`${field} flex items-center gap-1 flex-1`}>
    <span className="text-[10.5px] text-[#9aa8b6]">{label}</span>
    <input
      type="number"
      value={Math.round(value)}
      onChange={(e) => Number.isFinite(e.target.valueAsNumber) && onChange(e.target.valueAsNumber)}
      onKeyDown={(e) => e.stopPropagation()}
      className="w-full bg-transparent outline-none"
    />
  </label>
);

const Color: React.FC<{ value: string; onChange: (v: string) => void; title: string }> = ({ value, onChange, title }) => (
  <label title={title} className="relative w-7 h-7 rounded-md border border-[#d5dde8] cursor-pointer overflow-hidden shrink-0" style={{ background: value === "transparent" ? "repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 0/8px 8px" : value }}>
    <input type="color" value={value.startsWith("#") && value.length === 7 ? value : "#ffffff"} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
  </label>
);

export const Properties: React.FC<Props> = ({ diagram: d, selection, onChange, onAutoLayout, onCode }) => {
  const nodes = selection.map((id) => d.nodes[id]).filter(Boolean);
  const edges = selection.map((id) => d.edges[id]).filter(Boolean);
  const node = nodes.length === 1 && !edges.length ? nodes[0] : null;
  const edge = edges.length === 1 && !nodes.length ? edges[0] : null;
  const setNode = (patch: Partial<DNode>, key = "") => node && onChange(updateNodes(d, { [node.id]: patch }), key);
  const setEdge = (patch: Partial<DEdge>, key = "") => edge && onChange(updateEdges(d, { [edge.id]: patch }), key);

  const align = (how: string) => {
    if (nodes.length < 2) return;
    const x0 = Math.min(...nodes.map((n) => n.x));
    const x1 = Math.max(...nodes.map((n) => n.x + n.w));
    const y0 = Math.min(...nodes.map((n) => n.y));
    const y1 = Math.max(...nodes.map((n) => n.y + n.h));
    const patches: Record<string, Partial<DNode>> = {};
    if (how === "hdist" || how === "vdist") {
      const h = how === "hdist";
      const sorted = [...nodes].sort((a, b) => (h ? a.x - b.x : a.y - b.y));
      const total = sorted.reduce((s, n) => s + (h ? n.w : n.h), 0);
      const gap = ((h ? x1 - x0 : y1 - y0) - total) / (sorted.length - 1);
      let cur = h ? x0 : y0;
      for (const n of sorted) {
        patches[n.id] = h ? { x: Math.round(cur) } : { y: Math.round(cur) };
        cur += (h ? n.w : n.h) + gap;
      }
    } else
      for (const n of nodes)
        patches[n.id] =
          how === "left" ? { x: x0 } : how === "hcenter" ? { x: Math.round((x0 + x1) / 2 - n.w / 2) } : how === "right" ? { x: x1 - n.w } : how === "top" ? { y: y0 } : how === "vcenter" ? { y: Math.round((y0 + y1) / 2 - n.h / 2) } : { y: y1 - n.h };
    onChange(updateNodes(d, patches));
  };

  // -------------------------------------------------------------------------
  // Miembros (atributos, operaciones, columnas)
  // -------------------------------------------------------------------------

  const membersEditor = (n: DNode, key: "attributes" | "operations") => {
    const list = n[key];
    const isEntity = n.type === "entity";
    const isOp = key === "operations";
    const title = isEntity ? "Columnas" : n.type === "state" ? "Actividades internas" : n.type === "object" ? "Valores" : isOp ? "Operaciones" : "Atributos";
    const update = (i: number, patch: Partial<Member>) => {
      const next = [...list];
      next[i] = { ...next[i], ...patch };
      setNode({ [key]: next } as Partial<DNode>, `${key}-${i}`);
    };
    const move = (i: number, dir: -1 | 1) => {
      const next = [...list];
      const j = i + dir;
      if (j < 0 || j >= next.length) return;
      [next[i], next[j]] = [next[j], next[i]];
      setNode({ [key]: next } as Partial<DNode>);
    };
    const add = () => {
      const m = isEntity
        ? member({ name: `columna${list.length + 1}`, type: "VARCHAR(100)" })
        : n.type === "state"
          ? member({ name: list.length ? "do / actividad" : "entry / acción" })
          : n.type === "object"
            ? member({ name: "atributo", value: "valor" })
            : isOp
              ? member({ name: `operacion${list.length + 1}`, type: "void", isAbstract: n.type === "interface" })
              : member({ visibility: "-", name: `atributo${list.length + 1}`, type: "String" });
      setNode({ [key]: [...list, m] } as Partial<DNode>);
    };
    return (
      <Section
        title={title}
        dataId={`members-${key}`}
        action={
          <button type="button" data-btn={`add-${key}`} title="Añadir" onClick={add} className="w-6 h-6 rounded hover:bg-[#eef3f9] flex items-center justify-center text-[#1e3a5f]">
            <Plus size={14} />
          </button>
        }
      >
        {list.map((m, i) => (
          <div key={m.id} className="flex flex-col gap-1 p-1.5 rounded-md bg-[#fafbfd] border border-[#eef1f5]" data-member={i}>
            <div className="flex items-center gap-1">
              {!isEntity && n.type !== "state" && n.type !== "object" && (
                <select value={m.visibility} onChange={(e) => update(i, { visibility: e.target.value as Visibility })} onKeyDown={(e) => e.stopPropagation()} className={`${field} w-12 px-1 font-mono text-center`} title="Visibilidad">
                  {(["+", "-", "#", "~"] as Visibility[]).map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              )}
              <Text value={m.name} onChange={(v) => update(i, { name: v })} placeholder="nombre" dataField={`${key}-name-${i}`} />
              {n.type !== "state" && n.type !== "object" && <Text value={m.type} onChange={(v) => update(i, { type: v })} placeholder={isOp ? "retorno" : "tipo"} className="w-[74px] flex-none font-mono" dataField={`${key}-type-${i}`} />}
              {n.type === "object" && <Text value={m.value} onChange={(v) => update(i, { value: v })} placeholder="valor" className="w-[80px] flex-none" />}
            </div>
            {isOp && <Text value={m.params} onChange={(v) => update(i, { params: v })} placeholder="parámetros (id: int, nombre: String)" className="font-mono" />}
            <div className="flex items-center gap-2 text-[11px] text-[#5b6b7b]">
              {isEntity ? (
                <>
                  <label className="flex items-center gap-1" title="Clave principal">
                    <input type="checkbox" checked={m.pk} onChange={(e) => update(i, { pk: e.target.checked, nullable: e.target.checked ? false : m.nullable })} /> <Key size={11} /> PK
                  </label>
                  <label className="flex items-center gap-1" title="Clave foránea">
                    <input type="checkbox" checked={m.fk} onChange={(e) => update(i, { fk: e.target.checked })} /> <Link size={11} /> FK
                  </label>
                  <label className="flex items-center gap-1" title="Obligatorio (NOT NULL)">
                    <input type="checkbox" checked={!m.nullable} onChange={(e) => update(i, { nullable: !e.target.checked })} /> NN
                  </label>
                  <label className="flex items-center gap-1" title="Único">
                    <input type="checkbox" checked={m.unique} onChange={(e) => update(i, { unique: e.target.checked })} /> UQ
                  </label>
                </>
              ) : n.type !== "state" && n.type !== "object" ? (
                <>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={m.isStatic} onChange={(e) => update(i, { isStatic: e.target.checked })} /> Estático
                  </label>
                  {isOp && (
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={m.isAbstract} onChange={(e) => update(i, { isAbstract: e.target.checked })} /> Abstracto
                    </label>
                  )}
                  {!isOp && <Text value={m.value} onChange={(v) => update(i, { value: v })} placeholder="valor inicial" className="h-6" />}
                </>
              ) : null}
              <span className="flex-1" />
              <button type="button" title="Subir" onClick={() => move(i, -1)} className="hover:text-[#1e3a5f]">
                <ArrowUp size={12} />
              </button>
              <button type="button" title="Bajar" onClick={() => move(i, 1)} className="hover:text-[#1e3a5f]">
                <ArrowDown size={12} />
              </button>
              <button type="button" title="Quitar" onClick={() => setNode({ [key]: list.filter((_, j) => j !== i) } as Partial<DNode>)} className="hover:text-red-600">
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
        {!list.length && <p className="text-[11px] text-[#9aa8b6]">Sin elementos. Pulsa + para añadir{isEntity ? " una columna" : ""}.</p>}
      </Section>
    );
  };

  // -------------------------------------------------------------------------

  let body: React.ReactNode;
  if (node) {
    const n = node;
    body = (
      <>
        <Section title={SHAPE_LABEL[n.type] || "Figura"} dataId="node">
          {n.type !== "note" && n.type !== "fragment" && n.type !== "initial" && n.type !== "final" && n.type !== "flowFinal" && n.type !== "fork" && n.type !== "activation" && (
            <Row label="Nombre">
              <Text value={n.name} onChange={(v) => setNode({ name: v }, "name")} dataField="name" />
            </Row>
          )}
          {["class", "interface", "enum", "component", "node", "device", "artifact", "usecase", "actor", "state", "package"].includes(n.type) && (
            <Row label="Estereotipo">
              <Text value={n.stereotype} onChange={(v) => setNode({ stereotype: v }, "stereo")} placeholder="p. ej. entity, service" />
            </Row>
          )}
          {n.type === "class" && (
            <label className="flex items-center gap-2 text-[12px]">
              <input type="checkbox" checked={n.isAbstract} onChange={(e) => setNode({ isAbstract: e.target.checked })} /> Clase abstracta
            </label>
          )}
          {n.type === "erAttribute" && (
            <label className="flex items-center gap-2 text-[12px]">
              <input type="checkbox" checked={n.isAbstract} onChange={(e) => setNode({ isAbstract: e.target.checked })} /> Atributo clave (subrayado)
            </label>
          )}
          {n.type === "fragment" && (
            <>
              <Row label="Operador">
                <select value={n.operator || "alt"} onChange={(e) => setNode({ operator: e.target.value })} onKeyDown={(e) => e.stopPropagation()} className={`${field} flex-1`}>
                  {["alt", "opt", "loop", "par", "break", "critical", "ref", "neg", "seq", "strict"].map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </Row>
              <Row label="Condición">
                <Text value={n.text} onChange={(v) => setNode({ text: v }, "guard")} placeholder="[condición]" />
              </Row>
            </>
          )}
          {n.type === "note" && <Text value={n.text} onChange={(v) => setNode({ text: v }, "text")} multiline dataField="note-text" />}
          {n.type === "swimlane" && (
            <label className="flex items-center gap-2 text-[12px]">
              <input type="checkbox" checked={!!n.horizontal} onChange={(e) => setNode({ horizontal: e.target.checked, w: n.h, h: n.w })} /> Carril horizontal
            </label>
          )}
          {n.type === "fork" && (
            <button type="button" onClick={() => setNode({ w: n.h, h: n.w, autoSize: false })} className="h-7 px-2 rounded-md bg-[#f4f7fb] hover:bg-[#eef3f9] text-[12px] flex items-center gap-1.5 self-start">
              <ArrowLeftRight size={13} /> Girar barra
            </button>
          )}
        </Section>
        {n.type === "enum" && (
          <Section
            title="Valores"
            action={
              <button type="button" onClick={() => setNode({ literals: [...n.literals, `VALOR_${n.literals.length + 1}`] })} className="w-6 h-6 rounded hover:bg-[#eef3f9] flex items-center justify-center text-[#1e3a5f]">
                <Plus size={14} />
              </button>
            }
          >
            {n.literals.map((l, i) => (
              <div key={i} className="flex items-center gap-1">
                <Text value={l} onChange={(v) => setNode({ literals: n.literals.map((x, j) => (j === i ? v : x)) }, `lit-${i}`)} className="font-mono" />
                <button type="button" onClick={() => setNode({ literals: n.literals.filter((_, j) => j !== i) })} className="text-[#7b8b9b] hover:text-red-600">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </Section>
        )}
        {hasMembers(n.type) && membersEditor(n, "attributes")}
        {(n.type === "class" || n.type === "interface") && membersEditor(n, "operations")}
        <Section title="Apariencia">
          <div className="flex items-center gap-2">
            <Color value={n.fill} onChange={(v) => setNode({ fill: v }, "fill")} title="Relleno" />
            <Color value={n.stroke} onChange={(v) => setNode({ stroke: v }, "stroke")} title="Borde" />
            <Color value={n.textColor} onChange={(v) => setNode({ textColor: v }, "color")} title="Texto" />
            <span className="text-[11px] text-[#7b8b9b]">Relleno · borde · texto</span>
          </div>
          <div className="flex gap-1.5">
            <Num label="X" value={n.x} onChange={(v) => setNode({ x: v }, "x")} />
            <Num label="Y" value={n.y} onChange={(v) => setNode({ y: v }, "y")} />
          </div>
          <div className="flex gap-1.5">
            <Num label="An" value={n.w} onChange={(v) => setNode({ w: Math.max(4, v), autoSize: false }, "w")} />
            <Num label="Al" value={n.h} onChange={(v) => setNode({ h: Math.max(4, v), autoSize: false }, "h")} />
          </div>
          {["class", "interface", "enum", "object", "entity", "state", "usecase", "action"].includes(n.type) && (
            <label className="flex items-center gap-2 text-[12px]">
              <input type="checkbox" checked={n.autoSize} onChange={(e) => setNode({ autoSize: e.target.checked })} /> Ajustar el tamaño al contenido
            </label>
          )}
        </Section>
      </>
    );
  } else if (edge) {
    const e = edge;
    const info = kindInfo(d.kind);
    const kinds = [...new Set([...info.edges.map((x) => x.kind), e.kind])];
    const isMsg = e.y !== undefined;
    body = (
      <Section title="Conexión" dataId="edge">
        <Row label="Tipo">
          <select data-field="edge-kind" value={e.kind} onChange={(ev) => setEdge({ kind: ev.target.value as DEdge["kind"] })} onKeyDown={(ev) => ev.stopPropagation()} className={`${field} flex-1`}>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {EDGE_LABEL[k] || k}
              </option>
            ))}
          </select>
        </Row>
        <Row label={isMsg ? "Mensaje" : "Etiqueta"}>
          <Text value={e.label} onChange={(v) => setEdge({ label: v }, "label")} dataField="edge-label" placeholder={isMsg ? "operacion(parametros)" : ""} />
        </Row>
        {e.kind === "erRelation" ? (
          <>
            <Row label={`Lado de «${d.nodes[e.source]?.name || "origen"}»`}>
              <select data-field="source-card" value={e.sourceCard} onChange={(ev) => setEdge({ sourceCard: ev.target.value as Cardinality })} onKeyDown={(ev) => ev.stopPropagation()} className={`${field} flex-1`}>
                {CARDINALITIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Row>
            <Row label={`Lado de «${d.nodes[e.target]?.name || "destino"}»`}>
              <select data-field="target-card" value={e.targetCard} onChange={(ev) => setEdge({ targetCard: ev.target.value as Cardinality })} onKeyDown={(ev) => ev.stopPropagation()} className={`${field} flex-1`}>
                {CARDINALITIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Row>
          </>
        ) : (
          !isMsg && (
            <>
              <Row label="Origen">
                <Text value={e.sourceLabel} onChange={(v) => setEdge({ sourceLabel: v }, "sl")} placeholder="multiplicidad o rol (1, 0..*)" dataField="source-label" />
              </Row>
              <Row label="Destino">
                <Text value={e.targetLabel} onChange={(v) => setEdge({ targetLabel: v }, "tl")} placeholder="multiplicidad o rol" dataField="target-label" />
              </Row>
            </>
          )
        )}
        {!isMsg && (
          <Row label="Trazado">
            <select value={e.routing} onChange={(ev) => setEdge({ routing: ev.target.value as DEdge["routing"] })} onKeyDown={(ev) => ev.stopPropagation()} className={`${field} flex-1`}>
              <option value="straight">Recto</option>
              <option value="orthogonal">Ortogonal (en ángulo recto)</option>
            </select>
          </Row>
        )}
        <div className="flex items-center gap-2">
          <Color value={e.color} onChange={(v) => setEdge({ color: v }, "ecolor")} title="Color" />
          <button type="button" data-btn="swap" onClick={() => setEdge({ source: e.target, target: e.source, sourceLabel: e.targetLabel, targetLabel: e.sourceLabel, sourceCard: e.targetCard, targetCard: e.sourceCard })} className="h-7 px-2 rounded-md bg-[#f4f7fb] hover:bg-[#eef3f9] text-[12px] flex items-center gap-1.5">
            <ArrowLeftRight size={13} /> Invertir sentido
          </button>
        </div>
        <p className="text-[11px] text-[#7b8b9b] leading-snug">
          {d.nodes[e.source]?.name || "Origen"} → {d.nodes[e.target]?.name || "destino"}
          {isMsg ? " · arrastra el mensaje para cambiar su orden" : ""}
        </p>
      </Section>
    );
  } else if (nodes.length > 1) {
    body = (
      <Section title={`${nodes.length} figuras seleccionadas`}>
        <div className="grid grid-cols-4 gap-1">
          {(
            [
              ["left", AlignLeft, "Alinear a la izquierda"],
              ["hcenter", AlignCenterHorizontal, "Centrar horizontalmente"],
              ["right", AlignRight, "Alinear a la derecha"],
              ["hdist", AlignHorizontalSpaceAround, "Repartir horizontalmente"],
              ["top", AlignStartVertical, "Alinear arriba"],
              ["vcenter", AlignCenterVertical, "Centrar verticalmente"],
              ["bottom", AlignEndVertical, "Alinear abajo"],
              ["vdist", AlignVerticalSpaceAround, "Repartir verticalmente"],
            ] as const
          ).map(([id, Icon, title]) => (
            <button key={id} type="button" data-align={id} title={title} onClick={() => align(id)} className="h-8 rounded-md bg-[#f4f7fb] hover:bg-[#e7eef7] flex items-center justify-center text-[#1e3a5f]">
              <Icon size={15} className={id === "top" || id === "vcenter" || id === "bottom" ? "rotate-90" : ""} />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            const w = Math.max(...nodes.map((n) => n.w));
            const h = Math.max(...nodes.map((n) => n.h));
            onChange(updateNodes(d, Object.fromEntries(nodes.map((n) => [n.id, { w, h, autoSize: false }]))));
          }}
          className="h-7 rounded-md bg-[#f4f7fb] hover:bg-[#eef3f9] text-[12px]"
        >
          Igualar tamaños
        </button>
      </Section>
    );
  } else {
    const counts = { figuras: Object.keys(d.nodes).length, conexiones: Object.keys(d.edges).length };
    body = (
      <>
        <Section title="Diagrama" dataId="diagram">
          <Row label="Nombre">
            <Text value={d.name} onChange={(v) => onChange({ ...d, name: v }, "dname")} dataField="diagram-name" />
          </Row>
          <Row label="Tipo">
            <select value={d.kind} onChange={(e) => onChange({ ...d, kind: e.target.value as Diagram["kind"] })} onKeyDown={(e) => e.stopPropagation()} className={`${field} flex-1`}>
              {KINDS.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.label}
                </option>
              ))}
            </select>
          </Row>
          <p className="text-[11.5px] text-[#5b6b7b] leading-snug">{kindInfo(d.kind).description}</p>
          <p className="text-[11px] text-[#9aa8b6]">
            {counts.figuras} figuras · {counts.conexiones} conexiones
          </p>
        </Section>
        <Section title="Herramientas">
          <button type="button" data-btn="autolayout" onClick={onAutoLayout} className="h-8 rounded-md bg-[#f4f7fb] hover:bg-[#e7eef7] text-[12px] flex items-center gap-2 px-2.5">
            <LayoutGrid size={14} /> Organizar automáticamente
          </button>
          <button type="button" data-btn="code" onClick={onCode} className="h-8 rounded-md bg-[#1e3a5f] hover:bg-[#15304f] text-white text-[12px] font-semibold flex items-center gap-2 px-2.5">
            <Code2 size={14} /> Generar código…
          </button>
        </Section>
        <Section title="Cómo se usa">
          <ul className="text-[11.5px] text-[#5b6b7b] leading-relaxed list-disc pl-4">
            <li>Elige una figura en la paleta y haz clic en el lienzo.</li>
            <li>Arrastra el círculo azul de una figura hasta otra para conectarlas; si lo sueltas en vacío se crea una figura nueva.</li>
            <li>Doble clic sobre un nombre, atributo u operación para editarlo (por ejemplo «- precio: double»).</li>
            <li>Rueda: desplazar · Ctrl + rueda: zoom · Espacio + arrastrar: mover la vista.</li>
          </ul>
        </Section>
      </>
    );
  }

  return (
    <aside className="w-[290px] shrink-0 bg-white border-l border-[#e1e6ed] overflow-y-auto" data-properties>
      {body}
    </aside>
  );
};
