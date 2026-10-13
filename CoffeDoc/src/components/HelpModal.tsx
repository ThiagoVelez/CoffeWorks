import React from "react";
import { X, Keyboard } from "lucide-react";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: "Ctrl + S", action: "Guardar documento en la bóveda" },
    { key: "Ctrl + P", action: "Imprimir / Guardar como PDF" },
    { key: "Ctrl + Z", action: "Deshacer cambio" },
    { key: "Ctrl + Y", action: "Rehacer cambio" },
    { key: "Ctrl + F", action: "Buscar y reemplazar texto" },
    { key: "Ctrl + B", action: "Aplicar negrita a selección" },
    { key: "Ctrl + I", action: "Aplicar cursiva a selección" },
    { key: "Ctrl + U", action: "Subrayar selección" },
    { key: "Ctrl + A", action: "Seleccionar todo el texto" },
    { key: "Escape", action: "Salir de Modo Zen / Cerrar modales" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-surface-container-high border border-outline-variant/40 shadow-2xl p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-primary" />
            <h2 className="font-display text-sm font-bold text-on-surface">
              Atajos de Teclado de CoffeDoc
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

        <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto">
          {shortcuts.map((sc) => (
            <div
              key={sc.key}
              className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low border border-outline-variant/20 text-xs"
            >
              <span className="text-on-surface-variant">{sc.action}</span>
              <kbd className="font-mono text-[11px] px-2 py-0.5 rounded bg-surface-container-highest text-primary border border-outline-variant/30">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-primary text-on-primary hover:bg-primary-fixed-dim transition-all shadow-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
