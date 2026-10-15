import React, { useEffect, useRef } from "react";
import {
  FileText,
  Calendar,
  Mail,
  MoreHorizontal,
} from "lucide-react";
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
  zoom,
  lineSpacing,
  margins = "normal",
  columns = 1,
  watermark,
  pageColor,
  isProtected = false,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);

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

  const handleInsertTemplate = (type: string) => {
    let templateHtml = "";
    if (type === "format") {
      templateHtml = `<h2>Encabezado de Sección</h2><p>Este documento utiliza el formato estándar con tipografía Arial y espaciado proporcional optimizado.</p>`;
    } else if (type === "notes") {
      templateHtml = `<h2>Notas de la reunión</h2><p><strong>Fecha:</strong> ${new Date().toLocaleDateString()}</p><p><strong>Participantes:</strong> Equipo de producto</p><h3>Puntos clave:</h3><ul><li>Revisión de avances del sprint</li><li>Planificación del diseño de interfaces de usuario</li></ul>`;
    } else if (type === "email") {
      templateHtml = `<h2>Borrador de correo electrónico</h2><p><strong>Para:</strong> equipo@coffeworks.org</p><p><strong>Asunto:</strong> Actualización de la Suite</p><p>Estimado equipo,<br/><br/>Les comparto los detalles del nuevo lanzamiento...</p>`;
    }

    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand("insertHTML", false, templateHtml);
      onChange(editorRef.current.innerHTML);
    }
  };

  const marginPadding =
    margins === "narrow" ? "p-8" : margins === "wide" ? "p-24" : "p-16";

  const sheetBg = pageColor || "#ffffff";

  return (
    <div className="flex-1 overflow-y-auto py-6 px-4 flex justify-center bg-[#f9fbfd] select-text">
      {/* Contenedor escalado según zoom */}
      <div
        style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
        className="transition-transform duration-150 ease-out flex flex-col items-center"
      >
        {/* Banner de protección */}
        {isProtected && (
          <div className="w-[816px] mb-2 px-4 py-2 bg-amber-50 border border-amber-300 text-amber-800 text-xs rounded-lg font-medium flex items-center justify-between">
            <span>Documento protegido contra edición (Modo solo lectura)</span>
            <span className="font-mono text-[10px]">Protección activa</span>
          </div>
        )}

        {/* Hoja física estándar de Google Docs */}
        <div
          style={{ backgroundColor: sheetBg }}
          className={`w-[816px] min-h-[1056px] ${marginPadding} relative bg-white border border-[#e1dfdd]/40 shadow-[0_1px_3px_1px_rgba(60,64,67,0.15)] flex flex-col justify-between`}
        >
          {/* Marca de agua si está configurada */}
          {watermark && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-0">
              <span className="text-7xl font-bold tracking-widest uppercase opacity-10 rotate-[-35deg] text-neutral-500">
                {watermark}
              </span>
            </div>
          )}

          {/* Área de redacción contentEditable */}
          <div
            ref={editorRef}
            contentEditable={!isProtected}
            onInput={handleInput}
            suppressContentEditableWarning
            style={{
              lineHeight: lineSpacing,
              columnCount: columns || 1,
              columnGap: "2.5rem",
              fontFamily: "Arial, sans-serif",
            }}
            className="outline-none min-h-[700px] text-[15px] text-[#1f1f1f] relative z-10 leading-relaxed font-sans"
          />

          {/* Píldoras flotantes inferiores y barra 'Escribir con Gemini' de Google Docs */}
          <div className="pt-8 pb-4 relative z-20 flex flex-col items-center gap-4">
            {/* Chips de acción rápida verbatim según la captura */}
            <div className="flex items-center gap-2 flex-wrap justify-center select-none">
              <button
                type="button"
                onClick={() => handleInsertTemplate("format")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f0f4f9] hover:bg-[#e1dfdd] text-[#1f1f1f] rounded-lg text-xs font-medium transition-colors shadow-2xs border border-gray-200/50"
              >
                <FileText size={14} className="text-[#444746]" />
                <span>Usar el formato del documento</span>
              </button>

              <button
                type="button"
                onClick={() => handleInsertTemplate("notes")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f0f4f9] hover:bg-[#e1dfdd] text-[#1f1f1f] rounded-lg text-xs font-medium transition-colors shadow-2xs border border-gray-200/50"
              >
                <Calendar size={14} className="text-[#444746]" />
                <span>Notas de la reunión</span>
              </button>

              <button
                type="button"
                onClick={() => handleInsertTemplate("email")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f0f4f9] hover:bg-[#e1dfdd] text-[#1f1f1f] rounded-lg text-xs font-medium transition-colors shadow-2xs border border-gray-200/50"
              >
                <Mail size={14} className="text-[#444746]" />
                <span>Borrador de correo electrónico</span>
              </button>

              <button
                type="button"
                className="flex items-center gap-1 px-2.5 py-1.5 bg-[#f0f4f9] hover:bg-[#e1dfdd] text-[#1f1f1f] rounded-lg text-xs font-medium transition-colors shadow-2xs border border-gray-200/50"
              >
                <MoreHorizontal size={14} className="text-[#444746]" />
                <span>Más</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
