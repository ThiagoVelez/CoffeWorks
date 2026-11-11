import React from "react";
import { X, Keyboard } from "lucide-react";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: "Ctrl + N", action: "Nuevo documento" },
    { key: "Ctrl + O", action: "Abrir un archivo" },
    { key: "Ctrl + S", action: "Guardar el documento" },
    { key: "Ctrl + Mayús + S", action: "Guardar como…" },
    { key: "Ctrl + P", action: "Imprimir / Guardar como PDF" },
    { key: "Ctrl + Z", action: "Deshacer" },
    { key: "Ctrl + Y", action: "Rehacer" },
    { key: "Ctrl + F", action: "Buscar y reemplazar" },
    { key: "Ctrl + K", action: "Insertar o editar un enlace" },
    { key: "Ctrl + B / I / U", action: "Negrita, cursiva y subrayado" },
    { key: "Ctrl + Alt + 0…3", action: "Texto normal y títulos 1 a 3" },
    { key: "Ctrl + Mayús + V", action: "Pegar sin formato" },
    { key: "Tab / Mayús + Tab", action: "Sangría de listas y moverse entre celdas" },
    { key: "Ctrl + clic", action: "Abrir un enlace del documento" },
    { key: "Alt + /", action: "Buscar en los menús" },
    { key: "F11", action: "Pantalla completa (modo sin distracciones)" },
    { key: "Escape", action: "Cerrar paneles y salir de pantalla completa" },
  ];


  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none print:hidden"
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
              Atajos de Teclado de CoffeeDoc
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
