import React, { useState } from "react";
import {
  Undo2,
  Redo2,
  Printer,
  Paintbrush,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Superscript,
  Subscript,
  Highlighter,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  CheckSquare,
  Outdent,
  Indent,
  Table as TableIcon,
  Link2,
  Image as ImageIcon,
  Minus,
  Search,
  Eraser,
  ChevronDown,
  Plus,
} from "lucide-react";

interface ToolbarProps {
  onExecuteCommand: (command: string, value?: string) => void;
  onInsertTable: () => void;
  onInsertLink: () => void;
  onInsertImage: () => void;
  onOpenFindReplace: () => void;
  onPrint: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onExecuteCommand,
  onInsertTable,
  onInsertLink,
  onInsertImage,
  onOpenFindReplace,
  onPrint,
}) => {
  const [fontSize, setFontSize] = useState<number>(11);
  const [fontFamily, setFontFamily] = useState<string>("Hanken Grotesk");
  const [textColorOpen, setTextColorOpen] = useState<boolean>(false);
  const [highlightOpen, setHighlightOpen] = useState<boolean>(false);

  const textColors = [
    { name: "Blanco / Predeterminado", color: "#eae0dd" },
    { name: "Caramelo CoffeWorks", color: "#e08e45" },
    { name: "Ámbar Cálido", color: "#ebbf88" },
    { name: "Verde Salvia", color: "#7ca982" },
    { name: "Terracota Alerta", color: "#d95d39" },
    { name: "Azul Cobalto", color: "#7da0ff" },
    { name: "Gris Atenuado", color: "#a18d7f" },
  ];

  const highlightColors = [
    { name: "Sin resaltado", color: "transparent" },
    { name: "Ámbar Tostado", color: "#e08e45" },
    { name: "Amarillo Crema", color: "#ffd166" },
    { name: "Verde Claro", color: "#06d6a0" },
    { name: "Azul Suave", color: "#118ab2" },
  ];

  const handleBlockFormat = (tag: string) => {
    onExecuteCommand("formatBlock", tag);
  };

  const handleFontFamilyChange = (font: string) => {
    setFontFamily(font);
    onExecuteCommand("fontName", font);
  };

  const changeFontSize = (delta: number) => {
    const newSize = Math.max(8, Math.min(48, fontSize + delta));
    setFontSize(newSize);
    // Aplicar tamaño con comando nativo o estilo
    onExecuteCommand("fontSize", newSize <= 10 ? "2" : newSize <= 12 ? "3" : newSize <= 16 ? "4" : newSize <= 24 ? "5" : "6");
  };

  return (
    <div className="bg-[#1e1916] border-b border-[#393431]/60 px-3 py-1.5 flex items-center gap-1.5 flex-wrap select-none shadow-sm z-30">
      {/* 1. Historial y utilidades */}
      <div className="flex items-center gap-0.5 pr-1.5 border-r border-outline-variant/30">
        <button
          type="button"
          onClick={() => onExecuteCommand("undo")}
          title="Deshacer (Ctrl + Z)"
          className="p-1.5 rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
        >
          <Undo2 size={15} />
        </button>
        <button
          type="button"
          onClick={() => onExecuteCommand("redo")}
          title="Rehacer (Ctrl + Y)"
          className="p-1.5 rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
        >
          <Redo2 size={15} />
        </button>
        <button
          type="button"
          onClick={onPrint}
          title="Imprimir (Ctrl + P)"
          className="p-1.5 rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
        >
          <Printer size={15} />
        </button>
        <button
          type="button"
          onClick={() => alert("Función Copiar formato activa")}
          title="Copiar formato"
          className="p-1.5 rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
        >
          <Paintbrush size={15} />
        </button>
      </div>

      {/* 2. Jerarquía de texto (Estilos rápidos) */}
      <div className="pr-1.5 border-r border-outline-variant/30">
        <select
          onChange={(e) => handleBlockFormat(e.target.value)}
          defaultValue="p"
          className="bg-surface-container text-xs text-on-surface px-2 py-1 rounded border border-outline-variant/40 focus:outline-none focus:border-primary font-medium"
        >
          <option value="p">Texto normal</option>
          <option value="h1">Título 1</option>
          <option value="h2">Título 2</option>
          <option value="h3">Título 3</option>
          <option value="blockquote">Cita destacada</option>
          <option value="pre">Bloque de código</option>
        </select>
      </div>

      {/* 3. Tipografía y Tamaño de letra */}
      <div className="flex items-center gap-1 pr-1.5 border-r border-outline-variant/30">
        <select
          value={fontFamily}
          onChange={(e) => handleFontFamilyChange(e.target.value)}
          className="bg-surface-container text-xs text-on-surface px-2 py-1 rounded border border-outline-variant/40 focus:outline-none focus:border-primary font-medium w-36 truncate"
        >
          <option value="Hanken Grotesk">Hanken Grotesk</option>
          <option value="Inter">Inter</option>
          <option value="JetBrains Mono">JetBrains Mono</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Georgia">Georgia</option>
          <option value="Courier New">Courier New</option>
        </select>

        {/* Tamaño de fuente con botones numéricos */}
        <div className="flex items-center bg-surface-container rounded border border-outline-variant/40 px-1 py-0.5">
          <button
            type="button"
            onClick={() => changeFontSize(-1)}
            title="Reducir tamaño de fuente"
            className="p-0.5 text-outline hover:text-on-surface hover:bg-surface-container-high rounded"
          >
            <Minus size={11} />
          </button>
          <span className="font-mono text-xs w-6 text-center text-on-surface font-semibold">
            {fontSize}
          </span>
          <button
            type="button"
            onClick={() => changeFontSize(1)}
            title="Aumentar tamaño de fuente"
            className="p-0.5 text-outline hover:text-on-surface hover:bg-surface-container-high rounded"
          >
            <Plus size={11} />
          </button>
        </div>
      </div>

      {/* 4. Estilos de Carácter (B, I, U, S, x2, x^2, Color, Resaltado) */}
      <div className="flex items-center gap-0.5 pr-1.5 border-r border-outline-variant/30">
        <button
          type="button"
          onClick={() => onExecuteCommand("bold")}
          title="Negrita (Ctrl + B)"
          className="p-1.5 rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors font-bold"
        >
          <Bold size={15} />
        </button>
        <button
          type="button"
          onClick={() => onExecuteCommand("italic")}
          title="Cursiva (Ctrl + I)"
          className="p-1.5 rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors italic"
        >
          <Italic size={15} />
        </button>
        <button
          type="button"
          onClick={() => onExecuteCommand("underline")}
          title="Subrayado (Ctrl + U)"
          className="p-1.5 rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors underline"
        >
          <Underline size={15} />
        </button>
        <button
          type="button"
          onClick={() => onExecuteCommand("strikeThrough")}
          title="Tachado"
          className="p-1.5 rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
        >
          <Strikethrough size={15} />
        </button>
        <button
          type="button"
          onClick={() => onExecuteCommand("superscript")}
          title="Superíndice"
          className="p-1.5 rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
        >
          <Superscript size={15} />
        </button>
        <button
          type="button"
          onClick={() => onExecuteCommand("subscript")}
          title="Subíndice"
          className="p-1.5 rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
        >
          <Subscript size={15} />
        </button>

        {/* Color de texto desplegable */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setTextColorOpen(!textColorOpen);
              setHighlightOpen(false);
            }}
            title="Color de texto"
            className="flex items-center gap-0.5 p-1.5 rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
          >
            <Palette size={15} />
            <ChevronDown size={10} />
          </button>
          {textColorOpen && (
            <div className="absolute left-0 mt-1 w-44 rounded-xl bg-surface-container-high border border-outline-variant/40 shadow-2xl p-1.5 z-40">
              <span className="font-mono text-[10px] text-outline px-2 py-1 block">Color de texto</span>
              {textColors.map((tc) => (
                <button
                  key={tc.color}
                  type="button"
                  onClick={() => {
                    onExecuteCommand("foreColor", tc.color);
                    setTextColorOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-surface-container text-left text-on-surface"
                >
                  <div className="w-3 h-3 rounded-full border border-outline-variant/40" style={{ background: tc.color }} />
                  <span>{tc.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Resaltador desplegable */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setHighlightOpen(!highlightOpen);
              setTextColorOpen(false);
            }}
            title="Color de resaltado"
            className="flex items-center gap-0.5 p-1.5 rounded hover:bg-surface-container text-outline hover:text-primary transition-colors"
          >
            <Highlighter size={15} />
            <ChevronDown size={10} />
          </button>
          {highlightOpen && (
            <div className="absolute left-0 mt-1 w-44 rounded-xl bg-surface-container-high border border-outline-variant/40 shadow-2xl p-1.5 z-40">
              <span className="font-mono text-[10px] text-outline px-2 py-1 block">Resaltador</span>
              {highlightColors.map((hc) => (
                <button
                  key={hc.color}
                  type="button"
                  onClick={() => {
                    onExecuteCommand("hiliteColor", hc.color);
                    setHighlightOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-surface-container text-left text-on-surface"
                >
                  <div className="w-3 h-3 rounded-full border border-outline-variant/40" style={{ background: hc.color }} />
                  <span>{hc.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. Alineación y Sangría */}
      <div className="flex items-center gap-0.5 pr-1.5 border-r border-outline-variant/30">
        <button
          type="button"
          onClick={() => onExecuteCommand("justifyLeft")}
          title="Alinear a la izquierda"
          className="p-1.5 rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
        >
          <AlignLeft size={15} />
        </button>
        <button
          type="button"
          onClick={() => onExecuteCommand("justifyCenter")}
          title="Centrar"
          className="p-1.5 rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
        >
          <AlignCenter size={15} />
        </button>
        <button
          type="button"
          onClick={() => onExecuteCommand("justifyRight")}
          title="Alinear a la derecha"
          className="p-1.5 rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
        >
          <AlignRight size={15} />
        </button>
        <button
          type="button"
          onClick={() => onExecuteCommand("justifyFull")}
          title="Justificar"
          className="p-1.5 rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
        >
          <AlignJustify size={15} />
        </button>
        <button
          type="button"
          onClick={() => onExecuteCommand("outdent")}
          title="Disminuir sangría"
          className="p-1.5 rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
        >
          <Outdent size={15} />
        </button>
        <button
          type="button"
          onClick={() => onExecuteCommand("indent")}
          title="Aumentar sangría"
          className="p-1.5 rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
        >
          <Indent size={15} />
        </button>
      </div>

      {/* 6. Listas */}
      <div className="flex items-center gap-0.5 pr-1.5 border-r border-outline-variant/30">
        <button
          type="button"
          onClick={() => onExecuteCommand("insertUnorderedList")}
          title="Lista con viñetas"
          className="p-1.5 rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
        >
          <List size={15} />
        </button>
        <button
          type="button"
          onClick={() => onExecuteCommand("insertOrderedList")}
          title="Lista numerada"
          className="p-1.5 rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
        >
          <ListOrdered size={15} />
        </button>
        <button
          type="button"
          onClick={() =>
            onExecuteCommand(
              "insertHTML",
              "<ul class='checklist'><li><input type='checkbox'> Nueva tarea</li></ul><p></p>"
            )
          }
          title="Lista de verificación (Checklist)"
          className="p-1.5 rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
        >
          <CheckSquare size={15} />
        </button>
      </div>

      {/* 7. Inserción rápida */}
      <div className="flex items-center gap-0.5 pr-1.5 border-r border-outline-variant/30">
        <button
          type="button"
          onClick={onInsertImage}
          title="Insertar imagen"
          className="p-1.5 rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
        >
          <ImageIcon size={15} />
        </button>
        <button
          type="button"
          onClick={onInsertTable}
          title="Insertar tabla"
          className="p-1.5 rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
        >
          <TableIcon size={15} />
        </button>
        <button
          type="button"
          onClick={onInsertLink}
          title="Insertar hipervínculo (Ctrl + K)"
          className="p-1.5 rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
        >
          <Link2 size={15} />
        </button>
      </div>

      {/* 8. Buscar y Limpiar formato */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onOpenFindReplace}
          title="Buscar y reemplazar (Ctrl + F)"
          className="p-1.5 rounded hover:bg-surface-container text-outline hover:text-primary transition-colors"
        >
          <Search size={15} />
        </button>
        <button
          type="button"
          onClick={() => onExecuteCommand("removeFormat")}
          title="Borrar formato"
          className="p-1.5 rounded hover:bg-surface-container text-outline hover:text-error transition-colors"
        >
          <Eraser size={15} />
        </button>
      </div>
    </div>
  );
};
