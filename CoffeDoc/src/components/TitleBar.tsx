import React from "react";
import {
  Sun,
  Moon,
  Maximize2,
  Minimize2,
  Download,
  ListTree,
  Minus,
  Square,
  X,
  Save,
  Undo2,
  Redo2,
} from "lucide-react";
import type { DocumentTheme } from "../types";

const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

interface TitleBarProps {
  title: string;
  onTitleChange: (newTitle: string) => void;
  isSaving: boolean;
  theme: DocumentTheme;
  onToggleTheme: () => void;
  zenMode: boolean;
  onToggleZenMode: () => void;
  outlineOpen: boolean;
  onToggleOutline: () => void;
  onOpenExportModal: () => void;
  onSave?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  title,
  onTitleChange,
  isSaving,
  theme,
  onToggleTheme,
  zenMode,
  onToggleZenMode,
  outlineOpen,
  onToggleOutline,
  onOpenExportModal,
  onSave,
  onUndo,
  onRedo,
}) => {
  const handleMinimize = async () => {
    if (isTauri) {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().minimize();
      } catch (err) {
        console.warn(err);
      }
    }
  };

  const handleMaximize = async () => {
    if (isTauri) {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().toggleMaximize();
      } catch (err) {
        console.warn(err);
      }
    }
  };

  const handleClose = async () => {
    if (isTauri) {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().close();
      } catch (err) {
        console.warn(err);
      }
    } else {
      window.close();
    }
  };

  const isLight = theme === "paper-white";

  return (
    <header
      data-tauri-drag-region
      className={`h-9 shrink-0 select-none flex items-center justify-between px-2 text-xs transition-colors z-30 ${
        isLight
          ? "bg-[#185abd] text-white border-b border-[#144ea3]"
          : "bg-[#1b1715] text-[#eae0dd] border-b border-[#352f2c]"
      }`}
    >
      {/* 1. Izquierda: Logo y Barra de acceso rápido de Microsoft Word */}
      <div className="flex items-center gap-1.5 min-w-0">
        {/* Píldora del programa CoffeDoc con su icono oficial y nombre */}
        <div
          className={`flex items-center gap-1.5 px-2 py-1 rounded font-bold text-xs tracking-wide mr-1 ${
            isLight
              ? "bg-[#144ea3] text-white border border-[#0f3d80]"
              : "bg-[#251e1b] text-white border border-[#3e342f]"
          }`}
          title="CoffeDoc - Procesador de Textos"
        >
          <img
            src="/app-icon.ico"
            alt="CoffeDoc"
            className="w-4 h-4 object-contain shrink-0"
          />
          <span className="font-display">CoffeDoc</span>
        </div>

        {/* Acceso Rápido: Guardar, Deshacer, Rehacer */}
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            title="Guardar automáticamente (Ctrl + S)"
            className="p-1 rounded hover:bg-white/20 transition-colors flex items-center gap-1"
          >
            <Save size={13} />
            {isSaving && <span className="text-[10px] animate-pulse">Guardando...</span>}
          </button>
        )}
        {onUndo && (
          <button
            type="button"
            onClick={onUndo}
            title="Deshacer (Ctrl + Z)"
            className="p-1 rounded hover:bg-white/20 transition-colors"
          >
            <Undo2 size={13} />
          </button>
        )}
        {onRedo && (
          <button
            type="button"
            onClick={onRedo}
            title="Rehacer (Ctrl + Y)"
            className="p-1 rounded hover:bg-white/20 transition-colors"
          >
            <Redo2 size={13} />
          </button>
        )}

        <div className="h-4 w-px bg-white/20 mx-1 hidden sm:block" />

        {/* Indicador de estado de guardado */}
        <span className="text-[11px] text-white/80 font-mono hidden md:inline">
          {isSaving ? "Sincronizando..." : "Guardado en Bóveda"}
        </span>
      </div>

      {/* 2. Centro: Título del documento editable */}
      <div className="flex items-center justify-center flex-1 max-w-md mx-2">
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Documento sin título"
          className={`text-center font-medium text-xs px-2 py-0.5 rounded transition-all w-full truncate border border-transparent focus:outline-none ${
            isLight
              ? "text-white placeholder-white/70 hover:bg-white/10 focus:bg-white focus:text-[#111111]"
              : "text-[#eae0dd] placeholder-stone-500 hover:bg-stone-800 focus:bg-stone-900 focus:border-primary"
          }`}
        />
        <span className="opacity-75 font-normal ml-1 shrink-0 text-[11px] hidden lg:inline">
          - CoffeDoc
        </span>
      </div>

      {/* 3. Derecha: Controles de vista, tema y botones de ventana de Windows */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Esquema de títulos */}
        <button
          type="button"
          onClick={onToggleOutline}
          title={outlineOpen ? "Ocultar panel de navegación" : "Mostrar panel de navegación"}
          className={`p-1 rounded transition-colors ${
            outlineOpen ? "bg-white/25 font-bold" : "hover:bg-white/15 opacity-85"
          }`}
        >
          <ListTree size={14} />
        </button>

        {/* Tema claro/oscuro */}
        <button
          type="button"
          onClick={onToggleTheme}
          title={isLight ? "Cambiar a modo oscuro" : "Cambiar a modo hoja blanca de Word"}
          className="p-1 rounded hover:bg-white/15 opacity-85 transition-colors"
        >
          {isLight ? <Moon size={14} /> : <Sun size={14} />}
        </button>

        {/* Modo pantalla completa / Zen */}
        <button
          type="button"
          onClick={onToggleZenMode}
          title={zenMode ? "Salir de modo pantalla completa" : "Modo pantalla completa"}
          className="p-1 rounded hover:bg-white/15 opacity-85 transition-colors"
        >
          {zenMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>

        {/* Exportar */}
        <button
          type="button"
          onClick={onOpenExportModal}
          className={`text-[11px] font-semibold px-2 py-0.5 rounded shadow-sm transition-all flex items-center gap-1 active:scale-95 ${
            isLight
              ? "bg-white text-[#185abd] hover:bg-white/90"
              : "bg-primary text-on-primary hover:bg-primary/90"
          }`}
        >
          <Download size={12} />
          <span className="hidden sm:inline">Exportar</span>
        </button>

        {/* Controles de ventana nativos */}
        <div className="flex items-center ml-1">
          <button
            type="button"
            onClick={handleMinimize}
            title="Minimizar"
            className="w-7 h-7 flex items-center justify-center hover:bg-white/15 transition-colors rounded"
          >
            <Minus size={13} />
          </button>
          <button
            type="button"
            onClick={handleMaximize}
            title="Maximizar"
            className="w-7 h-7 flex items-center justify-center hover:bg-white/15 transition-colors rounded"
          >
            <Square size={11} />
          </button>
          <button
            type="button"
            onClick={handleClose}
            title="Cerrar"
            className="w-7 h-7 flex items-center justify-center hover:bg-red-600 hover:text-white transition-colors rounded"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    </header>
  );
};

