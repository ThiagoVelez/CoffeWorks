import React, { useState } from "react";
import {
  Save,
  Undo2,
  Redo2,
  Play,
  Share2,
  Minus,
  Square,
  X,
  ChevronDown,
  Check,
} from "lucide-react";

interface TitleBarProps {
  title: string;
  onTitleChange: (newTitle: string) => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onStartPresentation: () => void;
  onOpenExport: () => void;
  isSaving: boolean;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  title,
  onTitleChange,
  onSave,
  onUndo,
  onRedo,
  onStartPresentation,
  onOpenExport,
  isSaving,
}) => {
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(title);
  const [quickAccessOpen, setQuickAccessOpen] = useState(false);

  const handleFinishEditing = () => {
    setEditingTitle(false);
    if (tempTitle.trim()) {
      onTitleChange(tempTitle.trim());
    } else {
      setTempTitle(title);
    }
  };

  return (
    <header className="h-10 bg-[#c43e1c] text-white flex items-center justify-between px-3 select-none text-xs border-b border-[#a93217] shadow-sm z-50">
      {/* Zona izquierda: Logo y Acceso Rápido oficial de Microsoft PowerPoint */}
      <div className="flex items-center gap-1.5">
        {/* Píldora del programa CoffeView con icono oficial */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#a93217] text-white font-bold text-xs tracking-wide mr-1 border border-[#8c260f]">
          <img
            src="/app-icon.ico"
            alt="CoffeView"
            className="w-4 h-4 object-contain shrink-0"
          />
          <span className="font-display">CoffeView</span>
        </div>

        {/* Botón Guardar */}
        <button
          type="button"
          onClick={onSave}
          title="Guardar presentación (Ctrl + S)"
          className="p-1 rounded hover:bg-[#a93217] text-white transition-colors flex items-center gap-1 cursor-pointer"
        >
          <Save size={14} />
          {isSaving && <span className="text-[10px] animate-pulse">Guardando...</span>}
        </button>

        {/* Deshacer / Rehacer */}
        <button
          type="button"
          onClick={onUndo}
          title="Deshacer (Ctrl + Z)"
          className="p-1 rounded hover:bg-[#a93217] text-white transition-colors cursor-pointer"
        >
          <Undo2 size={14} />
        </button>
        <button
          type="button"
          onClick={onRedo}
          title="Rehacer (Ctrl + Y)"
          className="p-1 rounded hover:bg-[#a93217] text-white transition-colors cursor-pointer"
        >
          <Redo2 size={14} />
        </button>

        {/* Botón desplegable para personalizar accesos directos */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setQuickAccessOpen(!quickAccessOpen)}
            title="Personalizar barra de herramientas de acceso rápido"
            className="p-1 rounded hover:bg-[#a93217] transition-colors text-white/90 hover:text-white cursor-pointer"
          >
            <ChevronDown size={11} />
          </button>

          {quickAccessOpen && (
            <div
              className="absolute left-0 mt-1 w-56 rounded-lg bg-white text-[#201f1e] border border-[#d2d0ce] shadow-2xl py-1.5 z-50 text-xs font-sans animate-in fade-in"
              onClick={() => setQuickAccessOpen(false)}
            >
              <div className="px-3 py-1 text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                Personalizar acceso rápido
              </div>
              <div className="h-px bg-stone-200 my-1" />
              {[
                { label: "Autoguardado", checked: true },
                { label: "Guardar (Ctrl+S)", checked: true },
                { label: "Deshacer (Ctrl+Z)", checked: true },
                { label: "Rehacer (Ctrl+Y)", checked: true },
                { label: "Iniciar desde principio (F5)", checked: false },
                { label: "Nueva diapositiva", checked: false },
                { label: "Modo Moderador", checked: false },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between px-3 py-1.5 hover:bg-[#f3f2f1] cursor-pointer"
                >
                  <span>{item.label}</span>
                  {item.checked && <Check size={12} className="text-[#c43e1c]" />}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-white/20 mx-1" />

        {/* Indicador de estado de guardado en Bóveda */}
        <span className="text-[11px] text-white/80 font-mono hidden md:inline">
          {isSaving ? "Sincronizando..." : "Guardado en Bóveda"}
        </span>
      </div>

      {/* Zona central: Título de la presentación editable */}
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
            className="w-full text-center bg-white text-[#201f1e] px-2 py-0.5 rounded text-xs font-semibold focus:outline-none shadow-inner"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setTempTitle(title);
              setEditingTitle(true);
            }}
            title="Haga clic para renombrar la presentación"
            className="px-3 py-1 rounded hover:bg-black/15 transition-colors font-medium flex items-center gap-1 truncate max-w-full"
          >
            <span className="font-semibold">{title}</span>
            <span className="text-white/70 ml-1 font-normal">- CoffeView</span>
          </button>
        )}
      </div>

      {/* Zona derecha: Botón Iniciar Presentación, Exportar y controles de ventana */}
      <div className="flex items-center gap-2">
        {/* Botón Iniciar Presentación a pantalla completa (F5) */}
        <button
          type="button"
          onClick={onStartPresentation}
          title="Iniciar Presentación con diapositivas (F5)"
          className="flex items-center gap-1.5 px-3 py-1 rounded bg-white text-[#a93217] hover:bg-[#fff5f2] font-bold text-xs shadow-xs transition-all active:scale-95"
        >
          <Play size={13} fill="currentColor" />
          <span>Presentar</span>
        </button>

        {/* Botón Exportar */}
        <button
          type="button"
          onClick={onOpenExport}
          title="Exportar diapositivas"
          className="flex items-center gap-1 px-2.5 py-1 rounded hover:bg-[#a93217] text-white transition-colors text-xs font-medium"
        >
          <Share2 size={13} />
          <span className="hidden sm:inline">Exportar</span>
        </button>

        {/* Separador de ventana */}
        <div className="h-4 w-px bg-white/20 mx-0.5" />

        {/* Botones de ventana nativos */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => window.close()}
            title="Minimizar"
            className="p-1.5 hover:bg-white/10 rounded transition-colors"
          >
            <Minus size={13} />
          </button>
          <button
            type="button"
            onClick={() => {}}
            title="Maximizar"
            className="p-1.5 hover:bg-white/10 rounded transition-colors"
          >
            <Square size={12} />
          </button>
          <button
            type="button"
            onClick={() => window.close()}
            title="Cerrar"
            className="p-1.5 hover:bg-red-600 rounded transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    </header>
  );
};
