// Panel derecho: Diseño (propiedades), Prototipo (enlaces) y Código (CSS).

import React from "react";
import {
  AlignLeft,
  AlignCenterHorizontal,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  Plus,
  Minus,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowDown,
  Grid2x2,
  Play,
  Copy,
  Diamond,
  Unlink,
  Image as ImageIcon,
  AlignJustify,
  Type,
  ArrowLeftRight,
} from "lucide-react";
import {
  DEVICES,
  FONTS,
  TRANSITIONS,
  WEIGHTS,
  type AutoLayout,
  type Page,
  type Paint,
  type SizeMode,
  type UNode,
  type UxDocument,
} from "../types";
import { DEFAULT_LAYOUT, absoluteBox, findComponent, parentMap, solid, stroke, topFrames, unionBox, updateNodes } from "../services/model";
import { cssText, nodeCss } from "../services/exporters";
import { ColorField, IconToggle, NumberField, Section, SelectField, SmallButton } from "./ui";

export type RightTab = "design" | "prototype" | "code";

interface Props {
  doc: UxDocument;
  page: Page;
  selection: string[];
  tab: RightTab;
  onTab: (tab: RightTab) => void;
  onPage: (page: Page, key?: string) => void;
  onDoc: (doc: UxDocument, key?: string) => void;
  onSelect: (ids: string[]) => void;
  onAction: (action: "component" | "instance" | "detach" | "goto-component" | "image" | "present" | "export" | "copy-html" | "copy-css" | "export-html") => void;
}

/** Valor común a todos los nodos o "" si difieren. */
function common<T>(nodes: UNode[], get: (n: UNode) => T): T | "" {
  if (!nodes.length) return "";
  const first = get(nodes[0]);
  return nodes.every((n) => JSON.stringify(get(n)) === JSON.stringify(first)) ? first : "";
}

const ALIGN_JUSTIFY = [
  { value: "start", label: "Inicio" },
  { value: "center", label: "Centro" },
  { value: "end", label: "Final" },
  { value: "space-between", label: "Repartir" },
];

export const RightPanel: React.FC<Props> = ({ doc, page, selection, tab, onTab, onPage, onDoc, onSelect, onAction }) => {
  const nodes = selection.map((id) => page.nodes[id]).filter(Boolean);
  const single = nodes.length === 1 ? nodes[0] : null;
  const parents = parentMap(page);
  const parentId = single ? parents.get(single.id) ?? null : null;
  const parent = parentId ? page.nodes[parentId] : null;
  const inLayout = !!parent?.layout && parent.layout.mode !== "none";

  const patchAll = (patch: Partial<UNode> | ((n: UNode) => Partial<UNode>), key = "") => {
    const patches: Record<string, Partial<UNode>> = {};
    for (const n of nodes) patches[n.id] = typeof patch === "function" ? patch(n) : patch;
    onPage(updateNodes(page, patches), key);
  };

  const tabs = (
    <div className="flex items-center gap-1 px-2 h-10 border-b border-[#e6e6e6] shrink-0">
      {(
        [
          ["design", "Diseño"],
          ["prototype", "Prototipo"],
          ["code", "Código"],
        ] as [RightTab, string][]
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          data-right-tab={id}
          onClick={() => onTab(id)}
          className={`px-2.5 h-7 rounded-md text-[12px] font-semibold ${tab === id ? "bg-[#f0f0f0] text-[#1e1e1e]" : "text-[#8a8a8a] hover:text-[#1e1e1e]"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  // -------------------------------------------------------------------------
  // Alinear y repartir
  // -------------------------------------------------------------------------

  const align = (how: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom" | "hdist" | "vdist") => {
    if (!nodes.length) return;
    const boxes = nodes.map((n) => ({ n, b: absoluteBox(page, n.id, parents) }));
    let ref = unionBox(boxes.map((x) => x.b))!;
    if (nodes.length === 1) {
      if (!parentId) return;
      ref = absoluteBox(page, parentId, parents);
    }
    const patches: Record<string, Partial<UNode>> = {};
    if (how === "hdist" || how === "vdist") {
      const horiz = how === "hdist";
      const sorted = [...boxes].sort((a, b) => (horiz ? a.b.x - b.b.x : a.b.y - b.b.y));
      const total = sorted.reduce((s, x) => s + (horiz ? x.b.w : x.b.h), 0);
      const space = ((horiz ? ref.w : ref.h) - total) / Math.max(1, sorted.length - 1);
      let cursor = horiz ? ref.x : ref.y;
      for (const { n, b } of sorted) {
        if (horiz) patches[n.id] = { x: Math.round(n.x + cursor - b.x) };
        else patches[n.id] = { y: Math.round(n.y + cursor - b.y) };
        cursor += (horiz ? b.w : b.h) + space;
      }
    } else
      for (const { n, b } of boxes) {
        if (how === "left") patches[n.id] = { x: Math.round(n.x + ref.x - b.x) };
        if (how === "hcenter") patches[n.id] = { x: Math.round(n.x + ref.x + (ref.w - b.w) / 2 - b.x) };
        if (how === "right") patches[n.id] = { x: Math.round(n.x + ref.x + ref.w - b.w - b.x) };
        if (how === "top") patches[n.id] = { y: Math.round(n.y + ref.y - b.y) };
        if (how === "vcenter") patches[n.id] = { y: Math.round(n.y + ref.y + (ref.h - b.h) / 2 - b.y) };
        if (how === "bottom") patches[n.id] = { y: Math.round(n.y + ref.y + ref.h - b.h - b.y) };
      }
    onPage(updateNodes(page, patches));
  };

  // -------------------------------------------------------------------------
  // Pestaña Diseño
  // -------------------------------------------------------------------------

  const paintEditor = (paint: Paint, onPaint: (p: Paint | null) => void, label: string) => (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <SelectField
          value={paint.type}
          onChange={(v) => onPaint({ ...paint, type: v as Paint["type"] })}
          options={[
            { value: "solid", label: "Sólido" },
            { value: "linear", label: "Lineal" },
            { value: "radial", label: "Radial" },
          ]}
          className="w-[74px]"
          dataField={`${label}-type`}
        />
        <ColorField value={paint.color} onChange={(c) => onPaint({ ...paint, color: c })} opacity={paint.opacity} onOpacity={(o) => onPaint({ ...paint, opacity: o })} dataField={`${label}-color`} />
        <IconToggle title="Quitar" onClick={() => onPaint(null)}>
          <Minus size={14} />
        </IconToggle>
      </div>
      {paint.type !== "solid" && (
        <div className="flex items-center gap-1.5 pl-[80px]">
          <ColorField value={paint.color2} onChange={(c) => onPaint({ ...paint, color2: c })} />
          {paint.type === "linear" && <NumberField value={paint.angle} suffix="°" onChange={(v) => onPaint({ ...paint, angle: v })} className="w-[62px] shrink-0" />}
        </div>
      )}
    </div>
  );

  const sizingSelect = (axis: "w" | "h") => {
    if (!single) return null;
    const isLayoutFrame = !!single.layout && single.layout.mode !== "none";
    const canHug = isLayoutFrame || single.type === "text";
    const options: { value: SizeMode; label: string }[] = [{ value: "fixed", label: "Fijo" }];
    if (canHug) options.push({ value: "hug", label: "Ajustar" });
    if (inLayout) options.push({ value: "fill", label: "Rellenar" });
    if (options.length < 2) return null;
    const value = single.type === "text" ? (axis === "w" ? (single.font!.autoSize === "width" ? "hug" : single.sizing.w === "fill" ? "fill" : "fixed") : single.font!.autoSize === "fixed" ? "fixed" : "hug") : single.sizing[axis];
    return (
      <SelectField
        dataField={`sizing-${axis}`}
        title={axis === "w" ? "Ancho" : "Alto"}
        value={value}
        options={options}
        onChange={(v) => {
          const mode = v as SizeMode;
          if (single.type === "text") {
            const font = { ...single.font! };
            if (axis === "w") font.autoSize = mode === "hug" ? "width" : "height";
            else font.autoSize = mode === "hug" ? (font.autoSize === "fixed" ? "height" : font.autoSize) : "fixed";
            patchAll({ font, sizing: { ...single.sizing, [axis]: mode === "fill" ? "fill" : "fixed" } });
          } else patchAll({ sizing: { ...single.sizing, [axis]: mode } });
        }}
        className="flex-1"
      />
    );
  };

  const layoutEditor = (n: UNode) => {
    const L: AutoLayout = n.layout || { ...DEFAULT_LAYOUT, mode: "none" };
    const setL = (patch: Partial<AutoLayout>) => patchAll({ layout: { ...L, ...patch } });
    const active = L.mode !== "none";
    return (
      <Section
        title="Diseño automático"
        dataId="autolayout"
        action={
          <IconToggle title={active ? "Quitar diseño automático" : "Añadir diseño automático (Mayús+A)"} onClick={() => setL({ mode: active ? "none" : "column" })} dataId="toggle-autolayout">
            {active ? <Minus size={14} /> : <Plus size={14} />}
          </IconToggle>
        }
      >
        {active && (
          <>
            <div className="flex items-center gap-1">
              <IconToggle active={L.mode === "column"} title="Vertical" onClick={() => setL({ mode: "column" })} dataId="layout-column">
                <ArrowDown size={14} />
              </IconToggle>
              <IconToggle active={L.mode === "row"} title="Horizontal" onClick={() => setL({ mode: "row" })} dataId="layout-row">
                <ArrowRight size={14} />
              </IconToggle>
              <NumberField label="↔" title="Espacio entre elementos" value={L.gap} min={0} onChange={(v) => setL({ gap: v })} className="flex-1" dataField="gap" />
            </div>
            <div className="grid grid-cols-4 gap-1">
              {(["top", "right", "bottom", "left"] as const).map((side) => (
                <NumberField key={side} title={`Relleno ${side === "top" ? "superior" : side === "right" ? "derecho" : side === "bottom" ? "inferior" : "izquierdo"}`} value={L.padding[side]} min={0} onChange={(v) => setL({ padding: { ...L.padding, [side]: v } })} />
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <SelectField value={L.justify} onChange={(v) => setL({ justify: v as AutoLayout["justify"] })} options={ALIGN_JUSTIFY} className="flex-1" title="Distribución en el eje principal" />
              <SelectField value={L.align} onChange={(v) => setL({ align: v as AutoLayout["align"] })} options={ALIGN_JUSTIFY.slice(0, 3)} className="flex-1" title="Alineación en el eje cruzado" />
            </div>
          </>
        )}
      </Section>
    );
  };

  const design = () => {
    if (!nodes.length) {
      return (
        <>
          <Section title="Página">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#8a8a8a] w-14">Fondo</span>
              <ColorField value={page.background} onChange={(c) => onPage({ ...page, background: c })} dataField="page-bg" />
            </div>
          </Section>
          <Section title="Plataforma del proyecto">
            <SelectField
              value={doc.platform}
              onChange={(v) => onDoc({ ...doc, platform: v as UxDocument["platform"] })}
              options={[
                { value: "mobile", label: "Aplicación móvil" },
                { value: "desktop", label: "Aplicación de escritorio" },
                { value: "web", label: "Página web" },
              ]}
            />
            <p className="text-[11px] text-[#8a8a8a] leading-snug">La biblioteca de Recursos muestra primero los elementos de esta plataforma.</p>
          </Section>
          <Section title="Estilos de color">
            <div className="flex flex-wrap gap-1.5">
              {doc.colorStyles.map((c) => (
                <div key={c.id} className="flex items-center gap-1.5 pl-1 pr-2 h-7 rounded-md bg-[#f5f5f5] text-[11px]" title={c.color}>
                  <label className="relative w-4 h-4 rounded-sm border border-black/10 overflow-hidden" style={{ background: c.color }}>
                    <input type="color" value={c.color} onChange={(e) => onDoc({ ...doc, colorStyles: doc.colorStyles.map((s) => (s.id === c.id ? { ...s, color: e.target.value } : s)) })} className="absolute inset-0 opacity-0" />
                  </label>
                  {c.name}
                </div>
              ))}
            </div>
          </Section>
          <Section title="Exportar">
            <SmallButton onClick={() => onAction("export")} dataId="export-all">
              Exportar marcos…
            </SmallButton>
          </Section>
        </>
      );
    }
    const box = unionBox(nodes.map((n) => absoluteBox(page, n.id, parents)))!;
    const f = single?.font;
    const fill = common(nodes, (n) => n.fill);
    const strokeVal = common(nodes, (n) => n.stroke);
    const shadow = common(nodes, (n) => n.shadow);
    return (
      <>
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-[#e6e6e6]">
          <IconToggle title="Alinear a la izquierda" onClick={() => align("left")} dataId="align-left">
            <AlignLeft size={15} />
          </IconToggle>
          <IconToggle title="Centrar horizontalmente" onClick={() => align("hcenter")} dataId="align-hcenter">
            <AlignCenterHorizontal size={15} />
          </IconToggle>
          <IconToggle title="Alinear a la derecha" onClick={() => align("right")}>
            <AlignRight size={15} />
          </IconToggle>
          <IconToggle title="Alinear arriba" onClick={() => align("top")}>
            <AlignStartVertical size={15} className="rotate-90" />
          </IconToggle>
          <IconToggle title="Centrar verticalmente" onClick={() => align("vcenter")}>
            <AlignCenterVertical size={15} className="rotate-90" />
          </IconToggle>
          <IconToggle title="Alinear abajo" onClick={() => align("bottom")}>
            <AlignEndVertical size={15} className="rotate-90" />
          </IconToggle>
          <IconToggle title="Repartir horizontalmente" onClick={() => align("hdist")}>
            <AlignHorizontalSpaceAround size={15} />
          </IconToggle>
          <IconToggle title="Repartir verticalmente" onClick={() => align("vdist")}>
            <AlignVerticalSpaceAround size={15} />
          </IconToggle>
        </div>

        {single && (single.type === "frame" || single.type === "component") && !parentId && (
          <Section title={single.type === "component" ? "Componente" : "Marco"}>
            <SelectField
              dataField="device"
              value={single.device || ""}
              onChange={(v) => {
                const d = DEVICES.find((x) => x.id === v);
                if (d) patchAll({ w: d.w, h: d.h, device: d.id, sizing: { w: "fixed", h: "fixed" } });
              }}
              options={[{ value: "", label: "Tamaño personalizado" }, ...DEVICES.map((d) => ({ value: d.id, label: `${d.group} · ${d.name} (${d.w}×${d.h})` }))]}
            />
            <div className="flex items-center gap-2">
              <SmallButton onClick={() => patchAll({ w: single.h, h: single.w })} title="Cambiar orientación">
                <ArrowLeftRight size={13} /> Girar
              </SmallButton>
              <label className="flex items-center gap-1.5 text-[11.5px]">
                <input type="checkbox" checked={!!single.clip} onChange={(e) => patchAll({ clip: e.target.checked })} />
                Recortar contenido
              </label>
            </div>
          </Section>
        )}

        <Section title="Posición y tamaño" dataId="geometry">
          <div className="grid grid-cols-2 gap-1.5">
            <NumberField label="X" dataField="x" value={nodes.length === 1 ? single!.x : Math.round(box.x)} onChange={(v) => (single ? patchAll({ x: v }) : patchAll((n) => ({ x: n.x + v - box.x })))} />
            <NumberField label="Y" dataField="y" value={nodes.length === 1 ? single!.y : Math.round(box.y)} onChange={(v) => (single ? patchAll({ y: v }) : patchAll((n) => ({ y: n.y + v - box.y })))} />
            <NumberField label="W" dataField="w" value={single ? single.w : common(nodes, (n) => n.w)} min={single?.type === "line" ? undefined : 1} onChange={(v) => patchAll((n) => ({ w: v, sizing: { ...n.sizing, w: n.sizing.w === "hug" ? "fixed" : n.sizing.w }, ...(n.type === "text" && n.font!.autoSize === "width" ? { font: { ...n.font!, autoSize: "height" as const } } : {}) }))} />
            <NumberField label="H" dataField="h" value={single ? single.h : common(nodes, (n) => n.h)} min={single?.type === "line" ? undefined : 1} onChange={(v) => patchAll((n) => ({ h: v, sizing: { ...n.sizing, h: n.sizing.h === "hug" ? "fixed" : n.sizing.h }, ...(n.type === "text" ? { font: { ...n.font!, autoSize: "fixed" as const } } : {}) }))} />
            <NumberField label="∠" title="Rotación" suffix="°" value={common(nodes, (n) => n.rotation)} onChange={(v) => patchAll({ rotation: v })} />
            <NumberField label="◜" title="Radio de las esquinas" value={common(nodes, (n) => n.radius)} min={0} onChange={(v) => patchAll({ radius: v })} dataField="radius" />
          </div>
          {single && (sizingSelect("w") || sizingSelect("h")) && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10.5px] text-[#8a8a8a] w-10">Tamaño</span>
              {sizingSelect("w")}
              {sizingSelect("h")}
            </div>
          )}
        </Section>

        {single && (single.type === "frame" || single.type === "component") && layoutEditor(single)}

        {single?.type === "instance" && (
          <Section title="Instancia" dataId="instance">
            {(() => {
              const found = single.componentId ? findComponent(doc, single.componentId) : null;
              if (!found) return <p className="text-[11px] text-red-600">El componente original ya no existe.</p>;
              const texts = collectTexts(found.page, found.node.children || []);
              return (
                <>
                  <div className="flex items-center gap-1.5 text-[11.5px]">
                    <Diamond size={13} className="text-[#9747ff]" /> {found.node.name}
                  </div>
                  {texts.map((t) => (
                    <label key={t.id} className="flex flex-col gap-1 text-[10.5px] text-[#8a8a8a]">
                      {t.name}
                      <input
                        data-override={t.id}
                        value={single.overrides?.[t.id]?.text ?? t.text ?? ""}
                        onChange={(e) => patchAll({ overrides: { ...(single.overrides || {}), [t.id]: { ...(single.overrides?.[t.id] || {}), text: e.target.value } } }, `ov-${t.id}`)}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="h-7 rounded-md bg-[#f5f5f5] px-2 text-[11.5px] text-[#1e1e1e] outline-none focus:ring-1 focus:ring-[#0d99ff]"
                      />
                    </label>
                  ))}
                  <div className="flex gap-1.5 flex-wrap">
                    <SmallButton onClick={() => onAction("goto-component")}>Ir al componente</SmallButton>
                    <SmallButton onClick={() => patchAll({ overrides: {} })}>Restablecer</SmallButton>
                    <SmallButton onClick={() => onAction("detach")} dataId="detach">
                      <Unlink size={13} /> Separar
                    </SmallButton>
                  </div>
                </>
              );
            })()}
          </Section>
        )}

        {single?.type === "component" && (
          <Section title="Componente">
            <SmallButton onClick={() => onAction("instance")} dataId="create-instance">
              <Copy size={13} /> Crear instancia
            </SmallButton>
            <p className="text-[11px] text-[#8a8a8a] leading-snug">Los cambios en el componente se aplican a todas sus instancias.</p>
          </Section>
        )}

        <Section title="Capa">
          <div className="flex items-center gap-1.5">
            <NumberField label="◐" title="Opacidad" value={Math.round((common(nodes, (n) => n.opacity) || 0) * 100) || (common(nodes, (n) => n.opacity) === "" ? "" : 0)} min={0} max={100} suffix="%" onChange={(v) => patchAll({ opacity: v / 100 })} className="flex-1" dataField="opacity" />
            <IconToggle title="Mostrar u ocultar" onClick={() => patchAll((n) => ({ visible: !n.visible }))}>
              {nodes.every((n) => n.visible) ? <Eye size={14} /> : <EyeOff size={14} />}
            </IconToggle>
          </div>
        </Section>

        {single?.type === "text" && f && (
          <Section title="Texto" dataId="text">
            <SelectField dataField="font-family" value={f.family} onChange={(v) => patchAll({ font: { ...f, family: v } })} options={FONTS.map((x) => ({ value: x, label: x }))} />
            <div className="grid grid-cols-2 gap-1.5">
              <SelectField value={String(f.weight)} onChange={(v) => patchAll({ font: { ...f, weight: Number(v) } })} options={WEIGHTS.map((w) => ({ value: String(w.value), label: w.label }))} />
              <NumberField dataField="font-size" value={f.size} min={1} onChange={(v) => patchAll({ font: { ...f, size: v } })} suffix="px" />
              <NumberField label="↕" title="Interlineado" value={f.lineHeight} step={0.1} min={0.5} onChange={(v) => patchAll({ font: { ...f, lineHeight: v } })} />
              <NumberField label="A" title="Espaciado entre letras" value={f.letterSpacing} step={0.1} onChange={(v) => patchAll({ font: { ...f, letterSpacing: v } })} suffix="px" />
            </div>
            <div className="flex items-center gap-0.5 flex-wrap">
              {(["left", "center", "right"] as const).map((a) => (
                <IconToggle key={a} active={f.align === a} title={a === "left" ? "Izquierda" : a === "center" ? "Centro" : "Derecha"} onClick={() => patchAll({ font: { ...f, align: a } })}>
                  {a === "left" ? <AlignLeft size={14} /> : a === "center" ? <AlignCenterHorizontal size={14} /> : <AlignRight size={14} />}
                </IconToggle>
              ))}
              <span className="w-2" />
              {(["top", "middle", "bottom"] as const).map((a) => (
                <IconToggle key={a} active={f.valign === a} title={a === "top" ? "Arriba" : a === "middle" ? "En medio" : "Abajo"} onClick={() => patchAll({ font: { ...f, valign: a } })}>
                  {a === "top" ? <AlignStartVertical size={14} className="rotate-90" /> : a === "middle" ? <AlignCenterVertical size={14} className="rotate-90" /> : <AlignEndVertical size={14} className="rotate-90" />}
                </IconToggle>
              ))}
            </div>
            <div className="flex items-center gap-0.5">
              <IconToggle active={f.italic} title="Cursiva" onClick={() => patchAll({ font: { ...f, italic: !f.italic } })}>
                <i className="font-serif text-[13px]">I</i>
              </IconToggle>
              <IconToggle active={f.underline} title="Subrayado" onClick={() => patchAll({ font: { ...f, underline: !f.underline } })}>
                <u className="text-[13px]">U</u>
              </IconToggle>
              <IconToggle active={f.strike} title="Tachado" onClick={() => patchAll({ font: { ...f, strike: !f.strike } })}>
                <s className="text-[13px]">S</s>
              </IconToggle>
              <SelectField
                value={f.transform}
                onChange={(v) => patchAll({ font: { ...f, transform: v as typeof f.transform } })}
                options={[
                  { value: "none", label: "Aa" },
                  { value: "uppercase", label: "AA" },
                  { value: "lowercase", label: "aa" },
                ]}
                className="w-14"
              />
              <SelectField
                value={f.autoSize}
                onChange={(v) => patchAll({ font: { ...f, autoSize: v as typeof f.autoSize } })}
                options={[
                  { value: "width", label: "Ancho automático" },
                  { value: "height", label: "Alto automático" },
                  { value: "fixed", label: "Tamaño fijo" },
                ]}
                className="flex-1"
                title="Tamaño del cuadro de texto"
              />
            </div>
          </Section>
        )}

        {single && (single.type === "polygon" || single.type === "star") && (
          <Section title={single.type === "star" ? "Estrella" : "Polígono"}>
            <div className="grid grid-cols-2 gap-1.5">
              <NumberField label="#" title="Lados o puntas" value={single.sides || 3} min={3} max={60} onChange={(v) => patchAll({ sides: Math.round(v) })} />
              {single.type === "star" && <NumberField label="◎" title="Radio interior" value={Math.round((single.innerRatio || 0.45) * 100)} min={5} max={100} suffix="%" onChange={(v) => patchAll({ innerRatio: v / 100 })} />}
            </div>
          </Section>
        )}

        {single?.type === "line" && (
          <Section title="Línea">
            <div className="flex gap-3 text-[11.5px]">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={!!single.arrowStart} onChange={(e) => patchAll({ arrowStart: e.target.checked })} /> Flecha al inicio
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={!!single.arrowEnd} onChange={(e) => patchAll({ arrowEnd: e.target.checked })} /> Flecha al final
              </label>
            </div>
          </Section>
        )}

        {single?.type === "path" && (
          <Section title="Trazado">
            <label className="flex items-center gap-1.5 text-[11.5px]">
              <input type="checkbox" checked={!!single.closed} onChange={(e) => patchAll({ closed: e.target.checked, fill: e.target.checked ? single.fill || solid("#d9d9d9") : single.fill })} /> Cerrar la forma
            </label>
          </Section>
        )}

        {single?.type === "image" && (
          <Section title="Imagen">
            <div className="flex items-center gap-1.5">
              <SmallButton onClick={() => onAction("image")} dataId="replace-image">
                <ImageIcon size={13} /> {single.src ? "Reemplazar" : "Elegir imagen"}
              </SmallButton>
              <SelectField
                value={single.fit || "cover"}
                onChange={(v) => patchAll({ fit: v as UNode["fit"] })}
                options={[
                  { value: "cover", label: "Rellenar" },
                  { value: "contain", label: "Ajustar" },
                  { value: "fill", label: "Estirar" },
                ]}
                className="flex-1"
              />
            </div>
          </Section>
        )}

        {nodes.every((n) => n.type !== "line" && n.type !== "group" && n.type !== "image") && (
          <Section
            title={single?.type === "text" ? "Color del texto" : "Relleno"}
            dataId="fill"
            action={
              !fill && (
                <IconToggle title="Añadir relleno" onClick={() => patchAll({ fill: solid(single?.type === "text" ? "#1e1e1e" : "#d9d9d9") })} dataId="add-fill">
                  <Plus size={14} />
                </IconToggle>
              )
            }
          >
            {fill ? paintEditor(fill, (p) => patchAll({ fill: p }, "fill"), "fill") : common(nodes, (n) => n.fill) === "" && nodes.length > 1 ? <span className="text-[11px] text-[#8a8a8a]">Varios rellenos</span> : null}
            {doc.colorStyles.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {doc.colorStyles.map((c) => (
                  <button key={c.id} type="button" title={`Estilo «${c.name}»`} onClick={() => patchAll((n) => ({ fill: { ...(n.fill || solid(c.color)), type: "solid", color: c.color } }))} className="w-5 h-5 rounded border border-black/10" style={{ background: c.color }} />
                ))}
              </div>
            )}
          </Section>
        )}

        {nodes.every((n) => n.type !== "group") && (
          <Section
            title="Borde"
            dataId="stroke"
            action={
              !strokeVal && (
                <IconToggle title="Añadir borde" onClick={() => patchAll({ stroke: stroke("#1e1e1e", 1) })} dataId="add-stroke">
                  <Plus size={14} />
                </IconToggle>
              )
            }
          >
            {strokeVal && (
              <div className="flex items-center gap-1.5">
                <ColorField value={strokeVal.color} onChange={(c) => patchAll({ stroke: { ...strokeVal, color: c } })} opacity={strokeVal.opacity} onOpacity={(o) => patchAll({ stroke: { ...strokeVal, opacity: o } })} />
                <NumberField value={strokeVal.width} min={0} onChange={(v) => patchAll({ stroke: { ...strokeVal, width: v } })} className="w-[52px] shrink-0" dataField="stroke-width" />
                <IconToggle active={strokeVal.dash} title="Discontinuo" onClick={() => patchAll({ stroke: { ...strokeVal, dash: !strokeVal.dash } })}>
                  <AlignJustify size={14} />
                </IconToggle>
                {nodes.every((n) => n.type !== "line" && n.type !== "path") && (
                  <IconToggle title="Quitar borde" onClick={() => patchAll({ stroke: null })}>
                    <Minus size={14} />
                  </IconToggle>
                )}
              </div>
            )}
          </Section>
        )}

        <Section
          title="Efectos"
          dataId="effects"
          action={
            !shadow && (
              <IconToggle title="Añadir sombra" onClick={() => patchAll({ shadow: { x: 0, y: 4, blur: 12, color: "#000000", opacity: 0.18, inner: false } })} dataId="add-shadow">
                <Plus size={14} />
              </IconToggle>
            )
          }
        >
          {shadow && (
            <>
              <div className="flex items-center gap-1.5">
                <SelectField
                  value={shadow.inner ? "inner" : "drop"}
                  onChange={(v) => patchAll({ shadow: { ...shadow, inner: v === "inner" } })}
                  options={[
                    { value: "drop", label: "Sombra exterior" },
                    { value: "inner", label: "Sombra interior" },
                  ]}
                  className="flex-1"
                />
                <IconToggle title="Quitar sombra" onClick={() => patchAll({ shadow: null })}>
                  <Minus size={14} />
                </IconToggle>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <NumberField label="X" value={shadow.x} onChange={(v) => patchAll({ shadow: { ...shadow, x: v } })} />
                <NumberField label="Y" value={shadow.y} onChange={(v) => patchAll({ shadow: { ...shadow, y: v } })} />
                <NumberField label="◌" title="Desenfoque" value={shadow.blur} min={0} onChange={(v) => patchAll({ shadow: { ...shadow, blur: v } })} />
              </div>
              <ColorField value={shadow.color} onChange={(c) => patchAll({ shadow: { ...shadow, color: c } })} opacity={shadow.opacity} onOpacity={(o) => patchAll({ shadow: { ...shadow, opacity: o } })} />
            </>
          )}
          <NumberField label="◍" title="Desenfoque de la capa" value={common(nodes, (n) => n.blur)} min={0} suffix="px" onChange={(v) => patchAll({ blur: v })} />
        </Section>

        {single && single.type !== "component" && single.type !== "instance" && (
          <Section title="Reutilizar">
            <SmallButton onClick={() => onAction("component")} dataId="make-component">
              <Diamond size={13} className="text-[#9747ff]" /> Crear componente
            </SmallButton>
          </Section>
        )}
      </>
    );
  };

  // -------------------------------------------------------------------------
  // Pestaña Prototipo
  // -------------------------------------------------------------------------

  const prototype = () => {
    const frames = topFrames(page);
    return (
      <>
        <Section title="Inicio del prototipo">
          <SelectField
            dataField="start-frame"
            value={page.startFrame || ""}
            onChange={(v) => onPage({ ...page, startFrame: v || undefined })}
            options={[{ value: "", label: "Primer marco" }, ...frames.map((f) => ({ value: f.id, label: f.name }))]}
          />
          <SmallButton primary onClick={() => onAction("present")} dataId="present">
            <Play size={13} /> Presentar
          </SmallButton>
        </Section>
        {single ? (
          <Section title="Al hacer clic" dataId="interaction">
            <SelectField
              dataField="link-target"
              value={single.link?.target || ""}
              onChange={(v) => patchAll({ link: v ? { target: v, transition: single.link?.transition || "dissolve", duration: single.link?.duration || 300 } : null })}
              options={[{ value: "", label: "Sin acción" }, { value: "back", label: "← Volver atrás" }, ...frames.filter((f) => f.id !== single.id).map((f) => ({ value: f.id, label: `Ir a «${f.name}»` }))]}
            />
            {single.link && (
              <div className="flex items-center gap-1.5">
                <SelectField value={single.link.transition} onChange={(v) => patchAll({ link: { ...single.link!, transition: v as typeof single.link.transition } })} options={TRANSITIONS.map((t) => ({ value: t.id, label: t.label }))} className="flex-1" />
                <NumberField value={single.link.duration} min={0} max={3000} suffix="ms" onChange={(v) => patchAll({ link: { ...single.link!, duration: v } })} className="w-[76px]" />
              </div>
            )}
          </Section>
        ) : (
          <Section title="Interacciones">
            <p className="text-[11px] text-[#8a8a8a] leading-snug">Selecciona un botón o cualquier capa y elige a qué pantalla lleva al hacer clic. Las flechas moradas del lienzo muestran el recorrido.</p>
          </Section>
        )}
      </>
    );
  };

  // -------------------------------------------------------------------------
  // Pestaña Código
  // -------------------------------------------------------------------------

  const code = () => {
    if (!single) return <p className="p-3 text-[11.5px] text-[#8a8a8a]">Selecciona una capa para ver su CSS. Selecciona un marco para exportarlo como página HTML.</p>;
    const css = nodeCss(single, inLayout, !parentId);
    const isFrame = (single.type === "frame" || single.type === "component") && !parentId;
    return (
      <>
        <Section title={`CSS · ${single.name}`} dataId="css">
          <pre data-css className="text-[11px] leading-relaxed font-mono bg-[#1e1e1e] text-[#d4d4d4] rounded-md p-2.5 overflow-x-auto select-text whitespace-pre">
            {`.${single.name.toLowerCase().replace(/[^a-z0-9]+/gi, "-") || "capa"} {\n${cssText(css)}\n}`}
          </pre>
          <SmallButton onClick={() => onAction("copy-css")}>
            <Copy size={13} /> Copiar CSS
          </SmallButton>
        </Section>
        {single.type === "text" && (
          <Section title="Contenido">
            <pre className="text-[11px] font-mono bg-[#f5f5f5] rounded-md p-2 whitespace-pre-wrap select-text">{single.text}</pre>
          </Section>
        )}
        {isFrame && (
          <Section title="Página HTML">
            <p className="text-[11px] text-[#8a8a8a] leading-snug">Genera el HTML y el CSS del marco. El diseño automático se convierte en Flexbox.</p>
            <div className="flex gap-1.5 flex-wrap">
              <SmallButton primary onClick={() => onAction("export-html")} dataId="export-html">
                <Grid2x2 size={13} /> Exportar HTML + CSS
              </SmallButton>
              <SmallButton onClick={() => onAction("copy-html")}>
                <Type size={13} /> Copiar HTML
              </SmallButton>
            </div>
          </Section>
        )}
      </>
    );
  };

  return (
    <aside className="w-[264px] shrink-0 bg-white border-l border-[#e6e6e6] flex flex-col min-h-0" data-right-panel>
      {tabs}
      <div className="flex-1 overflow-y-auto" onPointerDown={() => onSelect(selection)}>
        {tab === "design" && design()}
        {tab === "prototype" && prototype()}
        {tab === "code" && code()}
      </div>
    </aside>
  );
};

function collectTexts(page: Page, ids: string[]): UNode[] {
  const out: UNode[] = [];
  const walk = (id: string) => {
    const n = page.nodes[id];
    if (!n) return;
    if (n.type === "text") out.push(n);
    n.children?.forEach(walk);
  };
  ids.forEach(walk);
  return out;
}
