import React, { useRef } from "react";
import { Plus, FolderOpen, Presentation, ArrowRight, Clock, Minus, Square, X } from "lucide-react";

const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

interface StartScreenProps {
  onNewPresentation: () => void;
  onOpenPresentation: (file: File) => void;
  onContinueCurrent?: () => void;
  hasExistingPresentation?: boolean;
  currentTitle?: string;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  onNewPresentation,
  onOpenPresentation,
  onContinueCurrent,
  hasExistingPresentation = false,
  currentTitle = "Presentación1",
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onOpenPresentation(file);
      e.target.value = "";
    }
  };

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
    } else {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
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

  return (
    <div className="fixed inset-0 z-50 bg-[#faf7f2] flex flex-col select-none overflow-hidden">
      {/* Barra superior de controles de ventana estilo PowerPoint */}
      <header
        data-tauri-drag-region
        className="h-10 bg-[#c43e1c] text-white flex items-center justify-between px-3 shrink-0 border-b border-[#a83214] shadow-xs select-none z-50"
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#a83214] text-white font-bold text-xs tracking-wide border border-[#8a260c]">
            <Presentation size={14} className="text-white" />
            <span className="font-display">CoffeView</span>
          </div>
          <span className="text-[11px] text-white/80 font-mono hidden sm:inline">
            Inicio • CoffeWorks Office
          </span>
        </div>

        <div className="flex-1 h-full" data-tauri-drag-region />

        <div className="flex items-center">
          <button
            type="button"
            onClick={handleMinimize}
            title="Minimizar"
            className="w-8 h-8 flex items-center justify-center hover:bg-white/15 transition-colors rounded text-white"
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            onClick={handleMaximize}
            title="Maximizar / Ventana"
            className="w-8 h-8 flex items-center justify-center hover:bg-white/15 transition-colors rounded text-white"
          >
            <Square size={12} />
          </button>
          <button
            type="button"
            onClick={handleClose}
            title="Cerrar"
            className="w-8 h-8 flex items-center justify-center hover:bg-red-600 transition-colors rounded text-white"
          >
            <X size={14} />
          </button>
        </div>
      </header>

      {/* Contenedor del contenido centrado */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pptx,.csl,.json"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="w-full max-w-2xl flex flex-col items-center gap-8 animate-fade-in my-auto">
        {/* Identidad de CoffeView */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-[#fbe7e1] border border-[#f3c5b8] flex items-center justify-center text-[#c43e1c] shadow-sm">
            <Presentation size={32} strokeWidth={2.4} />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold text-[#3e1810] tracking-tight">
              CoffeView
            </h1>
            <p className="text-xs font-mono text-[#8a331a] mt-1">
              Diseño de Presentaciones & Diapositivas 16:9 • CoffeWorks
            </p>
          </div>
        </div>

        {/* Dos botones grandes al centro */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-lg">
          {/* Botón: Nuevo archivo */}
          <button
            type="button"
            onClick={onNewPresentation}
            className="group flex flex-col items-center justify-center p-8 rounded-2xl bg-white hover:bg-[#fff9f8] border-2 border-[#f3c5b8] hover:border-[#c43e1c] shadow-sm hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer text-center gap-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-[#fbe7e1] group-hover:bg-[#c43e1c] text-[#c43e1c] group-hover:text-white flex items-center justify-center transition-all shadow-xs border border-[#f3c5b8]">
              <Plus size={36} strokeWidth={2.6} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-display text-lg font-bold text-[#3e1810] group-hover:text-[#c43e1c] transition-colors">
                Nuevo archivo
              </span>
              <span className="font-mono text-[11px] text-[#8a331a]">
                1 diapositiva en blanco
              </span>
            </div>
          </button>

          {/* Botón: Abrir archivo */}
          <button
            type="button"
            onClick={handleOpenClick}
            className="group flex flex-col items-center justify-center p-8 rounded-2xl bg-white hover:bg-[#fff9f8] border-2 border-[#f3c5b8] hover:border-[#c43e1c] shadow-sm hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer text-center gap-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-[#fbe7e1] group-hover:bg-[#c43e1c] text-[#c43e1c] group-hover:text-white flex items-center justify-center transition-all shadow-xs border border-[#f3c5b8]">
              <FolderOpen size={34} strokeWidth={2.4} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-display text-lg font-bold text-[#3e1810] group-hover:text-[#c43e1c] transition-colors">
                Abrir archivo
              </span>
              <span className="font-mono text-[11px] text-[#8a331a]">
                Cargar .pptx, .csl o .json
              </span>
            </div>
          </button>
        </div>

        {/* Continuar con presentación existente si hay una activa */}
        {hasExistingPresentation && onContinueCurrent && (
          <div className="w-full max-w-lg pt-4 border-t border-[#f3c5b8] flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#fbe7e1] flex items-center justify-center text-[#c43e1c] shrink-0 border border-[#f3c5b8]">
                <Presentation size={16} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-[#3e1810] truncate">
                  {currentTitle}
                </span>
                <span className="text-[10px] text-[#8a331a] font-mono flex items-center gap-1">
                  <Clock size={11} />
                  <span>Presentación activa en memoria</span>
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onContinueCurrent}
              className="text-xs font-bold text-[#c43e1c] hover:text-[#9e2c10] flex items-center gap-1 transition-colors px-3 py-1.5 rounded-lg hover:bg-[#fbe7e1]"
            >
              <span>Continuar editando</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* Pie con formatos compatibles */}
        <div className="flex items-center gap-2 text-[11px] font-mono text-[#8a331a]">
          <span>Formatos admitidos:</span>
          <span className="px-2 py-0.5 rounded bg-white border border-[#f3c5b8] text-[#c43e1c] font-semibold">
            .pptx
          </span>
          <span className="px-2 py-0.5 rounded bg-white border border-[#f3c5b8] text-[#c43e1c] font-semibold">
            .csl
          </span>
          <span className="px-2 py-0.5 rounded bg-white border border-[#f3c5b8] text-[#c43e1c] font-semibold">
            .json
          </span>
        </div>
      </div>
    </div>
  </div>
);
};
