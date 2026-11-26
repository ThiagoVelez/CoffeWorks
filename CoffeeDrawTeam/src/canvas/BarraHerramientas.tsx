// Barra de herramientas del tablero (izquierda) con las opciones de la herramienta activa.

import { Circle, Diamond, Eraser, Hand, Highlighter, Image as ImageIcon, MousePointer2, MoveRight, Pencil, Spline, Square, StickyNote, Type } from "lucide-react";
import { NOTA_COLORES, type NotaColor } from "../board/model";
import type { FormaTipo, Herramienta, OpcionesDibujo } from "./Lienzo";

const HERRAMIENTAS: { id: Herramienta; nombre: string; tecla: string; Icono: React.FC<{ size?: number }> }[] = [
  { id: "seleccionar", nombre: "Seleccionar", tecla: "V", Icono: MousePointer2 },
  { id: "mano", nombre: "Mano", tecla: "H", Icono: Hand },
  { id: "nota", nombre: "Nota adhesiva", tecla: "N", Icono: StickyNote },
  { id: "texto", nombre: "Texto", tecla: "T", Icono: Type },
  { id: "forma", nombre: "Forma", tecla: "R", Icono: Square },
  { id: "conector", nombre: "Conector", tecla: "C", Icono: Spline },
  { id: "lapiz", nombre: "Lápiz", tecla: "P", Icono: Pencil },
  { id: "marcador", nombre: "Marcador", tecla: "M", Icono: Highlighter },
  { id: "borrador", nombre: "Borrador de trazos", tecla: "E", Icono: Eraser },
];

export const COLORES_TRAZO = ["#2c1b12", "#e5484d", "#e5702a", "#4c9a2a", "#2f80ed", "#8e4ec6", "#f0c419"];
const FORMAS: { id: FormaTipo; nombre: string; Icono: React.FC<{ size?: number }> }[] = [
  { id: "rect", nombre: "Rectángulo", Icono: Square },
  { id: "elipse", nombre: "Elipse", Icono: Circle },
  { id: "rombo", nombre: "Rombo", Icono: Diamond },
  { id: "flecha", nombre: "Flecha", Icono: MoveRight },
];

const boton = (activo: boolean) =>
  `w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${activo ? "bg-[#f08c2e] text-white" : "text-[#5c3a21] hover:bg-[#f3ece4]"}`;

export function BarraHerramientas({ herramienta, setHerramienta, opciones, setOpciones, alImagen, soloLectura }: {
  herramienta: Herramienta;
  setHerramienta: (h: Herramienta) => void;
  opciones: OpcionesDibujo;
  setOpciones: (o: OpcionesDibujo) => void;
  alImagen: () => void;
  soloLectura: boolean;
}) {
  const lista = soloLectura ? HERRAMIENTAS.slice(0, 2) : HERRAMIENTAS;
  return (
    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-start gap-2 z-10">
      <div className="flex flex-col gap-1 p-1.5 rounded-2xl bg-white border border-[#e8dfd8] shadow-md" role="toolbar" aria-label="Herramientas">
        {lista.map(({ id, nombre, tecla, Icono }) => (
          <button key={id} type="button" title={`${nombre} (${tecla})`} aria-label={nombre} aria-pressed={herramienta === id} className={boton(herramienta === id)} onClick={() => setHerramienta(id)}>
            <Icono size={19} />
          </button>
        ))}
        {!soloLectura && (
          <button type="button" title="Insertar imagen (o pega / arrastra una)" aria-label="Insertar imagen" className={boton(false)} onClick={alImagen}>
            <ImageIcon size={19} />
          </button>
        )}
      </div>

      {herramienta === "nota" && (
        <div className="flex flex-col gap-1.5 p-2 rounded-2xl bg-white border border-[#e8dfd8] shadow-md">
          {(Object.keys(NOTA_COLORES) as NotaColor[]).map((c) => (
            <button key={c} type="button" title={c} aria-label={`Nota ${c}`} onClick={() => setOpciones({ ...opciones, notaColor: c })}
              className={`w-7 h-7 rounded-md border ${opciones.notaColor === c ? "ring-2 ring-[#f08c2e] border-transparent" : "border-[#e8dfd8]"}`} style={{ background: NOTA_COLORES[c] }} />
          ))}
        </div>
      )}
      {herramienta === "forma" && (
        <div className="flex flex-col gap-1 p-1.5 rounded-2xl bg-white border border-[#e8dfd8] shadow-md">
          {FORMAS.map(({ id, nombre, Icono }) => (
            <button key={id} type="button" title={nombre} aria-label={nombre} className={boton(opciones.formaTipo === id)} onClick={() => setOpciones({ ...opciones, formaTipo: id })}>
              <Icono size={18} />
            </button>
          ))}
        </div>
      )}
      {(herramienta === "lapiz" || herramienta === "marcador") && (
        <div className="flex flex-col gap-1.5 p-2 rounded-2xl bg-white border border-[#e8dfd8] shadow-md items-center">
          {COLORES_TRAZO.map((c) => (
            <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => setOpciones({ ...opciones, trazoColor: c })}
              className={`w-6 h-6 rounded-full ${opciones.trazoColor === c ? "ring-2 ring-offset-2 ring-[#f08c2e]" : ""}`} style={{ background: c }} />
          ))}
          {[2, 4, 8].map((g) => (
            <button key={g} type="button" aria-label={`Grosor ${g}`} onClick={() => setOpciones({ ...opciones, grosor: g })}
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${opciones.grosor === g ? "bg-[#f3ece4]" : ""}`}>
              <span className="rounded-full bg-[#2c1b12]" style={{ width: g + 2, height: g + 2 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
