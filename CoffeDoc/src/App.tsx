import React, { useState, useEffect, useRef, useCallback } from "react";
import { GoogleDocsHeader } from "./components/GoogleDocsHeader";
import { GoogleDocsToolbar } from "./components/GoogleDocsToolbar";
import { Ruler } from "./components/Ruler";
import { DocumentCanvas } from "./components/DocumentCanvas";
import { StatusBar } from "./components/StatusBar";
import { OutlineSidebar } from "./components/OutlineSidebar";
import { ExportModal } from "./components/ExportModal";
import { FindReplaceModal } from "./components/FindReplaceModal";
import { WordCountModal } from "./components/WordCountModal";
import { HelpModal } from "./components/HelpModal";
import { StartScreen } from "./components/StartScreen";
import { documentVault } from "./services/documentVault";
import type {
  DocumentMetadata,
  DocumentStats,
  DocumentHeading,
  DocumentTheme,
  PageMargins,
  ColumnCount,
} from "./types";

export const App: React.FC = () => {
  const [metadata, setMetadata] = useState<DocumentMetadata>({
    id: "doc_1",
    title: "Documento de Trabajo",
    author: "Usuario CoffeWorks",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const [content, setContent] = useState<string>("");
  const [theme] = useState<DocumentTheme>("paper-white");
  const [zenMode, setZenMode] = useState<boolean>(false);
  const [showRuler, setShowRuler] = useState<boolean>(true);
  const [outlineOpen, setOutlineOpen] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(100);
  const [lineSpacing, setLineSpacing] = useState<string>("1.5");
  const [margins] = useState<PageMargins>("normal");
  const [columns] = useState<ColumnCount>(1);
  const [watermark] = useState<string>("");
  const [pageColor] = useState<string>("#ffffff");
  const [isProtected, setIsProtected] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showStartScreen, setShowStartScreen] = useState<boolean>(true);

  // Modales
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false);
  const [findReplaceOpen, setFindReplaceOpen] = useState<boolean>(false);
  const [wordCountOpen, setWordCountOpen] = useState<boolean>(false);
  const [helpOpen, setHelpOpen] = useState<boolean>(false);

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Carga inicial del documento
  useEffect(() => {
    const loaded = documentVault.loadCurrentDocument();
    setMetadata(loaded.metadata);
    setContent(loaded.content);
    // Asegurar sincronización inmediata con la bóveda del Launcher
    documentVault.saveDocument(loaded.metadata, loaded.content);
  }, []);

  // Función de cálculo de métricas en tiempo real
  const calculateStats = useCallback((htmlContent: string): DocumentStats => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;
    const text = tempDiv.textContent || tempDiv.innerText || "";

    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const characters = text.length;
    const charactersWithoutSpaces = text.replace(/\s/g, "").length;
    const readingTimeMinutes = Math.max(1, Math.ceil(words / 200));
    const pages = Math.max(1, Math.ceil(words / 450));
    const paragraphs = htmlContent.split(/<\/(?:p|h[1-6]|blockquote|li)>/gi).length - 1 || 1;

    return {
      words,
      characters,
      charactersWithoutSpaces,
      readingTimeMinutes,
      pages,
      paragraphs,
    };
  }, []);

  // Extracción de títulos para el esquema
  const extractHeadings = useCallback((htmlContent: string): DocumentHeading[] => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;
    const elements = tempDiv.querySelectorAll("h1, h2, h3");

    const result: DocumentHeading[] = [];
    elements.forEach((el, index) => {
      const tag = el.tagName.toLowerCase();
      const level = tag === "h1" ? 1 : tag === "h2" ? 2 : 3;
      result.push({
        id: `heading_${index}`,
        text: el.textContent || "",
        level,
      });
    });
    return result;
  }, []);

  const stats = calculateStats(content);
  const headings = extractHeadings(content);

  // Autoguardado con retardo de 800ms
  const triggerAutoSave = useCallback((newContent: string, newMetadata: DocumentMetadata) => {
    setIsSaving(true);
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(async () => {
      await documentVault.saveDocument(newMetadata, newContent);
      setIsSaving(false);
    }, 800);
  }, []);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    triggerAutoSave(newContent, metadata);
  };

  const handleTitleChange = (newTitle: string) => {
    const updatedMeta = { ...metadata, title: newTitle };
    setMetadata(updatedMeta);
    triggerAutoSave(content, updatedMeta);
  };

  // Comandos de formato ricos con preservación de foco y sincronización inmediata
  const handleExecuteCommand = (command: string, value?: string) => {
    const editor = document.querySelector('[contenteditable="true"]') as HTMLElement;
    if (editor) {
      editor.focus();
    }
    try {
      document.execCommand(command, false, value);
    } catch (err) {
      console.warn("execCommand warning:", err);
    }
    if (editor) {
      const newHtml = editor.innerHTML;
      setContent(newHtml);
      triggerAutoSave(newHtml, metadata);
    }
  };

  const handleNewDocument = () => {
    const newMeta: DocumentMetadata = {
      id: `doc_${Date.now()}`,
      title: "Nuevo Documento",
      author: "Usuario CoffeWorks",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const newContent = "<h1>Nuevo Documento</h1><p></p>";
    setMetadata(newMeta);
    setContent(newContent);
    triggerAutoSave(newContent, newMeta);
    setShowStartScreen(false);
  };

  const handleStartOpenDocument = async (file: File) => {
    try {
      const imported = await documentVault.importDocumentFile(file);
      const newMeta: DocumentMetadata = {
        id: `doc_${Date.now()}`,
        title: imported.title || file.name.replace(/\.[^/.]+$/, ""),
        author: "Usuario CoffeWorks",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setMetadata(newMeta);
      setContent(imported.content);
      triggerAutoSave(imported.content, newMeta);
      setShowStartScreen(false);
    } catch (err) {
      console.error("Error al abrir archivo en CoffeDoc:", err);
      alert("No se pudo leer el archivo seleccionado.");
    }
  };

  const handleSaveDocument = async () => {
    setIsSaving(true);
    await documentVault.saveDocument(metadata, content);
    setIsSaving(false);
  };

  const handleInsertTable = () => {
    const tableHtml = `
      <table style="width:100%; border-collapse:collapse; margin:16px 0;">
        <thead>
          <tr>
            <th style="border:1px solid #534438; padding:8px; text-align:left;">Encabezado 1</th>
            <th style="border:1px solid #534438; padding:8px; text-align:left;">Encabezado 2</th>
            <th style="border:1px solid #534438; padding:8px; text-align:left;">Encabezado 3</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border:1px solid #534438; padding:8px;">Dato 1</td>
            <td style="border:1px solid #534438; padding:8px;">Dato 2</td>
            <td style="border:1px solid #534438; padding:8px;">Dato 3</td>
          </tr>
        </tbody>
      </table>
      <p></p>
    `;
    document.execCommand("insertHTML", false, tableHtml);
  };

  const handleInsertLink = () => {
    const url = window.prompt("Introduce la URL del hipervínculo:");
    if (url) {
      document.execCommand("createLink", false, url);
    }
  };

  const handleInsertImage = () => {
    const url = window.prompt("Introduce la URL de la imagen:", "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&q=80");
    if (url) {
      document.execCommand("insertImage", false, url);
    }
  };

  const handleFind = (query: string) => {
    if (!query || typeof window === "undefined") return;
    const win = window as unknown as {
      find?: (
        text: string,
        caseSensitive?: boolean,
        backwards?: boolean,
        wrapAround?: boolean,
        wholeWord?: boolean,
        searchInFrames?: boolean,
        showDialog?: boolean
      ) => boolean;
    };
    if (typeof win.find === "function") {
      win.find(query, false, false, true, false, true, false);
    }
  };

  const handleReplace = (query: string, replacement: string) => {
    if (!query) return;
    const selection = window.getSelection();
    if (selection && selection.toString().toLowerCase() === query.toLowerCase()) {
      document.execCommand("insertText", false, replacement);
    } else {
      handleFind(query);
    }
  };

  const handleReplaceAll = (query: string, replacement: string) => {
    if (!query) return;
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const updated = content.replace(regex, replacement);
    handleContentChange(updated);
  };

  const handleExport = (format: "cfd" | "docx" | "md" | "html" | "pdf") => {
    if (format === "pdf") {
      window.print();
    } else {
      documentVault.exportFile(metadata, content, format);
    }
  };

  // Atajos de teclado globales
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveDocument();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        window.print();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFindReplaceOpen((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        setHelpOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        if (zenMode) setZenMode(false);
        if (findReplaceOpen) setFindReplaceOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [metadata, content, zenMode, findReplaceOpen]);

  return (
    <div className="flex flex-col h-screen bg-surface text-on-surface overflow-hidden">
      {/* 1. Encabezado oficial estilo Google Docs */}
      <GoogleDocsHeader
        title={metadata.title}
        onTitleChange={handleTitleChange}
        isSaving={isSaving}
        onNewDocument={handleNewDocument}
        onSave={handleSaveDocument}
        onOpenExportModal={() => setExportModalOpen(true)}
        onPrint={() => window.print()}
        onUndo={() => handleExecuteCommand("undo")}
        onRedo={() => handleExecuteCommand("redo")}
        onOpenFindReplace={() => setFindReplaceOpen(true)}
        onOpenWordCount={() => setWordCountOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
        zenMode={zenMode}
        onToggleZenMode={() => setZenMode((prev) => !prev)}
        showRuler={showRuler}
        onToggleRuler={() => setShowRuler((prev) => !prev)}
        outlineOpen={outlineOpen}
        onToggleOutline={() => setOutlineOpen((prev) => !prev)}
        isProtected={isProtected}
        onToggleProtected={() => setIsProtected((prev) => !prev)}
        onInsertTable={handleInsertTable}
      />

      {/* 2. Barra de herramientas flotante en forma de píldora estilo Google Docs */}
      {!zenMode && (
        <GoogleDocsToolbar
          onExecuteCommand={handleExecuteCommand}
          onPrint={() => window.print()}
          onInsertLink={handleInsertLink}
          onInsertImage={handleInsertImage}
          zoom={zoom}
          onZoomChange={setZoom}
          lineSpacing={lineSpacing}
          onSetLineSpacing={setLineSpacing}
          onOpenFindReplace={() => setFindReplaceOpen(true)}
        />
      )}

      {/* 3. Regla milimétrica horizontal de Word */}
      {!zenMode && showRuler && <Ruler zoom={zoom} theme={theme} />}

      {/* 5. Área central de trabajo */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Esquema de títulos (oculto en modo Zen o colapsado) */}
        {!zenMode && (
          <OutlineSidebar
            isOpen={outlineOpen}
            headings={headings}
            onSelectHeading={(text) => handleFind(text)}
            theme={theme}
          />
        )}

        {/* Lienzo de redacción de página A4 con diseño dinámico de columnas y márgenes */}
        <DocumentCanvas
          content={content}
          onChange={handleContentChange}
          theme={theme}
          zoom={zoom}
          lineSpacing={lineSpacing}
          margins={margins}
          columns={columns}
          watermark={watermark}
          pageColor={pageColor}
          isProtected={isProtected}
        />
      </div>

      {/* 6. Barra de estado inferior con métricas y zoom (oculta en modo Zen) */}
      {!zenMode && (
        <StatusBar
          stats={stats}
          zoom={zoom}
          onZoomChange={setZoom}
          theme={theme}
        />
      )}

      {/* Modales integrados */}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExport={handleExport}
        documentTitle={metadata.title}
      />

      <FindReplaceModal
        isOpen={findReplaceOpen}
        onClose={() => setFindReplaceOpen(false)}
        onFind={handleFind}
        onReplace={handleReplace}
        onReplaceAll={handleReplaceAll}
      />

      <WordCountModal
        isOpen={wordCountOpen}
        onClose={() => setWordCountOpen(false)}
        stats={stats}
      />

      <HelpModal
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
      />

      {/* Pantalla de inicio con botones grandes: Nuevo archivo y Abrir archivo */}
      {showStartScreen && (
        <StartScreen
          onNewDocument={handleNewDocument}
          onOpenDocument={handleStartOpenDocument}
          onContinueCurrent={() => setShowStartScreen(false)}
          hasExistingDocument={Boolean(content && content.length > 0)}
          currentTitle={metadata.title}
          lastModified="Bóveda local sincronizada"
        />
      )}
    </div>
  );
};
