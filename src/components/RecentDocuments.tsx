import React, { useState, useEffect } from "react";
import {
  History,
  ExternalLink,
  Pin,
  ArrowRight,
  MoreVertical,
  Trash2,
} from "lucide-react";
import type { RecentDocument, DocumentFilter } from "../types";

interface RecentDocumentsProps {
  documents: RecentDocument[];
  onOpenDoc: (doc: RecentDocument) => void;
  onTogglePinDoc: (id: string) => void;
  onDeleteDoc: (id: string) => void;
}

export const RecentDocuments: React.FC<RecentDocumentsProps> = ({
  documents,
  onOpenDoc,
  onTogglePinDoc,
  onDeleteDoc,
}) => {
  const [activeFilter, setActiveFilter] = useState<DocumentFilter>("all");
  const [menuOpenDocId, setMenuOpenDocId] = useState<string | null>(null);

  // Cerrar menú contextual al hacer clic en cualquier otro lugar
  useEffect(() => {
    const handleOutsideClick = () => setMenuOpenDocId(null);
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  const filteredDocs = documents.filter((doc) => {
    if (activeFilter === "pinned") return doc.is_pinned;
    const lower = doc.name.toLowerCase();
    const app = doc.app_id?.toLowerCase() || "";
    if (activeFilter === "documents") return app === "coffedoc" || lower.endsWith(".cfd") || lower.endsWith(".docx");
    if (activeFilter === "spreadsheets") return app === "coffecalc" || app === "coffesheet" || lower.endsWith(".cfs") || lower.endsWith(".xlsx");
    if (activeFilter === "presentations") return app === "coffeview" || app === "coffeslides" || lower.endsWith(".csl") || lower.endsWith(".pptx");
    return true;
  });

  const getDocVisual = (doc: RecentDocument) => {
    const lowerName = doc.name.toLowerCase();
    const appId = doc.app_id?.toLowerCase() || "";

    if (
      lowerName.endsWith(".cfs") ||
      lowerName.endsWith(".xlsx") ||
      lowerName.endsWith(".xls") ||
      appId === "coffecalc" ||
      appId === "coffesheet"
    ) {
      return {
        iconUrl: "/icons/CoffeSheet.ico",
        alt: "CoffeCalc / Hoja de Cálculo",
        bg: "bg-[#dff6dd]",
        border: "border-[#b2e2b0]",
      };
    }
    if (
      lowerName.endsWith(".cfd") ||
      lowerName.endsWith(".docx") ||
      lowerName.endsWith(".doc") ||
      lowerName.endsWith(".txt") ||
      lowerName.endsWith(".md") ||
      appId === "coffedoc"
    ) {
      return {
        iconUrl: "/icons/CoffeText.ico",
        alt: "CoffeDoc / Documento de Texto",
        bg: "bg-[#eeddd0]",
        border: "border-[#dfd3c7]",
      };
    }
    if (
      lowerName.endsWith(".csl") ||
      lowerName.endsWith(".pptx") ||
      lowerName.endsWith(".ppt") ||
      appId === "coffeview" ||
      appId === "coffeslides"
    ) {
      return {
        iconUrl: "/icons/CoffeSlides.ico",
        alt: "CoffeView / Presentación",
        bg: "bg-[#faede4]",
        border: "border-[#dfd3c7]",
      };
    }
    return {
      iconUrl: "/icons/CoffeWorks.ico",
      alt: "CoffeWorks Document",
      bg: "bg-[#f4ede6]",
      border: "border-[#dfd3c7]",
    };
  };

  return (
    <section className="flex flex-col gap-4 bg-white p-6 rounded-2xl shadow-sm border border-[#dfd3c7]">
      {/* Encabezado y filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e8dfd8]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#eeddd0] flex items-center justify-center text-[#6f4e37] border border-[#dfd3c7]">
            <History size={16} strokeWidth={2.4} />
          </div>
          <h2 className="font-display text-base lg:text-lg text-[#2c1b12] font-bold">
            Documentos Recientes & Espacios
          </h2>
        </div>

        {/* Chips de filtro */}
        <div className="flex items-center gap-1 bg-[#faf7f2] p-1 rounded-xl overflow-x-auto border border-[#dfd3c7]">
          {(
            [
              { id: "all", label: "Todos" },
              { id: "documents", label: "Documentos" },
              { id: "spreadsheets", label: "Hojas de Cálculo" },
              { id: "presentations", label: "Presentaciones" },
              { id: "pinned", label: "Fijados" },
            ] as Array<{ id: DocumentFilter; label: string }>
          ).map((filter) => {
            const isActive = activeFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
                className={`px-3 py-1 rounded-lg text-xs transition-all whitespace-nowrap font-medium ${
                  isActive
                    ? "bg-[#6f4e37] text-white font-bold shadow-xs"
                    : "text-[#5c3a21] hover:text-[#2c1b12] hover:bg-[#eeddd0]/60"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista de documentos recientes */}
      <div className="flex flex-col gap-2">
        {filteredDocs.length === 0 ? (
          <div className="py-12 px-4 flex flex-col items-center justify-center text-center gap-2.5 border border-dashed border-[#dfd3c7] rounded-xl bg-[#fbf9f6]">
            <span className="text-sm font-bold text-[#2c1b12]">Bóveda de documentos vacía</span>
            <p className="text-xs text-[#795548] font-sans max-w-md leading-relaxed">
              No tienes archivos recientes en esta categoría. Puedes crear uno nuevo desde el botón "+ Nuevo Documento Rápido" o abrir la aplicación CoffeDoc para empezar a redactar.
            </p>
          </div>
        ) : (
          filteredDocs.map((doc) => {
            const visual = getDocVisual(doc);

            return (
              <div
                key={doc.id}
                className="group flex items-center justify-between p-3 rounded-xl bg-[#fcfaf7] hover:bg-[#f4ede6] border border-[#dfd3c7] hover:border-[#6f4e37] transition-all"
              >
                {/* Información del archivo */}
                <div
                  className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  onClick={() => onOpenDoc(doc)}
                >
                  <div
                    className={`w-10 h-10 rounded-xl ${visual.bg} ${visual.border} flex items-center justify-center shrink-0 border shadow-xs overflow-hidden p-1.5`}
                  >
                    <img
                      src={visual.iconUrl}
                      alt={visual.alt}
                      className="w-6 h-6 object-contain"
                    />
                  </div>

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-xs sm:text-sm font-bold text-[#2c1b12] group-hover:text-[#6f4e37] transition-colors truncate">
                        {doc.name}
                      </span>
                      {doc.is_pinned && (
                        <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-[#eeddd0] text-[#6f4e37] font-bold border border-[#dfd3c7]">
                          Fijado
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-mono text-[#795548] truncate">
                      <span>{doc.category}</span>
                      <span>•</span>
                      <span>{doc.last_modified}</span>
                      <span className="hidden sm:inline">•</span>
                      <span className="hidden sm:inline text-[#a1887f]">{doc.path}</span>
                    </div>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-1.5 shrink-0 ml-2 relative">
                  <button
                    type="button"
                    onClick={() => onTogglePinDoc(doc.id)}
                    title={doc.is_pinned ? "Desfijar documento" : "Fijar documento"}
                    className={`p-1.5 rounded-lg transition-colors ${
                      doc.is_pinned
                        ? "text-[#6f4e37] bg-white shadow-xs"
                        : "text-[#8d6e63] hover:text-[#2c1b12] hover:bg-white"
                    }`}
                  >
                    <Pin size={15} className={doc.is_pinned ? "fill-[#6f4e37]" : ""} />
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenDoc(doc)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#6f4e37] text-[#5c3a21] hover:text-white border border-[#dfd3c7] text-xs font-bold transition-all shadow-xs"
                  >
                    <span>Abrir</span>
                    <ExternalLink size={13} />
                  </button>

                  {/* Botón de 3 puntos (Menú de opciones / Borrar) */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenDocId(menuOpenDocId === doc.id ? null : doc.id);
                      }}
                      title="Opciones del documento"
                      className={`p-1.5 rounded-lg transition-colors border ${
                        menuOpenDocId === doc.id
                          ? "bg-[#eeddd0] text-[#6f4e37] border-[#dfd3c7]"
                          : "text-[#8d6e63] hover:text-[#2c1b12] hover:bg-white border-transparent"
                      }`}
                    >
                      <MoreVertical size={15} />
                    </button>

                    {menuOpenDocId === doc.id && (
                      <div
                        className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-xl shadow-xl border border-[#dfd3c7] py-1.5 z-50 animate-in fade-in zoom-in-95"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpenDocId(null);
                            onDeleteDoc(doc.id);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors text-left"
                        >
                          <Trash2 size={14} />
                          <span>Borrar documento</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pie de lista */}
      <div className="flex items-center justify-between pt-2 border-t border-[#e8dfd8] text-[11px] font-mono text-[#795548]">
        <span>
          Mostrando {filteredDocs.length} de {documents.length} archivos en tu bóveda local
        </span>
        <button
          type="button"
          onClick={() => {
            if (filteredDocs.length > 0) onOpenDoc(filteredDocs[0]);
          }}
          className="text-[#6f4e37] hover:text-[#3e2723] font-bold flex items-center gap-1 transition-colors"
        >
          <span>Ver carpeta de trabajo completa</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </section>
  );
};
