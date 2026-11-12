// Modelo de datos de CoffeeUI/UX.
//
// Un diseño (.cux) tiene páginas; cada página es un lienzo infinito con nodos
// en árbol (marcos, grupos, formas, textos, imágenes, componentes e
// instancias). Las coordenadas de cada nodo son relativas a su padre.

export const ACCENT = "#ffc400";
export const ACCENT_DARK = "#2b2100";
export const SELECT = "#0d99ff";

export type NodeType =
  | "frame"
  | "group"
  | "component"
  | "instance"
  | "rect"
  | "ellipse"
  | "line"
  | "polygon"
  | "star"
  | "path"
  | "text"
  | "image";

export type PaintType = "solid" | "linear" | "radial";

export interface Paint {
  type: PaintType;
  color: string;
  /** Segundo color de los degradados. */
  color2: string;
  /** Ángulo del degradado lineal (grados). */
  angle: number;
  opacity: number; // 0-1
}

export interface Stroke {
  color: string;
  width: number;
  opacity: number;
  dash: boolean;
}

export interface Shadow {
  x: number;
  y: number;
  blur: number;
  color: string;
  opacity: number;
  inner: boolean;
}

export type LayoutMode = "none" | "row" | "column";
export type Justify = "start" | "center" | "end" | "space-between";
export type Align = "start" | "center" | "end";
export type SizeMode = "fixed" | "hug" | "fill";

export interface AutoLayout {
  mode: LayoutMode;
  gap: number;
  padding: { top: number; right: number; bottom: number; left: number };
  justify: Justify;
  align: Align;
}

export interface TextStyle {
  family: string;
  size: number;
  weight: number;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  align: "left" | "center" | "right";
  valign: "top" | "middle" | "bottom";
  lineHeight: number; // multiplicador
  letterSpacing: number; // px
  transform: "none" | "uppercase" | "lowercase";
  /** «width»: crece en ancho · «height»: ancho fijo y crece en alto · «fixed». */
  autoSize: "width" | "height" | "fixed";
}

export type Transition = "instant" | "dissolve" | "slide-left" | "slide-right" | "slide-up" | "slide-down" | "push-left" | "push-right";

export interface ProtoLink {
  /** Marco de destino, o "back" para volver al anterior. */
  target: string;
  transition: Transition;
  duration: number; // ms
}

export interface Override {
  text?: string;
  fill?: Paint | null;
  visible?: boolean;
}

export interface UNode {
  id: string;
  type: NodeType;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  opacity: number; // 0-1
  visible: boolean;
  locked: boolean;
  fill: Paint | null;
  stroke: Stroke | null;
  radius: number;
  shadow: Shadow | null;
  blur: number;
  /** Tamaño dentro de un diseño automático (y «ajustar al contenido» en marcos). */
  sizing: { w: SizeMode; h: SizeMode };
  // Contenedores (frame, group, component)
  children?: string[];
  clip?: boolean;
  layout?: AutoLayout;
  /** Marco creado a partir de un tamaño de dispositivo. */
  device?: string;
  // Texto
  text?: string;
  font?: TextStyle;
  // Imagen
  src?: string;
  fit?: "cover" | "contain" | "fill";
  // Formas
  sides?: number;
  innerRatio?: number;
  /** Puntos del trazado, relativos a la caja (0-1). */
  points?: [number, number][];
  closed?: boolean;
  arrowStart?: boolean;
  arrowEnd?: boolean;
  // Componentes
  componentId?: string;
  overrides?: Record<string, Override>;
  // Prototipo
  link?: ProtoLink | null;
}

export interface Page {
  id: string;
  name: string;
  background: string;
  nodes: Record<string, UNode>;
  children: string[];
  /** Marco con el que empieza la presentación del prototipo. */
  startFrame?: string;
}

export interface ColorStyle {
  id: string;
  name: string;
  color: string;
}

export interface UxDocument {
  format: "coffeeuiux";
  version: 1;
  /** Para qué se diseña: móvil, escritorio o web (orienta la biblioteca). */
  platform: Platform;
  pages: Page[];
  currentPage: string;
  colorStyles: ColorStyle[];
}

export type Platform = "mobile" | "desktop" | "web";

export type Tool = "move" | "hand" | "frame" | "rect" | "ellipse" | "line" | "arrow" | "polygon" | "star" | "text" | "pen" | "pencil";

export interface DevicePreset {
  id: string;
  name: string;
  w: number;
  h: number;
  group: "Móvil" | "Tableta" | "Escritorio" | "Web";
}

export const DEVICES: DevicePreset[] = [
  { id: "iphone-15", name: "iPhone 15 / 14", w: 393, h: 852, group: "Móvil" },
  { id: "iphone-15-pro-max", name: "iPhone 15 Pro Max", w: 430, h: 932, group: "Móvil" },
  { id: "iphone-se", name: "iPhone SE", w: 375, h: 667, group: "Móvil" },
  { id: "android-large", name: "Android grande", w: 412, h: 915, group: "Móvil" },
  { id: "android-small", name: "Android compacto", w: 360, h: 640, group: "Móvil" },
  { id: "watch", name: "Reloj (45 mm)", w: 198, h: 242, group: "Móvil" },
  { id: "ipad-mini", name: "iPad mini", w: 744, h: 1133, group: "Tableta" },
  { id: "ipad-pro-11", name: "iPad Pro 11\"", w: 834, h: 1194, group: "Tableta" },
  { id: "android-tablet", name: "Tableta Android", w: 800, h: 1280, group: "Tableta" },
  { id: "desktop-app", name: "Ventana de aplicación", w: 1280, h: 800, group: "Escritorio" },
  { id: "desktop-small", name: "Ventana pequeña", w: 1024, h: 680, group: "Escritorio" },
  { id: "desktop-fhd", name: "Pantalla Full HD", w: 1920, h: 1080, group: "Escritorio" },
  { id: "macbook-air", name: "MacBook Air", w: 1280, h: 832, group: "Escritorio" },
  { id: "dialog", name: "Diálogo", w: 480, h: 320, group: "Escritorio" },
  { id: "web-1440", name: "Web escritorio (1440)", w: 1440, h: 1024, group: "Web" },
  { id: "web-1280", name: "Web portátil (1280)", w: 1280, h: 832, group: "Web" },
  { id: "web-768", name: "Web tableta (768)", w: 768, h: 1024, group: "Web" },
  { id: "web-390", name: "Web móvil (390)", w: 390, h: 844, group: "Web" },
];

export const PLATFORM_DEVICE: Record<Platform, string> = { mobile: "iphone-15", desktop: "desktop-app", web: "web-1440" };

export const PLATFORM_LABEL: Record<Platform, string> = { mobile: "Móvil", desktop: "Escritorio", web: "Web" };

export const FONTS = [
  "Hanken Grotesk",
  "Segoe UI",
  "Arial",
  "Helvetica",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Georgia",
  "Times New Roman",
  "Garamond",
  "Courier New",
  "JetBrains Mono",
  "system-ui",
];

export const WEIGHTS: { value: number; label: string }[] = [
  { value: 300, label: "Ligera" },
  { value: 400, label: "Normal" },
  { value: 500, label: "Media" },
  { value: 600, label: "Seminegrita" },
  { value: 700, label: "Negrita" },
  { value: 800, label: "Extra negrita" },
];

export const TRANSITIONS: { id: Transition; label: string }[] = [
  { id: "instant", label: "Instantánea" },
  { id: "dissolve", label: "Disolver" },
  { id: "slide-left", label: "Deslizar a la izquierda" },
  { id: "slide-right", label: "Deslizar a la derecha" },
  { id: "slide-up", label: "Deslizar hacia arriba" },
  { id: "slide-down", label: "Deslizar hacia abajo" },
  { id: "push-left", label: "Empujar a la izquierda" },
  { id: "push-right", label: "Empujar a la derecha" },
];

export const TYPE_LABEL: Record<NodeType, string> = {
  frame: "Marco",
  group: "Grupo",
  component: "Componente",
  instance: "Instancia",
  rect: "Rectángulo",
  ellipse: "Elipse",
  line: "Línea",
  polygon: "Polígono",
  star: "Estrella",
  path: "Trazado",
  text: "Texto",
  image: "Imagen",
};

export const isContainer = (n: UNode | undefined) => !!n && (n.type === "frame" || n.type === "group" || n.type === "component");
