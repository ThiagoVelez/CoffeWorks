// Diálogos propios: nuevo diagrama y generación de código.

import React, { useMemo, useState } from "react";
import { X, Copy, Download } from "lucide-react";
import type { Diagram, DiagramKind } from "../types";
import { KINDS } from "../types";
import { LANGUAGES, generate, type CodeLanguage } from "../services/codegen";
import { KindIcon } from "./icons";

const Shell: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; width?: number; footer?: React.ReactNode }> = ({ title, onClose, children, width = 720, footer }) => (
  <div data-modal-open className="fixed inset-0 z-[95000] bg-black/40 flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className="bg-white rounded-xl shadow-2xl overflow-hidden max-h-full flex flex-col" style={{ width }}>
      <div className="flex items-center justify-between px-5 h-12 border-b border-[#eef1f5] shrink-0">
        <h2 className="text-[14px] font-semibold text-[#1b2733]">{title}</h2>
        <button type="button" onClick={onClose} className="w-7 h-7 rounded hover:bg-[#f0f3f7] flex items-center justify-center">
          <X size={15} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
      {footer && <div className="flex justify-end gap-2 px-5 py-3 border-t border-[#eef1f5] shrink-0">{footer}</div>}
    </div>
  </div>
);

export const NewDiagramDialog: React.FC<{ title?: string; onClose: () => void; onPick: (kind: DiagramKind) => void }> = ({ title = "Nuevo diagrama", onClose, onPick }) => {
  const groups = ["UML estructural", "UML de comportamiento", "Datos", "Otros"] as const;
  return (
    <Shell title={title} onClose={onClose} width={760}>
      <div className="p-5 flex flex-col gap-4" data-new-diagram>
        {groups.map((g) => (
          <div key={g}>
            <div className="text-[11px] font-bold uppercase tracking-wide text-[#5b6b7b] mb-2">{g}</div>
            <div className="grid grid-cols-3 gap-2">
              {KINDS.filter((k) => k.group === g).map((k) => (
                <button
                  key={k.kind}
                  type="button"
                  data-kind={k.kind}
                  onClick={() => onPick(k.kind)}
                  className="text-left p-3 rounded-lg border border-[#e1e6ed] hover:border-[#2f80ed] hover:bg-[#f5f9ff] flex gap-2.5"
                >
                  <span className="w-9 h-9 rounded-lg bg-[#e3f1ec] flex items-center justify-center shrink-0">
                    <KindIcon kind={k.kind} size={22} />
                  </span>
                  <span>
                    <span className="block text-[12.5px] font-semibold text-[#1b2733]">{k.label}</span>
                    <span className="block text-[11px] text-[#7b8b9b] leading-snug mt-0.5">{k.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
};

export const CodeDialog: React.FC<{ diagram: Diagram; onClose: () => void; onSave: (text: string, name: string, ext: string, label: string) => void; onCopy: (text: string) => void }> = ({ diagram, onClose, onSave, onCopy }) => {
  const available = LANGUAGES.filter((l) => l.kinds.includes(diagram.kind));
  const options = available.length ? available : LANGUAGES.filter((l) => l.id === "mermaid" || l.id === "plantuml");
  const [lang, setLang] = useState<CodeLanguage>(options[0].id);
  const code = useMemo(() => {
    try {
      return generate(diagram, lang);
    } catch (err) {
      return `// No se pudo generar el código: ${err instanceof Error ? err.message : String(err)}`;
    }
  }, [diagram, lang]);
  const info = LANGUAGES.find((l) => l.id === lang)!;
  return (
    <Shell
      title={`Generar código · ${diagram.name}`}
      onClose={onClose}
      width={820}
      footer={
        <>
          <button type="button" onClick={() => onCopy(code)} className="h-9 px-4 rounded-lg text-[12.5px] bg-[#f4f7fb] hover:bg-[#e3f1ec] flex items-center gap-2">
            <Copy size={14} /> Copiar
          </button>
          <button type="button" data-btn="save-code" onClick={() => onSave(code, diagram.name, info.ext, info.label)} className="h-9 px-4 rounded-lg text-[12.5px] bg-[#2e6b58] hover:bg-[#24574a] text-white font-semibold flex items-center gap-2">
            <Download size={14} /> Guardar archivo .{info.ext}
          </button>
        </>
      }
    >
      <div className="p-4 flex flex-col gap-3" data-code-dialog>
        <div className="flex gap-1.5 flex-wrap">
          {options.map((l) => (
            <button
              key={l.id}
              type="button"
              data-lang={l.id}
              onClick={() => setLang(l.id)}
              className={`h-8 px-3 rounded-full text-[12px] font-semibold border ${lang === l.id ? "bg-[#2e6b58] text-white border-[#2e6b58]" : "border-[#d5dde8] hover:border-[#2e6b58]"}`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <pre data-code className="h-[52vh] overflow-auto rounded-lg bg-[#0f1b2a] text-[#d6e2f0] text-[12px] leading-relaxed p-4 font-mono select-text whitespace-pre">
          {code}
        </pre>
        {lang === "sql" && <p className="text-[11.5px] text-[#5b6b7b]">El script crea las tablas con sus claves; las relaciones «uno a muchos» añaden la clave foránea en el lado «muchos». Puedes ejecutarlo en CoffeeDataBase (Datos externos › Importar SQL).</p>}
        {(lang === "mermaid" || lang === "plantuml") && <p className="text-[11.5px] text-[#5b6b7b]">Texto compatible con {info.label}, para documentación (por ejemplo, en archivos Markdown de GitHub).</p>}
      </div>
    </Shell>
  );
};
