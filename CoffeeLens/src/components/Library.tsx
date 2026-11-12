// Módulo Biblioteca de CoffeeLens: catálogo, filtros, cuadrícula y datos de
// la foto (estrellas, banderas, etiquetas de color, palabras clave, EXIF).

import React, { useState } from "react";
import { Star, Flag, FlagOff, Images, FolderPlus, Trash2, Search, ImagePlus, Camera, Pencil } from "lucide-react";
import type { Catalog, Collection, Photo } from "../types";
import { LABELS } from "../types";
import { Button, Section, Select, cx } from "../studio/ui";
import { isDefault } from "../services/develop";

export type Source = { kind: "all" } | { kind: "picks" } | { kind: "recent" } | { kind: "collection"; id: string };

export interface Filters {
  text: string;
  minRating: number;
  flag: "any" | "pick" | "reject" | "unflagged";
  label: string | null;
  sort: "added" | "name" | "rating" | "date";
}

export const DEFAULT_FILTERS: Filters = { text: "", minRating: 0, flag: "any", label: null, sort: "added" };

export function visiblePhotos(cat: Catalog, source: Source, f: Filters): Photo[] {
  let list = cat.photos;
  if (source.kind === "picks") list = list.filter((p) => p.flag === "pick");
  if (source.kind === "recent") {
    const last = Math.max(0, ...list.map((p) => p.added));
    list = list.filter((p) => last - p.added < 60_000);
  }
  if (source.kind === "collection") {
    const c = cat.collections.find((x) => x.id === source.id);
    list = c ? list.filter((p) => c.photos.includes(p.id)) : [];
  }
  const t = f.text.trim().toLowerCase();
  if (t) list = list.filter((p) => p.name.toLowerCase().includes(t) || p.keywords.some((k) => k.toLowerCase().includes(t)) || p.caption.toLowerCase().includes(t) || (p.exif.camera || "").toLowerCase().includes(t));
  if (f.minRating) list = list.filter((p) => p.rating >= f.minRating);
  if (f.flag !== "any") list = list.filter((p) => (f.flag === "unflagged" ? !p.flag : p.flag === f.flag));
  if (f.label) list = list.filter((p) => p.label === f.label);
  const sorted = [...list];
  if (f.sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
  if (f.sort === "rating") sorted.sort((a, b) => b.rating - a.rating);
  if (f.sort === "date") sorted.sort((a, b) => (b.exif.date || "").localeCompare(a.exif.date || ""));
  if (f.sort === "added") sorted.sort((a, b) => b.added - a.added);
  return sorted;
}

export const Stars: React.FC<{ value: number; onChange?: (v: number) => void; size?: number }> = ({ value, onChange, size = 12 }) => (
  <span className="flex items-center gap-0.5" data-stars>
    {[1, 2, 3, 4, 5].map((n) => (
      <button key={n} type="button" disabled={!onChange} onClick={(e) => { e.stopPropagation(); onChange?.(value === n ? 0 : n); }} className="disabled:cursor-default" title={`${n} estrellas`}>
        <Star size={size} className={n <= value ? "fill-[#ffc107] text-[#ffc107]" : "text-[#5a5a62]"} />
      </button>
    ))}
  </span>
);

export const CatalogPanel: React.FC<{
  cat: Catalog;
  source: Source;
  onSource: (s: Source) => void;
  onAddCollection: () => void;
  onRenameCollection: (c: Collection) => void;
  onDeleteCollection: (c: Collection) => void;
  onDropToCollection: (id: string) => void;
  onImport: () => void;
}> = ({ cat, source, onSource, onAddCollection, onRenameCollection, onDeleteCollection, onDropToCollection, onImport }) => {
  const item = (s: Source, label: string, count: number, icon: React.ReactNode) => {
    const active = JSON.stringify(s) === JSON.stringify(source);
    return (
      <button type="button" onClick={() => onSource(s)} className={cx("flex items-center gap-2 px-2 h-7 rounded text-[12px] w-full", active ? "bg-[#d9480f]/35 text-white" : "text-[#c9c9cf] hover:bg-white/5")}>
        {icon}
        <span className="flex-1 text-left truncate">{label}</span>
        <span className="text-[10px] text-[#8b8b93]">{count}</span>
      </button>
    );
  };
  return (
    <aside className="w-[220px] shrink-0 bg-[#202023] border-r border-black/50 overflow-y-auto" data-catalog>
      <div className="p-3">
        <Button primary accent="#d9480f" onClick={onImport} className="w-full">
          <ImagePlus size={14} /> Importar fotos…
        </Button>
      </div>
      <Section title="Catálogo">
        {item({ kind: "all" }, "Todas las fotos", cat.photos.length, <Images size={13} />)}
        {item({ kind: "picks" }, "Seleccionadas", cat.photos.filter((p) => p.flag === "pick").length, <Flag size={13} />)}
        {item({ kind: "recent" }, "Última importación", cat.photos.filter((p) => Math.max(0, ...cat.photos.map((x) => x.added)) - p.added < 60_000).length, <Camera size={13} />)}
      </Section>
      <Section title="Colecciones" right={<button type="button" title="Nueva colección" onClick={onAddCollection} className="text-[#b9b9c0] hover:text-white"><FolderPlus size={14} /></button>}>
        {cat.collections.length === 0 && <span className="text-[11px] text-[#6f6f77]">Crea una colección y arrastra fotos a ella.</span>}
        {cat.collections.map((c) => (
          <div key={c.id} className="group flex items-center" onDragOver={(e) => e.preventDefault()} onDrop={() => onDropToCollection(c.id)} data-collection={c.name}>
            {item({ kind: "collection", id: c.id }, c.name, c.photos.length, <Images size={13} />)}
            <button type="button" title="Cambiar nombre" onClick={() => onRenameCollection(c)} className="opacity-0 group-hover:opacity-100 text-[#8b8b93] hover:text-white px-1">
              <Pencil size={11} />
            </button>
            <button type="button" title="Eliminar colección" onClick={() => onDeleteCollection(c)} className="opacity-0 group-hover:opacity-100 text-[#8b8b93] hover:text-white px-1">
              <Trash2 size={11} />
            </button>
          </div>
        ))}
      </Section>
    </aside>
  );
};

export const FilterBar: React.FC<{ f: Filters; onChange: (f: Filters) => void; count: number; total: number; thumb: number; onThumb: (v: number) => void }> = ({ f, onChange, count, total, thumb, onThumb }) => (
  <div className="h-10 shrink-0 bg-[#26262a] border-b border-black/50 flex items-center gap-3 px-3 text-[11px]" data-filters>
    <label className="flex items-center gap-1 bg-[#141416] border border-black/50 rounded h-6 px-1.5">
      <Search size={12} className="text-[#8b8b93]" />
      <input value={f.text} onChange={(e) => onChange({ ...f, text: e.target.value })} placeholder="Buscar nombre, palabra clave, cámara…" className="bg-transparent outline-none w-52 text-[11px]" data-search />
    </label>
    <span className="text-[#8b8b93]">Mínimo</span>
    <Stars value={f.minRating} onChange={(v) => onChange({ ...f, minRating: v })} />
    <Select value={f.flag} onChange={(v) => onChange({ ...f, flag: v as Filters["flag"] })} options={[{ value: "any", label: "Todas las banderas" }, { value: "pick", label: "Seleccionadas" }, { value: "reject", label: "Rechazadas" }, { value: "unflagged", label: "Sin bandera" }]} />
    <div className="flex items-center gap-1">
      {LABELS.map((l) => (
        <button key={l.id} type="button" title={`Etiqueta ${l.name}`} onClick={() => onChange({ ...f, label: f.label === l.id ? null : l.id })} className={cx("w-4 h-4 rounded-sm border", f.label === l.id ? "border-white" : "border-transparent")} style={{ backgroundColor: l.color }} />
      ))}
    </div>
    <Select value={f.sort} onChange={(v) => onChange({ ...f, sort: v as Filters["sort"] })} options={[{ value: "added", label: "Orden: importación" }, { value: "date", label: "Orden: fecha de captura" }, { value: "name", label: "Orden: nombre" }, { value: "rating", label: "Orden: estrellas" }]} />
    <div className="flex-1" />
    <input type="range" min={110} max={320} value={thumb} onChange={(e) => onThumb(Number(e.target.value))} className="studio-range w-24" title="Tamaño de las miniaturas" />
    <span className="text-[#8b8b93] font-mono" data-count>
      {count} de {total}
    </span>
  </div>
);

export const Grid: React.FC<{
  photos: Photo[];
  selected: string[];
  active: string | null;
  thumb: number;
  onSelect: (id: string, e: React.MouseEvent) => void;
  onOpen: (id: string) => void;
  onDragStart: (id: string) => void;
  onRating: (id: string, v: number) => void;
}> = ({ photos, selected, active, thumb, onSelect, onOpen, onDragStart, onRating }) => (
  <div className="flex-1 overflow-y-auto p-3" data-grid>
    {photos.length === 0 ? (
      <div className="h-full flex flex-col items-center justify-center text-[#8b8b93] gap-2">
        <Images size={40} />
        <span>No hay fotos aquí. Usa «Importar fotos…» o arrastra imágenes a la ventana.</span>
      </div>
    ) : (
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${thumb}px, 1fr))` }}>
        {photos.map((p) => {
          const label = LABELS.find((l) => l.id === p.label);
          return (
            <div
              key={p.id}
              draggable
              onDragStart={() => onDragStart(p.id)}
              onClick={(e) => onSelect(p.id, e)}
              onDoubleClick={() => onOpen(p.id)}
              data-photo={p.name}
              className={cx("rounded-md p-1.5 cursor-pointer flex flex-col gap-1 border", selected.includes(p.id) ? "bg-[#3a3a42] border-[#d9480f]" : "bg-[#26262b] border-transparent hover:bg-[#303036]", p.id === active && "ring-1 ring-white/60", p.flag === "reject" && "opacity-40")}
            >
              <div className="relative bg-[#141416] rounded flex items-center justify-center overflow-hidden" style={{ height: thumb * 0.72 }}>
                <img src={p.preview || p.thumb} alt="" className="max-w-full max-h-full object-contain" draggable={false} />
                {p.flag === "pick" && <Flag size={12} className="absolute top-1 left-1 fill-white text-white" />}
                {p.flag === "reject" && <FlagOff size={12} className="absolute top-1 left-1 text-[#ff8787]" />}
                {!isDefault(p.edits) && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#ffa94d]" title="Revelada" />}
              </div>
              <div className="flex items-center gap-1">
                <Stars value={p.rating} onChange={(v) => onRating(p.id, v)} size={10} />
                <span className="flex-1" />
                {label && <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: label.color }} />}
              </div>
              <span className="text-[10px] text-[#9a9aa2] truncate">{p.name}</span>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

export const InfoPanel: React.FC<{ photo: Photo | null; count: number; onPatch: (patch: Partial<Photo>) => void }> = ({ photo, count, onPatch }) => {
  const [kw, setKw] = useState("");
  if (!photo)
    return (
      <Section title="Metadatos">
        <span className="text-[11px] text-[#6f6f77]">Selecciona una foto.</span>
      </Section>
    );
  const ex = photo.exif;
  return (
    <>
      <Section title={count > 1 ? `Metadatos (${count} fotos: los cambios se aplican a todas)` : "Metadatos"}>
        <span className="text-[12px] text-white truncate" title={photo.name}>
          {photo.name}
        </span>
        <div className="flex items-center gap-2">
          <Stars value={photo.rating} onChange={(v) => onPatch({ rating: v })} size={14} />
          <button type="button" title="Seleccionar (P)" onClick={() => onPatch({ flag: photo.flag === "pick" ? null : "pick" })} className={cx("p-1 rounded", photo.flag === "pick" ? "bg-white text-black" : "text-[#b9b9c0] hover:bg-white/10")}>
            <Flag size={13} />
          </button>
          <button type="button" title="Rechazar (X)" onClick={() => onPatch({ flag: photo.flag === "reject" ? null : "reject" })} className={cx("p-1 rounded", photo.flag === "reject" ? "bg-[#ff8787] text-black" : "text-[#b9b9c0] hover:bg-white/10")}>
            <FlagOff size={13} />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          {LABELS.map((l) => (
            <button key={l.id} type="button" title={l.name} onClick={() => onPatch({ label: photo.label === l.id ? null : l.id })} className={cx("w-5 h-5 rounded border-2", photo.label === l.id ? "border-white" : "border-transparent")} style={{ backgroundColor: l.color }} />
          ))}
        </div>
        <textarea value={photo.caption} onChange={(e) => onPatch({ caption: e.target.value })} placeholder="Descripción" rows={2} className="bg-[#141416] border border-black/50 rounded p-1.5 text-[11px] outline-none resize-none" />
        <div className="flex flex-wrap gap-1">
          {photo.keywords.map((k) => (
            <button key={k} type="button" title="Quitar" onClick={() => onPatch({ keywords: photo.keywords.filter((x) => x !== k) })} className="px-1.5 h-5 rounded bg-[#34343a] text-[10px] hover:bg-[#d9480f]">
              {k} ×
            </button>
          ))}
        </div>
        <input
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && kw.trim()) {
              onPatch({ keywords: [...new Set([...photo.keywords, ...kw.split(",").map((x) => x.trim()).filter(Boolean)])] });
              setKw("");
            }
          }}
          placeholder="Añadir palabras clave (Intro)"
          className="bg-[#141416] border border-black/50 rounded h-6 px-1.5 text-[11px] outline-none"
          data-keyword
        />
      </Section>
      <Section title="Datos de la cámara">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
          <dt className="text-[#8b8b93]">Tamaño</dt>
          <dd>
            {photo.width} × {photo.height}
          </dd>
          {ex.camera && (
            <>
              <dt className="text-[#8b8b93]">Cámara</dt>
              <dd>{ex.camera}</dd>
            </>
          )}
          {ex.lens && (
            <>
              <dt className="text-[#8b8b93]">Objetivo</dt>
              <dd>{ex.lens}</dd>
            </>
          )}
          {(ex.shutter || ex.aperture || ex.iso) && (
            <>
              <dt className="text-[#8b8b93]">Exposición</dt>
              <dd>{[ex.shutter, ex.aperture, ex.iso ? `ISO ${ex.iso}` : "", ex.focal].filter(Boolean).join(" · ")}</dd>
            </>
          )}
          {ex.date && (
            <>
              <dt className="text-[#8b8b93]">Fecha</dt>
              <dd>{ex.date}</dd>
            </>
          )}
          <dt className="text-[#8b8b93]">Ubicación</dt>
          <dd className="truncate" title={photo.path || "Dentro del catálogo"}>
            {photo.path || "Dentro del catálogo"}
          </dd>
        </dl>
      </Section>
    </>
  );
};
