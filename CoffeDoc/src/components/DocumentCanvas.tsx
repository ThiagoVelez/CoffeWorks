import React, { useEffect, useRef } from "react";
import type { DocumentTheme } from "../types";

interface DocumentCanvasProps {
  content: string;
  onChange: (newContent: string) => void;
  theme: DocumentTheme;
  zoom: number;
  lineSpacing: string;
}

export const DocumentCanvas: React.FC<DocumentCanvasProps> = ({
  content,
  onChange,
  theme,
  zoom,
  lineSpacing,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);

  // Inicializar contenido en el editor editable
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== content) {
      editorRef.current.innerHTML = content;
    }
  }, [content]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const isDark = theme === "dark-espresso";

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
        {/* Hoja de papel A4 física */}
        <div
          className={`w-[794px] min-h-[1123px] p-16 rounded-sm transition-all border ${
            isDark
              ? "bg-[#1f1b19] text-[#eae0dd] border-[#393431]/60 shadow-[0_8px_30px_rgb(0,0,0,0.5)]"
              : "bg-white text-[#111111] border-[#d2d0ce] shadow-[0_4px_24px_rgba(0,0,0,0.12)]"
          }`}
        >
          {/* Área de edición enriquecida */}
          <div
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            suppressContentEditableWarning
            style={{ lineHeight: lineSpacing }}
            className={`outline-none min-h-[960px] prose max-w-none ${
              isDark ? "coffedoc-dark" : "coffedoc-light"
            }`}
          />
        </div>
      </div>
    </div>
  );
};
