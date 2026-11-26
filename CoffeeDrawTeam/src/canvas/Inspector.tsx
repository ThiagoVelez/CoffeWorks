// Panel con las propiedades de lo seleccionado.

import { ArrowUpToLine, Trash2 } from "lucide-react";
import type * as Y from "yjs";
import { actualizar, alFrente, borrar, NOTA_COLORES, type Elemento, type NotaColor } from "../board/model";
import { COLORES_TRAZO } from "./BarraHerramientas";

const RELLENOS = ["#ffffff", "#fff3a3", "#ffd6a8", "#ffc9de", "#c8f2c2", "#c4e2ff", "#e0d2ff", "#efe6dd"];

function Fila({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8d6e63]">{titulo}</span>
      <div className="flex flex-wrap gap-1.5 items-center">{children}</div>
    </div>
  );
}

const muestra = (activo: boolean) => `w-6 h-6 rounded-md border ${activo ? "ring-2 ring-[#f08c2e] border-transparent" : "border-[#e8dfd8]"}`;

export function Inspector({ doc, seleccion, elementos, origen, alBorrar }: { doc: Y.Doc; seleccion: string[]; elementos: Elemento[]; origen: string; alBorrar: () => void }) {
  const sel = elementos.filter((e) => seleccion.includes(e.id));
  if (!sel.length) return null;
  const todos = (cambio: Partial<Elemento>, filtro: (e: Elemento) => boolean) =>
    doc.transact(() => sel.filter(filtro).forEach((e) => actualizar(doc, e.id, cambio, origen)), origen);
  const uno = sel.length === 1 ? sel[0] : undefined;
  const hay = (k: Elemento["kind"]) => sel.some((e) => e.kind === k);

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-start gap-4 px-4 py-3 rounded-2xl bg-white border border-[#e8dfd8] shadow-md text-[#2c1b12]" data-inspector>
      {hay("nota") && (
        <Fila titulo="Nota">
          {(Object.keys(NOTA_COLORES) as NotaColor[]).map((c) => (
            <button key={c} type="button" aria-label={`Nota ${c}`} className={muestra(uno?.kind === "nota" && uno.color === c)} style={{ background: NOTA_COLORES[c] }} onClick={() => todos({ color: c } as Partial<Elemento>, (e) => e.kind === "nota")} />
          ))}
        </Fila>
      )}
      {hay("forma") && (
        <Fila titulo="Relleno">
          {RELLENOS.map((c) => (
            <button key={c} type="button" aria-label={`Relleno ${c}`} className={muestra(uno?.kind === "forma" && uno.relleno === c)} style={{ background: c }} onClick={() => todos({ relleno: c } as Partial<Elemento>, (e) => e.kind === "forma")} />
          ))}
        </Fila>
      )}
      {(hay("texto") || hay("trazo") || hay("conector") || hay("forma")) && (
        <Fila titulo="Color">
          {COLORES_TRAZO.map((c) => (
            <button key={c} type="button" aria-label={`Color ${c}`} className={`w-6 h-6 rounded-full ${uno && "color" in uno && uno.color === c ? "ring-2 ring-offset-1 ring-[#f08c2e]" : ""}`} style={{ background: c }}
              onClick={() => doc.transact(() => sel.forEach((e) => {
                if (e.kind === "forma") actualizar(doc, e.id, { borde: c } as Partial<Elemento>, origen);
                else if (e.kind === "texto" || e.kind === "trazo" || e.kind === "conector") actualizar(doc, e.id, { color: c } as Partial<Elemento>, origen);
              }), origen)} />
          ))}
        </Fila>
      )}
      {uno?.kind === "texto" && (
        <Fila titulo="Texto">
          {[16, 24, 36, 56].map((t) => (
            <button key={t} type="button" className={`px-2 h-7 rounded-lg text-xs ${uno.tam === t ? "bg-[#f3ece4] font-bold" : "hover:bg-[#f3ece4]"}`} onClick={() => actualizar(doc, uno.id, { tam: t, h: t * 1.8 } as Partial<Elemento>, origen)}>{t}</button>
          ))}
          <button type="button" aria-pressed={uno.negrita} className={`w-7 h-7 rounded-lg font-bold ${uno.negrita ? "bg-[#f3ece4]" : "hover:bg-[#f3ece4]"}`} onClick={() => actualizar(doc, uno.id, { negrita: !uno.negrita } as Partial<Elemento>, origen)}>N</button>
        </Fila>
      )}
      {uno?.kind === "conector" && (
        <Fila titulo="Conector">
          <button type="button" className={`px-2 h-7 rounded-lg text-xs ${uno.estilo === "recto" ? "bg-[#f3ece4] font-bold" : ""}`} onClick={() => actualizar(doc, uno.id, { estilo: "recto" } as Partial<Elemento>, origen)}>Recto</button>
          <button type="button" className={`px-2 h-7 rounded-lg text-xs ${uno.estilo === "codo" ? "bg-[#f3ece4] font-bold" : ""}`} onClick={() => actualizar(doc, uno.id, { estilo: "codo" } as Partial<Elemento>, origen)}>En codo</button>
          <button type="button" className={`px-2 h-7 rounded-lg text-xs ${uno.flecha ? "bg-[#f3ece4] font-bold" : ""}`} onClick={() => actualizar(doc, uno.id, { flecha: !uno.flecha } as Partial<Elemento>, origen)}>Flecha</button>
        </Fila>
      )}
      <Fila titulo="Orden">
        <button type="button" title="Traer al frente" aria-label="Traer al frente" className="w-8 h-8 rounded-lg hover:bg-[#f3ece4] flex items-center justify-center" onClick={() => alFrente(doc, seleccion, origen)}><ArrowUpToLine size={16} /></button>
        <button type="button" title="Borrar (Supr)" aria-label="Borrar" className="w-8 h-8 rounded-lg hover:bg-[#fde8e8] text-[#c62828] flex items-center justify-center" onClick={() => { borrar(doc, seleccion, origen); alBorrar(); }}><Trash2 size={16} /></button>
      </Fila>
    </div>
  );
}
