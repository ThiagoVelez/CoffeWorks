import React, { useEffect, useRef, useState } from "react";
import { Search, Replace, X } from "lucide-react";

interface FindPanelProps {
  isOpen: boolean;
  onClose: () => void;
  readOnly: boolean;
  /** Selecciona la siguiente celda que contiene el texto. Devuelve el número de coincidencias. */
  onFindNext: (query: string, matchCase: boolean) => number;
  /** Reemplaza en toda la hoja. Devuelve cuántas celdas cambió. */
  onReplaceAll: (query: string, replacement: string, matchCase: boolean) => number;
}

/** Panel flotante para buscar y reemplazar en la hoja activa. */
export const FindPanel: React.FC<FindPanelProps> = ({ isOpen, onClose, readOnly, onFindNext, onReplaceAll }) => {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [status, setStatus] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setStatus("");
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const findNext = () => {
    if (!query) return;
    const count = onFindNext(query, matchCase);
    setStatus(count === 0 ? "Sin resultados" : `${count} ${count === 1 ? "celda coincide" : "celdas coinciden"}`);
  };

  const replaceAll = () => {
    if (!query || readOnly) return;
    const count = onReplaceAll(query, replacement, matchCase);
    setStatus(count === 0 ? "Sin resultados" : `${count} ${count === 1 ? "celda modificada" : "celdas modificadas"}`);
  };

  const fieldClass =
    "flex items-center bg-white border border-[#c4c7c5] focus-within:border-[#0b57d0] rounded-lg px-2.5 py-1.5 gap-2";

  return (
    <div
      className="fixed top-32 right-8 z-[999950] w-80 rounded-2xl bg-white border border-[#dadce0] shadow-2xl p-4 flex flex-col gap-3 select-none print:hidden"
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="flex items-center justify-between pb-2 border-b border-[#e8eaed]">
        <div className="flex items-center gap-2">
          <Search size={16} className="text-[#0F9D58]" />
          <span className="text-xs font-bold text-[#1f1f1f]">Buscar y reemplazar</span>
        </div>
        <button type="button" onClick={onClose} title="Cerrar" className="p-1 rounded text-[#444746] hover:bg-gray-100">
          <X size={15} />
        </button>
      </div>

      <div className={fieldClass}>
        <Search size={14} className="text-[#747775] shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              findNext();
            }
          }}
          placeholder="Buscar en la hoja…"
          className="bg-transparent text-xs text-[#1f1f1f] focus:outline-none w-full select-text"
        />
      </div>
      <div className={fieldClass}>
        <Replace size={14} className="text-[#747775] shrink-0" />
        <input
          type="text"
          value={replacement}
          disabled={readOnly}
          onChange={(e) => setReplacement(e.target.value)}
          placeholder={readOnly ? "Hoja protegida" : "Reemplazar con…"}
          className="bg-transparent text-xs text-[#1f1f1f] focus:outline-none w-full select-text"
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-[#444746]">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} />
          <span>Coincidir mayúsculas</span>
        </label>
        <span className="font-mono text-[10px] text-[#747775]">{status}</span>
      </div>

      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={findNext}
          disabled={!query}
          className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#f0f4f9] hover:bg-[#e1e5ea] text-[#1f1f1f] disabled:opacity-40"
        >
          Buscar siguiente
        </button>
        <button
          type="button"
          onClick={replaceAll}
          disabled={!query || readOnly}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0F9D58] text-white hover:bg-[#0c8048] disabled:opacity-40"
        >
          Reemplazar todo
        </button>
      </div>
    </div>
  );
};
