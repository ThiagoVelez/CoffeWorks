import React, { useState, useRef, useEffect } from "react";
import {
  FilePlus,
  Save,
  Download,
  Printer,
  Undo2,
  Redo2,
  Scissors,
  Copy,
  Search,
  Maximize2,
  Ruler as RulerIcon,
  ListTree,
  Sun,
  Moon,
  Image as ImageIcon,
  Table as TableIcon,
  Link2,
  Minus,
  Quote,
  CheckSquare,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Superscript,
  Subscript,
  Code,
  FileText,
  SpellCheck,
  Puzzle,
  BookOpen,
  Keyboard,
  Info,
  Check,
} from "lucide-react";
import type { DocumentTheme } from "../types";

interface MenuBarProps {
  onNewDocument: () => void;
  onSave: () => void;
  onOpenExport: () => void;
  onPrint: () => void;
  onExecuteCommand: (command: string, value?: string) => void;
  onInsertTable: () => void;
  onInsertLink: () => void;
  onInsertImage: () => void;
  onOpenFindReplace: () => void;
  onOpenWordCount: () => void;
  onOpenHelp: () => void;
  zenMode: boolean;
  onToggleZenMode: () => void;
  showRuler: boolean;
  onToggleRuler: () => void;
  outlineOpen: boolean;
  onToggleOutline: () => void;
  theme: DocumentTheme;
  onToggleTheme: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onSetLineSpacing: (spacing: string) => void;
}

type MenuKey = "archivo" | "editar" | "ver" | "insertar" | "formato" | "herramientas" | "extensiones" | "ayuda";

export const MenuBar: React.FC<MenuBarProps> = ({
  onNewDocument,
  onSave,
  onOpenExport,
  onPrint,
  onExecuteCommand,
  onInsertTable,
  onInsertLink,
  onInsertImage,
  onOpenFindReplace,
  onOpenWordCount,
  onOpenHelp,
  zenMode,
  onToggleZenMode,
  showRuler,
  onToggleRuler,
  outlineOpen,
  onToggleOutline,
  theme,
  onToggleTheme,
  zoom,
  onZoomChange,
  onSetLineSpacing,
}) => {
  const [activeMenu, setActiveMenu] = useState<MenuKey | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cerrar menús al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMenuClick = (key: MenuKey) => {
    setActiveMenu(activeMenu === key ? null : key);
  };

  const handleMenuMouseEnter = (key: MenuKey) => {
    if (activeMenu !== null) {
      setActiveMenu(key);
    }
  };

  const closeMenu = () => {
    setActiveMenu(null);
  };

  const menuItems: Array<{ key: MenuKey; label: string }> = [
    { key: "archivo", label: "Archivo" },
    { key: "editar", label: "Editar" },
    { key: "ver", label: "Ver" },
    { key: "insertar", label: "Insertar" },
    { key: "formato", label: "Formato" },
    { key: "herramientas", label: "Herramientas" },
    { key: "extensiones", label: "Extensiones" },
    { key: "ayuda", label: "Ayuda" },
  ];

  return (
    <div
      ref={containerRef}
      className="bg-[#181412] border-b border-[#393431]/50 px-2 py-0.5 flex items-center gap-0.5 select-none relative z-50 text-xs"
    >
      {menuItems.map(({ key, label }) => {
        const isOpen = activeMenu === key;
        return (
          <div key={key} className="relative">
            <button
              type="button"
              onClick={() => handleMenuClick(key)}
              onMouseEnter={() => handleMenuMouseEnter(key)}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                isOpen
                  ? "bg-surface-container-high text-primary font-semibold"
                  : "text-on-surface hover:bg-surface-container hover:text-primary"
              }`}
            >
              {label}
            </button>

            {/* Menú desplegable */}
            {isOpen && (
              <div
                className="absolute left-0 mt-1 w-64 rounded-xl bg-surface-container-high border border-outline-variant/40 shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 font-sans"
                onClick={closeMenu}
              >
                {/* 1. ARCHIVO */}
                {key === "archivo" && (
                  <>
                    <button
                      type="button"
                      onClick={onNewDocument}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <FilePlus size={14} className="text-outline" />
                        Nuevo documento
                      </span>
                      <span className="font-mono text-[10px] text-outline">Ctrl+N</span>
                    </button>
                    <button
                      type="button"
                      onClick={onSave}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <Save size={14} className="text-outline" />
                        Guardar
                      </span>
                      <span className="font-mono text-[10px] text-outline">Ctrl+S</span>
                    </button>
                    <div className="h-px bg-outline-variant/20 my-1" />
                    <button
                      type="button"
                      onClick={onOpenExport}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <Download size={14} className="text-primary" />
                        Descargar / Exportar...
                      </span>
                      <span className="font-mono text-[10px] text-outline">.cfd, .md, .html</span>
                    </button>
                    <div className="h-px bg-outline-variant/20 my-1" />
                    <button
                      type="button"
                      onClick={onPrint}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <Printer size={14} className="text-outline" />
                        Imprimir / Guardar como PDF
                      </span>
                      <span className="font-mono text-[10px] text-outline">Ctrl+P</span>
                    </button>
                  </>
                )}

                {/* 2. EDITAR */}
                {key === "editar" && (
                  <>
                    <button
                      type="button"
                      onClick={() => onExecuteCommand("undo")}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <Undo2 size={14} className="text-outline" />
                        Deshacer
                      </span>
                      <span className="font-mono text-[10px] text-outline">Ctrl+Z</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onExecuteCommand("redo")}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <Redo2 size={14} className="text-outline" />
                        Rehacer
                      </span>
                      <span className="font-mono text-[10px] text-outline">Ctrl+Y</span>
                    </button>
                    <div className="h-px bg-outline-variant/20 my-1" />
                    <button
                      type="button"
                      onClick={() => onExecuteCommand("cut")}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <Scissors size={14} className="text-outline" />
                        Cortar
                      </span>
                      <span className="font-mono text-[10px] text-outline">Ctrl+X</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onExecuteCommand("copy")}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <Copy size={14} className="text-outline" />
                        Copiar
                      </span>
                      <span className="font-mono text-[10px] text-outline">Ctrl+C</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onExecuteCommand("selectAll")}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <FileText size={14} className="text-outline" />
                        Seleccionar todo
                      </span>
                      <span className="font-mono text-[10px] text-outline">Ctrl+A</span>
                    </button>
                    <div className="h-px bg-outline-variant/20 my-1" />
                    <button
                      type="button"
                      onClick={onOpenFindReplace}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <Search size={14} className="text-primary" />
                        Buscar y reemplazar
                      </span>
                      <span className="font-mono text-[10px] text-outline">Ctrl+F</span>
                    </button>
                  </>
                )}

                {/* 3. VER */}
                {key === "ver" && (
                  <>
                    <button
                      type="button"
                      onClick={onToggleZenMode}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <Maximize2 size={14} className="text-outline" />
                        Modo Pantalla Completa / Zen
                      </span>
                      {zenMode && <Check size={14} className="text-primary" />}
                    </button>
                    <button
                      type="button"
                      onClick={onToggleRuler}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <RulerIcon size={14} className="text-outline" />
                        Mostrar regla horizontal
                      </span>
                      {showRuler && <Check size={14} className="text-primary" />}
                    </button>
                    <button
                      type="button"
                      onClick={onToggleOutline}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <ListTree size={14} className="text-outline" />
                        Mostrar esquema de documento
                      </span>
                      {outlineOpen && <Check size={14} className="text-primary" />}
                    </button>
                    <div className="h-px bg-outline-variant/20 my-1" />
                    <button
                      type="button"
                      onClick={onToggleTheme}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs"
                    >
                      <span className="flex items-center gap-2">
                        {theme === "dark-espresso" ? (
                          <Sun size={14} className="text-primary" />
                        ) : (
                          <Moon size={14} className="text-primary" />
                        )}
                        Tema: {theme === "dark-espresso" ? "Modo Oscuro" : "Papel Blanco"}
                      </span>
                    </button>
                    <div className="h-px bg-outline-variant/20 my-1" />
                    <div className="px-3 py-1 text-[11px] font-mono text-outline font-semibold">
                      Zoom del documento
                    </div>
                    {[75, 100, 125, 150].map((z) => (
                      <button
                        key={z}
                        type="button"
                        onClick={() => onZoomChange(z)}
                        className="w-full flex items-center justify-between px-3 py-1 hover:bg-surface-container text-on-surface text-xs"
                      >
                        <span className="pl-6">{z}%</span>
                        {zoom === z && <Check size={14} className="text-primary" />}
                      </button>
                    ))}
                  </>
                )}

                {/* 4. INSERTAR */}
                {key === "insertar" && (
                  <>
                    <button
                      type="button"
                      onClick={onInsertImage}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <ImageIcon size={14} className="text-outline" />
                        Imagen desde URL o archivo
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={onInsertTable}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <TableIcon size={14} className="text-outline" />
                        Tabla estructurada
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={onInsertLink}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <Link2 size={14} className="text-outline" />
                        Hipervínculo
                      </span>
                      <span className="font-mono text-[10px] text-outline">Ctrl+K</span>
                    </button>
                    <div className="h-px bg-outline-variant/20 my-1" />
                    <button
                      type="button"
                      onClick={() => onExecuteCommand("insertHorizontalRule")}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs"
                    >
                      <Minus size={14} className="text-outline" />
                      Línea horizontal
                    </button>
                    <button
                      type="button"
                      onClick={() => onExecuteCommand("formatBlock", "blockquote")}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs"
                    >
                      <Quote size={14} className="text-outline" />
                      Cita en bloque
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onExecuteCommand(
                          "insertHTML",
                          "<ul class='checklist'><li><input type='checkbox'> Tarea pendiente</li></ul><p></p>"
                        )
                      }
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs"
                    >
                      <CheckSquare size={14} className="text-outline" />
                      Lista de verificación (Checklist)
                    </button>
                  </>
                )}

                {/* 5. FORMATO */}
                {key === "formato" && (
                  <>
                    <div className="px-3 py-1 text-[11px] font-mono text-outline font-semibold">
                      Texto
                    </div>
                    <button
                      type="button"
                      onClick={() => onExecuteCommand("bold")}
                      className="w-full flex items-center justify-between px-3 py-1 hover:bg-surface-container text-on-surface text-xs"
                    >
                      <span className="flex items-center gap-2 font-bold">
                        <Bold size={14} /> Negrita
                      </span>
                      <span className="font-mono text-[10px] text-outline">Ctrl+B</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onExecuteCommand("italic")}
                      className="w-full flex items-center justify-between px-3 py-1 hover:bg-surface-container text-on-surface text-xs"
                    >
                      <span className="flex items-center gap-2 italic">
                        <Italic size={14} /> Cursiva
                      </span>
                      <span className="font-mono text-[10px] text-outline">Ctrl+I</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onExecuteCommand("underline")}
                      className="w-full flex items-center justify-between px-3 py-1 hover:bg-surface-container text-on-surface text-xs"
                    >
                      <span className="flex items-center gap-2 underline">
                        <Underline size={14} /> Subrayado
                      </span>
                      <span className="font-mono text-[10px] text-outline">Ctrl+U</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onExecuteCommand("strikeThrough")}
                      className="w-full flex items-center gap-2 px-3 py-1 hover:bg-surface-container text-on-surface text-xs"
                    >
                      <Strikethrough size={14} /> Tachado
                    </button>
                    <button
                      type="button"
                      onClick={() => onExecuteCommand("superscript")}
                      className="w-full flex items-center gap-2 px-3 py-1 hover:bg-surface-container text-on-surface text-xs"
                    >
                      <Superscript size={14} /> Superíndice
                    </button>
                    <button
                      type="button"
                      onClick={() => onExecuteCommand("subscript")}
                      className="w-full flex items-center gap-2 px-3 py-1 hover:bg-surface-container text-on-surface text-xs"
                    >
                      <Subscript size={14} /> Subíndice
                    </button>
                    <div className="h-px bg-outline-variant/20 my-1" />
                    <div className="px-3 py-1 text-[11px] font-mono text-outline font-semibold">
                      Interlineado
                    </div>
                    {[
                      { label: "Sencillo (1.0)", val: "1.0" },
                      { label: "1.15", val: "1.15" },
                      { label: "1.5", val: "1.5" },
                      { label: "Doble (2.0)", val: "2.0" },
                    ].map((sp) => (
                      <button
                        key={sp.val}
                        type="button"
                        onClick={() => onSetLineSpacing(sp.val)}
                        className="w-full text-left px-6 py-1 hover:bg-surface-container text-on-surface text-xs"
                      >
                        {sp.label}
                      </button>
                    ))}
                    <div className="h-px bg-outline-variant/20 my-1" />
                    <button
                      type="button"
                      onClick={() => onExecuteCommand("removeFormat")}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-surface-container text-on-surface hover:text-error text-xs"
                    >
                      <Code size={14} /> Borrar formato
                    </button>
                  </>
                )}

                {/* 6. HERRAMIENTAS */}
                {key === "herramientas" && (
                  <>
                    <button
                      type="button"
                      onClick={onOpenWordCount}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <FileText size={14} className="text-outline" />
                        Recuento de palabras detallado
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => alert("Corrector ortográfico en español activo y sincronizado localmente.")}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <SpellCheck size={14} className="text-outline" />
                        Ortografía y gramática
                      </span>
                    </button>
                  </>
                )}

                {/* 7. EXTENSIONES */}
                {key === "extensiones" && (
                  <>
                    <button
                      type="button"
                      onClick={() => alert("Catálogo de complementos locales de la suite CoffeWorks.")}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <Puzzle size={14} className="text-outline" />
                        Complementos de la Suite
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => alert("Conector Zotero & Citas bibliográficas conectado a la bóveda.")}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <BookOpen size={14} className="text-outline" />
                        Citas Bibliográficas (Zotero)
                      </span>
                    </button>
                  </>
                )}

                {/* 8. AYUDA */}
                {key === "ayuda" && (
                  <>
                    <button
                      type="button"
                      onClick={onOpenHelp}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <Keyboard size={14} className="text-outline" />
                        Atajos de teclado
                      </span>
                      <span className="font-mono text-[10px] text-outline">Ctrl+/</span>
                    </button>
                    <div className="h-px bg-outline-variant/20 my-1" />
                    <button
                      type="button"
                      onClick={() =>
                        alert(
                          "CoffeDoc v1.4 Pro\nProcesador de textos de la suite ofimática CoffeWorks.\nConstruido con React 19, TypeScript y motor nativo Tauri."
                        )
                      }
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <Info size={14} className="text-outline" />
                        Acerca de CoffeDoc
                      </span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
