import React, { useRef, useState, useEffect } from "react";
import {
  Plus,
  X,
  Presentation,
  Image as ImageIcon,
  Film,
  Upload,
  Video,
  Sparkles,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Play,
  Pause,
  RotateCcw,
  Palette,
  LayoutTemplate,
  Clock,
  Sparkle,
  Type,
  AlignLeft,
} from "lucide-react";
import type { Slide, SlideElement, SlideTheme, SlideLayout } from "../types";

interface UploadedAsset {
  id: string;
  name: string;
  dataUrl: string;
  size: string;
}

interface SlideCanvasProps {
  slide: Slide;
  theme: SlideTheme;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onUpdateElement: (id: string, updates: Partial<SlideElement>) => void;
  aspectRatio?: "16:9" | "4:3";
  showGridlines?: boolean;
  onAddSlide?: (layout?: SlideLayout) => void;
  onDuplicateSlide?: (id?: string) => void;
  onDeleteSlide?: (id?: string) => void;
  onToggleHideSlide?: () => void;
  onAddImage?: (url?: string) => void;
  onAddMedia?: (url?: string) => void;
  onChangeLayout?: (layout: SlideLayout) => void;
  onSetSlideBackground?: (color: string, applyToAll: boolean) => void;
  onTransformSlide?: (type: "bullets" | "align" | "contrast" | "invert" | "title") => void;
  slidesCount?: number;
  currentSlideIndex?: number;
}

type SidebarTab = "diapositiva" | "imagen" | "multimedia" | "cargas" | "grabar" | "transformar";

export const SlideCanvas: React.FC<SlideCanvasProps> = ({
  slide,
  theme,
  selectedElementId,
  onSelectElement,
  onUpdateElement,
  aspectRatio = "16:9",
  showGridlines = false,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onToggleHideSlide,
  onAddImage,
  onAddMedia,
  onChangeLayout,
  onSetSlideBackground,
  onTransformSlide,
  slidesCount = 1,
  currentSlideIndex: _currentSlideIndex = 0,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadsInputRef = useRef<HTMLInputElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPill, setShowPill] = useState(true);
  const [activeTab, setActiveTab] = useState<SidebarTab | null>(null);

  // Estados de Imagen
  const [imageUrlInput, setImageUrlInput] = useState("");

  // Estados de Multimedia
  const [videoUrlInput, setVideoUrlInput] = useState("");

  // Estados de Cargas
  const [uploadedAssets, setUploadedAssets] = useState<UploadedAsset[]>([
    {
      id: "sample_logo",
      name: "Logo_Corporativo.png",
      dataUrl: "https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?auto=format&fit=crop&w=300&q=80",
      size: "42 KB",
    },
  ]);

  // Estados de Grabación / Ensayo
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [slideTimings, setSlideTimings] = useState<{ [slideNum: number]: number }>({});

  useEffect(() => {
    let interval: any = null;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
        setSlideTimings((prev) => ({
          ...prev,
          [slide.slideNumber]: (prev[slide.slideNumber] || 0) + 1,
        }));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording, slide.slideNumber]);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      onSelectElement(null);
      setEditingId(null);
    }
  };

  const isWide = aspectRatio === "16:9";

  // Marcas de centímetros para la regla horizontal y vertical
  const hMarks = Array.from({ length: 26 }, (_, i) => i + 1);
  const vMarks = Array.from({ length: 14 }, (_, i) => i + 1);

  // Manejador de subida de imágenes
  const handleLocalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          onAddImage?.(result);
          // Registrar también en cargas
          const newAsset: UploadedAsset = {
            id: `asset_${Date.now()}`,
            name: file.name,
            dataUrl: result,
            size: `${Math.round(file.size / 1024)} KB`,
          };
          setUploadedAssets((prev) => [newAsset, ...prev]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Manejador de subida en la sección de Cargas
  const handleUploadsFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          if (result) {
            const newAsset: UploadedAsset = {
              id: `asset_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
              name: file.name,
              dataUrl: result,
              size: `${Math.round(file.size / 1024)} KB`,
            };
            setUploadedAssets((prev) => [newAsset, ...prev]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  // Imágenes de stock rápidas
  const stockImages = [
    {
      title: "Negocios y Finanzas",
      url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=700&q=80",
    },
    {
      title: "Oficina y Equipo",
      url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=700&q=80",
    },
    {
      title: "Tecnología y Código",
      url: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=700&q=80",
    },
    {
      title: "Café de Especialidad",
      url: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=700&q=80",
    },
    {
      title: "Arquitectura Minimalista",
      url: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=700&q=80",
    },
    {
      title: "Naturaleza y Paisaje",
      url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=700&q=80",
    },
  ];

  return (
    <div className="flex-1 flex overflow-hidden bg-[#f0f4f9] relative">
      {/* Input oculto para subida de imágenes */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleLocalImageUpload}
      />

      {/* Input oculto para subida múltiple en Cargas */}
      <input
        ref={uploadsInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleUploadsFiles}
      />

      {/* Regla Vertical a la izquierda */}
      <div className="w-5 bg-white border-r border-[#e1dfdd] select-none flex flex-col justify-around py-8 items-end pr-1 text-[8px] text-[#747775] font-mono shrink-0">
        {vMarks.map((m) => (
          <div key={m} className="flex items-center gap-0.5">
            <span>{m % 2 === 0 ? m : ""}</span>
            <div className={`h-px bg-gray-300 ${m % 2 === 0 ? "w-2" : "w-1"}`} />
          </div>
        ))}
      </div>

      {/* Área Central: Regla horizontal superior + Lienzo de diapositiva */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Regla Horizontal superior con borde inferior nítido */}
        <div className="h-5 bg-white border-b border-[#e1dfdd] select-none flex justify-around px-12 items-end pb-0.5 text-[8px] text-[#747775] font-mono shrink-0 shadow-2xs z-10">
          {hMarks.map((m) => (
            <div key={m} className="flex flex-col items-center">
              <span>{m % 2 === 0 ? m : ""}</span>
              <div className={`w-px bg-gray-300 ${m % 2 === 0 ? "h-2" : "h-1"}`} />
            </div>
          ))}
        </div>

        {/* Área del lienzo central con scroll controlado y margen superior holgado (nunca pegado a la regla) */}
        <div
          className="flex-1 overflow-auto flex flex-col items-center px-6 py-8 select-none relative bg-[#f8fafd]"
          onClick={handleCanvasClick}
        >
          {/* Contenedor con margen superior explícito para garantizar separación visual con la regla */}
          <div className="my-auto mt-6 mb-8 flex flex-col items-center shrink-0">
            {/* Contenedor principal de la Diapositiva con sombra elegante y bordes exactos */}
            <div
              ref={canvasRef}
              onClick={handleCanvasClick}
              style={{
                backgroundColor: slide.background || theme.slideBg,
                backgroundImage: showGridlines
                  ? "linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)"
                  : undefined,
                backgroundSize: showGridlines ? "24px 24px" : undefined,
              }}
              className={`${
                isWide ? "w-[920px] h-[517px] aspect-video" : "w-[720px] h-[540px] aspect-[4/3]"
              } max-w-[calc(100vw-360px)] rounded-xs relative shadow-[0_2px_6px_rgba(60,64,67,0.15),0_8px_24px_rgba(60,64,67,0.12)] border border-[#dadce0] overflow-hidden transition-all shrink-0 bg-white`}
            >
              {/* Banner de diapositiva oculta */}
              {slide.hidden && (
                <div className="absolute top-2 left-2 z-30 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-mono tracking-wider flex items-center gap-1.5">
                  <EyeOff size={11} />
                  <span>Oculta de la proyección</span>
                </div>
              )}

              {/* Elementos dentro de la Diapositiva */}
              {slide.elements.length === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-12 gap-6 pointer-events-none">
                  <div className="border border-dashed border-gray-300 hover:border-[#1a73e8] p-6 w-full max-w-2xl text-center rounded">
                    <h1 className="text-4xl font-bold text-[#1f1f1f] tracking-tight">
                      Haz clic para agregar un título
                    </h1>
                  </div>
                  <div className="border border-dashed border-gray-300 hover:border-[#1a73e8] p-4 w-full max-w-xl text-center rounded">
                    <p className="text-lg text-[#444746] font-normal">
                      Haz clic para agregar un subtítulo
                    </p>
                  </div>
                </div>
              ) : (
                slide.elements.map((el) => {
                  const isSelected = el.id === selectedElementId;
                  const isEditing = el.id === editingId;

                  const defaultPlaceholder =
                    el.type === "title"
                      ? "Haz clic para agregar un título"
                      : el.type === "subtitle"
                      ? "Haz clic para agregar un subtítulo"
                      : "Haz clic para escribir texto...";

                  return (
                    <div
                      key={el.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectElement(el.id);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        onSelectElement(el.id);
                        setEditingId(el.id);
                      }}
                      style={{
                        left: `${el.x}%`,
                        top: `${el.y}%`,
                        width: `${el.width}%`,
                        height: `${el.height}%`,
                        color: el.color || (el.type === "title" ? theme.titleColor : theme.textColor),
                        backgroundColor: el.bg || (el.type === "shape" ? theme.accentColor : "transparent"),
                        textAlign: el.align || "center",
                        fontWeight: el.fontWeight || (el.type === "title" ? "bold" : "normal"),
                        fontStyle: el.fontStyle || "normal",
                        textDecoration: el.underline ? "underline" : "none",
                        fontSize: `${el.fontSize || (el.type === "title" ? 40 : 20)}px`,
                        fontFamily: el.fontFamily || "Arial, sans-serif",
                        borderRadius:
                          el.shapeType === "circle"
                            ? "50%"
                            : el.shapeType === "rounded"
                            ? "16px"
                            : undefined,
                      }}
                      className={`absolute flex flex-col justify-center p-3 rounded-xs cursor-move transition-shadow ${
                        isSelected
                          ? "outline-2 outline-solid outline-[#1a73e8] ring-1 ring-white/50"
                          : "hover:outline-1 hover:outline-dashed hover:outline-gray-300"
                      }`}
                    >
                      {el.type === "image" ? (
                        <div className="w-full h-full flex items-center justify-center overflow-hidden rounded">
                          {el.content && (el.content.startsWith("http") || el.content.startsWith("data:")) ? (
                            <img
                              src={el.content}
                              alt="Diapositiva"
                              className="w-full h-full object-contain pointer-events-none"
                            />
                          ) : (
                            <div className="w-full h-full border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center p-2 text-gray-500 bg-gray-50">
                              <span className="text-xs font-semibold">{el.content || "Imagen"}</span>
                            </div>
                          )}
                        </div>
                      ) : el.type === "video" ? (
                        <div className="w-full h-full flex items-center justify-center overflow-hidden rounded bg-black/5">
                          {el.content.includes("youtube.com") || el.content.includes("youtu.be") ? (
                            <iframe
                              src={el.content.replace("watch?v=", "embed/")}
                              title="Video"
                              className="w-full h-full border-0 pointer-events-none rounded"
                            />
                          ) : (
                            <video
                              src={el.content}
                              controls
                              className="w-full h-full rounded object-contain"
                            />
                          )}
                        </div>
                      ) : isEditing ? (
                        <textarea
                          value={el.content}
                          onChange={(e) => onUpdateElement(el.id, { content: e.target.value })}
                          onBlur={() => setEditingId(null)}
                          autoFocus
                          className="w-full h-full bg-transparent text-inherit font-inherit resize-none focus:outline-none border-none p-0 select-text"
                          style={{ textAlign: el.align || "center" }}
                        />
                      ) : (
                        <div
                          className="w-full h-full whitespace-pre-wrap leading-tight break-words overflow-hidden pointer-events-none flex items-center justify-center"
                          style={{ textAlign: el.align || "center" }}
                        >
                          {el.content || (
                            <span className="text-gray-400 font-normal">{defaultPlaceholder}</span>
                          )}
                        </div>
                      )}

                      {isSelected && !isEditing && (
                        <>
                          <div className="element-handle -top-1 -left-1" />
                          <div className="element-handle -top-1 -right-1" />
                          <div className="element-handle -bottom-1 -left-1" />
                          <div className="element-handle -bottom-1 -right-1" />
                        </>
                      )}
                    </div>
                  );
                })
              )}

              <div
                style={{ color: theme.textColor }}
                className="absolute bottom-2 right-4 font-mono text-[10px] opacity-40 select-none pointer-events-none"
              >
                {slide.slideNumber}
              </div>
            </div>

            {/* Botón flotante inferior idéntico a la imagen 2: '+ Crear una diapositiva' */}
            {showPill && (
              <div className="mt-5 flex items-center gap-2 bg-[#edf2fa] hover:bg-[#e2e8f0] text-[#1a73e8] hover:text-[#1557b0] text-xs font-medium px-4 py-1.5 rounded-full shadow-xs border border-gray-200/80 transition-all select-none">
                <button
                  type="button"
                  onClick={() => onAddSlide?.("title-content")}
                  className="flex items-center gap-1.5 cursor-pointer text-[#1a73e8] hover:text-[#1557b0] font-medium"
                >
                  <Plus size={15} className="text-[#1a73e8]" />
                  <span className="text-xs">Crear una diapositiva</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPill(false)}
                  className="ml-1 p-0.5 hover:bg-gray-300/60 rounded-full text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
                  title="Cerrar sugerencia"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Panel Lateral Desplegable de Herramientas para la barra lateral derecha */}
      {activeTab && (
        <aside className="w-80 bg-white border-l border-[#e1dfdd] flex flex-col h-full shadow-lg z-20 animate-in slide-in-from-right-2 duration-150 select-none shrink-0 text-[#1f1f1f]">
          {/* Cabecera del Panel */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              {activeTab === "diapositiva" && <Presentation size={17} className="text-[#1a73e8]" />}
              {activeTab === "imagen" && <ImageIcon size={17} className="text-[#1a73e8]" />}
              {activeTab === "multimedia" && <Film size={17} className="text-[#1a73e8]" />}
              {activeTab === "cargas" && <Upload size={17} className="text-[#1a73e8]" />}
              {activeTab === "grabar" && <Video size={17} className="text-[#ea4335]" />}
              {activeTab === "transformar" && <Sparkles size={17} className="text-[#1a73e8]" />}

              <h2 className="text-xs font-semibold text-[#1f1f1f] uppercase tracking-wide">
                {activeTab === "diapositiva" && "Diapositiva"}
                {activeTab === "imagen" && "Insertar Imagen"}
                {activeTab === "multimedia" && "Contenido Multimedia"}
                {activeTab === "cargas" && "Cargas y Recursos"}
                {activeTab === "grabar" && "Estudio de Grabación"}
                {activeTab === "transformar" && "Transformar Diapositiva"}
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab(null)}
              className="p-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors"
              title="Cerrar panel"
            >
              <X size={16} />
            </button>
          </div>

          {/* Contenido del Panel según la pestaña seleccionada */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 text-xs text-[#444746]">
            {/* 1. DIAPOSITIVA */}
            {activeTab === "diapositiva" && (
              <>
                <div className="flex flex-col gap-2">
                  <label className="font-semibold text-[#1f1f1f] flex items-center gap-1.5">
                    <LayoutTemplate size={14} className="text-[#1a73e8]" />
                    <span>Diseño de diapositiva</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {[
                      { id: "title", label: "Título" },
                      { id: "title-content", label: "Título y contenido" },
                      { id: "two-columns", label: "Dos columnas" },
                      { id: "blank", label: "En blanco" },
                    ].map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => onChangeLayout?.(l.id as SlideLayout)}
                        className={`p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                          slide.layout === l.id
                            ? "border-[#1a73e8] bg-blue-50/60 font-semibold text-[#1a73e8]"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-[#444746]"
                        }`}
                      >
                        <span className="text-xs">{l.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2 border-t pt-4">
                  <label className="font-semibold text-[#1f1f1f] flex items-center gap-1.5">
                    <Palette size={14} className="text-[#1a73e8]" />
                    <span>Fondo de la diapositiva</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={slide.background || theme.slideBg}
                      onChange={(e) => onSetSlideBackground?.(e.target.value, false)}
                      className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0.5"
                      title="Elegir color personalizado"
                    />
                    <span className="font-mono text-xs text-gray-600 uppercase">
                      {slide.background || theme.slideBg}
                    </span>
                  </div>

                  <div className="grid grid-cols-8 gap-1.5 mt-1">
                    {[
                      "#ffffff",
                      "#f8f9fa",
                      "#e8eaed",
                      "#dadce0",
                      "#fce8e6",
                      "#fef7e0",
                      "#e6f4ea",
                      "#e8f0fe",
                      "#202124",
                      "#1e140f",
                      "#2b2523",
                      "#3c4043",
                      "#ea4335",
                      "#fbbc04",
                      "#34a853",
                      "#1a73e8",
                    ].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => onSetSlideBackground?.(c, false)}
                        style={{ backgroundColor: c }}
                        className="w-5 h-5 rounded-full border border-gray-300 hover:scale-110 transition-transform shadow-2xs"
                        title={c}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2 border-t pt-4">
                  <label className="font-semibold text-[#1f1f1f]">Acciones de diapositiva</label>
                  <button
                    type="button"
                    onClick={() => onAddSlide?.("title-content")}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[#edf2fa] hover:bg-[#e2e8f0] text-[#1a73e8] font-medium transition-colors"
                  >
                    <Plus size={15} />
                    <span>Nueva diapositiva</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDuplicateSlide?.(slide.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-[#1f1f1f] transition-colors"
                  >
                    <Copy size={15} />
                    <span>Duplicar diapositiva</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleHideSlide?.()}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-[#1f1f1f] transition-colors"
                  >
                    {slide.hidden ? <Eye size={15} /> : <EyeOff size={15} />}
                    <span>{slide.hidden ? "Mostrar en presentación" : "Ocultar en presentación"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSlide?.(slide.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 transition-colors"
                  >
                    <Trash2 size={15} />
                    <span>Eliminar diapositiva</span>
                  </button>
                </div>
              </>
            )}

            {/* 2. IMAGEN */}
            {activeTab === "imagen" && (
              <>
                <div className="flex flex-col gap-2">
                  <label className="font-semibold text-[#1f1f1f]">Subir desde tu equipo</label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium transition-colors cursor-pointer"
                  >
                    <Upload size={15} />
                    <span>Seleccionar archivo de imagen</span>
                  </button>
                  <span className="text-[10px] text-gray-500">Soporta PNG, JPG, WebP y SVG.</span>
                </div>

                <div className="flex flex-col gap-2 border-t pt-4">
                  <label className="font-semibold text-[#1f1f1f]">Insertar por enlace web (URL)</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="url"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      placeholder="https://ejemplo.com/foto.jpg"
                      className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#1a73e8]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (imageUrlInput.trim()) {
                          onAddImage?.(imageUrlInput.trim());
                          setImageUrlInput("");
                        }
                      }}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-[#1f1f1f] font-medium rounded-lg transition-colors cursor-pointer"
                    >
                      Insertar
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 border-t pt-4">
                  <label className="font-semibold text-[#1f1f1f]">Galería de imágenes de muestra</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {stockImages.map((img, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => onAddImage?.(img.url)}
                        className="group flex flex-col rounded-lg border border-gray-200 overflow-hidden hover:border-[#1a73e8] transition-all text-left cursor-pointer"
                        title={`Insertar ${img.title}`}
                      >
                        <div className="w-full h-16 bg-gray-100 overflow-hidden">
                          <img
                            src={img.url}
                            alt={img.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                        <span className="p-1.5 text-[10px] font-medium text-gray-700 truncate">
                          {img.title}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* 3. MULTIMEDIA */}
            {activeTab === "multimedia" && (
              <>
                <div className="flex flex-col gap-2">
                  <label className="font-semibold text-[#1f1f1f]">Insertar Video (Web / YouTube)</label>
                  <div className="flex flex-col gap-2">
                    <input
                      type="url"
                      value={videoUrlInput}
                      onChange={(e) => setVideoUrlInput(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#1a73e8]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (videoUrlInput.trim()) {
                          onAddMedia?.(videoUrlInput.trim());
                          setVideoUrlInput("");
                        }
                      }}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium rounded-lg transition-colors cursor-pointer"
                    >
                      <Film size={14} />
                      <span>Insertar video en diapositiva</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 border-t pt-4">
                  <label className="font-semibold text-[#1f1f1f]">Videos de muestra para presentación</label>
                  <div className="flex flex-col gap-2">
                    {[
                      {
                        label: "Demostración de Producto (MP4)",
                        url: "https://www.w3schools.com/html/mov_bbb.mp4",
                      },
                      {
                        label: "Animación de Gráficos Financieros",
                        url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
                      },
                    ].map((vid, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onAddMedia?.(vid.url)}
                        className="p-2.5 rounded-lg border border-gray-200 hover:border-[#1a73e8] hover:bg-blue-50/50 text-left flex items-center justify-between text-xs transition-colors cursor-pointer"
                      >
                        <span className="font-medium text-gray-800">{vid.label}</span>
                        <Play size={13} className="text-[#1a73e8]" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2 border-t pt-4">
                  <label className="font-semibold text-[#1f1f1f]">Configuración de reproducción</label>
                  <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                    <input type="checkbox" defaultChecked className="rounded text-[#1a73e8]" />
                    <span>Mostrar controles de reproducción integrados</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                    <input type="checkbox" className="rounded text-[#1a73e8]" />
                    <span>Iniciar automáticamente al presentar</span>
                  </label>
                </div>
              </>
            )}

            {/* 4. CARGAS */}
            {activeTab === "cargas" && (
              <>
                <div className="flex flex-col gap-2">
                  <label className="font-semibold text-[#1f1f1f]">Cargar archivos y recursos</label>
                  <div
                    onClick={() => uploadsInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 hover:border-[#1a73e8] rounded-xl p-5 flex flex-col items-center justify-center gap-2 bg-gray-50/80 hover:bg-blue-50/30 cursor-pointer transition-colors"
                  >
                    <div className="p-2.5 rounded-full bg-blue-100 text-[#1a73e8]">
                      <Upload size={18} />
                    </div>
                    <span className="font-medium text-xs text-[#1f1f1f] text-center">
                      Haz clic para subir o arrastra archivos aquí
                    </span>
                    <span className="text-[10px] text-gray-500">Imágenes, logotipos e íconos</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-[#1f1f1f]">
                      Archivos cargados ({uploadedAssets.length})
                    </label>
                    <span className="text-[10px] text-gray-500">Clic para insertar</span>
                  </div>

                  <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                    {uploadedAssets.map((asset) => (
                      <div
                        key={asset.id}
                        className="flex items-center justify-between p-2 rounded-lg border border-gray-200 hover:border-[#1a73e8] bg-white group transition-colors"
                      >
                        <div
                          onClick={() => onAddImage?.(asset.dataUrl)}
                          className="flex items-center gap-2 flex-1 cursor-pointer overflow-hidden"
                          title="Insertar en la diapositiva"
                        >
                          <img
                            src={asset.dataUrl}
                            alt={asset.name}
                            className="w-9 h-9 object-cover rounded border border-gray-100 shrink-0"
                          />
                          <div className="flex flex-col truncate">
                            <span className="text-xs font-medium text-gray-800 truncate">
                              {asset.name}
                            </span>
                            <span className="text-[10px] text-gray-500">{asset.size}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setUploadedAssets((prev) => prev.filter((a) => a.id !== asset.id))
                          }
                          className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                          title="Eliminar de cargas"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* 5. GRABAR / ESTUDIO DE ENSAYO */}
            {activeTab === "grabar" && (
              <>
                <div className="flex flex-col items-center justify-center p-5 bg-gray-50 rounded-xl border border-gray-200 gap-3">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className={isRecording ? "text-red-500 animate-pulse" : "text-gray-500"} />
                    <span className="font-mono text-2xl font-bold tracking-wider text-[#1f1f1f]">
                      {formatTimer(recordSeconds)}
                    </span>
                  </div>

                  <span className="text-[11px] font-medium text-gray-600">
                    {isRecording ? "Grabando ensayo en tiempo real..." : "Estudio de ensayo detenido"}
                  </span>

                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setIsRecording(!isRecording)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-medium text-xs transition-colors cursor-pointer ${
                        isRecording
                          ? "bg-amber-500 hover:bg-amber-600 text-white"
                          : "bg-[#ea4335] hover:bg-[#d93025] text-white"
                      }`}
                    >
                      {isRecording ? <Pause size={14} /> : <Play size={14} />}
                      <span>{isRecording ? "Pausar ensayo" : "Iniciar grabación"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsRecording(false);
                        setRecordSeconds(0);
                        setSlideTimings({});
                      }}
                      className="p-2 border border-gray-300 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
                      title="Reiniciar cronómetro"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 border-t pt-4">
                  <label className="font-semibold text-[#1f1f1f]">Tiempo por diapositiva</label>
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                    {Array.from({ length: slidesCount }).map((_, idx) => {
                      const num = idx + 1;
                      const time = slideTimings[num] || 0;
                      const isCurrent = slide.slideNumber === num;
                      return (
                        <div
                          key={num}
                          className={`flex items-center justify-between p-2 rounded-lg text-xs ${
                            isCurrent
                              ? "bg-blue-50 border border-[#1a73e8] font-semibold text-[#1a73e8]"
                              : "border border-gray-100 text-gray-700 bg-white"
                          }`}
                        >
                          <span>Diapositiva {num} {isCurrent && "(activa)"}</span>
                          <span className="font-mono">{formatTimer(time)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* 6. TRANSFORMAR */}
            {activeTab === "transformar" && (
              <>
                <div className="flex flex-col gap-2">
                  <label className="font-semibold text-[#1f1f1f]">
                    Acciones de Diseño y Transformación
                  </label>
                  <p className="text-[11px] text-gray-500">
                    Aplica mejoras automáticas de diagramación, formato y estilo con 1 solo clic.
                  </p>

                  <div className="flex flex-col gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => onTransformSlide?.("bullets")}
                      className="p-3 rounded-lg border border-gray-200 hover:border-[#1a73e8] hover:bg-blue-50/50 flex items-start gap-2.5 text-left transition-colors cursor-pointer"
                    >
                      <AlignLeft size={16} className="text-[#1a73e8] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-gray-800 block text-xs">
                          Estructurar en Viñetas
                        </span>
                        <span className="text-[10px] text-gray-500">
                          Convierte bloques de texto en viñetas ejecutivas concisas y fáciles de leer.
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => onTransformSlide?.("align")}
                      className="p-3 rounded-lg border border-gray-200 hover:border-[#1a73e8] hover:bg-blue-50/50 flex items-start gap-2.5 text-left transition-colors cursor-pointer"
                    >
                      <LayoutTemplate size={16} className="text-[#1a73e8] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-gray-800 block text-xs">
                          Alinear y Equilibrar
                        </span>
                        <span className="text-[10px] text-gray-500">
                          Centra y distribuye armónicamente el título y los textos en el lienzo.
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => onTransformSlide?.("contrast")}
                      className="p-3 rounded-lg border border-gray-200 hover:border-[#1a73e8] hover:bg-blue-50/50 flex items-start gap-2.5 text-left transition-colors cursor-pointer"
                    >
                      <Sparkle size={16} className="text-[#1a73e8] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-gray-800 block text-xs">
                          Contraste de Alto Impacto
                        </span>
                        <span className="text-[10px] text-gray-500">
                          Optimiza los colores de texto y títulos para máxima legibilidad según el fondo.
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => onTransformSlide?.("invert")}
                      className="p-3 rounded-lg border border-gray-200 hover:border-[#1a73e8] hover:bg-blue-50/50 flex items-start gap-2.5 text-left transition-colors cursor-pointer"
                    >
                      <Palette size={16} className="text-[#1a73e8] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-gray-800 block text-xs">
                          Invertir Esquema (Claro / Oscuro)
                        </span>
                        <span className="text-[10px] text-gray-500">
                          Alterna instantáneamente entre fondo claro y fondo oscuro con texto adaptado.
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => onTransformSlide?.("title")}
                      className="p-3 rounded-lg border border-gray-200 hover:border-[#1a73e8] hover:bg-blue-50/50 flex items-start gap-2.5 text-left transition-colors cursor-pointer"
                    >
                      <Type size={16} className="text-[#1a73e8] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-gray-800 block text-xs">
                          Título de Portada Impactante
                        </span>
                        <span className="text-[10px] text-gray-500">
                          Aumenta el tamaño y peso tipográfico del título a 44px negrita color acento.
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </aside>
      )}

      {/* Riel de acciones vertical lateral derecho idéntico a la imagen 3 de Google Slides */}
      <aside className="w-20 bg-white border-l border-[#e1dfdd] flex flex-col items-center py-4 gap-4 select-none shrink-0 text-[#444746] z-10">
        {[
          { id: "diapositiva", label: "Diapositiva", icon: Presentation },
          { id: "imagen", label: "Imagen", icon: ImageIcon },
          { id: "multimedia", label: "Contenido multimedia", icon: Film },
          { id: "cargas", label: "Cargas", icon: Upload },
          { id: "grabar", label: "Grabar", icon: Video },
          { id: "transformar", label: "Transformar", icon: Sparkles },
        ].map((action) => {
          const Icon = action.icon;
          const isActive = activeTab === action.id;
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => setActiveTab(isActive ? null : (action.id as SidebarTab))}
              className={`flex flex-col items-center gap-1 transition-colors group cursor-pointer w-full px-1 ${
                isActive ? "text-[#1a73e8]" : "hover:text-[#1a73e8]"
              }`}
              title={action.label}
            >
              <div
                className={`p-2 rounded-full transition-colors ${
                  isActive
                    ? "bg-[#c2e7ff] text-[#001d35]"
                    : "group-hover:bg-[#f0f4f9] text-[#444746]"
                }`}
              >
                <Icon size={18} />
              </div>
              <span
                className={`text-[10px] text-center leading-tight line-clamp-2 ${
                  isActive
                    ? "text-[#1a73e8] font-semibold"
                    : "text-[#444746] group-hover:text-[#1a73e8]"
                }`}
              >
                {action.label}
              </span>
            </button>
          );
        })}
      </aside>
    </div>
  );
};
