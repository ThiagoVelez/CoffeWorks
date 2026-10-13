import React from "react";
import { X, FileCode, Globe, Printer } from "lucide-react";
import type { PresentationMetadata, Slide, SlideTheme } from "../types";
import { presentationVault } from "../services/presentationVault";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: PresentationMetadata;
  slides: Slide[];
  theme: SlideTheme;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  metadata,
  slides,
  theme,
}) => {
  if (!isOpen) return null;

  const handleExportCSL = () => {
    presentationVault.exportToCSL(metadata, slides);
    onClose();
  };

  const handleExportHTML = () => {
    presentationVault.exportToHTML(metadata, slides, theme);
    onClose();
  };

  const handlePrint = () => {
    onClose();
    setTimeout(() => window.print(), 200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 select-none">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Cabecera */}
        <div className="bg-[#c43e1c] text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">Exportar Presentación</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-black/20 rounded-full transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-5 flex flex-col gap-3">
          <p className="text-xs text-gray-600 mb-1 leading-relaxed">
            Seleccione el formato en el que desea exportar <strong>{metadata.title}</strong>:
          </p>

          {/* Opción 1: Archivo CSL nativo */}
          <button
            type="button"
            onClick={handleExportCSL}
            className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:border-[#c43e1c] hover:bg-[#fff5f2] text-left transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-[#fcebe6] text-[#c43e1c] flex items-center justify-center shrink-0 border border-[#f5c6bb]">
              <FileCode size={20} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs text-gray-900 group-hover:text-[#c43e1c]">
                Formato CoffeView (.csl)
              </span>
              <span className="text-[11px] text-gray-500 mt-0.5 leading-tight">
                Conserva diapositivas, notas del orador, temas y capas editables para la suite.
              </span>
            </div>
          </button>

          {/* Opción 2: Presentación Web HTML */}
          <button
            type="button"
            onClick={handleExportHTML}
            className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:border-[#c43e1c] hover:bg-[#fff5f2] text-left transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-[#fcebe6] text-[#c43e1c] flex items-center justify-center shrink-0 border border-[#f5c6bb]">
              <Globe size={20} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs text-gray-900 group-hover:text-[#c43e1c]">
                Presentación Web Autocontenida (.html)
              </span>
              <span className="text-[11px] text-gray-500 mt-0.5 leading-tight">
                Diapositivas listas para proyectar o enviar a clientes sin necesidad de instalar software.
              </span>
            </div>
          </button>

          {/* Opción 3: Imprimir / PDF */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:border-[#c43e1c] hover:bg-[#fff5f2] text-left transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-[#fcebe6] text-[#c43e1c] flex items-center justify-center shrink-0 border border-[#f5c6bb]">
              <Printer size={20} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs text-gray-900 group-hover:text-[#c43e1c]">
                Imprimir o Guardar como PDF
              </span>
              <span className="text-[11px] text-gray-500 mt-0.5 leading-tight">
                Abre el diálogo nativo del sistema para imprimir o guardar cada diapositiva en PDF.
              </span>
            </div>
          </button>
        </div>

        {/* Pie */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
