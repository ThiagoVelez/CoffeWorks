import React, { useState } from "react";
import { LayoutGrid, ChevronLeft } from "lucide-react";

interface SpeakerNotesProps {
  notes: string;
  onChangeNotes: (notes: string) => void;
  onClose?: () => void;
}

export const SpeakerNotes: React.FC<SpeakerNotesProps> = ({
  notes,
  onChangeNotes,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="h-14 bg-white border-t border-gray-200 flex items-center shrink-0 text-xs px-4 select-none">
      {/* Botones inferiores de vista cuadrícula y colapso de Google Slides */}
      <div className="flex items-center gap-1 mr-4 border-r border-gray-200 pr-3">
        <button
          type="button"
          title="Vista de cuadrícula"
          className="p-1 rounded hover:bg-gray-100 text-[#444746] transition-colors"
        >
          <LayoutGrid size={15} />
        </button>
        <button
          type="button"
          title="Ocultar tira de diapositivas"
          className="p-1 rounded hover:bg-gray-100 text-[#444746] transition-colors"
        >
          <ChevronLeft size={15} />
        </button>
      </div>

      <textarea
        value={notes}
        onChange={(e) => onChangeNotes(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder="Haz clic para agregar notas del orador"
        className={`flex-1 h-full py-3 bg-transparent text-xs resize-none focus:outline-none font-sans leading-relaxed select-text transition-all ${
          !notes && !isFocused ? "text-gray-500 font-normal" : "text-[#1f1f1f]"
        }`}
      />
    </div>
  );
};

