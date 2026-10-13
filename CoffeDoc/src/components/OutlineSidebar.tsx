import React from "react";
import { ListTree, ChevronRight } from "lucide-react";
import type { DocumentHeading, DocumentTheme } from "../types";

interface OutlineSidebarProps {
  isOpen: boolean;
  headings: DocumentHeading[];
  onSelectHeading: (text: string) => void;
  theme?: DocumentTheme;
}

export const OutlineSidebar: React.FC<OutlineSidebarProps> = ({
  isOpen,
  headings,
  onSelectHeading,
  theme = "paper-white",
}) => {
  if (!isOpen) return null;
  const isLight = theme === "paper-white";

  return (
    <aside
      className={`w-64 border-r flex flex-col p-4 select-none z-30 shrink-0 transition-colors ${
        isLight
          ? "bg-[#faf9f8] border-[#e1dfdd] text-[#323130]"
          : "bg-[#1c1816] border-[#38322e] text-[#eae0dd]"
      }`}
    >
      <div
        className={`flex items-center gap-2 pb-3 border-b mb-3 ${
          isLight ? "border-[#edebe9]" : "border-[#38322e]"
        }`}
      >
        <ListTree size={16} className={isLight ? "text-[#185abd]" : "text-primary"} />
        <h3
          className={`font-display text-xs font-bold uppercase tracking-wider ${
            isLight ? "text-[#201f1e]" : "text-[#eae0dd]"
          }`}
        >
          Esquema del Documento
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-1">
        {headings.length === 0 ? (
          <div
            className={`p-4 text-center text-xs font-mono leading-relaxed ${
              isLight ? "text-[#605e5c]" : "text-[#a89f91]"
            }`}
          >
            Usa Título 1, Título 2 o Título 3 desde la cinta de herramientas para organizar las secciones de tu texto.
          </div>
        ) : (
          headings.map((h, i) => (
            <button
              key={`${h.id}-${i}`}
              type="button"
              onClick={() => onSelectHeading(h.text)}
              style={{ paddingLeft: `${(h.level - 1) * 12 + 8}px` }}
              className={`text-left py-1.5 px-2 rounded text-xs transition-colors flex items-center gap-1.5 group truncate ${
                isLight
                  ? "text-[#323130] hover:bg-[#edebe9] hover:text-[#185abd]"
                  : "text-[#eae0dd] hover:bg-[#2b2522] hover:text-primary"
              }`}
            >
              <ChevronRight
                size={12}
                className={`shrink-0 ${
                  isLight
                    ? "text-[#8a8886] group-hover:text-[#185abd]"
                    : "text-outline group-hover:text-primary"
                }`}
              />
              <span className="truncate">{h.text}</span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
};
