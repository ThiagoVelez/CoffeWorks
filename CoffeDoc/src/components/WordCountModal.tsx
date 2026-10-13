import React from "react";
import { X, FileText, Clock, Volume2 } from "lucide-react";
import type { DocumentStats } from "../types";

interface WordCountModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: DocumentStats;
}

export const WordCountModal: React.FC<WordCountModalProps> = ({
  isOpen,
  onClose,
  stats,
}) => {
  if (!isOpen) return null;

  const speechTimeMinutes = Math.max(1, Math.ceil(stats.words / 130));

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-surface-container-high border border-outline-variant/40 shadow-2xl p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-primary" />
            <h2 className="font-display text-sm font-bold text-on-surface">
              Recuento de Palabras
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabla de métricas estadísticas */}
        <div className="flex flex-col gap-2 font-mono text-xs">
          <div className="flex justify-between py-1 border-b border-outline-variant/10 text-on-surface">
            <span className="text-outline">Páginas:</span>
            <span className="font-semibold">{stats.pages}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-outline-variant/10 text-on-surface">
            <span className="text-outline">Palabras:</span>
            <span className="font-semibold">{stats.words}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-outline-variant/10 text-on-surface">
            <span className="text-outline">Caracteres (sin espacios):</span>
            <span className="font-semibold">{stats.charactersWithoutSpaces}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-outline-variant/10 text-on-surface">
            <span className="text-outline">Caracteres (con espacios):</span>
            <span className="font-semibold">{stats.characters}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-outline-variant/10 text-on-surface">
            <span className="text-outline">Párrafos:</span>
            <span className="font-semibold">{stats.paragraphs}</span>
          </div>
        </div>

        {/* Estimación de tiempos */}
        <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2 text-xs">
          <div className="flex items-center justify-between text-outline">
            <span className="flex items-center gap-1.5">
              <Clock size={13} className="text-tertiary" />
              Lectura silenciosa:
            </span>
            <span className="text-on-surface font-mono font-medium">~{stats.readingTimeMinutes} min</span>
          </div>
          <div className="flex items-center justify-between text-outline">
            <span className="flex items-center gap-1.5">
              <Volume2 size={13} className="text-primary" />
              Lectura en voz alta:
            </span>
            <span className="text-on-surface font-mono font-medium">~{speechTimeMinutes} min</span>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-primary text-on-primary hover:bg-primary-fixed-dim transition-all shadow-sm"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
};
