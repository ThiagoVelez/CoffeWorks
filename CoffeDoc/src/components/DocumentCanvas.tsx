import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FileText,
  Calendar,
  Mail,
  MoreHorizontal,
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  Trash2,
  Rows3,
  Columns3,
  ExternalLink,
  Pencil,
  Unlink,
  Check,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ShieldAlert,
  ClipboardList,
  ScrollText,
  UserRound,
} from "lucide-react";
import type { PageSettings } from "../types";
import { MARGIN_PIXELS, PAGE_DIMENSIONS } from "../types";
import {
  EDITOR_ID,
  currentComment,
  currentLink,
  currentTableCell,
  fixupFontSizes,
  insertHtml,
  insertImage,
  normalizeStructure,
  notifyChange,
  rememberSelection,
  removeLink,
  resolveComment,
  tableAction,
  type TableAction,
} from "../services/editor";
import { openExternal } from "../services/desktop";

interface DocumentCanvasProps {
  content: string;
  onChange: (html: string) => void;
  settings: PageSettings;
  zoom: number;
  readOnly: boolean;
  spellcheck: boolean;
  onSelectionChange: () => void;
  onPageCount: (pages: number) => void;
  /** Hay un formato copiado esperando a aplicarse sobre la próxima selección. */
  painterActive: boolean;
  onPainterApply: () => void;
  onEditLink: () => void;
  onEditComment: (mark: HTMLElement) => void;
}

interface TemplateDefinition {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  html: () => string;
}

const today = () =>
  new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

const TEMPLATES: TemplateDefinition[] = [
  {
    id: "notes",
    label: "Notas de la reunión",
    icon: Calendar,
    html: () =>
      `<h1>Notas de la reunión</h1><p><strong>Fecha:</strong> ${today()}</p><p><strong>Asistentes:</strong> </p><h2>Orden del día</h2><ol><li>Primer tema</li><li>Segundo tema</li></ol><h2>Acuerdos</h2><ul><li>Acuerdo y responsable</li></ul><h2>Próximos pasos</h2><ul><li>Tarea, responsable y fecha</li></ul>`,
  },
  {
    id: "email",
    label: "Borrador de correo electrónico",
    icon: Mail,
    html: () =>
      `<p><strong>Para:</strong> </p><p><strong>Asunto:</strong> </p><hr><p>Hola:</p><p>Escribe aquí el cuerpo del mensaje.</p><p>Un saludo,</p><p><br></p>`,
  },
  {
    id: "report",
    label: "Informe",
    icon: ClipboardList,
    html: () =>
      `<h1>Título del informe</h1><p><em>${today()}</em></p><h2>Resumen</h2><p>Describe en pocas líneas el propósito y las conclusiones principales.</p><h2>Desarrollo</h2><p>Expón los datos, el análisis y los resultados.</p><table class="cfd-table"><tbody><tr><th>Concepto</th><th>Valor</th><th>Observaciones</th></tr><tr><td><br></td><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td><td><br></td></tr></tbody></table><h2>Conclusiones</h2><ul><li>Primera conclusión</li><li>Segunda conclusión</li></ul>`,
  },
  {
    id: "letter",
    label: "Carta formal",
    icon: ScrollText,
    html: () =>
      `<p style="text-align:right;">${today()}</p><p><strong>Nombre del destinatario</strong><br>Cargo<br>Empresa</p><p>Estimado/a señor/a:</p><p>Me dirijo a usted para…</p><p>Sin otro particular, reciba un cordial saludo.</p><p><br></p><p>Nombre y firma</p>`,
  },
  {
    id: "cv",
    label: "Currículum",
    icon: UserRound,
    html: () =>
      `<h1>Nombre y apellidos</h1><p>Correo electrónico · Teléfono · Ciudad</p><h2>Perfil</h2><p>Resumen profesional en dos o tres líneas.</p><h2>Experiencia</h2><p><strong>Puesto — Empresa</strong> <em>(año – año)</em></p><ul><li>Logro o responsabilidad destacada</li></ul><h2>Formación</h2><p><strong>Titulación — Centro</strong> <em>(año)</em></p><h2>Habilidades</h2><ul><li>Habilidad</li></ul>`,
  },
];

const QUICK_TEMPLATE_IDS = ["notes", "email"];

type CaretContext =
  | { kind: "none" }
  | { kind: "table" }
  | { kind: "link"; href: string }
  | { kind: "comment"; element: HTMLElement; text: string }
  | { kind: "image"; element: HTMLImageElement };

const ContextButton: React.FC<{
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}> = ({ title, onClick, children, danger }) => (
  <button
    type="button"
    title={title}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
      danger ? "text-[#b3261e] hover:bg-[#fce8e6]" : "text-[#444746] hover:bg-[#e8eaed]"
    }`}
  >
    {children}
  </button>
);

export const DocumentCanvas: React.FC<DocumentCanvasProps> = ({
  content,
  onChange,
  settings,
  zoom,
  readOnly,
  spellcheck,
  onSelectionChange,
  onPageCount,
  painterActive,
  onPainterApply,
  onEditLink,
  onEditComment,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [context, setContext] = useState<CaretContext>({ kind: "none" });
  const [isEmpty, setIsEmpty] = useState(false);
  const [moreTemplatesOpen, setMoreTemplatesOpen] = useState(false);

  const dims = PAGE_DIMENSIONS[settings.pageSize];
  const landscape = settings.orientation === "landscape";
  const pageWidth = landscape ? dims.height : dims.width;
  const pageHeight = landscape ? dims.width : dims.height;
  const margin = MARGIN_PIXELS[settings.margins];

  const refreshEmptiness = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const hasMedia = editor.querySelector("img, table, hr") !== null;
    setIsEmpty(!hasMedia && (editor.textContent || "").trim() === "");
  }, []);

  // Volcar el contenido externo (abrir documento, cambiar de pestaña, deshacer)
  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.innerHTML !== content) {
      editor.innerHTML = content;
      setContext({ kind: "none" });
    }
    refreshEmptiness();
  }, [content, refreshEmptiness]);

  useEffect(() => {
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {
      // No disponible en todos los motores; el editor funciona igualmente.
    }
  }, []);

  // Recalcular el número de páginas cuando cambia la altura del contenido
  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    const measure = () => onPageCount(Math.max(1, Math.ceil((page.scrollHeight - 2) / pageHeight)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(page);
    return () => observer.disconnect();
  }, [pageHeight, onPageCount]);

  // Seguir la selección para actualizar la barra de herramientas y la barra contextual
  useEffect(() => {
    const handleSelection = () => {
      const editor = editorRef.current;
      const selection = window.getSelection();
      if (!editor || !selection || !selection.anchorNode || !editor.contains(selection.anchorNode)) {
        return;
      }
      rememberSelection();
      onSelectionChange();

      const comment = currentComment();
      const link = currentLink();
      if (comment) {
        setContext({ kind: "comment", element: comment, text: comment.dataset.comment || "" });
      } else if (link) {
        setContext({ kind: "link", href: link.getAttribute("href") || "" });
      } else if (currentTableCell()) {
        setContext({ kind: "table" });
      } else {
        setContext((prev) => (prev.kind === "image" ? prev : { kind: "none" }));
      }
    };
    document.addEventListener("selectionchange", handleSelection);
    return () => document.removeEventListener("selectionchange", handleSelection);
  }, [onSelectionChange]);

  const handleInput = () => {
    const editor = editorRef.current;
    if (!editor || readOnly) return;
    fixupFontSizes();
    normalizeStructure();
    // El editor siempre conserva al menos un párrafo para escribir
    if (editor.innerHTML === "" || editor.innerHTML === "<br>") {
      editor.innerHTML = "<p><br></p>";
    }
    refreshEmptiness();
    onChange(editor.innerHTML);
  };

  const insertImageFiles = (files: FileList | File[]) => {
    Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => insertImage(String(reader.result), file.name);
        reader.readAsDataURL(file);
      });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Tab" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const selection = window.getSelection();
      const node = selection?.anchorNode;
      const element = node instanceof HTMLElement ? node : node?.parentElement;
      if (element?.closest("li")) {
        document.execCommand(e.shiftKey ? "outdent" : "indent");
      } else if (element?.closest("td, th")) {
        // Tabulador dentro de una tabla: saltar a la celda siguiente o anterior
        const cell = element.closest("td, th") as HTMLTableCellElement;
        const cells = Array.from(cell.closest("table")?.querySelectorAll("td, th") || []);
        const next = cells[cells.indexOf(cell) + (e.shiftKey ? -1 : 1)] as HTMLElement | undefined;
        if (next) {
          const range = document.createRange();
          range.selectNodeContents(next);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
        return;
      } else {
        document.execCommand("insertText", false, " ");
      }
      notifyChange();
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG") {
      const range = document.createRange();
      range.selectNode(target);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      setContext({ kind: "image", element: target as HTMLImageElement });
      return;
    }
    setContext((prev) => (prev.kind === "image" ? { kind: "none" } : prev));

    const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
    if (anchor && (e.ctrlKey || e.metaKey || readOnly)) {
      e.preventDefault();
      void openExternal(anchor.href);
    }
  };

  const handleMouseUp = () => {
    if (!painterActive) return;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) onPainterApply();
  };

  const applyTemplate = (template: TemplateDefinition) => {
    const editor = editorRef.current;
    if (!editor || readOnly) return;
    setMoreTemplatesOpen(false);
    if ((editor.textContent || "").trim() === "") {
      editor.innerHTML = template.html();
      notifyChange();
    } else {
      insertHtml(template.html());
    }
  };

  const updateImage = (mutate: (img: HTMLImageElement) => void) => {
    if (context.kind !== "image") return;
    mutate(context.element);
    notifyChange();
  };

  const alignImage = (mode: "left" | "center" | "right") =>
    updateImage((img) => {
      img.style.float = "";
      img.style.display = "";
      img.style.margin = "";
      if (mode === "center") {
        img.style.display = "block";
        img.style.margin = "8px auto";
      } else {
        img.style.float = mode;
        img.style.margin = mode === "left" ? "4px 16px 8px 0" : "4px 0 8px 16px";
      }
    });

  const tableButtons: Array<{ action: TableAction; title: string; icon: React.ReactNode; danger?: boolean }> = [
    { action: "row-above", title: "Insertar fila encima", icon: <ArrowUpToLine size={13} /> },
    { action: "row-below", title: "Insertar fila debajo", icon: <ArrowDownToLine size={13} /> },
    { action: "col-left", title: "Insertar columna a la izquierda", icon: <ArrowLeftToLine size={13} /> },
    { action: "col-right", title: "Insertar columna a la derecha", icon: <ArrowRightToLine size={13} /> },
    { action: "delete-row", title: "Eliminar fila", icon: <Rows3 size={13} />, danger: true },
    { action: "delete-col", title: "Eliminar columna", icon: <Columns3 size={13} />, danger: true },
    { action: "delete-table", title: "Eliminar tabla", icon: <Trash2 size={13} />, danger: true },
  ];

  const quickTemplates = TEMPLATES.filter((t) => QUICK_TEMPLATE_IDS.includes(t.id));
  const extraTemplates = TEMPLATES.filter((t) => !QUICK_TEMPLATE_IDS.includes(t.id));

  // Guías visuales del final de cada página
  const pageGuides = `repeating-linear-gradient(to bottom, transparent 0, transparent ${
    pageHeight - 1
  }px, #d2d6dc ${pageHeight - 1}px, #d2d6dc ${pageHeight}px)`;

  return (
    <div className="cfd-canvas flex-1 overflow-auto bg-[#f9fbfd] select-text relative print:hidden">
      {/* Barra contextual: herramientas del elemento donde está el cursor */}
      {!readOnly && context.kind !== "none" && (
        <div className="sticky top-2 z-30 flex justify-center pointer-events-none h-0">
          <div className="pointer-events-auto h-fit flex items-center gap-0.5 bg-white border border-[#dadce0] rounded-lg shadow-md px-1.5 py-1 select-none max-w-[92%]">
            {context.kind === "table" && (
              <>
                <span className="text-[11px] font-semibold text-[#0b57d0] px-1.5">Tabla</span>
                {tableButtons.map((button) => (
                  <ContextButton
                    key={button.action}
                    title={button.title}
                    danger={button.danger}
                    onClick={() => tableAction(button.action)}
                  >
                    {button.icon}
                  </ContextButton>
                ))}
              </>
            )}

            {context.kind === "link" && (
              <>
                <span className="text-[11px] text-[#0b57d0] px-1.5 truncate max-w-[280px]" title={context.href}>
                  {context.href}
                </span>
                <ContextButton title="Abrir enlace" onClick={() => void openExternal(context.href)}>
                  <ExternalLink size={13} />
                  <span>Abrir</span>
                </ContextButton>
                <ContextButton title="Editar enlace" onClick={onEditLink}>
                  <Pencil size={13} />
                  <span>Editar</span>
                </ContextButton>
                <ContextButton title="Quitar enlace" danger onClick={removeLink}>
                  <Unlink size={13} />
                  <span>Quitar</span>
                </ContextButton>
              </>
            )}

            {context.kind === "comment" && (
              <>
                <span className="text-[11px] text-[#1f1f1f] px-1.5 truncate max-w-[320px]" title={context.text}>
                  <strong>Comentario:</strong> {context.text}
                </span>
                <ContextButton title="Editar comentario" onClick={() => onEditComment(context.element)}>
                  <Pencil size={13} />
                  <span>Editar</span>
                </ContextButton>
                <ContextButton
                  title="Marcar como resuelto y quitar el comentario"
                  onClick={() => {
                    resolveComment(context.element);
                    setContext({ kind: "none" });
                  }}
                >
                  <Check size={13} />
                  <span>Resolver</span>
                </ContextButton>
              </>
            )}

            {context.kind === "image" && (
              <>
                <span className="text-[11px] font-semibold text-[#0b57d0] px-1.5">Imagen</span>
                {[25, 50, 75, 100].map((percent) => (
                  <ContextButton
                    key={percent}
                    title={`Ancho ${percent}%`}
                    onClick={() =>
                      updateImage((img) => {
                        img.style.width = `${percent}%`;
                        img.style.height = "auto";
                      })
                    }
                  >
                    {percent}%
                  </ContextButton>
                ))}
                <ContextButton title="Alinear a la izquierda con texto alrededor" onClick={() => alignImage("left")}>
                  <AlignLeft size={13} />
                </ContextButton>
                <ContextButton title="Centrar" onClick={() => alignImage("center")}>
                  <AlignCenter size={13} />
                </ContextButton>
                <ContextButton title="Alinear a la derecha con texto alrededor" onClick={() => alignImage("right")}>
                  <AlignRight size={13} />
                </ContextButton>
                <ContextButton
                  title="Eliminar imagen"
                  danger
                  onClick={() => {
                    context.element.remove();
                    setContext({ kind: "none" });
                    notifyChange();
                  }}
                >
                  <Trash2 size={13} />
                </ContextButton>
              </>
            )}
          </div>
        </div>
      )}

      <div className="py-6 px-4 flex justify-center min-w-fit">
        <div style={{ zoom: zoom / 100 }} className="flex flex-col items-center">
          {readOnly && (
            <div
              style={{ width: pageWidth }}
              className="mb-2 px-4 py-2 bg-amber-50 border border-amber-300 text-amber-800 text-xs rounded-lg font-medium flex items-center gap-2 select-none"
            >
              <ShieldAlert size={14} />
              <span>Modo de solo lectura. Cambia a «Edición» en la barra de herramientas para modificar el documento.</span>
            </div>
          )}

          {/* Hoja del documento */}
          <div
            ref={pageRef}
            style={{
              width: pageWidth,
              minHeight: pageHeight,
              padding: margin,
              backgroundColor: settings.pageColor || "#ffffff",
              backgroundImage: pageGuides,
            }}
            className="cfd-page relative border border-[#e1dfdd]/40 shadow-[0_1px_3px_1px_rgba(60,64,67,0.15)]"
          >
            {settings.watermark && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-0">
                <span className="text-7xl font-bold tracking-widest uppercase opacity-10 rotate-[-35deg] text-neutral-500 whitespace-nowrap">
                  {settings.watermark}
                </span>
              </div>
            )}

            <div
              id={EDITOR_ID}
              ref={editorRef}
              contentEditable={!readOnly}
              spellCheck={spellcheck}
              lang="es"
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onClick={handleClick}
              onMouseUp={handleMouseUp}
              onPaste={(e) => {
                if (e.clipboardData.files.length > 0 && !e.clipboardData.getData("text/html")) {
                  e.preventDefault();
                  insertImageFiles(e.clipboardData.files);
                }
              }}
              onDrop={(e) => {
                if (e.dataTransfer.files.length > 0) {
                  e.preventDefault();
                  insertImageFiles(e.dataTransfer.files);
                }
              }}
              suppressContentEditableWarning
              style={{
                lineHeight: settings.lineSpacing,
                columnCount: settings.columns > 1 ? settings.columns : undefined,
                columnGap: "2.5rem",
                minHeight: pageHeight - margin * 2,
                cursor: painterActive ? "copy" : undefined,
              }}
              className="cfd-content outline-none relative z-10"
            />

            {/* Sugerencias de inicio: solo en documentos vacíos */}
            {isEmpty && !readOnly && (
              <div
                style={{ top: margin + 56, left: margin, right: margin }}
                className="absolute z-20 flex flex-col items-center gap-3 select-none"
              >
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <span className="flex items-center gap-1.5 text-xs text-[#747775] mr-1">
                    <FileText size={14} />
                    Empieza a escribir o usa una plantilla:
                  </span>
                  {quickTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => applyTemplate(template)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f0f4f9] hover:bg-[#e1e5ea] text-[#1f1f1f] rounded-lg text-xs font-medium transition-colors border border-gray-200/50"
                    >
                      <template.icon size={14} className="text-[#444746]" />
                      <span>{template.label}</span>
                    </button>
                  ))}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMoreTemplatesOpen((open) => !open)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-[#f0f4f9] hover:bg-[#e1e5ea] text-[#1f1f1f] rounded-lg text-xs font-medium transition-colors border border-gray-200/50"
                    >
                      <MoreHorizontal size={14} className="text-[#444746]" />
                      <span>Más</span>
                    </button>
                    {moreTemplatesOpen && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px] z-30">
                        {extraTemplates.map((template) => (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => applyTemplate(template)}
                            className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs text-[#1f1f1f] hover:bg-[#f0f4f9]"
                          >
                            <template.icon size={14} className="text-[#444746]" />
                            <span>{template.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
