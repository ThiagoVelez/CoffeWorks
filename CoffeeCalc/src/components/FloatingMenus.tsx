import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ, Check } from "lucide-react";

export interface ContextMenuItem {
  label: string;
  action?: () => void;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
}

/** Coloca un panel flotante dentro de la ventana y lo cierra al pulsar fuera. */
function useFloating(x: number, y: number, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosition({
      left: Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)),
    });
  }, [x, y]);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleMouseDown, true);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown, true);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return { ref, position };
}

/** Menú contextual de la cuadrícula (clic derecho). */
export const ContextMenu: React.FC<{ x: number; y: number; items: ContextMenuItem[]; onClose: () => void }> = ({
  x,
  y,
  items,
  onClose,
}) => {
  const { ref, position } = useFloating(x, y, onClose);
  return (
    <div
      ref={ref}
      style={position}
      className="fixed z-[999970] bg-white border border-gray-200 rounded-lg shadow-2xl py-1.5 min-w-[230px] select-none print:hidden"
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, index) =>
        item.divider ? (
          <div key={index} className="h-px bg-gray-200 my-1" />
        ) : (
          <button
            key={index}
            type="button"
            disabled={item.disabled}
            onClick={() => {
              onClose();
              item.action?.();
            }}
            className={`w-full flex items-center justify-between gap-4 px-3 py-1.5 text-xs text-left hover:bg-[#f0f4f9] disabled:opacity-40 disabled:hover:bg-transparent ${
              item.danger ? "text-[#b3261e]" : "text-[#1f1f1f]"
            }`}
          >
            <span>{item.label}</span>
            {item.shortcut && <span className="font-mono text-[10px] text-gray-400">{item.shortcut}</span>}
          </button>
        )
      )}
    </div>
  );
};

interface FilterMenuProps {
  x: number;
  y: number;
  columnName: string;
  values: string[];
  excluded: string[];
  onApply: (excluded: string[]) => void;
  onSort: (ascending: boolean) => void;
  onClose: () => void;
}

/** Panel del filtro de una columna: ordenar y elegir los valores visibles. */
export const FilterMenu: React.FC<FilterMenuProps> = ({
  x,
  y,
  columnName,
  values,
  excluded,
  onApply,
  onSort,
  onClose,
}) => {
  const { ref, position } = useFloating(x, y, onClose);
  const [hidden, setHidden] = useState<Set<string>>(new Set(excluded));
  const [query, setQuery] = useState("");

  const shown = values.filter((value) => value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const toggle = (value: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });

  return (
    <div
      ref={ref}
      style={position}
      className="fixed z-[999970] w-64 bg-white border border-gray-200 rounded-xl shadow-2xl p-2 flex flex-col gap-1.5 select-none text-xs text-[#1f1f1f] print:hidden"
    >
      <div className="px-1.5 pt-0.5 text-[10px] uppercase tracking-wide font-semibold text-[#747775]">
        Columna {columnName}
      </div>
      <button type="button" onClick={() => onSort(true)} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#f0f4f9]">
        <ArrowDownAZ size={14} /> Ordenar de A a Z
      </button>
      <button type="button" onClick={() => onSort(false)} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#f0f4f9]">
        <ArrowUpAZ size={14} /> Ordenar de Z a A
      </button>
      <div className="h-px bg-gray-200" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar valores…"
        className="border border-[#c4c7c5] rounded px-2 py-1 outline-none focus:border-[#0b57d0] select-text"
      />
      <div className="flex items-center gap-3 px-1 text-[11px] text-[#0b57d0]">
        <button type="button" onClick={() => setHidden(new Set())} className="hover:underline">
          Seleccionar todo
        </button>
        <button type="button" onClick={() => setHidden(new Set(values))} className="hover:underline">
          Borrar
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto flex flex-col border border-[#e8eaed] rounded">
        {shown.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => toggle(value)}
            className="flex items-center gap-2 px-2 py-1 text-left hover:bg-[#f0f4f9]"
          >
            <span
              className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${
                hidden.has(value) ? "border-[#9aa0a6]" : "bg-[#0b57d0] border-[#0b57d0] text-white"
              }`}
            >
              {!hidden.has(value) && <Check size={10} />}
            </span>
            <span className="truncate">{value === "" ? "(Vacías)" : value}</span>
          </button>
        ))}
        {shown.length === 0 && <div className="px-2 py-3 text-center text-[#747775]">Sin valores</div>}
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="px-3 py-1 rounded-full font-semibold text-[#0b57d0] hover:bg-[#e8f0fe]">
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => {
            onApply(Array.from(hidden));
            onClose();
          }}
          className="px-3 py-1 rounded-full font-semibold text-white bg-[#0b57d0] hover:bg-[#0a4cb8]"
        >
          Aceptar
        </button>
      </div>
    </div>
  );
};
