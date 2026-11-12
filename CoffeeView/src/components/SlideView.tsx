// Dibujo de una diapositiva. Lo comparten el lienzo de edición, las miniaturas,
// el modo presentación y la impresión, de modo que todos muestran lo mismo.
// La diapositiva se dibuja a su tamaño lógico y se escala con CSS.

import React from "react";
import type { AspectRatio, ShapeType, Slide, SlideElement, SlideTheme } from "../types";
import { SLIDE_SIZE } from "../types";
import { isDarkColor } from "../services/presentationVault";

const STAR_POINTS = (() => {
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? 50 : 20;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${50 + radius * Math.cos(angle)},${50 + radius * Math.sin(angle)}`);
  }
  return points.join(" ");
})();

function shapeNode(shape: ShapeType, fill: string, stroke: string | undefined, strokeWidth: number) {
  const common = {
    fill,
    stroke: stroke || "none",
    strokeWidth: stroke ? strokeWidth : 0,
    vectorEffect: "non-scaling-stroke" as const,
  };
  switch (shape) {
    case "rounded":
      return <rect x="0" y="0" width="100" height="100" rx="12" ry="12" {...common} />;
    case "circle":
      return <ellipse cx="50" cy="50" rx="50" ry="50" {...common} />;
    case "triangle":
      return <polygon points="50,0 100,100 0,100" {...common} />;
    case "arrow-right":
      return <polygon points="0,28 62,28 62,0 100,50 62,100 62,72 0,72" {...common} />;
    case "star":
      return <polygon points={STAR_POINTS} {...common} />;
    case "diamond":
      return <polygon points="50,0 100,50 50,100 0,50" {...common} />;
    case "callout":
      return <path d="M0,0 H100 V74 H42 L22,100 L26,74 H0 Z" {...common} />;
    default:
      return <rect x="0" y="0" width="100" height="100" {...common} />;
  }
}

const PLACEHOLDERS: Record<string, string> = {
  title: "Haz clic para agregar un título",
  subtitle: "Haz clic para agregar un subtítulo",
  text: "Haz clic para agregar texto",
};

interface ElementViewProps {
  element: SlideElement;
  theme: SlideTheme;
  /** Muestra los textos de ayuda de los marcadores vacíos (solo al editar). */
  showPlaceholders: boolean;
  /** El elemento está en edición de texto. */
  editing?: boolean;
  onChangeContent?: (content: string) => void;
  onChangeCell?: (row: number, col: number, value: string) => void;
  onFinishEditing?: () => void;
  /** Permite reproducir los vídeos (presentación). */
  interactive?: boolean;
}

export const ElementView: React.FC<ElementViewProps> = ({
  element: el,
  theme,
  showPlaceholders,
  editing,
  onChangeContent,
  onChangeCell,
  onFinishEditing,
  interactive,
}) => {
  if (el.type === "image") {
    return el.content ? (
      <img src={el.content} alt="" draggable={false} className="w-full h-full object-contain pointer-events-none select-none" />
    ) : null;
  }

  if (el.type === "video") {
    const youtube = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/.exec(el.content);
    if (youtube) {
      return (
        <iframe
          src={`https://www.youtube.com/embed/${youtube[1]}`}
          title="Vídeo"
          allowFullScreen
          className={`w-full h-full border-0 bg-black ${interactive ? "" : "pointer-events-none"}`}
        />
      );
    }
    return (
      <video
        src={el.content}
        controls={interactive}
        className={`w-full h-full object-contain bg-black ${interactive ? "" : "pointer-events-none"}`}
      />
    );
  }

  if (el.type === "line") {
    return (
      <svg className="w-full h-full overflow-visible pointer-events-none">
        <line
          x1="0"
          y1={el.flip ? "100%" : "0"}
          x2="100%"
          y2={el.flip ? "0" : "100%"}
          stroke={el.color || theme.textColor}
          strokeWidth={el.borderWidth || 3}
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (el.type === "table") {
    const rows = el.rows && el.rows.length > 0 ? el.rows : [[""]];
    return (
      <table
        className="w-full h-full border-collapse table-fixed"
        style={{
          fontSize: el.fontSize || 16,
          fontFamily: `${el.fontFamily || theme.fontFamily}, sans-serif`,
          color: el.color || theme.textColor,
        }}
      >
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td
                  key={c}
                  className="border border-[#bdc1c6] px-2 py-0.5 align-middle overflow-hidden"
                  style={{
                    backgroundColor: r === 0 ? theme.accentColor : el.bg || (isDarkColor(theme.slideBg) ? "transparent" : "#ffffff"),
                    color: r === 0 ? "#ffffff" : undefined,
                    fontWeight: r === 0 ? 700 : undefined,
                  }}
                >
                  {editing ? (
                    <input
                      value={cell}
                      spellCheck={false}
                      data-spell-key={onChangeCell ? `${el.id}#${r}.${c}` : undefined}
                      autoFocus={r === 0 && c === 0}
                      onChange={(e) => onChangeCell?.(r, c, e.target.value)}
                      onMouseDown={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Escape") onFinishEditing?.();
                      }}
                      className="w-full bg-transparent outline-none select-text"
                      style={{ color: "inherit", font: "inherit" }}
                    />
                  ) : (
                    <span className="block truncate" data-spell-key={onChangeCell ? `${el.id}#${r}.${c}` : undefined}>
                      {cell}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // Texto y formas
  const isTitle = el.type === "title";
  const isShape = el.type === "shape";
  const shapeFill = el.bg || theme.accentColor;
  const color =
    el.color ||
    (isShape ? (isDarkColor(shapeFill) ? "#ffffff" : "#1f1f1f") : isTitle ? theme.titleColor : theme.textColor);
  const align = el.align || "center";
  const textStyle: React.CSSProperties = {
    color,
    fontSize: el.fontSize || (isTitle ? 40 : 20),
    fontWeight: el.fontWeight || (isTitle ? "bold" : "normal"),
    fontStyle: el.fontStyle || "normal",
    textDecoration: el.underline ? "underline" : "none",
    fontFamily: `${el.fontFamily || theme.fontFamily}, sans-serif`,
    textAlign: align,
    lineHeight: 1.2,
  };
  const justify = el.valign === "top" ? "flex-start" : el.valign === "bottom" ? "flex-end" : "center";

  return (
    <div
      className="w-full h-full relative"
      style={{
        backgroundColor: !isShape && el.bg ? el.bg : undefined,
        border: !isShape && el.borderWidth ? `${el.borderWidth}px solid ${el.borderColor || "#1f1f1f"}` : undefined,
      }}
    >
      {isShape && (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
          {shapeNode(el.shapeType || "rectangle", shapeFill, el.borderWidth ? el.borderColor || "#1f1f1f" : undefined, el.borderWidth || 0)}
        </svg>
      )}
      <div className="absolute inset-0 flex flex-col p-2 overflow-hidden" style={{ justifyContent: justify }}>
        {editing ? (
          <textarea
            value={el.content}
            autoFocus
            spellCheck={false}
            data-spell-key={onChangeContent ? el.id : undefined}
            onChange={(e) => onChangeContent?.(e.target.value)}
            onBlur={onFinishEditing}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") onFinishEditing?.();
            }}
            onFocus={(e) => {
              const end = e.target.value.length;
              e.target.setSelectionRange(end, end);
            }}
            className="w-full h-full bg-transparent resize-none outline-none border-none p-0 select-text"
            style={textStyle}
          />
        ) : el.content ? (
          <div className="whitespace-pre-wrap break-words" style={textStyle} data-spell-key={onChangeContent ? el.id : undefined}>
            {el.content}
          </div>
        ) : showPlaceholders && PLACEHOLDERS[el.type] ? (
          <div className="whitespace-pre-wrap" style={{ ...textStyle, color: "#9aa0a6", fontWeight: "normal", textDecoration: "none" }}>
            {PLACEHOLDERS[el.type]}
          </div>
        ) : null}
      </div>
    </div>
  );
};

interface SlideViewProps {
  slide: Slide;
  theme: SlideTheme;
  aspectRatio: AspectRatio;
  /** Ancho en pantalla, en píxeles. */
  width: number;
  showPlaceholders?: boolean;
  interactive?: boolean;
  className?: string;
  /** Contenido adicional en coordenadas lógicas (selección, guías...). */
  children?: React.ReactNode;
  /** Sustituye el dibujo de los elementos (lo usa el lienzo de edición). */
  renderElement?: (element: SlideElement) => React.ReactNode;
  innerRef?: React.Ref<HTMLDivElement>;
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const SlideView: React.FC<SlideViewProps> = ({
  slide,
  theme,
  aspectRatio,
  width,
  showPlaceholders = false,
  interactive = false,
  className = "",
  children,
  renderElement,
  innerRef,
  onMouseDown,
}) => {
  const size = SLIDE_SIZE[aspectRatio];
  const scale = width / size.width;

  return (
    <div className={`relative overflow-hidden shrink-0 ${className}`} style={{ width, height: size.height * scale }}>
      <div
        ref={innerRef}
        onMouseDown={onMouseDown}
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width: size.width,
          height: size.height,
          transform: `scale(${scale})`,
          backgroundColor: slide.background || theme.slideBg,
        }}
      >
        {slide.elements.map((element) =>
          renderElement ? (
            renderElement(element)
          ) : (
            <div
              key={element.id}
              className="absolute"
              style={{
                left: `${element.x}%`,
                top: `${element.y}%`,
                width: `${element.width}%`,
                height: `${element.height}%`,
              }}
            >
              <ElementView element={element} theme={theme} showPlaceholders={showPlaceholders} interactive={interactive} />
            </div>
          )
        )}
        {children}
      </div>
    </div>
  );
};
