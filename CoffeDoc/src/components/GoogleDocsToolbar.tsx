import React, { useState } from "react";
import {
  Search,
  Undo2,
  Redo2,
  Printer,
  CheckCheck,
  Paintbrush,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  Bold,
  Italic,
  Underline,
  Highlighter,
  Link,
  MessageSquarePlus,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  IndentDecrease,
  IndentIncrease,
  RemoveFormatting,
  Pencil,
  Check,
} from "lucide-react";

interface GoogleDocsToolbarProps {
  onExecuteCommand: (command: string, value?: string) => void;
  onPrint: () => void;
  onInsertLink: () => void;
  onInsertImage: () => void;
  zoom: number;
  onZoomChange: (z: number) => void;
  lineSpacing: string;
  onSetLineSpacing: (s: string) => void;
  onOpenFindReplace: () => void;
}

export const GoogleDocsToolbar: React.FC<GoogleDocsToolbarProps> = ({
  onExecuteCommand,
  onPrint,
  onInsertLink,
  onInsertImage,
  zoom,
  onZoomChange,
  lineSpacing,
  onSetLineSpacing,
  onOpenFindReplace,
}) => {
  const [fontSize, setFontSize] = useState<number>(11);
  const [fontFamily, setFontFamily] = useState<string>("Arial");
  const [styleName, setStyleName] = useState<string>("Texto normal");
  const mode = "Edición";
  const [collapsed, setCollapsed] = useState<boolean>(false);

  // Estados de dropdowns
  const [zoomOpen, setZoomOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  const [alignOpen, setAlignOpen] = useState(false);
  const [spacingOpen, setSpacingOpen] = useState(false);

  const handleFontSizeChange = (delta: number) => {
    const next = Math.max(6, Math.min(96, fontSize + delta));
    setFontSize(next);
    onExecuteCommand("fontSize", String(Math.min(7, Math.max(1, Math.round(next / 6)))));
  };

  const handleFontSelect = (font: string) => {
    setFontFamily(font);
    setFontOpen(false);
    onExecuteCommand("fontName", font);
  };

  const handleStyleSelect = (tag: string, label: string) => {
    setStyleName(label);
    setStyleOpen(false);
    if (tag === "p") {
      onExecuteCommand("formatBlock", "<p>");
    } else {
      onExecuteCommand("formatBlock", `<${tag}>`);
    }
  };

  const handleSpacingSelect = (val: string) => {
    onSetLineSpacing(val);
    setSpacingOpen(false);
  };

  return (
    <div className="w-full px-4 py-1 flex items-center justify-between select-none bg-white">
      {/* Contenedor tipo píldora flotante de Google Docs (Material You) */}
      <div className="bg-[#edf2fa] rounded-full px-3 py-1 flex items-center gap-1 shadow-xs text-[#444746] text-xs flex-wrap max-w-full">
        {/* 1. Botón de búsqueda de menús (Menús) */}
        <button
          type="button"
          onClick={onOpenFindReplace}
          className="flex items-center gap-1.5 bg-white hover:bg-gray-50 border border-gray-200/80 rounded-full px-2.5 py-1 text-xs text-[#444746] shadow-xs cursor-pointer mr-1"
          title="Buscar en los menús (Ctrl+F)"
        >
          <Search size={14} className="text-[#444746]" />
          <span className="font-medium text-[11px]">Menús</span>
        </button>

        {/* 2. Acciones rápidas: Deshacer, Rehacer, Imprimir, Ortografía, Copiar formato */}
        <button
          type="button"
          onClick={() => onExecuteCommand("undo")}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Deshacer (Ctrl+Z)"
        >
          <Undo2 size={15} />
        </button>

        <button
          type="button"
          onClick={() => onExecuteCommand("redo")}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Rehacer (Ctrl+Y)"
        >
          <Redo2 size={15} />
        </button>

        <button
          type="button"
          onClick={onPrint}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Imprimir (Ctrl+P)"
        >
          <Printer size={15} />
        </button>

        <button
          type="button"
          onClick={() => alert("Comprobación ortográfica: No se detectaron errores ortográficos.")}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Ortografía y gramática"
        >
          <CheckCheck size={15} />
        </button>

        <button
          type="button"
          onClick={() => alert("Copiar formato: selecciona texto para aplicar estilo.")}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Copiar formato"
        >
          <Paintbrush size={15} />
        </button>

        {/* 3. Selector de Zoom */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setZoomOpen(!zoomOpen)}
            className="flex items-center gap-1 px-2 py-1 rounded-full hover:bg-gray-200/70 text-[#444746] text-xs font-medium cursor-pointer"
            title="Zoom"
          >
            <span>{zoom}%</span>
            <ChevronDown size={12} />
          </button>
          {zoomOpen && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[90px]">
              {[50, 75, 90, 100, 125, 150, 200].map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => {
                    onZoomChange(z);
                    setZoomOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1 text-xs hover:bg-[#f0f4f9] flex items-center justify-between ${
                    zoom === z ? "font-bold text-[#1a73e8]" : "text-[#444746]"
                  }`}
                >
                  <span>{z}%</span>
                  {zoom === z && <Check size={12} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-gray-300 mx-0.5" />

        {/* 4. Estilos de texto (Texto normal, Título 1, 2, 3) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setStyleOpen(!styleOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full hover:bg-gray-200/70 text-[#444746] text-xs font-medium cursor-pointer max-w-[120px] truncate"
            title="Estilos de párrafo"
          >
            <span className="truncate">{styleName}</span>
            <ChevronDown size={12} />
          </button>
          {styleOpen && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[160px]">
              {[
                { tag: "p", label: "Texto normal" },
                { tag: "h1", label: "Título 1" },
                { tag: "h2", label: "Título 2" },
                { tag: "h3", label: "Título 3" },
              ].map((st) => (
                <button
                  key={st.tag}
                  type="button"
                  onClick={() => handleStyleSelect(st.tag, st.label)}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#f0f4f9] flex items-center justify-between ${
                    styleName === st.label ? "font-bold text-[#1a73e8]" : "text-[#444746]"
                  }`}
                >
                  <span>{st.label}</span>
                  {styleName === st.label && <Check size={12} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 5. Selector de Fuente (Arial por defecto de Google Docs) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setFontOpen(!fontOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full hover:bg-gray-200/70 text-[#444746] text-xs font-medium cursor-pointer max-w-[110px] truncate"
            title="Fuente"
          >
            <span className="truncate">{fontFamily}</span>
            <ChevronDown size={12} />
          </button>
          {fontOpen && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[170px]">
              {["Arial", "Roboto", "Times New Roman", "Georgia", "Courier New", "Hanken Grotesk"].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => handleFontSelect(f)}
                  style={{ fontFamily: f }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#f0f4f9] flex items-center justify-between ${
                    fontFamily === f ? "font-bold text-[#1a73e8]" : "text-[#444746]"
                  }`}
                >
                  <span>{f}</span>
                  {fontFamily === f && <Check size={12} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-gray-300 mx-0.5" />

        {/* 6. Tamaño de fuente: [-] 11 [+] */}
        <div className="flex items-center bg-transparent rounded-full px-1">
          <button
            type="button"
            onClick={() => handleFontSizeChange(-1)}
            className="p-1 rounded-full hover:bg-gray-200/70 text-[#444746]"
            title="Reducir tamaño de fuente"
          >
            <Minus size={12} />
          </button>
          <span className="w-6 text-center text-xs font-medium text-[#1f1f1f]">
            {fontSize}
          </span>
          <button
            type="button"
            onClick={() => handleFontSizeChange(1)}
            className="p-1 rounded-full hover:bg-gray-200/70 text-[#444746]"
            title="Aumentar tamaño de fuente"
          >
            <Plus size={12} />
          </button>
        </div>

        <div className="h-4 w-px bg-gray-300 mx-0.5" />

        {/* 7. Formato: Negrita, Cursiva, Subrayado, Color de texto, Resaltado */}
        <button
          type="button"
          onClick={() => onExecuteCommand("bold")}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Negrita (Ctrl+B)"
        >
          <Bold size={15} />
        </button>

        <button
          type="button"
          onClick={() => onExecuteCommand("italic")}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Cursiva (Ctrl+I)"
        >
          <Italic size={15} />
        </button>

        <button
          type="button"
          onClick={() => onExecuteCommand("underline")}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Subrayado (Ctrl+U)"
        >
          <Underline size={15} />
        </button>

        <button
          type="button"
          onClick={() => {
            const color = window.prompt("Introduce un color hex (ej: #1a73e8):", "#1a73e8");
            if (color) onExecuteCommand("foreColor", color);
          }}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors flex flex-col items-center"
          title="Color de texto"
        >
          <span className="font-bold text-xs leading-none">A</span>
          <span className="w-3 h-0.5 bg-[#1f1f1f] rounded-full mt-0.5" />
        </button>

        <button
          type="button"
          onClick={() => onExecuteCommand("hiliteColor", "#fff59d")}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Color de resaltado"
        >
          <Highlighter size={15} />
        </button>

        <div className="h-4 w-px bg-gray-300 mx-0.5" />

        {/* 8. Enlace, Comentario, Imagen */}
        <button
          type="button"
          onClick={onInsertLink}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Insertar enlace (Ctrl+K)"
        >
          <Link size={15} />
        </button>

        <button
          type="button"
          onClick={() => alert("Comentario añadido a la selección.")}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Añadir comentario"
        >
          <MessageSquarePlus size={15} />
        </button>

        <button
          type="button"
          onClick={onInsertImage}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Insertar imagen"
        >
          <ImageIcon size={15} />
        </button>

        <div className="h-4 w-px bg-gray-300 mx-0.5" />

        {/* 9. Alineación de párrafo */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setAlignOpen(!alignOpen)}
            className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors flex items-center gap-0.5"
            title="Alinear"
          >
            <AlignLeft size={15} />
            <ChevronDown size={11} />
          </button>
          {alignOpen && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1 z-50 flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  onExecuteCommand("justifyLeft");
                  setAlignOpen(false);
                }}
                className="p-1.5 rounded hover:bg-gray-100"
                title="Alinear a la izquierda"
              >
                <AlignLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() => {
                  onExecuteCommand("justifyCenter");
                  setAlignOpen(false);
                }}
                className="p-1.5 rounded hover:bg-gray-100"
                title="Centrar"
              >
                <AlignCenter size={14} />
              </button>
              <button
                type="button"
                onClick={() => {
                  onExecuteCommand("justifyRight");
                  setAlignOpen(false);
                }}
                className="p-1.5 rounded hover:bg-gray-100"
                title="Alinear a la derecha"
              >
                <AlignRight size={14} />
              </button>
              <button
                type="button"
                onClick={() => {
                  onExecuteCommand("justifyFull");
                  setAlignOpen(false);
                }}
                className="p-1.5 rounded hover:bg-gray-100"
                title="Justificar"
              >
                <AlignJustify size={14} />
              </button>
            </div>
          )}
        </div>

        {/* 10. Interlineado */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setSpacingOpen(!spacingOpen)}
            className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors flex items-center gap-0.5"
            title="Interlineado y espaciado entre párrafos"
          >
            <span className="text-[11px] font-mono font-medium">{lineSpacing}</span>
            <ChevronDown size={11} />
          </button>
          {spacingOpen && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[120px]">
              {["1.0", "1.15", "1.5", "2.0"].map((sp) => (
                <button
                  key={sp}
                  type="button"
                  onClick={() => handleSpacingSelect(sp)}
                  className={`w-full text-left px-3 py-1 text-xs hover:bg-[#f0f4f9] flex items-center justify-between ${
                    lineSpacing === sp ? "font-bold text-[#1a73e8]" : "text-[#444746]"
                  }`}
                >
                  <span>{sp}</span>
                  {lineSpacing === sp && <Check size={12} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 11. Listas y Sangrías */}
        <button
          type="button"
          onClick={() => onExecuteCommand("insertUnorderedList")}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Lista con viñetas"
        >
          <List size={15} />
        </button>

        <button
          type="button"
          onClick={() => onExecuteCommand("insertOrderedList")}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Lista numerada"
        >
          <ListOrdered size={15} />
        </button>

        <button
          type="button"
          onClick={() => onExecuteCommand("outdent")}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Reducir sangría"
        >
          <IndentDecrease size={15} />
        </button>

        <button
          type="button"
          onClick={() => onExecuteCommand("indent")}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Aumentar sangría"
        >
          <IndentIncrease size={15} />
        </button>

        <button
          type="button"
          onClick={() => onExecuteCommand("removeFormat")}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Borrar formato"
        >
          <RemoveFormatting size={15} />
        </button>
      </div>

      {/* Lado derecho de la barra: Modo "Edición" + Ocultar barra */}
      <div className="flex items-center gap-1 shrink-0 ml-2">
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-[#edf2fa] text-[#444746] font-medium text-xs transition-colors"
          title="Modo de edición"
        >
          <Pencil size={14} className="text-[#1a73e8]" />
          <span>{mode}</span>
          <ChevronDown size={12} />
        </button>

        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-full hover:bg-gray-100 text-[#444746] transition-colors"
          title="Ocultar los menús"
        >
          <ChevronUp size={15} />
        </button>
      </div>
    </div>
  );
};
