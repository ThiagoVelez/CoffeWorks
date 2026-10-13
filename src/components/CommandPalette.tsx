import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  FileText,
  Table,
  Presentation,
  StickyNote,
  CornerDownLeft,
  X,
  BookOpen,
} from "lucide-react";
import type { SuiteApp, RecentDocument } from "../types";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  apps: SuiteApp[];
  documents: RecentDocument[];
  onLaunchApp: (appId: string) => void;
  onOpenDoc: (doc: RecentDocument) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  apps,
  documents,
  onLaunchApp,
  onOpenDoc,
}) => {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  // Manejo de atajos globales (Escape para salir)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredApps = apps.filter(
    (app) =>
      app.name.toLowerCase().includes(query.toLowerCase()) ||
      app.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  const filteredDocs = documents.filter(
    (doc) =>
      doc.name.toLowerCase().includes(query.toLowerCase()) ||
      doc.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-20 px-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-white border border-[#dfd3c7] shadow-2xl overflow-hidden flex flex-col text-[#2c1b12]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra de entrada de búsqueda */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#e8dfd8] gap-3 bg-[#faf7f2]">
          <Search size={18} className="text-[#6f4e37] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar aplicaciones, documentos o atajos..."
            className="flex-1 bg-transparent text-sm text-[#2c1b12] placeholder:text-[#a1887f] focus:outline-none font-medium"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-[#795548] hover:text-[#2c1b12] hover:bg-[#f4ede6] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Resultados de búsqueda */}
        <div className="max-h-96 overflow-y-auto p-2.5 flex flex-col gap-3">
          {/* Aplicaciones encontradas */}
          {filteredApps.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-mono font-bold text-[#795548] px-2 py-1">
                Aplicaciones de la Suite
              </span>
              {filteredApps.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => {
                    onLaunchApp(app.id);
                    onClose();
                  }}
                  className="flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-[#f4ede6] transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-[#eeddd0] text-[#6f4e37] flex items-center justify-center shrink-0 border border-[#dfd3c7]">
                      <BookOpen size={14} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-[#2c1b12] group-hover:text-[#6f4e37] transition-colors">
                        {app.name}
                      </span>
                      <span className="text-[10px] text-[#795548] truncate font-mono">
                        {app.subtitle}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-[#6f4e37] font-semibold flex items-center gap-1 shrink-0">
                    <span>Abrir</span>
                    <CornerDownLeft size={12} />
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Documentos encontrados */}
          {filteredDocs.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-mono font-bold text-[#795548] px-2 py-1">
                Documentos Recientes
              </span>
              {filteredDocs.map((doc) => {
                const DocIcon =
                  doc.app_id === "coffesheet"
                    ? Table
                    : doc.app_id === "coffeslides"
                    ? Presentation
                    : doc.app_id === "coffenotes"
                    ? StickyNote
                    : FileText;

                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => {
                      onOpenDoc(doc);
                      onClose();
                    }}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-[#f4ede6] transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-[#eeddd0] text-[#6f4e37] flex items-center justify-center shrink-0 border border-[#dfd3c7]">
                        <DocIcon size={14} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-[#2c1b12] group-hover:text-[#6f4e37] transition-colors truncate">
                          {doc.name}
                        </span>
                        <span className="text-[10px] text-[#795548] font-mono">
                          {doc.category} • {doc.last_modified}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-[#6f4e37] font-semibold flex items-center gap-1 shrink-0">
                      <span>Cargar</span>
                      <CornerDownLeft size={12} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {filteredApps.length === 0 && filteredDocs.length === 0 && (
            <div className="p-8 text-center text-[#795548] text-xs font-mono">
              No se encontraron coincidencias para "{query}".
            </div>
          )}
        </div>

        {/* Pie con sugerencias de atajos */}
        <div className="px-4 py-2 bg-[#faf7f2] border-t border-[#e8dfd8] flex items-center justify-between text-[11px] font-mono text-[#795548]">
          <span>Navegar con ↑ ↓</span>
          <span>Seleccionar con Enter</span>
          <span>Cerrar con Esc</span>
        </div>
      </div>
    </div>
  );
};
