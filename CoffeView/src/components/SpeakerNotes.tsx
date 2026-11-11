import React from "react";
import { LayoutGrid, ChevronLeft, ChevronRight } from "lucide-react";

interface SpeakerNotesProps {
  notes: string;
  onChangeNotes: (notes: string) => void;
  gridView: boolean;
  onToggleGridView: () => void;
  stripVisible: boolean;
  onToggleStrip: () => void;
}

/** Notas del orador de la diapositiva activa y conmutadores de vista. */
export const SpeakerNotes: React.FC<SpeakerNotesProps> = ({
  notes,
  onChangeNotes,
  gridView,
  onToggleGridView,
  stripVisible,
  onToggleStrip,
}) => (
  <div className="h-16 bg-white border-t border-gray-200 flex items-center shrink-0 text-xs px-4 select-none print:hidden">
    <div className="flex items-center gap-1 mr-4 border-r border-gray-200 pr-3">
      <button
        type="button"
        onClick={onToggleGridView}
        title={gridView ? "Volver a la vista normal" : "Vista de cuadrícula: todas las diapositivas"}
        className={`p-1 rounded transition-colors ${gridView ? "bg-[#d3e3fd] text-[#0b57d0]" : "hover:bg-gray-100 text-[#444746]"}`}
      >
        <LayoutGrid size={15} />
      </button>
      <button
        type="button"
        onClick={onToggleStrip}
        title={stripVisible ? "Ocultar la tira de diapositivas" : "Mostrar la tira de diapositivas"}
        className="p-1 rounded hover:bg-gray-100 text-[#444746] transition-colors"
      >
        {stripVisible ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
      </button>
    </div>

    <textarea
      id="speaker-notes"
      value={notes}
      onChange={(e) => onChangeNotes(e.target.value)}
      placeholder="Haz clic para agregar notas del orador"
      className="flex-1 h-full py-2.5 bg-transparent text-xs text-[#1f1f1f] placeholder:text-gray-500 resize-none focus:outline-none font-sans leading-relaxed select-text"
    />
  </div>
);
