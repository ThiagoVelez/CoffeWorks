import React from "react";
import { X, Download } from "lucide-react";

export interface ExportOption {
  id: string;
  name: string;
  description: string;
  badge: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  fileTitle: string;
  options: ExportOption[];
  onExport: (id: string) => void;
}

/** Selector de formato de exportación. */
export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, title, fileTitle, options, onExport }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[999960] bg-black/40 flex items-center justify-center p-4 select-none print:hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl p-6 flex flex-col gap-4 text-[#1f1f1f]">
        <div className="flex items-center justify-between pb-3 border-b border-[#e8eaed]">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="font-mono text-[11px] text-[#747775] mt-0.5 truncate">Archivo actual: {fileTitle}</p>
          </div>
          <button type="button" onClick={onClose} title="Cerrar" className="p-1 rounded-full text-[#444746] hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                onClose();
                onExport(option.id);
              }}
              className="flex items-start gap-3.5 p-3.5 rounded-xl bg-[#f8fafd] hover:bg-[#edf2fa] border border-[#e1e5ea] hover:border-[#0b57d0]/50 transition-all text-left group"
            >
              <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0 border border-[#e1e5ea]">
                <option.icon size={18} className="text-[#0b57d0]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold group-hover:text-[#0b57d0] transition-colors">{option.name}</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white text-[#5f6368] border border-[#e1e5ea]">
                    {option.badge}
                  </span>
                </div>
                <p className="text-[11px] text-[#5f6368] mt-1 leading-relaxed">{option.description}</p>
              </div>
              <Download size={14} className="text-[#0b57d0] shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
