import React, { useState } from "react";
import { X, FileText, Table, Presentation, StickyNote, Plus } from "lucide-react";

interface CreateDocModalProps {
  isOpen: boolean;
  docType: string;
  onClose: () => void;
  onCreate: (docType: string, title: string) => void;
}

export const CreateDocModal: React.FC<CreateDocModalProps> = ({
  isOpen,
  docType,
  onClose,
  onCreate,
}) => {
  const [selectedType, setSelectedType] = useState(docType || "coffedoc");
  const [title, setTitle] = useState("");

  if (!isOpen) return null;

  const docOptions = [
    { id: "coffedoc", name: "CoffeDoc", ext: ".cfd", icon: FileText, color: "text-[#6f4e37]", bg: "bg-[#eeddd0]" },
    { id: "coffecalc", name: "CoffeCalc", ext: ".cfs", icon: Table, color: "text-[#107c41]", bg: "bg-[#dff6dd]" },
    { id: "coffeslides", name: "CoffeSlides", ext: ".csl", icon: Presentation, color: "text-[#b07d62]", bg: "bg-[#faede4]" },
    { id: "coffenotes", name: "CoffeNotes", ext: ".cfn", icon: StickyNote, color: "text-[#6f4e37]", bg: "bg-[#eeddd0]" },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(selectedType, title);
    setTitle("");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white border border-[#dfd3c7] shadow-2xl p-6 flex flex-col gap-5 text-[#2c1b12]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#e8dfd8]">
          <h2 className="font-display text-lg text-[#2c1b12] font-bold">
            Crear Nuevo Documento
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#795548] hover:text-[#2c1b12] hover:bg-[#f4ede6] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Selector de tipo de aplicación */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-mono text-[#795548] font-semibold">Tipo de documento:</label>
            <div className="grid grid-cols-2 gap-2.5">
              {docOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedType(opt.id)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl text-left border transition-all ${
                      isSelected
                        ? "bg-[#eeddd0] border-[#6f4e37] shadow-xs"
                        : "bg-[#faf7f2] border-[#dfd3c7] hover:border-[#6f4e37]"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg ${opt.bg} flex items-center justify-center ${opt.color} shrink-0 border border-[#dfd3c7]`}>
                      <Icon size={17} strokeWidth={2.2} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-[#2c1b12]">{opt.name}</span>
                      <span className="font-mono text-[10px] text-[#795548]">{opt.ext}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nombre del documento */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono text-[#795548] font-semibold">Nombre del archivo:</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Propuesta Comercial CoffeWorks"
              autoFocus
              className="w-full bg-[#fbf9f6] border border-[#dfd3c7] rounded-xl px-3.5 py-2 text-sm text-[#2c1b12] placeholder:text-[#a1887f] focus:outline-none focus:border-[#6f4e37] shadow-xs"
            />
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e8dfd8]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#795548] hover:text-[#2c1b12] hover:bg-[#f4ede6] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-[#6f4e37] hover:bg-[#5c3a21] text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Plus size={16} />
              <span>Crear Documento</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
