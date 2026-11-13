// Herramientas MCP de CoffeeAnimate3D: cada llamada de Claude se ejecuta sobre el
// modelo abierto con las mismas operaciones puras que usa el editor. Las que necesitan
// la ventana (captura y exportación) se devuelven como `needs` para que las haga la app.

import { addAnimation, addPart, copyPose, pastePose, type PoseClip, duplicatePart, fillFace, groupParts, mirrorPart, ungroup, newModel, paintPixels, removeAnimation, removeKeyframe, removePart, setKeyframe, updateAnimation, updatePart, type PartPatch } from "./model";
import { TEMPLATES } from "./templates";
import { EASES, FACES, SHAPES, TEX, type Ease, type Shape, type FaceName, type Model3D, type Vec3 } from "./types";
import type { ViewAngle } from "./viewport";

export type Content = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };

export interface ToolResult {
  /** Modelo nuevo (si la herramienta lo cambia). */
  model?: Model3D;
  content: Content[];
  isError?: boolean;
  /** Qué seleccionar en la app para que se vea lo que ha hecho Claude. */
  select?: string;
  needs?: { preview: PreviewRequest } | { export: string } | { exportObj: string } | { insertPiece: string } | { render: RenderRequest };
}

export interface PreviewRequest {
  angle?: ViewAngle;
  /** Dirección desde la que mirar (gana a `angle`), como en el cubo de vista. */
  direction?: Vec3;
  animation?: string;
  time?: number;
}

export interface RenderRequest {
  width: number;
  height: number;
  transparent: boolean;
  angle?: ViewAngle;
  direction?: Vec3;
}

const RENDER_SIZES: Record<string, [number, number]> = { "1280x720": [1280, 720], "1920x1080": [1920, 1080], "3840x2160": [3840, 2160] };

const VIEW_ANGLES: ViewAngle[] = ["frente", "detrás", "izquierda", "derecha", "arriba", "isométrica"];

class ToolError extends Error {}

const ok = (text: string, extra: Partial<ToolResult> = {}): ToolResult => ({ content: [{ type: "text", text }], ...extra });

function vec(v: unknown, name: string): Vec3 | undefined {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v) || v.length !== 3 || v.some((x) => typeof x !== "number" || !Number.isFinite(x))) throw new ToolError(`${name} debe ser una lista de 3 números`);
  return [v[0], v[1], v[2]];
}

function colorArg(v: unknown): string {
  if (typeof v !== "string" || !/^#[0-9a-fA-F]{6}$/.test(v)) throw new ToolError("color debe tener el formato #rrggbb");
  return v.toLowerCase();
}

function partRef(m: Model3D, ref: unknown): string {
  if (typeof ref !== "string" || !ref) throw new ToolError("Falta la pieza (id o nombre)");
  const byId = m.parts.find((p) => p.id === ref);
  if (byId) return byId.id;
  const byName = m.parts.filter((p) => p.name.toLowerCase() === ref.toLowerCase());
  if (byName.length === 1) return byName[0].id;
  if (byName.length > 1) throw new ToolError(`Hay varias piezas llamadas «${ref}»; usa su id`);
  throw new ToolError(`No hay ninguna pieza «${ref}». Usa get_model para ver las piezas.`);
}

function animRef(m: Model3D, ref: unknown): string {
  if (typeof ref !== "string" || !ref) throw new ToolError("Falta la animación (id o nombre)");
  const a = m.animations.find((x) => x.id === ref) ?? m.animations.find((x) => x.name.toLowerCase() === ref.toLowerCase());
  if (!a) throw new ToolError(`No hay ninguna animación «${ref}»`);
  return a.id;
}

function shapeArg(v: unknown): Shape | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string" || !SHAPES.includes(v as Shape)) throw new ToolError("shape debe ser box, cylinder, sphere, ramp o plane");
  return v as Shape;
}

function faceArg(v: unknown): FaceName {
  if (typeof v !== "string" || !FACES.includes(v as FaceName)) throw new ToolError("face debe ser px, nx, py, ny, pz o nz");
  return v as FaceName;
}

const nameOf = (m: Model3D, id: string) => m.parts.find((p) => p.id === id)?.name ?? id;

function describe(m: Model3D) {
  return {
    name: m.name,
    units: "16 unidades = 1 bloque",
    parts: m.parts.map((p) => ({
      id: p.id,
      name: p.name,
      parent: p.parent ? nameOf(m, p.parent) : null,
      pivot: p.pivot,
      rotation: p.rotation,
      visible: p.visible,
      box: p.box ? { from: p.box.from, size: p.box.size, faces: Object.fromEntries(FACES.map((f) => [f, p.box!.faces[f].pixels ? `${p.box!.faces[f].color} (pintada)` : p.box!.faces[f].color])) } : null,
    })),
    animations: m.animations.map((a) => ({
      id: a.id,
      name: a.name,
      length: a.length,
      loop: a.loop,
      keyframes: Object.values(a.tracks).reduce((n, k) => n + k.length, 0),
      tracks: Object.fromEntries(Object.entries(a.tracks).map(([pid, keys]) => [nameOf(m, pid), keys.map((k) => ({ t: k.t, pos: k.pos, rot: k.rot, scale: k.scale, ease: k.ease }))])),
    })),
  };
}

type Handler = (m: Model3D, a: Record<string, any>) => ToolResult;

const HANDLERS: Record<string, Handler> = {
  get_model: (m) => ok(JSON.stringify(describe(m), null, 1)),

  new_model: (_m, a) => {
    let next = newModel(typeof a.name === "string" && a.name ? a.name : "Modelo");
    if (a.template !== undefined) {
      const make = TEMPLATES[a.template];
      if (!make) throw new ToolError(`Plantilla desconocida: ${a.template}. Hay: ${Object.keys(TEMPLATES).join(", ")}`);
      next = { ...make(), name: typeof a.name === "string" && a.name ? a.name : make().name };
    }
    return ok(`Modelo «${next.name}» con ${next.parts.length} piezas y ${next.animations.length} animaciones.`, { model: next });
  },

  add_part: (m, a) => {
    const from = vec(a.from, "from");
    const size = vec(a.size, "size");
    if ((from && !size) || (size && !from)) throw new ToolError("Para un cubo indica from y size; sin ninguno se crea un hueso vacío");
    const [next, id] = addPart(m, {
      name: String(a.name ?? "Pieza"),
      parent: a.parent ? partRef(m, a.parent) : null,
      pivot: vec(a.pivot, "pivot"),
      rotation: vec(a.rotation, "rotation"),
      box: from && size ? { from, size, shape: shapeArg(a.shape), color: a.color !== undefined ? colorArg(a.color) : undefined } : null,
    });
    return ok(`Pieza «${a.name}» creada (id ${id}).`, { model: next, select: id });
  },

  update_part: (m, a) => {
    const id = partRef(m, a.part);
    const patch: PartPatch = {};
    if (typeof a.name === "string") patch.name = a.name;
    if (a.parent !== undefined) patch.parent = a.parent === null ? null : partRef(m, a.parent);
    if (a.pivot !== undefined) patch.pivot = vec(a.pivot, "pivot");
    if (a.rotation !== undefined) patch.rotation = vec(a.rotation, "rotation");
    if (typeof a.visible === "boolean") patch.visible = a.visible;
    if (a.from !== undefined || a.size !== undefined || a.color !== undefined || a.shape !== undefined) {
      patch.box = {};
      if (a.shape !== undefined) patch.box.shape = shapeArg(a.shape);
      if (a.from !== undefined) patch.box.from = vec(a.from, "from");
      if (a.size !== undefined) patch.box.size = vec(a.size, "size");
      if (a.color !== undefined) patch.box.color = colorArg(a.color);
    }
    return ok(`Pieza «${nameOf(m, id)}» actualizada.`, { model: updatePart(m, id, patch), select: id });
  },

  remove_part: (m, a) => {
    const id = partRef(m, a.part);
    return ok(`Pieza «${nameOf(m, id)}» eliminada con sus hijas.`, { model: removePart(m, id) });
  },

  duplicate_part: (m, a) => {
    const [next, id] = duplicatePart(m, partRef(m, a.part));
    return ok(`Copia creada: «${nameOf(next, id)}» (id ${id}).`, { model: next, select: id });
  },

  mirror_part: (m, a) => {
    const [next, id] = mirrorPart(m, partRef(m, a.part));
    return ok(`Copia reflejada creada: «${nameOf(next, id)}» (id ${id}).`, { model: next, select: id });
  },

  fill_face: (m, a) => {
    const id = partRef(m, a.part);
    const color = colorArg(a.color);
    const faces = a.face === "all" ? FACES : [faceArg(a.face)];
    let next = m;
    for (const f of faces) next = fillFace(next, id, f, color);
    return ok(`${faces.length === 6 ? "Todas las caras" : `Cara ${faces[0]}`} de «${nameOf(m, id)}» en ${color}.`, { model: next, select: id });
  },

  paint_pixels: (m, a) => {
    const id = partRef(m, a.part);
    const face = faceArg(a.face);
    const color = colorArg(a.color);
    const pts: [number, number][] = [];
    if (Array.isArray(a.pixels)) for (const p of a.pixels) if (Array.isArray(p) && p.length === 2) pts.push([Number(p[0]), Number(p[1])]);
    if (a.rect !== undefined) {
      if (!Array.isArray(a.rect) || a.rect.length !== 4) throw new ToolError("rect debe ser [x, y, ancho, alto]");
      const [x, y, w, h] = a.rect.map(Number);
      for (let j = Math.max(0, y); j < Math.min(TEX, y + h); j++) for (let i = Math.max(0, x); i < Math.min(TEX, x + w); i++) pts.push([i, j]);
    }
    if (!pts.length) throw new ToolError("Indica pixels o rect");
    return ok(`${pts.length} píxeles pintados en ${face} de «${nameOf(m, id)}».`, { model: paintPixels(m, id, face, pts, color), select: id });
  },

  add_animation: (m, a) => {
    const [next, id] = addAnimation(m, String(a.name ?? "Animación"), typeof a.length === "number" ? a.length : 1, a.loop !== false);
    return ok(`Animación «${a.name}» creada (id ${id}).`, { model: next });
  },

  set_keyframe: (m, a) => {
    const anim = animRef(m, a.animation);
    const part = partRef(m, a.part);
    if (typeof a.time !== "number") throw new ToolError("time debe ser un número (segundos)");
    const ease = a.ease === undefined ? undefined : (["smooth", "linear", "step"].includes(a.ease) ? a.ease : (() => { throw new ToolError("ease debe ser smooth, linear o step"); })()) as Ease;
    const next = setKeyframe(m, anim, part, a.time, { pos: vec(a.pos, "pos"), rot: vec(a.rot, "rot"), scale: vec(a.scale, "scale"), ease });
    return ok(`Clave de «${nameOf(m, part)}» en ${a.time} s.`, { model: next, select: part });
  },

  remove_keyframe: (m, a) => {
    const anim = animRef(m, a.animation);
    const part = partRef(m, a.part);
    return ok(`Clave quitada.`, { model: removeKeyframe(m, anim, part, Number(a.time)) });
  },

  update_animation: (m, a) => {
    const id = animRef(m, a.animation);
    if (a.remove === true) return ok("Animación eliminada.", { model: removeAnimation(m, id) });
    const patch: Record<string, unknown> = {};
    if (typeof a.name === "string") patch.name = a.name;
    if (typeof a.length === "number") patch.length = a.length;
    if (typeof a.loop === "boolean") patch.loop = a.loop;
    return ok("Animación actualizada.", { model: updateAnimation(m, id, patch) });
  },

  group_parts: (m, a) => {
    if (!Array.isArray(a.parts) || !a.parts.length) throw new ToolError("parts debe ser una lista de piezas (id o nombre)");
    const ids = a.parts.map((p) => partRef(m, p));
    const [next, id] = groupParts(m, ids, typeof a.name === "string" && a.name.trim() ? a.name.trim() : "Grupo");
    return ok(`Grupo «${nameOf(next, id)}» creado con ${ids.length} pieza(s) (id ${id}).`, { model: next, select: id });
  },

  ungroup: (m, a) => {
    const id = partRef(m, a.part);
    const name = nameOf(m, id);
    return ok(`Grupo «${name}» deshecho; sus piezas quedan en el mismo sitio.`, { model: ungroup(m, id) });
  },

  preview: (m, a) => {
    const preview: PreviewRequest = {};
    if (typeof a.angle === "string") preview.angle = a.angle as ViewAngle;
    const dir = vec(a.direction, "direction");
    if (dir) {
      if (dir.every((v) => v === 0)) throw new ToolError("direction no puede ser [0, 0, 0]");
      preview.direction = dir;
    }
    if (a.animation !== undefined) {
      preview.animation = animRef(m, a.animation);
      preview.time = typeof a.time === "number" ? a.time : 0;
    }
    return { content: [], needs: { preview } };
  },

  copy_pose: (m, a) => {
    const anim = animRef(m, a.animation);
    const t = typeof a.time === "number" ? a.time : 0;
    const ids = Array.isArray(a.parts) && a.parts.length ? a.parts.map((p) => partRef(m, p)) : m.parts.map((p) => p.id);
    const clip = copyPose(m, anim, t, ids);
    return ok(`Pose de ${clip.length} pieza(s) en ${t} s. Pásala tal cual como «pose» a paste_pose:\n${JSON.stringify(clip)}`);
  },

  paste_pose: (m, a) => {
    const anim = animRef(m, a.animation);
    if (typeof a.time !== "number") throw new ToolError("Falta time (segundos)");
    if (!Array.isArray(a.pose)) throw new ToolError("pose debe ser la lista que devuelve copy_pose");
    const clip: PoseClip = (a.pose as any[]).map((x) => ({ name: String(x?.name ?? ""), pose: { pos: vec(x?.pose?.pos, "pose.pos") ?? [0, 0, 0], rot: vec(x?.pose?.rot, "pose.rot") ?? [0, 0, 0], scale: vec(x?.pose?.scale, "pose.scale") ?? [1, 1, 1] } }));
    const ease: Ease = EASES.includes(a.ease as Ease) ? (a.ease as Ease) : "smooth";
    const r = pastePose(m, anim, a.time, clip, a.mirrored === true, ease);
    const extra = r.skipped.length ? ` Sin pareja: ${r.skipped.join(", ")}.` : "";
    return ok(`Pose ${a.mirrored ? "reflejada " : ""}pegada en ${r.pasted} pieza(s).${extra}`, r.pasted ? { model: r.model } : {});
  },

  export_obj: (_m, a) => {
    const base = String(a.file_name ?? "modelo").split(/[\\/]/).pop()!.replace(/\.(zip|obj)$/i, "").replace(/[^\p{L}\p{N} _.-]/gu, "_").replace(/^\.+/, "") || "modelo";
    return { content: [], needs: { exportObj: base } };
  },

  insert_piece: (_m, a) => {
    if (typeof a.name !== "string" || !a.name.trim()) throw new ToolError("Falta name: el nombre de la pieza (por ejemplo «Roble», «Roca» o «Mesa»)");
    return { content: [], needs: { insertPiece: a.name.trim() } };
  },

  render: (_m, a) => {
    const key = typeof a.size === "string" ? a.size.replace(/\s|×/g, "x").toLowerCase() : "1280x720";
    const size = RENDER_SIZES[key];
    if (!size) throw new ToolError("size debe ser 1280x720, 1920x1080 o 3840x2160");
    const req: RenderRequest = { width: size[0], height: size[1], transparent: a.transparent === true };
    if (a.angle !== undefined) {
      if (typeof a.angle !== "string" || !VIEW_ANGLES.includes(a.angle as ViewAngle)) throw new ToolError(`angle debe ser ${VIEW_ANGLES.join(", ")}`);
      req.angle = a.angle as ViewAngle;
    }
    const dir = vec(a.direction, "direction");
    if (dir) req.direction = dir;
    return { content: [], needs: { render: req } };
  },

  export_glb: (_m, a) => {
    const base = String(a.file_name ?? "modelo").split(/[\\/]/).pop()!.replace(/[^\p{L}\p{N} _.-]/gu, "_").replace(/^\.+/, "") || "modelo";
    return { content: [], needs: { export: base.toLowerCase().endsWith(".glb") ? base : `${base}.glb` } };
  },
};

export const TOOL_NAMES = Object.keys(HANDLERS);

/** Ejecuta una herramienta. Nunca lanza: los errores vuelven como `isError`. */
export function runTool(model: Model3D, name: string, args: Record<string, unknown>): ToolResult {
  const h = HANDLERS[name];
  if (!h) return { content: [{ type: "text", text: `Herramienta desconocida: ${name}` }], isError: true };
  try {
    return h(model, args ?? {});
  } catch (e) {
    return { content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }], isError: true };
  }
}
