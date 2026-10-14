import React, { useEffect, useRef } from "react";
import type { DocumentTheme, PageMargins, ColumnCount } from "../types";

interface DocumentCanvasProps {
  content: string;
  onChange: (newContent: string) => void;
  theme: DocumentTheme;
  zoom: number;
  lineSpacing: string;
  margins?: PageMargins;
  columns?: ColumnCount;
  watermark?: string;
  pageColor?: string;
  isProtected?: boolean;
}

export const DocumentCanvas: React.FC<DocumentCanvasProps> = ({
  content,
  onChange,
  theme,
  zoom,
  lineSpacing,
  margins = "normal",
  columns = 1,
  watermark,
  pageColor,
  isProtected = false,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);

  // Inicializar contenido en el editor editable
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== content) {
      editorRef.current.innerHTML = content;
    }
  }, [content]);

  const handleInput = () => {
    if (editorRef.current && !isProtected) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const isDark = theme === "dark-espresso";

  const marginPadding =
    margins === "narrow"
      ? "p-8"
      : margins === "wide"
      ? "p-24"
      : "p-16";

  const sheetBg = pageColor
    ? pageColor
    : isDark
    ? "#1f1b19"
    : "#ffffff";

  return (
    <div
      className={`flex-1 overflow-y-auto py-8 px-4 flex justify-center transition-colors ${
        isDark ? "bg-[#14100e]" : "bg-[#eae8e5]"
      }`}
    >
      {/* Contenedor con escala de zoom */}
      <div
        style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
        className="transition-transform duration-150 ease-out"
      >
        {/* Banner de protección */}
        {isProtected && (
          <div className="w-[794px] mb-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-700 text-xs rounded font-medium flex items-center justify-between">
            <span>Documento protegido contra edición (Modo solo lectura)</span>
            <span className="font-mono text-[10px]">Protección activa</span>
          </div>
        )}

        {/* Hoja de papel A4 física */}
        <div
          style={{ backgroundColor: sheetBg }}
          className={`w-[794px] min-h-[1123px] ${marginPadding} relative rounded-sm transition-all border ${
            isDark
              ? "text-[#eae0dd] border-[#393431]/60 shadow-[0_8px_30px_rgb(0,0,0,0.5)]"
              : "text-[#111111] border-[#d2d0ce] shadow-[0_4px_24px_rgba(0,0,0,0.12)]"
          }`}
        >
          {/* Marca de agua de documento (Estilo .uno:WatermarkDialog de LibreOffice Writer) */}
          {watermark && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-0">
              <span className="text-7xl font-bold tracking-widest uppercase opacity-8 rotate-[-35deg] text-neutral-500">
                {watermark}
              </span>
            </div>
          )}

          {/* Área de edición enriquecida con columnas dinámicas (.uno:FormatColumns) */}
          <div
            ref={editorRef}
            contentEditable={!isProtected}
            onInput={handleInput}
            suppressContentEditableWarning
            style={{
              lineHeight: lineSpacing,
              columnCount: columns || 1,
              columnGap: "2.5rem",
            }}
            className={`outline-none min-h-[960px] prose max-w-none relative z-10 ${
              isDark ? "coffedoc-dark" : "coffedoc-light"
            }`}
          />
        </div>
      </div>
    </div>
  );
};
