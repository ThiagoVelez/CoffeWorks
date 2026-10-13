import React from "react";
import { MessageSquare, X } from "lucide-react";

interface SpeakerNotesProps {
  notes: string;
  onChangeNotes: (notes: string) => void;
  onClose: () => void;
}

export const SpeakerNotes: React.FC<SpeakerNotesProps> = ({
  notes,
  onChangeNotes,
  onClose,
}) => {
  return (
    <div className="h-32 bg-[#f3f2f1] border-t border-[#d2d0ce] flex flex-col shrink-0 text-xs select-none">
      <div className="h-6 px-3 bg-[#edebe9] border-b border-[#e1dfdd] flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-bold text-[#605e5c] text-[10px] uppercase font-mono tracking-wider">
          <MessageSquare size={12} className="text-[#c43e1c]" />
          <span>Notas del Orador</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Cerrar notas"
          className="p-0.5 hover:bg-gray-300 rounded text-gray-500"
        >
          <X size={12} />
        </button>
      </div>

      <textarea
        value={notes}
        onChange={(e) => onChangeNotes(e.target.value)}
        placeholder="Haga clic para agregar notas de presentación..."
        className="flex-1 w-full p-2.5 bg-white text-[#201f1e] text-xs resize-none focus:outline-none select-text font-sans leading-relaxed"
      />
    </div>
  );
};
