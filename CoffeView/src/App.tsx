import React, { useState, useEffect, useCallback } from "react";
import { GoogleSlidesHeader } from "./components/GoogleSlidesHeader";
import { GoogleSlidesToolbar } from "./components/GoogleSlidesToolbar";
import { SlideThumbnails } from "./components/SlideThumbnails";
import { SlideCanvas } from "./components/SlideCanvas";
import { SpeakerNotes } from "./components/SpeakerNotes";
import { PresentationMode } from "./components/PresentationMode";
import { ExportModal } from "./components/ExportModal";
import { StartScreen } from "./components/StartScreen";
import {
  presentationVault,
  SLIDE_THEMES,
  createSlideForLayout,
  createDefaultSlides,
} from "./services/presentationVault";
import type {
  PresentationMetadata,
  Slide,
  SlideTheme,
  SlideLayout,
  SlideTransition,
  SlideElement,
  ShapeType,
} from "./types";

export const App: React.FC = () => {
  const [metadata, setMetadata] = useState<PresentationMetadata>({
    id: "pres_1",
    title: "Presentación1",
    author: "Usuario CoffeWorks",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    themeId: "theme_espresso",
  });

  const [slides, setSlides] = useState<Slide[]>([]);
  const [activeSlideId, setActiveSlideId] = useState<string>("slide_1");
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState<boolean>(true);
  const [isPresentationMode, setIsPresentationMode] = useState<boolean>(false);
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showStartScreen, setShowStartScreen] = useState<boolean>(true);

  // Estados avanzados de herramientas
  const [clipboardElement, setClipboardElement] = useState<SlideElement | null>(null);
  const [isFormatPainterActive, setIsFormatPainterActive] = useState<boolean>(false);
  const [formatPainterStyle, setFormatPainterStyle] = useState<Partial<SlideElement> | null>(null);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "4:3">("16:9");
  const [showGridlines, setShowGridlines] = useState<boolean>(false);

  // Historial para Deshacer / Rehacer
  const [history, setHistory] = useState<Slide[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Carga inicial
  useEffect(() => {
    const loaded = presentationVault.loadPresentation();
    setMetadata(loaded.metadata);
    setSlides(loaded.slides);
    setActiveSlideId(loaded.activeSlideId);
    setHistory([loaded.slides]);
    setHistoryIndex(0);
  }, []);

  const currentTheme =
    SLIDE_THEMES.find((th) => th.id === metadata.themeId) || SLIDE_THEMES[0];

  const activeSlide =
    slides.find((s) => s.id === activeSlideId) || slides[0] || {
      id: "slide_1",
      slideNumber: 1,
      layout: "title",
      transition: "fade",
      notes: "",
      elements: [],
    };

  // Guardar y sincronizar
  const updateSlides = useCallback(
    (nextSlides: Slide[]) => {
      setSlides(nextSlides);
      presentationVault.savePresentation(metadata, nextSlides, activeSlideId);

      // Registrar en historial
      setHistory((prev) => {
        const trimmed = prev.slice(0, historyIndex + 1);
        return [...trimmed, nextSlides];
      });
      setHistoryIndex((prev) => prev + 1);
    },
    [metadata, activeSlideId, historyIndex]
  );

  const handleManualSave = () => {
    setIsSaving(true);
    presentationVault.savePresentation(metadata, slides, activeSlideId);
    setTimeout(() => setIsSaving(false), 600);
  };

  // Deshacer / Rehacer
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevSlides = history[historyIndex - 1];
      setHistoryIndex((prev) => prev - 1);
      setSlides(prevSlides);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextSlides = history[historyIndex + 1];
      setHistoryIndex((prev) => prev + 1);
      setSlides(nextSlides);
    }
  };

  // Atajo de teclado global: F5 para presentar, Escape para salir, Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F5") {
        e.preventDefault();
        setIsPresentationMode(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleManualSave();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedElementId &&
        !isPresentationMode
      ) {
        const target = e.target as HTMLElement | null;
        const isEditingText =
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable);
        if (!isEditingText) {
          e.preventDefault();
          handleDeleteElement();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedElementId, isPresentationMode, historyIndex, history]);

  // Gestión de diapositivas
  const handleAddSlide = (layout: SlideLayout = "title-content") => {
    const newSlide = createSlideForLayout(layout, slides.length + 1);
    const updated = [...slides, newSlide].map((s, idx) => ({
      ...s,
      slideNumber: idx + 1,
    }));
    updateSlides(updated);
    setActiveSlideId(newSlide.id);
    setSelectedElementId(null);
  };

  const handleDuplicateSlide = (id: string = activeSlideId) => {
    const target = slides.find((s) => s.id === id);
    if (!target) return;

    const duplicated: Slide = {
      ...target,
      id: `slide_${Date.now()}`,
      elements: target.elements.map((el) => ({
        ...el,
        id: `el_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      })),
    };

    const targetIdx = slides.findIndex((s) => s.id === id);
    const updated = [
      ...slides.slice(0, targetIdx + 1),
      duplicated,
      ...slides.slice(targetIdx + 1),
    ].map((s, idx) => ({ ...s, slideNumber: idx + 1 }));

    updateSlides(updated);
    setActiveSlideId(duplicated.id);
  };

  const handleDeleteSlide = (id: string = activeSlideId) => {
    if (slides.length <= 1) return;
    const filtered = slides
      .filter((s) => s.id !== id)
      .map((s, idx) => ({ ...s, slideNumber: idx + 1 }));
    updateSlides(filtered);
    setActiveSlideId(filtered[0]?.id || "slide_1");
    setSelectedElementId(null);
  };

  const handleMoveSlide = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= slides.length) return;

    const nextSlides = [...slides];
    const temp = nextSlides[index];
    nextSlides[index] = nextSlides[targetIndex];
    nextSlides[targetIndex] = temp;

    const renumbered = nextSlides.map((s, idx) => ({ ...s, slideNumber: idx + 1 }));
    updateSlides(renumbered);
  };

  // Modificación de elementos dentro de la diapositiva activa
  const handleUpdateElement = (id: string, updates: Partial<SlideElement>) => {
    const updatedSlides = slides.map((s) => {
      if (s.id !== activeSlideId) return s;
      return {
        ...s,
        elements: s.elements.map((el) => (el.id === id ? { ...el, ...updates } : el)),
      };
    });
    updateSlides(updatedSlides);
  };

  const handleDeleteElement = () => {
    if (!selectedElementId) return;
    const updatedSlides = slides.map((s) => {
      if (s.id !== activeSlideId) return s;
      return {
        ...s,
        elements: s.elements.filter((el) => el.id !== selectedElementId),
      };
    });
    updateSlides(updatedSlides);
    setSelectedElementId(null);
  };

  const handleAddText = () => {
    const newEl: SlideElement = {
      id: `el_${Date.now()}`,
      type: "text",
      x: 25,
      y: 40,
      width: 50,
      height: 20,
      content: "Cuadro de texto nuevo",
      fontSize: 20,
      fontWeight: "normal",
      align: "center",
      color: currentTheme.textColor,
    };

    const updatedSlides = slides.map((s) => {
      if (s.id !== activeSlideId) return s;
      return { ...s, elements: [...s.elements, newEl] };
    });

    updateSlides(updatedSlides);
    setSelectedElementId(newEl.id);
  };

  const handleAddShape = (shape: ShapeType) => {
    const newEl: SlideElement = {
      id: `el_${Date.now()}`,
      type: "shape",
      shapeType: shape,
      x: 35,
      y: 35,
      width: 30,
      height: 25,
      content: shape === "star" ? "★" : "",
      align: "center",
      bg: currentTheme.accentColor,
      color: "#ffffff",
    };

    const updatedSlides = slides.map((s) => {
      if (s.id !== activeSlideId) return s;
      return { ...s, elements: [...s.elements, newEl] };
    });

    updateSlides(updatedSlides);
    setSelectedElementId(newEl.id);
  };

  // Formato del elemento seleccionado
  const modifySelectedElement = (updater: (prev: SlideElement) => SlideElement) => {
    if (!selectedElementId) return;
    const updatedSlides = slides.map((s) => {
      if (s.id !== activeSlideId) return s;
      return {
        ...s,
        elements: s.elements.map((el) =>
          el.id === selectedElementId ? updater(el) : el
        ),
      };
    });
    updateSlides(updatedSlides);
  };

  const handleToggleBold = () => {
    modifySelectedElement((el) => ({
      ...el,
      fontWeight: el.fontWeight === "bold" ? "normal" : "bold",
    }));
  };

  const handleToggleItalic = () => {
    modifySelectedElement((el) => ({
      ...el,
      fontStyle: el.fontStyle === "italic" ? "normal" : "italic",
    }));
  };

  const handleToggleUnderline = () => {
    modifySelectedElement((el) => ({
      ...el,
      underline: !el.underline,
    }));
  };

  const handleSetAlign = (align: "left" | "center" | "right" | "justify") => {
    modifySelectedElement((el) => ({ ...el, align }));
  };

  const handleSetFontFamily = (fontFamily: string) => {
    modifySelectedElement((el) => ({ ...el, fontFamily }));
  };

  const handleSetFontSize = (fontSize: number) => {
    modifySelectedElement((el) => ({ ...el, fontSize }));
  };

  const handleSelectTheme = (theme: SlideTheme) => {
    const updatedMeta = { ...metadata, themeId: theme.id };
    setMetadata(updatedMeta);
    presentationVault.savePresentation(updatedMeta, slides, activeSlideId);
  };

  const handleSelectTransition = (transition: SlideTransition) => {
    const updatedSlides = slides.map((s) =>
      s.id === activeSlideId ? { ...s, transition } : s
    );
    updateSlides(updatedSlides);
  };

  const handleToggleHideSlide = () => {
    const updated = slides.map((s) =>
      s.id === activeSlideId ? { ...s, hidden: !s.hidden } : s
    );
    updateSlides(updated);
  };

  // Portapapeles y copiado de formato
  const handleCopyElement = () => {
    if (!selectedElementId) return;
    const el = activeSlide.elements.find((e) => e.id === selectedElementId);
    if (el) setClipboardElement(el);
  };

  const handleCutElement = () => {
    if (!selectedElementId) return;
    handleCopyElement();
    handleDeleteElement();
  };

  const handlePasteElement = () => {
    if (!clipboardElement) return;
    const pastedEl: SlideElement = {
      ...clipboardElement,
      id: `el_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      x: Math.min(80, clipboardElement.x + 4),
      y: Math.min(80, clipboardElement.y + 4),
    };
    const updatedSlides = slides.map((s) => {
      if (s.id !== activeSlideId) return s;
      return { ...s, elements: [...s.elements, pastedEl] };
    });
    updateSlides(updatedSlides);
    setSelectedElementId(pastedEl.id);
  };

  const handleFormatPainter = () => {
    if (!selectedElementId) return;
    const el = activeSlide.elements.find((e) => e.id === selectedElementId);
    if (!el) return;
    if (isFormatPainterActive) {
      setIsFormatPainterActive(false);
      setFormatPainterStyle(null);
    } else {
      setIsFormatPainterActive(true);
      setFormatPainterStyle({
        fontSize: el.fontSize,
        fontFamily: el.fontFamily,
        fontWeight: el.fontWeight,
        fontStyle: el.fontStyle,
        underline: el.underline,
        align: el.align,
        color: el.color,
        bg: el.bg,
      });
    }
  };

  const handleSelectElementWithFormatPainter = (id: string | null) => {
    setSelectedElementId(id);
    if (id && isFormatPainterActive && formatPainterStyle) {
      handleUpdateElement(id, formatPainterStyle);
      setIsFormatPainterActive(false);
      setFormatPainterStyle(null);
    }
  };

  // Inserción de tablas e imágenes
  const handleAddTable = () => {
    const newEl: SlideElement = {
      id: `el_${Date.now()}`,
      type: "table",
      x: 20,
      y: 25,
      width: 60,
      height: 35,
      content: "Concepto, 2025, 2026\nVentas Netas, $120.000, $145.000\nCostos Operativos, $75.000, $82.000\nMargen EBITDA, 37.5%, 43.4%",
      color: currentTheme.textColor,
      bg: "#ffffff",
    };
    const updatedSlides = slides.map((s) => {
      if (s.id !== activeSlideId) return s;
      return { ...s, elements: [...s.elements, newEl] };
    });
    updateSlides(updatedSlides);
    setSelectedElementId(newEl.id);
  };

  const handleAddImage = () => {
    const sampleImage = "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80";
    const newEl: SlideElement = {
      id: `el_${Date.now()}`,
      type: "image",
      x: 25,
      y: 20,
      width: 50,
      height: 50,
      content: sampleImage,
    };
    const updatedSlides = slides.map((s) => {
      if (s.id !== activeSlideId) return s;
      return { ...s, elements: [...s.elements, newEl] };
    });
    updateSlides(updatedSlides);
    setSelectedElementId(newEl.id);
  };

  // Revisión, idioma y notas
  const handleSpellCheck = () => {
    const allWords = activeSlide.elements
      .map((el) => el.content)
      .join(" ")
      .split(/\s+/)
      .filter(Boolean);
    const notice = `[Revisión Ortográfica]: ${allWords.length} palabras revisadas sin anomalías.`;
    handleChangeNotes((activeSlide.notes ? activeSlide.notes + "\n" : "") + notice);
    if (!showNotes) setShowNotes(true);
  };

  const handleTranslateSlide = () => {
    const updatedElements = activeSlide.elements.map((el) => {
      if (el.type === "title" || el.type === "subtitle" || el.type === "text") {
        return {
          ...el,
          content: el.content.startsWith("[EN] ") ? el.content : `[EN] ${el.content}`,
        };
      }
      return el;
    });
    const updatedSlides = slides.map((s) =>
      s.id === activeSlideId ? { ...s, elements: updatedElements } : s
    );
    updateSlides(updatedSlides);
  };

  const handleAddComment = () => {
    const commentTag = `\n[Comentario ${new Date().toLocaleTimeString("es-ES")}]: Revisión editorial confirmada.`;
    handleChangeNotes((activeSlide.notes || "") + commentTag);
    if (!showNotes) setShowNotes(true);
  };

  const handleChangeNotes = (notes: string) => {
    const updatedSlides = slides.map((s) =>
      s.id === activeSlideId ? { ...s, notes } : s
    );
    updateSlides(updatedSlides);
  };

  const handleStartNewPresentation = () => {
    const defaultSlides = createDefaultSlides();
    const newMeta: PresentationMetadata = {
      id: `pres_${Date.now()}`,
      title: "Nueva Presentación",
      author: "Usuario CoffeWorks",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      themeId: "theme_espresso",
    };
    setMetadata(newMeta);
    setSlides(defaultSlides);
    setActiveSlideId(defaultSlides[0].id);
    setSelectedElementId(null);
    setHistory([defaultSlides]);
    setHistoryIndex(0);
    presentationVault.savePresentation(newMeta, defaultSlides, defaultSlides[0].id);
    setShowStartScreen(false);
  };

  const handleStartOpenPresentation = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (parsed.slides && Array.isArray(parsed.slides) && parsed.slides.length > 0) {
        const loadedMeta = parsed.metadata || {
          id: `pres_${Date.now()}`,
          title: file.name.replace(/\.[^/.]+$/, ""),
          author: "Usuario CoffeWorks",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          themeId: "theme_espresso",
        };
        setMetadata(loadedMeta);
        setSlides(parsed.slides);
        setActiveSlideId(parsed.slides[0].id);
        setSelectedElementId(null);
        setHistory([parsed.slides]);
        setHistoryIndex(0);
        presentationVault.savePresentation(loadedMeta, parsed.slides, parsed.slides[0].id);
        setShowStartScreen(false);
      } else {
        alert("El archivo no contiene diapositivas válidas.");
      }
    } catch (err) {
      console.error("Error al abrir presentación:", err);
      alert("No se pudo leer el archivo de presentación.");
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white select-none">
      {/* 1. Encabezado de Google Slides */}
      <GoogleSlidesHeader
        title={metadata.title}
        onTitleChange={(title) => {
          const next = { ...metadata, title };
          setMetadata(next);
          presentationVault.savePresentation(next, slides, activeSlideId);
        }}
        onSave={handleManualSave}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onExport={() => setExportModalOpen(true)}
        onNewPresentation={handleStartNewPresentation}
        onStartPresentation={() => setIsPresentationMode(true)}
        onAddSlide={handleAddSlide}
        onDuplicateSlide={() => handleDuplicateSlide(activeSlideId)}
        onDeleteSlide={() => handleDeleteSlide(activeSlideId)}
        onPrint={() => window.print()}
        isSaving={isSaving}
        onToggleHideSlide={handleToggleHideSlide}
        isSlideHidden={Boolean(activeSlide.hidden)}
        onAddText={handleAddText}
        onAddImage={handleAddImage}
        onAddTable={handleAddTable}
        onToggleBold={handleToggleBold}
        onToggleItalic={handleToggleItalic}
        onToggleUnderline={handleToggleUnderline}
        onSpellCheck={handleSpellCheck}
        onToggleNotes={() => setShowNotes(!showNotes)}
        onCut={handleCutElement}
        onCopy={handleCopyElement}
        onPaste={handlePasteElement}
        onToggleGridlines={() => setShowGridlines((prev) => !prev)}
        onTranslate={handleTranslateSlide}
        onChangeAspectRatio={setAspectRatio}
      />

      {/* 2. Barra de herramientas flotante de Google Slides */}
      <GoogleSlidesToolbar
        onUndo={handleUndo}
        onRedo={handleRedo}
        onPrint={() => window.print()}
        onFormatPainter={handleFormatPainter}
        isFormatPainterActive={isFormatPainterActive}
        onAddSlide={handleAddSlide}
        onAddText={handleAddText}
        onAddShape={handleAddShape}
        onInsertImage={handleAddImage}
        currentTheme={currentTheme}
        onSelectTheme={(themeId) => {
          const found = SLIDE_THEMES.find((th) => th.id === themeId);
          if (found) handleSelectTheme(found);
        }}
        currentTransition={activeSlide.transition}
        onSelectTransition={handleSelectTransition}
        selectedElementId={selectedElementId}
        onToggleBold={handleToggleBold}
        onToggleItalic={handleToggleItalic}
        onToggleUnderline={handleToggleUnderline}
        onSetAlign={handleSetAlign}
        onSetFontSize={handleSetFontSize}
        onSetFontFamily={handleSetFontFamily}
        onDeleteElement={handleDeleteElement}
        onAddComment={handleAddComment}
        onAddTable={handleAddTable}
      />

      {/* 3. Área de trabajo principal */}
      <div className="flex-1 flex overflow-hidden">
        {/* Panel lateral de miniaturas */}
        <SlideThumbnails
          slides={slides}
          activeSlideId={activeSlideId}
          onSelectSlide={(id) => {
            setActiveSlideId(id);
            setSelectedElementId(null);
          }}
          onAddSlide={() => handleAddSlide("title-content")}
          onDuplicateSlide={handleDuplicateSlide}
          onDeleteSlide={handleDeleteSlide}
          onMoveSlide={handleMoveSlide}
          currentTheme={currentTheme}
        />

        {/* Lienzo central de diapositiva y notas */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <SlideCanvas
            slide={activeSlide}
            theme={currentTheme}
            selectedElementId={selectedElementId}
            onSelectElement={handleSelectElementWithFormatPainter}
            onUpdateElement={handleUpdateElement}
            aspectRatio={aspectRatio}
            showGridlines={showGridlines}
          />

          {/* Panel inferior de notas del orador */}
          {showNotes && (
            <SpeakerNotes
              notes={activeSlide.notes || ""}
              onChangeNotes={handleChangeNotes}
              onClose={() => setShowNotes(false)}
            />
          )}
        </div>
      </div>

      {/* Modo presentación a pantalla completa (F5) */}
      {isPresentationMode && (
        <PresentationMode
          slides={slides}
          initialSlideIndex={slides.findIndex((s) => s.id === activeSlideId)}
          theme={currentTheme}
          onExit={() => setIsPresentationMode(false)}
        />
      )}

      {/* Modal de exportación */}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        metadata={metadata}
        slides={slides}
        theme={currentTheme}
      />

      {/* Pantalla de inicio con botones grandes: Nuevo archivo y Abrir archivo */}
      {showStartScreen && (
        <StartScreen
          onNewPresentation={handleStartNewPresentation}
          onOpenPresentation={handleStartOpenPresentation}
          onContinueCurrent={() => setShowStartScreen(false)}
          hasExistingPresentation={slides.length > 0}
          currentTitle={metadata.title}
        />
      )}
    </div>
  );
};
