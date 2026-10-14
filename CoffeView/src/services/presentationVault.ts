// Bóveda de persistencia local y sincronización para CoffeView
import type { PresentationMetadata, Slide, SlideTheme, SlideLayout } from "../types";

export const SLIDE_THEMES: SlideTheme[] = [
  {
    id: "theme_espresso",
    name: "Espresso Ejecutivo",
    slideBg: "#1e140f",
    titleColor: "#ffffff",
    textColor: "#dfd3c7",
    accentColor: "#c43e1c",
  },
  {
    id: "theme_paper",
    name: "Papel Minimalista",
    slideBg: "#ffffff",
    titleColor: "#2c1b12",
    textColor: "#5c3a21",
    accentColor: "#c43e1c",
  },
  {
    id: "theme_latte",
    name: "Latte Moderno",
    slideBg: "#fbf8f5",
    titleColor: "#3e2723",
    textColor: "#6f4e37",
    accentColor: "#d35400",
  },
  {
    id: "theme_corporate",
    name: "Mocca Corporativo",
    slideBg: "#2b2523",
    titleColor: "#ffffff",
    textColor: "#e0d6d1",
    accentColor: "#e67e22",
  },
];

export const createDefaultSlides = (): Slide[] => [
  {
    id: "slide_1",
    slideNumber: 1,
    layout: "blank",
    transition: "fade",
    notes: "",
    elements: [],
  },
];

export const createSlideForLayout = (layout: SlideLayout, slideNumber: number): Slide => {
  const baseId = `slide_${Date.now()}`;

  switch (layout) {
    case "title":
      return {
        id: baseId,
        slideNumber,
        layout,
        transition: "fade",
        notes: "",
        elements: [
          {
            id: `el_${baseId}_1`,
            type: "title",
            x: 10,
            y: 32,
            width: 80,
            height: 18,
            content: "Haga clic para agregar título",
            fontSize: 42,
            fontWeight: "bold",
            align: "center",
            color: "#ffffff",
          },
          {
            id: `el_${baseId}_2`,
            type: "subtitle",
            x: 15,
            y: 54,
            width: 70,
            height: 12,
            content: "Haga clic para agregar subtítulo",
            fontSize: 22,
            fontWeight: "normal",
            align: "center",
            color: "#dfd3c7",
          },
        ],
      };
    case "two-columns":
      return {
        id: baseId,
        slideNumber,
        layout,
        transition: "push",
        notes: "",
        elements: [
          {
            id: `el_${baseId}_title`,
            type: "title",
            x: 8,
            y: 10,
            width: 84,
            height: 12,
            content: "Título de la diapositiva",
            fontSize: 32,
            fontWeight: "bold",
            align: "left",
            color: "#ffffff",
          },
          {
            id: `el_${baseId}_c1`,
            type: "text",
            x: 8,
            y: 28,
            width: 40,
            height: 55,
            content: "• Primer punto de la columna 1\n• Segundo punto clave",
            fontSize: 18,
            fontWeight: "normal",
            align: "left",
            color: "#dfd3c7",
          },
          {
            id: `el_${baseId}_c2`,
            type: "text",
            x: 52,
            y: 28,
            width: 40,
            height: 55,
            content: "• Primer punto de la columna 2\n• Segundo punto clave",
            fontSize: 18,
            fontWeight: "normal",
            align: "left",
            color: "#dfd3c7",
          },
        ],
      };
    case "blank":
      return {
        id: baseId,
        slideNumber,
        layout,
        transition: "none",
        notes: "",
        elements: [],
      };
    case "title-content":
    default:
      return {
        id: baseId,
        slideNumber,
        layout: "title-content",
        transition: "push",
        notes: "",
        elements: [
          {
            id: `el_${baseId}_title`,
            type: "title",
            x: 8,
            y: 10,
            width: 84,
            height: 12,
            content: "Haga clic para agregar título",
            fontSize: 32,
            fontWeight: "bold",
            align: "left",
            color: "#ffffff",
          },
          {
            id: `el_${baseId}_body`,
            type: "text",
            x: 8,
            y: 28,
            width: 84,
            height: 55,
            content: "• Haga clic para agregar texto\n• Segundo punto principal\n• Tercer elemento relevante",
            fontSize: 20,
            fontWeight: "normal",
            align: "left",
            color: "#dfd3c7",
          },
        ],
      };
  }
};

const STORAGE_KEY = "coffeview_active_presentation";

export const presentationVault = {
  loadPresentation(): {
    metadata: PresentationMetadata;
    slides: Slide[];
    activeSlideId: string;
  } {
    if (typeof window === "undefined") {
      const slides = createDefaultSlides();
      return {
        metadata: {
          id: "pres_1",
          title: "Presentación1",
          author: "Usuario CoffeWorks",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          themeId: "theme_espresso",
        },
        slides,
        activeSlideId: slides[0].id,
      };
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.slides && Array.isArray(parsed.slides) && parsed.slides.length > 0) {
          return {
            metadata: parsed.metadata || {
              id: "pres_1",
              title: "Presentación1",
              author: "Usuario CoffeWorks",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              themeId: "theme_espresso",
            },
            slides: parsed.slides,
            activeSlideId: parsed.activeSlideId || parsed.slides[0].id,
          };
        }
      }
    } catch (err) {
      console.warn("Fallo al leer presentación persistida:", err);
    }

    const defaultSlides = createDefaultSlides();
    const initData = {
      metadata: {
        id: "pres_1",
        title: "Presentación1",
        author: "Usuario CoffeWorks",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        themeId: "theme_espresso",
      },
      slides: defaultSlides,
      activeSlideId: defaultSlides[0].id,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(initData));
    return initData;
  },

  savePresentation(
    metadata: PresentationMetadata,
    slides: Slide[],
    activeSlideId: string
  ): void {
    if (typeof window === "undefined") return;

    const data = {
      metadata: {
        ...metadata,
        updatedAt: new Date().toISOString(),
      },
      slides,
      activeSlideId,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    // Registrar en documentos recientes del Launcher
    try {
      const existingRaw = localStorage.getItem("coffeeworks_recent_docs");
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      const updatedDocs = [
        {
          id: metadata.id,
          name: `${metadata.title}.csl`,
          app_id: "coffeview",
          category: "Presentaciones",
          last_modified: "Hace unos instantes",
          is_pinned: false,
          path: `./vault/${metadata.title}.csl`,
        },
        ...existing.filter((d: { id: string }) => d.id !== metadata.id),
      ];
      localStorage.setItem("coffeeworks_recent_docs", JSON.stringify(updatedDocs));

      // Sincronizar vía endpoint si está disponible
      fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedDocs[0]),
      }).catch(() => {});
    } catch {
      // Ignorar fallas secundarias de sincronización
    }
  },

  exportToCSL(metadata: PresentationMetadata, slides: Slide[]): void {
    const payload = JSON.stringify({ metadata, slides }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${metadata.title || "Presentacion"}.csl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  exportToHTML(metadata: PresentationMetadata, slides: Slide[], theme: SlideTheme): void {
    const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${metadata.title} - CoffeView</title>
  <style>
    body { margin: 0; background: #111; color: #fff; font-family: Segoe UI, sans-serif; display: flex; flex-direction: column; align-items: center; padding: 20px; }
    .slide { width: 960px; height: 540px; background: ${theme.slideBg}; border-radius: 8px; position: relative; margin-bottom: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); overflow: hidden; page-break-after: always; }
    .el { position: absolute; box-sizing: border-box; }
    .slide-num { position: absolute; bottom: 12px; right: 20px; font-size: 12px; color: ${theme.textColor}; opacity: 0.7; }
  </style>
</head>
<body>
  ${slides
    .map(
      (slide, idx) => `
    <div class="slide">
      ${slide.elements
        .map(
          (el) => `
        <div class="el" style="left: ${el.x}%; top: ${el.y}%; width: ${el.width}%; height: ${
            el.height
          }%; color: ${el.color || theme.textColor}; font-size: ${el.fontSize || 18}px; font-weight: ${
            el.fontWeight || "normal"
          }; text-align: ${el.align || "left"}; background: ${el.bg || "transparent"}; padding: 8px;">
          ${el.content.replace(/\n/g, "<br/>")}
        </div>
      `
        )
        .join("")}
      <div class="slide-num">Diapositiva ${idx + 1} de ${slides.length}</div>
    </div>
  `
    )
    .join("")}
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${metadata.title || "Presentacion"}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
