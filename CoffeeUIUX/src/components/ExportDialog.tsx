// Diálogo de exportación: PNG, JPG, SVG, PDF y HTML/CSS.

import React, { useState } from "react";
import { X, Download, Loader2 } from "lucide-react";

export type ExportFormat = "png" | "jpeg" | "svg" | "pdf" | "html";

export interface ExportRequest {
  scope: "selection" | "frames";
  format: ExportFormat;
  scale: number;
}

const FORMATS: { id: ExportFormat; label: string; hint: string }[] = [
  { id: "png", label: "PNG", hint: "Imagen con transparencia" },
  { id: "jpeg", label: "JPG", hint: "Imagen con fondo blanco" },
  { id: "svg", label: "SVG", hint: "Vectorial, editable en otras herramientas" },
  { id: "pdf", label: "PDF", hint: "Una página por marco" },
  { id: "html", label: "HTML + CSS", hint: "Código de la pantalla (un marco)" },
];

export const ExportDialog: React.FC<{ hasSelection: boolean; frameCount: number; onClose: () => void; onExport: (r: ExportRequest) => Promise<void> }> = ({ hasSelection, frameCount, onClose, onExport }) => {
  const [scope, setScope] = useState<ExportRequest["scope"]>(hasSelection ? "selection" : "frames");
  const [format, setFormat] = useState<ExportFormat>("png");
  const [scale, setScale] = useState(2);
  const [busy, setBusy] = useState(false);

  return (
    <div data-modal-open className="fixed inset-0 z-[95000] bg-black/40 flex items-center justify-center" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="w-[440px] bg-white rounded-xl shadow-2xl overflow-hidden" data-export-dialog>
        <div className="flex items-center justify-between px-5 h-12 border-b border-[#ececec]">
          <h2 className="text-[14px] font-semibold">Exportar</h2>
          <button type="button" onClick={onClose} className="w-7 h-7 rounded hover:bg-[#f0f0f0] flex items-center justify-center">
            <X size={15} />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-4 text-[12.5px]">
          <div>
            <div className="font-semibold mb-2">Qué exportar</div>
            <div className="flex gap-2">
              <label className={`flex-1 flex items-center gap-2 p-2.5 rounded-lg border ${scope === "selection" ? "border-[#0d99ff] bg-[#f0f8ff]" : "border-[#e6e6e6]"} ${hasSelection ? "" : "opacity-50"}`}>
                <input type="radio" disabled={!hasSelection} checked={scope === "selection"} onChange={() => setScope("selection")} /> La selección
              </label>
              <label className={`flex-1 flex items-center gap-2 p-2.5 rounded-lg border ${scope === "frames" ? "border-[#0d99ff] bg-[#f0f8ff]" : "border-[#e6e6e6]"}`}>
                <input type="radio" checked={scope === "frames"} onChange={() => setScope("frames")} /> Todos los marcos ({frameCount})
              </label>
            </div>
          </div>
          <div>
            <div className="font-semibold mb-2">Formato</div>
            <div className="grid grid-cols-2 gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  data-format={f.id}
                  onClick={() => setFormat(f.id)}
                  className={`text-left p-2.5 rounded-lg border ${format === f.id ? "border-[#0d99ff] bg-[#f0f8ff]" : "border-[#e6e6e6] hover:border-[#bdbdbd]"}`}
                >
                  <div className="font-semibold">{f.label}</div>
                  <div className="text-[11px] text-[#8a8a8a]">{f.hint}</div>
                </button>
              ))}
            </div>
          </div>
          {(format === "png" || format === "jpeg") && (
            <div>
              <div className="font-semibold mb-2">Escala</div>
              <div className="flex gap-1.5">
                {[0.5, 1, 2, 3, 4].map((s) => (
                  <button key={s} type="button" onClick={() => setScale(s)} className={`px-3 h-8 rounded-md border text-[12px] font-semibold ${scale === s ? "border-[#0d99ff] bg-[#f0f8ff] text-[#0d99ff]" : "border-[#e6e6e6]"}`}>
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-[#ececec]">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg text-[12.5px] hover:bg-[#f0f0f0]">
            Cancelar
          </button>
          <button
            type="button"
            data-btn="do-export"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onExport({ scope, format, scale });
                onClose();
              } finally {
                setBusy(false);
              }
            }}
            className="h-9 px-4 rounded-lg bg-[#0d99ff] hover:bg-[#0a85e0] text-white text-[12.5px] font-semibold flex items-center gap-2 disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Exportar
          </button>
        </div>
      </div>
    </div>
  );
};
