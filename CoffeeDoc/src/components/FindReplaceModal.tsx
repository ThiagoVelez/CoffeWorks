import React, { useCallback, useEffect, useRef, useState } from "react";
import { Search, Replace, X, ChevronDown, ChevronUp } from "lucide-react";
import {
  clearHighlights,
  findMatches,
  highlightMatches,
  notifyChange,
  replaceRange,
  revealRange,
} from "../services/editor";

interface FindReplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  readOnly: boolean;
  /** Cambia cuando se modifica el documento, para refrescar las coincidencias. */
  contentVersion: string;
}

/** Panel flotante de búsqueda y reemplazo sobre el documento activo. */
export const FindReplaceModal: React.FC<FindReplaceModalProps> = ({
  isOpen,
  onClose,
  readOnly,
  contentVersion,
}) => {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [matches, setMatches] = useState<Range[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(
    (keepIndex: number) => {
      const found = findMatches(query, { matchCase, wholeWord });
      const index = found.length === 0 ? 0 : Math.min(keepIndex, found.length - 1);
      setMatches(found);
      setActiveIndex(index);
      highlightMatches(found, index);
      return found;
    },
    [query, matchCase, wholeWord]
  );

  // Recalcular al cambiar el texto buscado, las opciones o el documento
  useEffect(() => {
    if (!isOpen) return;
    refresh(activeIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, refresh, contentVersion]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else {
      clearHighlights();
    }
    return clearHighlights;
  }, [isOpen]);

  if (!isOpen) return null;

  const goTo = (index: number) => {
    if (matches.length === 0) return;
    const next = (index + matches.length) % matches.length;
    setActiveIndex(next);
    highlightMatches(matches, next);
    revealRange(matches[next]);
    inputRef.current?.focus();
  };

  const replaceCurrent = () => {
    if (readOnly || matches.length === 0) return;
    replaceRange(matches[activeIndex], replacement);
    notifyChange();
    const remaining = refresh(activeIndex);
    if (remaining.length > 0) revealRange(remaining[Math.min(activeIndex, remaining.length - 1)]);
    inputRef.current?.focus();
  };

  const replaceAll = () => {
    if (readOnly || matches.length === 0) return;
    // De atrás hacia delante para no invalidar los rangos anteriores
    for (let i = matches.length - 1; i >= 0; i--) {
      replaceRange(matches[i], replacement);
    }
    notifyChange();
    refresh(0);
  };

  const counter =
    query === "" ? "" : matches.length === 0 ? "Sin resultados" : `${activeIndex + 1} de ${matches.length}`;

  const fieldClass =
    "flex items-center bg-white border border-[#c4c7c5] focus-within:border-[#0b57d0] rounded-lg px-2.5 py-1.5 gap-2";
  const buttonClass =
    "px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#f0f4f9] hover:bg-[#e1e5ea] text-[#1f1f1f] transition-colors disabled:opacity-40";

  return (
    <div
      className="fixed top-28 right-8 z-50 w-96 rounded-2xl bg-white border border-[#dadce0] shadow-2xl p-4 flex flex-col gap-3 select-none print:hidden"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="flex items-center justify-between pb-2 border-b border-[#e8eaed]">
        <div className="flex items-center gap-2">
          <Search size={16} className="text-[#0b57d0]" />
          <span className="text-xs font-bold text-[#1f1f1f]">Buscar y reemplazar</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Cerrar"
          className="p-1 rounded text-[#444746] hover:bg-gray-100 transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      <div className="flex flex-col gap-2">
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
                goTo(matches.length > 0 && e.shiftKey ? activeIndex - 1 : activeIndex + (counter ? 1 : 0));
              }
            }}
            placeholder="Buscar en el documento…"
            className="bg-transparent text-xs text-[#1f1f1f] placeholder:text-[#9aa0a6] focus:outline-none w-full select-text"
          />
          <span className="text-[10px] font-mono text-[#747775] whitespace-nowrap">{counter}</span>
          <button
            type="button"
            title="Anterior (Mayús+Intro)"
            disabled={matches.length === 0}
            onClick={() => goTo(activeIndex - 1)}
            className="p-0.5 rounded hover:bg-gray-100 text-[#444746] disabled:opacity-30"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            title="Siguiente (Intro)"
            disabled={matches.length === 0}
            onClick={() => goTo(activeIndex + 1)}
            className="p-0.5 rounded hover:bg-gray-100 text-[#444746] disabled:opacity-30"
          >
            <ChevronDown size={14} />
          </button>
        </div>

        <div className={fieldClass}>
          <Replace size={14} className="text-[#747775] shrink-0" />
          <input
            type="text"
            value={replacement}
            disabled={readOnly}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                replaceCurrent();
              }
            }}
            placeholder={readOnly ? "Documento en solo lectura" : "Reemplazar con…"}
            className="bg-transparent text-xs text-[#1f1f1f] placeholder:text-[#9aa0a6] focus:outline-none w-full select-text"
          />
        </div>

        <div className="flex items-center gap-4 text-[11px] text-[#444746] px-0.5">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} />
            <span>Coincidir mayúsculas</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={wholeWord} onChange={(e) => setWholeWord(e.target.checked)} />
            <span>Palabra completa</span>
          </label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-1.5 pt-1">
        <button
          type="button"
          onClick={replaceCurrent}
          disabled={readOnly || matches.length === 0}
          className={buttonClass}
        >
          Reemplazar
        </button>
        <button
          type="button"
          onClick={replaceAll}
          disabled={readOnly || matches.length === 0}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0b57d0] text-white hover:bg-[#0a4cb8] transition-all disabled:opacity-40"
        >
          Reemplazar todo
        </button>
      </div>
    </div>
  );
};
