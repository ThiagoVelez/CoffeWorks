import React, { useState } from "react";
import { Search, Replace, X, ChevronDown } from "lucide-react";

interface FindReplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFind: (query: string) => void;
  onReplace: (query: string, replacement: string) => void;
  onReplaceAll: (query: string, replacement: string) => void;
}

export const FindReplaceModal: React.FC<FindReplaceModalProps> = ({
  isOpen,
  onClose,
  onFind,
  onReplace,
  onReplaceAll,
}) => {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");

  if (!isOpen) return null;

  return (
    <div
      className="fixed bottom-12 right-12 z-50 w-96 rounded-2xl bg-surface-container-high border border-outline-variant/40 shadow-2xl p-4 flex flex-col gap-3 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
        <div className="flex items-center gap-2">
          <Search size={16} className="text-primary" />
          <span className="font-display text-xs font-bold text-on-surface">
            Buscar y reemplazar
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center bg-surface-container-low border border-outline-variant/30 rounded-xl px-2.5 py-1.5 gap-2">
          <Search size={14} className="text-outline shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en el documento..."
            autoFocus
            className="bg-transparent text-xs text-on-surface placeholder:text-outline focus:outline-none w-full"
          />
        </div>

        <div className="flex items-center bg-surface-container-low border border-outline-variant/30 rounded-xl px-2.5 py-1.5 gap-2">
          <Replace size={14} className="text-outline shrink-0" />
          <input
            type="text"
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            placeholder="Reemplazar con..."
            className="bg-transparent text-xs text-on-surface placeholder:text-outline focus:outline-none w-full"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-1.5 pt-1">
        <button
          type="button"
          onClick={() => onFind(query)}
          className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface-container hover:bg-surface-container-highest text-on-surface transition-colors flex items-center gap-1"
        >
          <span>Buscar</span>
          <ChevronDown size={13} />
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onReplace(query, replacement)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface-container hover:bg-surface-container-highest text-on-surface transition-colors"
          >
            Reemplazar
          </button>
          <button
            type="button"
            onClick={() => onReplaceAll(query, replacement)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-on-primary hover:bg-primary-fixed-dim transition-all shadow-sm"
          >
            Todo
          </button>
        </div>
      </div>
    </div>
  );
};
