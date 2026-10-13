import React, { useState } from "react";
import {
  Save,
  Undo2,
  Redo2,
  Share2,
  Minus,
  Square,
  X,
} from "lucide-react";

interface TitleBarProps {
  title: string;
  onTitleChange: (newTitle: string) => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  isSaving: boolean;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  title,
  onTitleChange,
  onSave,
  onUndo,
  onRedo,
  onExport,
  isSaving,
}) => {
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(title);

  const handleFinishEditing = () => {
    setEditingTitle(false);
    if (tempTitle.trim()) {
      onTitleChange(tempTitle.trim());
    } else {
      setTempTitle(title);
    }
  };

  return (
    <header className="h-10 bg-[#107c41] text-white flex items-center justify-between px-3 select-none text-xs border-b border-[#0e6b37] shadow-sm z-50">
      {/* Zona izquierda: Acceso Rápido de Excel */}
      <div className="flex items-center gap-1.5">
        {/* Icono oficial del programa CoffeCalc */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#0e6b37] text-white font-bold text-xs tracking-wide mr-1 border border-[#0a4d27]">
          <img
            src="/app-icon.ico"
            alt="CoffeCalc"
            className="w-4 h-4 object-contain shrink-0"
          />
          <span className="font-display">CoffeCalc</span>
        </div>

        {/* Botón Guardar */}
        <button
          type="button"
          onClick={onSave}
          title="Guardar libro (Ctrl + S)"
          className="p-1 rounded hover:bg-[#0e6b37] text-white transition-colors flex items-center gap-1"
        >
          <Save size={14} />
          {isSaving && <span className="text-[10px] animate-pulse">Guardando...</span>}
        </button>

        {/* Deshacer / Rehacer */}
        <button
          type="button"
          onClick={onUndo}
          title="Deshacer (Ctrl + Z)"
          className="p-1 rounded hover:bg-[#0e6b37] text-white transition-colors"
        >
          <Undo2 size={14} />
        </button>
        <button
          type="button"
          onClick={onRedo}
          title="Rehacer (Ctrl + Y)"
          className="p-1 rounded hover:bg-[#0e6b37] text-white transition-colors"
        >
          <Redo2 size={14} />
        </button>

        <div className="h-4 w-px bg-white/20 mx-1" />

        {/* Indicador de estado de guardado */}
        <span className="text-[11px] text-white/80 font-mono hidden md:inline">
          {isSaving ? "Sincronizando..." : "Guardado en Bóveda"}
        </span>
      </div>

      {/* Zona central: Título del documento editable */}
      <div className="flex items-center justify-center flex-1 max-w-md mx-4">
        {editingTitle ? (
          <input
            type="text"
            value={tempTitle}
            onChange={(e) => setTempTitle(e.target.value)}
            onBlur={handleFinishEditing}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleFinishEditing();
              if (e.key === "Escape") {
                setTempTitle(title);
                setEditingTitle(false);
              }
            }}
            autoFocus
            className="px-2 py-0.5 rounded bg-white text-[#201f1e] text-center font-bold text-xs border border-[#0e6b37] focus:outline-none w-64 shadow-inner"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setTempTitle(title);
              setEditingTitle(true);
            }}
            title="Haz clic para renombrar el libro"
            className="px-3 py-1 rounded hover:bg-[#0e6b37] text-white font-semibold text-xs tracking-tight transition-colors flex items-center gap-1.5 truncate"
          >
            <span className="truncate">{title.endsWith(".cfs") ? title : `${title}.cfs`}</span>
            <span className="text-white/60 font-normal text-[11px]">- CoffeCalc</span>
          </button>
        )}
      </div>

      {/* Zona derecha: Compartir / Exportar y controles de ventana */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onExport}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#0e6b37] hover:bg-[#0a4d27] text-white font-semibold text-xs transition-colors border border-[#0a4d27] shadow-xs"
        >
          <Share2 size={13} />
          <span className="hidden sm:inline">Exportar</span>
        </button>

        <div className="flex items-center ml-2 border-l border-white/20 pl-2">
          <button
            type="button"
            onClick={() => window.blur()}
            title="Minimizar"
            className="p-1.5 rounded hover:bg-[#0e6b37] text-white transition-colors"
          >
            <Minus size={13} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
              } else {
                document.exitFullscreen().catch(() => {});
              }
            }}
            title="Maximizar / Pantalla completa"
            className="p-1.5 rounded hover:bg-[#0e6b37] text-white transition-colors"
          >
            <Square size={12} />
          </button>
          <button
            type="button"
            onClick={() => window.close()}
            title="Cerrar"
            className="p-1.5 rounded hover:bg-red-600 text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </header>
  );
};
