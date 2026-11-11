import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, X, Search } from "lucide-react";
import { FUNCTION_CATALOG } from "../services/formulaEngine";

interface FormulaBarProps {
  /** Referencia de la selección actual (A1 o A1:C5). */
  selectionLabel: string;
  onNavigate: (reference: string) => void;
  /** Contenido de la celda activa o texto en edición. */
  value: string;
  isEditing: boolean;
  readOnly: boolean;
  onFocusEdit: () => void;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onInsertFunction: (name: string) => void;
}

export const FormulaBar: React.FC<FormulaBarProps> = ({
  selectionLabel,
  onNavigate,
  value,
  isEditing,
  readOnly,
  onFocusEdit,
  onChange,
  onCommit,
  onCancel,
  onInsertFunction,
}) => {
  const [nameBox, setNameBox] = useState(selectionLabel);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setNameBox(selectionLabel), [selectionLabel]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [menuOpen]);

  const functions = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return needle
      ? FUNCTION_CATALOG.filter((fn) => `${fn.name} ${fn.description} ${fn.category}`.toLocaleLowerCase().includes(needle))
      : FUNCTION_CATALOG;
  }, [query]);

  return (
    <div className="h-8 bg-white border-b border-[#e1dfdd] flex items-center px-3 gap-2 text-xs select-none z-30 shrink-0 print:hidden">
      <div className="w-24 shrink-0">
        <input
          type="text"
          value={nameBox}
          spellCheck={false}
          onChange={(e) => setNameBox(e.target.value.toUpperCase())}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onNavigate(nameBox.trim());
              (e.target as HTMLInputElement).blur();
            } else if (e.key === "Escape") {
              setNameBox(selectionLabel);
              (e.target as HTMLInputElement).blur();
            }
          }}
          title="Cuadro de nombres: escribe una celda o un rango y pulsa Intro"
          className="w-full text-center font-mono font-medium text-xs py-0.5 border border-transparent hover:border-gray-300 rounded focus:bg-white focus:outline-none focus:border-[#1a73e8] select-text"
        />
      </div>

      <div className="h-4 w-px bg-gray-200 shrink-0" />

      <div className="flex items-center gap-1 shrink-0 relative" ref={menuRef}>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => {
            setMenuOpen((open) => !open);
            setQuery("");
          }}
          title="Insertar función"
          className="px-1.5 py-0.5 rounded hover:bg-gray-100 font-serif italic text-xs font-semibold text-[#5f6368] transition-colors disabled:opacity-40"
        >
          fx
        </button>

        {isEditing && (
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={onCancel} title="Cancelar (Esc)" className="p-0.5 rounded hover:bg-gray-100 text-gray-500">
              <X size={12} />
            </button>
            <button type="button" onClick={onCommit} title="Introducir (Intro)" className="p-0.5 rounded hover:bg-gray-100 text-[#0F9D58]">
              <Check size={12} />
            </button>
          </div>
        )}

        {menuOpen && (
          <div className="absolute left-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-50 flex flex-col max-h-96">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
              <Search size={13} className="text-[#747775]" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar una función…"
                className="flex-1 text-xs outline-none select-text"
              />
            </div>
            <div className="overflow-y-auto py-1">
              {functions.length === 0 && (
                <div className="px-3 py-4 text-center text-[11px] text-[#747775]">Sin resultados</div>
              )}
              {functions.map((fn) => (
                <button
                  key={fn.name}
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onInsertFunction(fn.name);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#f0f4f9] flex flex-col transition-colors"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-xs text-[#0F9D58]">{fn.syntax}</span>
                    <span className="text-[9px] uppercase tracking-wide text-[#9aa0a6] shrink-0">{fn.category}</span>
                  </span>
                  <span className="text-[10px] text-gray-500">{fn.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="h-4 w-px bg-gray-200 shrink-0" />

      <input
        type="text"
        value={value}
        readOnly={readOnly}
        spellCheck={false}
        onFocus={onFocusEdit}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
            (e.target as HTMLInputElement).blur();
          }
        }}
        data-formula-input
        title="Contenido de la celda"
        className="flex-1 min-w-0 font-sans text-xs px-2 py-0.5 border border-transparent hover:border-gray-200 focus:border-[#1a73e8] focus:bg-white rounded focus:outline-none select-text"
      />
    </div>
  );
};
