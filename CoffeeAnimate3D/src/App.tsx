import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FilePlus, FolderOpen, SaveAll, Home, Undo2, Redo2, Download, Keyboard, Info, Play, Pause, Plus, Trash2, Eye, EyeOff, Copy, FlipHorizontal2, Box as BoxIcon, Bone, Move3d, Rotate3d, Focus, Pencil, PaintBucket, Pipette, Diamond, Camera, Bot, Shapes, Scale3d, Ruler, Group, Ungroup, Minus, Cylinder, Circle, Triangle, Square, ClipboardCopy, ClipboardPaste, Layers, Spline, FileUp, FileDown, ScanEye, Sparkles, Package } from "lucide-react";
import { SuiteHeader, type MenuDefinition } from "./studio/SuiteHeader";
import { StartScreen } from "./studio/StartScreen";
import { CommandSearch } from "./studio/CommandSearch";
import { DialogHost, askText, showMessage, toast } from "./studio/Dialogs";
import { createDocStore } from "./studio/docStore";
import { useStudioDoc } from "./studio/useStudioDoc";
import { Button, IconButton, NumberField, STUDIO_CSS, Section, Select, Toggle, cx } from "./studio/ui";
import { bytesToText, pickOpenFile, saveFileAs } from "./studio/desktop";
import { makeZip } from "./studio/zip";
import { ACCENT, ACCENT_DARK, EASES, FACE_LABEL, SHAPES, SHAPE_FACES, SHAPE_LABEL, type Ease, type Shape, type FaceName, type Model3D, type Part, type Vec3 } from "./types";
import { addAnimation, addPart, insertPiece, clearReference, copyPose, getReference, moveKeyframe, pastePose, setReference, type PoseClip, descendants, duplicatePart, fillFace, findPart, getPixel, groupParts, mirrorPart, newModel, paintPixels, parseModel, removeAnimation, removeKeyframe, removePart, resizeBox, rotatePartsQuat, samplePose, scaleParts, serializeModel, setKeyframe, topLevel, translateParts, ungroup, updateAnimation, updatePart, wrapTime } from "./model";
import { SNAP_OPTIONS, formatDistance, loadSnap, parseNumber, saveSnap, snapValue, type SnapPrefs, type SnapStep } from "./snap";
import { TEMPLATES } from "./templates";
import { exportGlb, importGlb } from "./gltf";
import { exportObj, parseObj } from "./objfile";
import { RenderDialog, PiecesDialog } from "./panels";
import { canRender, loadPiece, type PieceEntry } from "./addonsLib";
import { Viewport, type GizmoMode, type TransformChange, type ViewAngle, type ViewTool } from "./viewport";
import { useMcpBridge } from "./mcpBridge";

const store = createDocStore<Model3D>({
  appId: "coffeeanimate3d",
  extension: "ca3d",
  category: "Ilustración",
  defaultTitle: "Modelo sin título",
  kindLabel: "Modelos de CoffeeAnimate3D",
  serialize: serializeModel,
  parse: parseModel,
  create: () => newModel(),
});

type Mode = "model" | "paint" | "animate";
type PaintTool = "pencil" | "fill" | "picker";

/** Paleta de SurvivalForest (tierra roja, verdes cálidos, café…). */
const PALETTE = ["#6fb84a", "#3c8f45", "#2c6e3a", "#b5532f", "#7e3524", "#9a9389", "#e8d49b", "#d9824f", "#f3eee4", "#2f6fb3", "#c4583a", "#7a5233", "#5a3a22", "#d23a3f", "#e8822f", "#f2c230", "#2b2724", "#ffffff", "#c98f62", "#1d4472"];

const ROUND = (v: number) => Math.round(v * 100) / 100;

export const App: React.FC = () => {
  const sd = useStudioDoc<Model3D>(store, { appName: "CoffeeAnimate3D", historyLimit: 120 });
  const doc = sd.doc;
  const docRef = sd.docRef;
  const cur = () => docRef.current!;
  const apply = useCallback((next: Model3D, key = "") => sd.apply(next, key), [sd]);

  // Selección: la última pieza es la principal (propiedades, línea de tiempo, gizmo).
  const [selection, setSelection] = useState<string[]>([]);
  const sel = selection.at(-1) ?? null;
  const setSel = useCallback((id: string | null) => setSelection(id ? [id] : []), []);
  const toggleSel = (id: string) => setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const [snap, setSnapState] = useState<SnapPrefs>(() => loadSnap());
  const setSnap = (next: SnapPrefs) => {
    setSnapState(next);
    saveSnap(next);
  };
  const [viewTool, setViewTool] = useState<ViewTool>("select");
  const [measured, setMeasured] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("model");
  const [gizmo, setGizmoState] = useState<GizmoMode>("translate");
  const [animId, setAnimId] = useState<string | null>(null);
  const [time, setTimeState] = useState(0);
  const timeRef = useRef(0);
  const setTime = (t: number) => {
    timeRef.current = t;
    setTimeState(t);
  };
  const [playing, setPlaying] = useState(false);
  const [color, setColor] = useState("#6fb84a");
  const [tool, setTool] = useState<PaintTool>("pencil");
  const [ease, setEase] = useState<Ease>("smooth");
  const [commandOpen, setCommandOpen] = useState(false);
  const [onion, setOnion] = useState(false);
  const [refVisible, setRefVisible] = useState(true);
  const poseClip = useRef<PoseClip | null>(null);
  const [dialog, setDialog] = useState<"render" | "pieces" | null>(null);
  const closeDialog = useCallback(() => setDialog(null), []);
  const getViewport = useCallback(() => vpRef.current, []);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const vpRef = useRef<Viewport | null>(null);
  const stroke = useRef<{ id: number; points: Map<string, { part: string; face: FaceName; pts: [number, number][] }> } | null>(null);
  const strokeCount = useRef(0);

  const anim = doc && animId ? doc.animations.find((a) => a.id === animId) ?? null : null;
  useEffect(() => {
    if (doc && (!animId || !doc.animations.some((a) => a.id === animId))) setAnimId(doc.animations[0]?.id ?? null);
  }, [doc, animId]);
  useEffect(() => {
    if (doc && selection.some((id) => !doc.parts.some((p) => p.id === id))) setSelection((s) => s.filter((id) => doc.parts.some((p) => p.id === id)));
  }, [doc, selection]);
  useEffect(() => {
    setSel(null);
    setTime(0);
    setPlaying(false);
  }, [sd.docId]);

  const poseNow = useCallback(() => {
    const d = docRef.current;
    if (!d || mode !== "animate" || !animId || !d.animations.some((a) => a.id === animId)) return undefined;
    return samplePose(d, animId, timeRef.current);
  }, [docRef, mode, animId]);

  // ---------- Visor ----------
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const handlers = useRef({
    onSelect: (_id: string | null, _additive: boolean) => {},
    onSelectRect: (_ids: string[], _additive: boolean) => {},
    onTransform: (_c: TransformChange) => {},
    onPaint: (_id: string, _f: FaceName, _x: number, _y: number, _last: boolean) => {},
  });

  useEffect(() => {
    if (!hostRef.current || !doc) return;
    const vp = new Viewport(hostRef.current, {
      onSelect: (id, additive) => handlers.current.onSelect(id, additive),
      onSelectRect: (ids, additive) => handlers.current.onSelectRect(ids, additive),
      onTransform: (c) => handlers.current.onTransform(c),
      onMeasure: (d) => setMeasured(d),
      onPaint: (id, f, x, y, last) => handlers.current.onPaint(id, f, x, y, last),
    });
    vpRef.current = vp;
    // Acceso para las pruebas automáticas (solo en desarrollo).
    if (import.meta.env.DEV) (window as unknown as { __ca3dViewport?: Viewport }).__ca3dViewport = vp;
    vp.setModel(docRef.current!, poseNow());
    vp.frame();
    return () => {
      vp.dispose();
      vpRef.current = null;
    };
    // El visor se crea una vez por documento abierto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!doc, sd.docId]);

  // Encuadrar cuando el modelo pasa de vacío a tener piezas (plantilla, archivo o Claude).
  const hadParts = useRef(false);
  useEffect(() => {
    if (!doc) return;
    vpRef.current?.setModel(doc, poseNow());
    const has = doc.parts.length > 0;
    if (has && !hadParts.current) vpRef.current?.frame();
    hadParts.current = has;
  }, [doc, poseNow]);
  useEffect(() => vpRef.current?.applyPose(poseNow()), [time, poseNow]);
  // Papel cebolla: la pose de la clave anterior y la siguiente (de cualquier pieza).
  useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;
    if (!onion || mode !== "animate" || !anim || !doc) return vp.setOnion(null);
    const times = [...new Set(Object.values(anim.tracks).flatMap((k) => k.map((x) => x.t)))].sort((a, b) => a - b);
    const prev = [...times].reverse().find((t) => t < time - 1e-4);
    const next = times.find((t) => t > time + 1e-4);
    vp.setOnion([prev, next].filter((t): t is number => t !== undefined).map((t) => samplePose(doc, anim.id, t)));
  }, [onion, mode, anim, doc, time]);
  const refMesh = useMemo(() => (doc ? getReference(doc) : null), [doc?.reference]);
  useEffect(() => vpRef.current?.setReference(refMesh?.mesh ?? null, refVisible), [refMesh, refVisible, !!doc, sd.docId]);
  useEffect(() => vpRef.current?.select(selection), [selection]);
  useEffect(() => vpRef.current?.setSnap(snap.step, snap.rotate), [snap, !!doc, sd.docId]);
  useEffect(() => vpRef.current?.setTool(viewTool), [viewTool]);
  useEffect(() => vpRef.current?.setMode(mode), [mode]);
  useEffect(() => vpRef.current?.setGizmo(gizmo), [gizmo]);

  handlers.current.onSelect = (id, additive) => {
    if (!id) return additive ? undefined : setSel(null);
    if (additive) toggleSel(id);
    else setSel(id);
  };
  handlers.current.onSelectRect = (ids, additive) => setSelection((s) => (additive ? [...s.filter((x) => !ids.includes(x)), ...ids] : ids));

  // Gizmo: en Modelar cambia el reposo; en Animar crea una clave en el instante actual.
  handlers.current.onTransform = (c) => {
    const d = cur();
    try {
      if (c.delta) return apply(translateParts(d, c.ids, c.delta));
      if (c.rotate) return apply(rotatePartsQuat(d, c.ids, c.rotate.quat, c.rotate.center));
      const id = c.ids[0];
      const part = findPart(d, id);
      if (modeRef.current === "animate" && animId) {
        const a = d.animations.find((x) => x.id === animId)!;
        const t = wrapTime(a, timeRef.current);
        const v: { pos?: Vec3; rot?: Vec3; scale?: Vec3; ease: Ease } = { ease };
        if (c.pivot) v.pos = c.pivot.map((p, k) => ROUND(p - part.pivot[k])) as Vec3;
        if (c.rotation) v.rot = c.rotation.map((r, k) => ROUND(r - part.rotation[k])) as Vec3;
        if (c.scale) v.scale = c.scale.factor.map((f) => Math.max(0.05, ROUND(f))) as Vec3;
        return apply(setKeyframe(d, animId, id, t, v));
      }
      if (c.scale && c.ids.length > 1) return apply(scaleParts(d, c.ids, c.scale.factor, c.scale.center));
      if (c.scale) {
        if (!part.box) return;
        const size = part.box.size.map((v, k) => snapValue(v * c.scale!.factor[k], snap.step)) as Vec3;
        return apply(resizeBox(d, id, size, "pivot"));
      }
      apply(updatePart(d, id, { pivot: c.pivot, rotation: c.rotation }));
    } catch (e) {
      toast(String((e as Error).message), "error");
      vpRef.current?.setModel(d, poseNow());
    }
  };

  // Pintura: un trazo es una sola entrada del historial.
  handlers.current.onPaint = (id, face, x, y, last) => {
    if (last && !id) {
      stroke.current = null;
      return;
    }
    const d = cur();
    if (tool === "picker") {
      setColor(getPixel(d, id, face, x, y));
      setTool("pencil");
      return;
    }
    if (tool === "fill") return apply(fillFace(d, id, face, color), "");
    if (!stroke.current) stroke.current = { id: ++strokeCount.current, points: new Map() };
    apply(paintPixels(d, id, face, [[x, y]], color), `paint-${stroke.current.id}`);
  };

  // ---------- Reproducción ----------
  useEffect(() => {
    if (!playing || !anim) return;
    let last = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = timeRef.current + (now - last) / 1000;
      last = now;
      setTime(anim.loop ? t % anim.length : Math.min(t, anim.length));
      if (!anim.loop && t >= anim.length) setPlaying(false);
      else raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, anim]);

  // ---------- Acciones ----------
  const selPart = doc && sel ? doc.parts.find((p) => p.id === sel) ?? null : null;
  const addCube = (bone = false, shape: Shape = "box") => {
    const parent = selPart?.id ?? null;
    const [m, id] = addPart(cur(), {
      name: bone ? `hueso ${cur().parts.length + 1}` : `${SHAPE_LABEL[shape].toLowerCase()} ${cur().parts.length + 1}`,
      parent,
      pivot: parent ? [0, 0, 0] : [0, 4, 0],
      box: bone ? null : { from: [-2, 0, -2], size: [4, 4, 4], color, shape },
    });
    apply(m);
    setSel(id);
  };
  const dup = () => {
    if (!sel) return;
    const [m, id] = duplicatePart(cur(), sel);
    apply(m);
    setSel(id);
  };
  const mirror = () => {
    if (!sel) return;
    const [m, id] = mirrorPart(cur(), sel);
    apply(m);
    setSel(id);
    toast("Copia reflejada creada");
  };
  const del = () => {
    if (!selection.length) return;
    let m = cur();
    for (const id of topLevel(m, selection)) m = removePart(m, id);
    apply(m);
    setSel(null);
  };
  const group = () => {
    if (!selection.length) return;
    try {
      const [m, id] = groupParts(cur(), selection);
      apply(m);
      setSel(id);
      toast("Grupo creado");
    } catch (e) {
      toast(String((e as Error).message), "error");
    }
  };
  const doUngroup = () => {
    if (!sel) return;
    try {
      const kids = cur().parts.filter((p) => p.parent === sel).map((p) => p.id);
      apply(ungroup(cur(), sel));
      setSelection(kids);
    } catch (e) {
      toast(String((e as Error).message), "error");
    }
  };
  const isGroup = !!(doc && sel && doc.parts.find((p) => p.id === sel)?.box === null);
  /** Botones −/+ del panel: cambia un eje de la caja desde el centro. */
  const grow = (axis: 0 | 1 | 2, amount: number) => {
    if (!selPart?.box) return;
    const size = [...selPart.box.size] as Vec3;
    size[axis] += amount;
    apply(resizeBox(cur(), selPart.id, size, "center"));
  };
  const patch = (p: Parameters<typeof updatePart>[2], key = "") => {
    if (!sel) return;
    try {
      apply(updatePart(cur(), sel, p), key);
    } catch (e) {
      toast(String((e as Error).message), "error");
    }
  };

  const newAnim = async () => {
    const name = await askText({ title: "Animación nueva", label: "Nombre", defaultValue: `Animación ${cur().animations.length + 1}` });
    if (!name) return;
    const [m, id] = addAnimation(cur(), name, 1);
    apply(m);
    setAnimId(id);
    setTime(0);
    setMode("animate");
  };
  const keyHere = () => {
    if (!sel || !anim) return toast("Elige una pieza y una animación", "info");
    const pose = samplePose(cur(), anim.id, timeRef.current).get(sel);
    apply(setKeyframe(cur(), anim.id, sel, wrapTime(anim, timeRef.current), { ...(pose ?? {}), ease }));
  };
  const unkeyHere = () => {
    if (!sel || !anim) return;
    const t = wrapTime(anim, timeRef.current);
    const k = (anim.tracks[sel] ?? []).find((x) => Math.abs(x.t - t) < 0.021);
    if (k) apply(removeKeyframe(cur(), anim.id, sel, k.t));
  };

  const copyPoseNow = () => {
    if (!anim) return toast("Elige una animación", "info");
    const ids = selection.length ? selection : cur().parts.map((p) => p.id);
    poseClip.current = copyPose(cur(), anim.id, timeRef.current, ids);
    toast(`Pose copiada (${ids.length} pieza${ids.length === 1 ? "" : "s"})`);
  };
  const pastePoseNow = (mirrored: boolean) => {
    if (!anim || !poseClip.current) return toast("Copia antes una pose (Ctrl+Mayús+C)", "info");
    const r = pastePose(cur(), anim.id, wrapTime(anim, timeRef.current), poseClip.current, mirrored, ease);
    if (r.pasted) apply(r.model);
    toast(r.skipped.length ? `Pose pegada en ${r.pasted}; sin pareja: ${r.skipped.join(", ")}` : `Pose ${mirrored ? "reflejada " : ""}pegada en ${r.pasted} pieza${r.pasted === 1 ? "" : "s"}`, r.pasted ? "success" : "info");
  };

  const importFile = async () => {
    const f = await pickOpenFile([{ name: "Modelos 3D", extensions: ["glb", "obj"] }], "Importar modelo o referencia");
    if (!f) return;
    try {
      if (f.name.toLowerCase().endsWith(".obj")) {
        apply(setReference(cur(), f.name, parseObj(bytesToText(f.bytes))));
        setRefVisible(true);
        return toast("Referencia cargada: calca encima con cubos (Ver › Referencia)");
      }
      const r = importGlb(f.bytes);
      if ("model" in r) {
        apply(r.model);
        setSel(null);
        setTimeout(() => vpRef.current?.frame(), 50);
        return toast("Modelo de CoffeeAnimate3D importado (Ctrl+Z para volver)");
      }
      apply(setReference(cur(), f.name, r.reference));
      setRefVisible(true);
      toast("Referencia cargada: calca encima con cubos (Ver › Referencia)");
    } catch (e) {
      toast(String((e as Error).message), "error");
    }
  };
  const exportObjZip = async () => {
    const base = (sd.title || "modelo").replace(/[\\/:*?"<>|]/g, "_");
    const { obj, mtl, png } = exportObj(cur(), base);
    const zip = makeZip([{ name: `${base}.obj`, data: obj }, { name: `${base}.mtl`, data: mtl }, { name: `${base}.png`, data: png }]);
    if (await saveFileAs(`${base}-obj.zip`, [{ name: "ZIP con OBJ, MTL y PNG", extensions: ["zip"] }], zip, "Exportar a OBJ")) toast("Exportado a OBJ (.zip con .obj, .mtl y la textura)");
  };

  const openRender = async () => {
    if (await canRender()) setDialog("render");
  };
  const insertPieceFrom = async (entry: PieceEntry) => {
    try {
      const [m, id] = insertPiece(cur(), await loadPiece(entry), entry.name);
      apply(m);
      setSel(id);
      setDialog(null);
      toast(`«${entry.name}» insertada`);
    } catch (e) {
      toast(String((e as Error).message), "error");
    }
  };

  const fromTemplate = (name: string) => {
    apply(TEMPLATES[name]());
    setSel(null);
    setTimeout(() => vpRef.current?.frame(), 50);
    toast(`Plantilla «${name}» cargada`);
  };

  const exportModel = async () => {
    const d = cur();
    const path = await saveFileAs(`${(sd.title || "modelo").replace(/[\\/:*?"<>|]/g, "_")}.glb`, [{ name: "Modelo glTF binario", extensions: ["glb"] }], exportGlb(d), "Exportar a glTF");
    if (path) toast("Modelo exportado a glTF (.glb)");
  };
  const exportShot = async () => {
    const url = vpRef.current?.capture("isométrica", 1280, 960);
    if (!url) return;
    const bytes = Uint8Array.from(atob(url.split(",")[1]), (c) => c.charCodeAt(0));
    if (await saveFileAs(`${sd.title || "modelo"}.png`, [{ name: "Imagen PNG", extensions: ["png"] }], bytes, "Guardar captura")) toast("Captura guardada");
  };

  // ---------- Puente MCP (Claude) ----------
  const mcp = useMcpBridge({
    getModel: () => docRef.current,
    apply: (m) => apply(m, ""),
    capture: (angle, w, h) => vpRef.current?.capture(angle, w, h) ?? null,
    select: (id) => setSel(id),
    viewport: () => vpRef.current,
    setAnimation: (id, t) => {
      setMode("animate");
      setAnimId(id);
      setTime(t);
    },
  });

  // ---------- Atajos ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !doc) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "z") {
        e.preventDefault();
        if (e.shiftKey) sd.redo();
        else sd.undo();
      } else if ((e.ctrlKey || e.metaKey) && k === "y") sd.redo();
      else if ((e.ctrlKey || e.metaKey) && k === "d") {
        e.preventDefault();
        dup();
      } else if ((e.ctrlKey || e.metaKey) && k === "s") {
        e.preventDefault();
        void sd.flush().then(() => toast("Guardado"));
      } else if ((e.ctrlKey || e.metaKey) && k === "k") {
        e.preventDefault();
        setCommandOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (k === "c" || k === "v" || k === "b")) {
        e.preventDefault();
        if (k === "c") copyPoseNow();
        else pastePoseNow(k === "b");
      } else if ((e.ctrlKey || e.metaKey) && k === "a") {
        e.preventDefault();
        setSelection(cur().parts.map((p) => p.id));
      } else if ((e.ctrlKey || e.metaKey) && k === "g") {
        e.preventDefault();
        if (e.shiftKey) doUngroup();
        else group();
      } else if (e.ctrlKey || e.metaKey || e.altKey) return;
      else if (k === "delete" || k === "backspace") del();
      else if (k === "g") setGizmoState("translate");
      else if (k === "r") setGizmoState("rotate");
      else if (k === "s") setGizmoState("scale");
      else if (k === "f") vpRef.current?.frame();
      else if (k === "m" && e.shiftKey) setViewTool((t) => (t === "measure" ? "select" : "measure"));
      else if (k === "m") mirror();
      else if (k === "1") setMode("model");
      else if (k === "2") setMode("paint");
      else if (k === "3") setMode("animate");
      else if (k === " " && mode === "animate") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (k === "k" && mode === "animate") keyHere();
      else if (k === "escape") {
        if (viewTool === "measure") setViewTool("select");
        else setSel(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const view = (a: ViewAngle) => vpRef.current?.frame(a);

  const menus: MenuDefinition[] = doc
    ? [
        {
          id: "file",
          label: "Archivo",
          items: [
            { label: "Modelo nuevo", icon: FilePlus, action: () => void sd.newDocument() },
            ...Object.keys(TEMPLATES).map((n) => ({ label: `Nuevo desde plantilla: ${n}`, icon: Shapes, action: () => fromTemplate(n) })),
            { label: "Abrir…", icon: FolderOpen, shortcut: "Ctrl+O", action: () => void sd.open() },
            { divider: true },
            { label: "Guardar", shortcut: "Ctrl+S", action: () => void sd.flush().then(() => toast("Guardado")) },
            { label: "Guardar como…", icon: SaveAll, action: () => void sd.saveAs() },
            { label: "Importar .glb u .obj…", icon: FileUp, action: () => void importFile() },
            { label: "Exportar a glTF (.glb)…", icon: Download, action: () => void exportModel() },
            { label: "Exportar a OBJ (.zip)…", icon: FileDown, action: () => void exportObjZip() },
            { label: "Guardar captura (PNG)…", icon: Camera, action: () => void exportShot() },
            { divider: true },
            { label: "Pantalla de inicio", icon: Home, action: () => sd.setShowStart(true) },
          ],
        },
        {
          id: "edit",
          label: "Edición",
          items: [
            { label: "Deshacer", icon: Undo2, shortcut: "Ctrl+Z", action: sd.undo, disabled: !sd.canUndo },
            { label: "Rehacer", icon: Redo2, shortcut: "Ctrl+Mayús+Z", action: sd.redo, disabled: !sd.canRedo },
            { divider: true },
            { label: "Añadir cubo", icon: BoxIcon, action: () => addCube(false) },
            { label: "Añadir cilindro", icon: Cylinder, action: () => addCube(false, "cylinder") },
            { label: "Añadir esfera", icon: Circle, action: () => addCube(false, "sphere") },
            { label: "Añadir rampa", icon: Triangle, action: () => addCube(false, "ramp") },
            { label: "Añadir plano", icon: Square, action: () => addCube(false, "plane") },
            { label: "Añadir hueso (sin caja)", icon: Bone, action: () => addCube(true) },
            { label: "Duplicar", icon: Copy, shortcut: "Ctrl+D", action: dup, disabled: !sel },
            { label: "Copia reflejada (izquierda ↔ derecha)", icon: FlipHorizontal2, shortcut: "M", action: mirror, disabled: !sel },
            { label: "Eliminar", icon: Trash2, shortcut: "Supr", action: del, disabled: !sel },
            { divider: true },
            { label: "Seleccionar todo", shortcut: "Ctrl+A", action: () => setSelection(cur().parts.map((p) => p.id)) },
            { label: "Agrupar", icon: Group, shortcut: "Ctrl+G", action: group, disabled: !sel },
            { label: "Desagrupar", icon: Ungroup, shortcut: "Ctrl+Mayús+G", action: doUngroup, disabled: !isGroup },
          ],
        },
        {
          id: "view",
          label: "Ver",
          items: [
            { label: "Encajar el modelo", icon: Focus, shortcut: "F", action: () => view("isométrica") },
            { label: "Frente", action: () => view("frente") },
            { label: "Detrás", action: () => view("detrás") },
            { label: "Izquierda", action: () => view("izquierda") },
            { label: "Derecha", action: () => view("derecha") },
            { label: "Arriba", action: () => view("arriba") },
            { divider: true },
            { label: "Render…", icon: Sparkles, action: () => void openRender() },
            { label: "Piezas…", icon: Package, action: () => setDialog("pieces") },
            { divider: true },
            { label: refMesh ? `Referencia: ${refMesh.name}` : "Referencia (Archivo › Importar)", icon: ScanEye, checked: !!refMesh && refVisible, action: () => setRefVisible(!refVisible), disabled: !refMesh },
            { label: "Quitar la referencia", action: () => apply(clearReference(cur())), disabled: !refMesh },
            { divider: true },
            { label: "Modelar", checked: mode === "model", shortcut: "1", action: () => setMode("model") },
            { label: "Pintar", checked: mode === "paint", shortcut: "2", action: () => setMode("paint") },
            { label: "Animar", checked: mode === "animate", shortcut: "3", action: () => setMode("animate") },
          ],
        },
        {
          id: "anim",
          label: "Animación",
          items: [
            { label: "Animación nueva…", icon: Plus, action: () => void newAnim() },
            { label: playing ? "Detener" : "Reproducir", icon: playing ? Pause : Play, shortcut: "Espacio", action: () => setPlaying(!playing), disabled: !anim },
            { label: "Fotograma clave en la pieza", icon: Diamond, shortcut: "K", action: keyHere, disabled: !anim || !sel },
            { label: "Quitar el fotograma clave", action: unkeyHere, disabled: !anim || !sel },
            { divider: true },
            { label: "Copiar pose", icon: ClipboardCopy, shortcut: "Ctrl+Mayús+C", action: copyPoseNow, disabled: !anim },
            { label: "Pegar pose", icon: ClipboardPaste, shortcut: "Ctrl+Mayús+V", action: () => pastePoseNow(false), disabled: !anim },
            { label: "Pegar pose reflejada (izquierda ↔ derecha)", icon: FlipHorizontal2, shortcut: "Ctrl+Mayús+B", action: () => pastePoseNow(true), disabled: !anim },
            { label: "Papel cebolla", icon: Layers, checked: onion, action: () => setOnion(!onion) },
            { divider: true },
            { label: "Eliminar la animación", icon: Trash2, action: () => anim && apply(removeAnimation(cur(), anim.id)), disabled: !anim },
          ],
        },
        {
          id: "help",
          label: "Ayuda",
          items: [
            {
              label: "Cómo usar",
              icon: Keyboard,
              action: () =>
                void showMessage(
                  "Cómo usar CoffeeAnimate3D",
                  "Modelar (1): añade cubos, cilindros, esferas, rampas, planos y huesos (la forma se cambia en Propiedades; todas se pintan cara a cara: el cilindro reparte su lateral en cuatro caras y la rampa usa la de arriba como pendiente); cada pieza gira alrededor de su pivote y arrastra a sus hijas. Con el gizmo mueves (G), giras (R) o escalas (S, desde el pivote); el tamaño exacto y los botones −/+ van en Propiedades. M crea la copia reflejada (por ejemplo, la pata derecha a partir de la izquierda). Mayús+clic añade piezas a la selección (Mayús+arrastrar en vacío: rectángulo; Ctrl+A: todas); Ctrl+G agrupa y Ctrl+Mayús+G desagrupa. El ajuste a la cuadrícula está en la barra (Ctrl invierte el paso de giro de 15°). Mayús+M mide distancias. El cubo de vista (arriba a la derecha) gira la cámara hacia la cara, arista o esquina que pulses.\n\nPintar (2): pinta píxel a píxel sobre las caras (texturas de 32×32), rellena una cara o toma un color con el cuentagotas.\n\nAnimar (3): elige una animación, coloca el tiempo, mueve o gira piezas con el gizmo (crea una clave) o pulsa K. Espacio reproduce.\n\nExporta a glTF (.glb) para SurvivalForest, Blender, Godot o Unity. 16 unidades = 1 bloque.",
                ),
            },
            {
              label: "Claude (MCP)",
              icon: Bot,
              action: () =>
                void showMessage(
                  "Modelar y animar con Claude (MCP)",
                  mcp.status === "off"
                    ? "Actívalo en el Launcher de CoffeeWorks › Ajustes › «Permitir que Claude controle CoffeeAnimate3D (MCP)» y copia allí la configuración para Claude. Con esta app abierta, Claude puede crear piezas, pintar, animar, mirar capturas y exportar; todo se puede deshacer con Ctrl+Z."
                    : `El servidor MCP está activo en ${mcp.address}. ${mcp.status === "connected" ? "Claude está conectado." : "Esperando a que Claude se conecte."} Todo lo que haga Claude se puede deshacer con Ctrl+Z.`,
                ),
            },
            { label: "Acerca de CoffeeAnimate3D", icon: Info, action: () => void showMessage("CoffeeAnimate3D", "Modelado y animación 3D con cubos de la suite CoffeeWorks: piezas en jerarquía con pivotes, texturas de 32×32 pintadas sobre el modelo, plantillas de criaturas, animación por fotogramas clave y exportación a glTF. Se puede controlar desde Claude por MCP.") },
          ],
        },
      ]
    : [];

  const logo = <img src="/app-icon.png" alt="" className="w-8 h-8" />;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#18181b] text-[#e4e4e8]" data-app="coffeeanimate3d">
      <style>{STUDIO_CSS}</style>
      {doc && (
        <>
          <SuiteHeader
            logo={logo}
            logoTitle="Pantalla de inicio"
            onLogoClick={() => sd.setShowStart(true)}
            title={sd.title}
            titlePlaceholder="Modelo sin título"
            onTitleChange={sd.setTitle}
            menus={menus}
            saveStatus={sd.saveStatus}
            fileLocation={sd.location}
            isStarred={sd.isStarred}
            onToggleStar={() => void sd.toggleStar()}
            onBeforeClose={sd.flush}
            actions={
              <div className="flex gap-2 items-center">
                {mcp.status !== "off" && (
                  <span className={cx("flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md", mcp.status === "connected" ? "bg-[#1f3a2a] text-[#8be0a4]" : "bg-[#2a2a30] text-[#a1a1aa]")} title={`MCP en ${mcp.address}`} data-mcp-status={mcp.status}>
                    <Bot size={13} /> {mcp.status === "connected" ? "Claude conectado" : "MCP activo"}
                  </span>
                )}
                <Button primary onClick={() => void exportModel()}>
                  <Download size={14} /> Exportar .glb
                </Button>
              </div>
            }
          />
          <div className="flex flex-1 min-h-0">
            {/* Árbol de piezas */}
            <aside className="w-60 shrink-0 border-r border-[#2a2a30] bg-[#1f1f23] flex flex-col min-h-0">
              <div className="px-3 py-2 flex flex-col gap-1.5 border-b border-[#2a2a30]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-[#8a8a92] font-semibold">Piezas</span>
                  <div className="flex gap-0.5">
                    <IconButton icon={Copy} title="Duplicar (Ctrl+D)" onClick={dup} disabled={!sel} />
                    <IconButton icon={FlipHorizontal2} title="Copia reflejada (M)" onClick={mirror} disabled={!sel} />
                    <IconButton icon={Trash2} title="Eliminar (Supr)" onClick={del} disabled={!sel} />
                  </div>
                </div>
                <div className="flex gap-0.5" data-add-shapes>
                  <IconButton icon={BoxIcon} title="Añadir cubo" onClick={() => addCube(false)} />
                  <IconButton icon={Cylinder} title="Añadir cilindro" onClick={() => addCube(false, "cylinder")} />
                  <IconButton icon={Circle} title="Añadir esfera" onClick={() => addCube(false, "sphere")} />
                  <IconButton icon={Triangle} title="Añadir rampa (sube hacia atrás)" onClick={() => addCube(false, "ramp")} />
                  <IconButton icon={Square} title="Añadir plano" onClick={() => addCube(false, "plane")} />
                  <IconButton icon={Bone} title="Añadir hueso (sin caja)" onClick={() => addCube(true)} />
                </div>
              </div>
              <div className="flex-1 overflow-auto py-1" data-outliner>
                {doc.parts.length === 0 && <div className="px-3 py-4 text-[12px] text-[#8a8a92] leading-relaxed">Añade un cubo o empieza desde una plantilla (Archivo › Nuevo desde plantilla).</div>}
                <Tree model={doc} parent={null} depth={0} selection={selection} onSelect={(id, additive) => (additive ? toggleSel(id) : setSel(id))} onToggle={(p) => apply(updatePart(cur(), p.id, { visible: !p.visible }))} anim={mode === "animate" ? anim : null} />
              </div>
            </aside>

            {/* Visor */}
            <main className="flex-1 min-w-0 flex flex-col">
              <div className="h-10 shrink-0 flex items-center gap-1 px-2 border-b border-[#2a2a30] bg-[#1f1f23]">
                {(
                  [
                    ["model", "Modelar", BoxIcon],
                    ["paint", "Pintar", Pencil],
                    ["animate", "Animar", Play],
                  ] as const
                ).map(([m, label, Icon]) => (
                  <button key={m} type="button" onClick={() => setMode(m)} className={cx("px-3 h-7 rounded-md text-[12px] flex items-center gap-1.5", mode === m ? "bg-[#ff8a3d] text-[#1a1a1d] font-semibold" : "text-[#c4c4cc] hover:bg-[#2a2a30]")} data-mode={m}>
                    <Icon size={13} /> {label}
                  </button>
                ))}
                <div className="w-px h-5 bg-[#2a2a30] mx-2" />
                {mode !== "paint" ? (
                  <>
                    <IconButton icon={Move3d} title="Mover (G)" active={gizmo === "translate"} onClick={() => setGizmoState("translate")} />
                    <IconButton icon={Rotate3d} title="Rotar (R)" active={gizmo === "rotate"} onClick={() => setGizmoState("rotate")} />
                    <IconButton icon={Scale3d} title="Escalar (S)" active={gizmo === "scale"} onClick={() => setGizmoState("scale")} />
                    <Select
                      value={String(snap.step)}
                      onChange={(v) => setSnap({ ...snap, step: Number(v) as SnapStep })}
                      options={SNAP_OPTIONS.map((o) => ({ value: String(o.step), label: `Ajuste: ${o.label}` }))}
                      className="w-32 ml-1"
                      title="Ajuste a la cuadrícula al mover y escalar"
                    />
                    <Toggle checked={snap.rotate} onChange={(v) => setSnap({ ...snap, rotate: v })} label="Giro 15°" />
                    <IconButton icon={Ruler} title="Medir (Mayús+M)" active={viewTool === "measure"} onClick={() => setViewTool(viewTool === "measure" ? "select" : "measure")} />
                    {viewTool === "measure" && (
                      <span className="text-[11px] text-[#ffb27a] ml-1" data-measure>
                        {measured == null ? "Haz clic en dos puntos" : formatDistance(measured)}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <IconButton icon={Pencil} title="Lápiz" active={tool === "pencil"} onClick={() => setTool("pencil")} />
                    <IconButton icon={PaintBucket} title="Rellenar la cara" active={tool === "fill"} onClick={() => setTool("fill")} />
                    <IconButton icon={Pipette} title="Cuentagotas" active={tool === "picker"} onClick={() => setTool("picker")} />
                    <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-7 h-7 rounded bg-transparent ml-1" title="Color" data-paint-color />
                    <div className="flex gap-0.5 ml-1">
                      {PALETTE.map((c) => (
                        <button key={c} type="button" title={c} onClick={() => setColor(c)} className={cx("w-4 h-4 rounded-sm border", color === c ? "border-white" : "border-black/40")} style={{ background: c }} />
                      ))}
                    </div>
                  </>
                )}
                <div className="flex-1" />
                <IconButton icon={Focus} title="Encajar (F)" onClick={() => view("isométrica")} />
                <Select value="" onChange={(v) => v && view(v as ViewAngle)} options={[{ value: "", label: "Vista…" }, ...(["frente", "detrás", "izquierda", "derecha", "arriba", "isométrica"] as const).map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))]} className="w-28" />
              </div>
              <div ref={hostRef} className="flex-1 min-h-0 relative" data-viewport />
              {mode === "animate" && (
                <Timeline
                  model={doc}
                  animId={animId}
                  setAnimId={(id) => {
                    setAnimId(id);
                    setTime(0);
                  }}
                  time={time}
                  setTime={setTime}
                  playing={playing}
                  setPlaying={setPlaying}
                  sel={sel}
                  setSel={setSel}
                  ease={ease}
                  setEase={setEase}
                  onNew={() => void newAnim()}
                  onKey={keyHere}
                  onUnkey={unkeyHere}
                  onChange={(m, key) => apply(m, key)}
                  onion={onion}
                  setOnion={setOnion}
                />
              )}
            </main>

            {/* Propiedades */}
            <aside className="w-72 shrink-0 border-l border-[#2a2a30] bg-[#1f1f23] overflow-auto" data-properties>
              {selection.length > 1 ? (
                <MultiPanel model={doc} ids={selection} onGroup={group} onDelete={del} onMove={(delta) => apply(translateParts(cur(), selection, delta))} />
              ) : selPart ? (
                <PartPanel key={selPart.id} model={doc} part={selPart} mode={mode} color={color} onPatch={patch} onFill={(f) => apply(fillFace(cur(), selPart.id, f, color))} onGrow={grow} onUngroup={isGroup ? doUngroup : undefined} />
              ) : (
                <div className="p-4 text-[12px] text-[#8a8a92] leading-relaxed">
                  Selecciona una pieza en el visor o en la lista para ver sus propiedades.
                  <div className="mt-4 flex flex-col gap-2">
                    <span className="text-[11px] uppercase tracking-wider text-[#6e6e76] font-semibold">Empezar desde una plantilla</span>
                    {Object.keys(TEMPLATES).map((n) => (
                      <Button key={n} onClick={() => fromTemplate(n)}>
                        <Shapes size={14} /> {n[0].toUpperCase() + n.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </>
      )}
      <CommandSearch isOpen={commandOpen} onClose={() => setCommandOpen(false)} menus={menus} />
      {sd.showStart && (
        <StartScreen
          appName="CoffeeAnimate3D"
          tagline="Modelado y animación 3D con cubos • CoffeeWorks"
          accent={ACCENT_DARK}
          newHint="Modelo vacío (o elige una plantilla dentro)"
          openHint="Abrir un modelo .ca3d"
          formats={[".ca3d"]}
          recents={sd.recents}
          onNew={() => void sd.newDocument()}
          onOpen={() => void sd.open()}
          onOpenRecent={(e) => void sd.openRecent(e)}
          onContinue={doc ? () => sd.setShowStart(false) : undefined}
          currentTitle={sd.title}
        />
      )}
      {dialog === "render" && <RenderDialog viewport={getViewport} title={sd.title} onClose={closeDialog} />}
      {dialog === "pieces" && <PiecesDialog onInsert={(e) => void insertPieceFrom(e)} onClose={closeDialog} />}
      <DialogHost />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Árbol de piezas
// ---------------------------------------------------------------------------

const Tree: React.FC<{ model: Model3D; parent: string | null; depth: number; selection: string[]; onSelect: (id: string, additive: boolean) => void; onToggle: (p: Part) => void; anim: Model3D["animations"][number] | null }> = ({ model, parent, depth, selection, onSelect, onToggle, anim }) => (
  <>
    {model.parts
      .filter((p) => p.parent === parent)
      .map((p) => (
        <React.Fragment key={p.id}>
          <div
            className={cx("flex items-center gap-1.5 pr-2 h-7 cursor-pointer text-[12px]", selection.includes(p.id) ? (selection.at(-1) === p.id ? "bg-[#ff8a3d]/25 text-white" : "bg-[#ff8a3d]/12 text-white") : "hover:bg-[#2a2a30] text-[#c4c4cc]")}
            style={{ paddingLeft: 8 + depth * 14 }}
            onClick={(e) => onSelect(p.id, e.shiftKey)}
            data-part={p.name}
          >
            {p.box ? <ShapeIcon shape={p.box.shape} /> : <Bone size={13} className="text-[#8ab4ff] shrink-0" />}
            <span className="truncate flex-1">{p.name}</span>
            {anim?.tracks[p.id]?.length ? <Diamond size={10} className="text-[#ffd166] shrink-0" /> : null}
            <button
              type="button"
              title={p.visible ? "Ocultar" : "Mostrar"}
              onClick={(e) => {
                e.stopPropagation();
                onToggle(p);
              }}
              className="text-[#8a8a92] hover:text-white"
            >
              {p.visible ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
          </div>
          <Tree model={model} parent={p.id} depth={depth + 1} selection={selection} onSelect={onSelect} onToggle={onToggle} anim={anim} />
        </React.Fragment>
      ))}
  </>
);

const SHAPE_ICON: Record<Shape, typeof BoxIcon> = { box: BoxIcon, cylinder: Cylinder, sphere: Circle, ramp: Triangle, plane: Square };
const ShapeIcon: React.FC<{ shape: Shape }> = ({ shape }) => {
  const Icon = SHAPE_ICON[shape] ?? BoxIcon;
  return <Icon size={13} className="text-[#ffb27a] shrink-0" />;
};

// ---------------------------------------------------------------------------
// Propiedades de la pieza
// ---------------------------------------------------------------------------

const Vec3Field: React.FC<{ label: string; value: Vec3; onChange: (v: Vec3) => void; step?: number; min?: number }> = ({ label, value, onChange, step = 1, min }) => (
  <div className="flex flex-col gap-1">
    <span className="text-[11px] text-[#8a8a92]">{label}</span>
    <div className="grid grid-cols-3 gap-1">
      {(["X", "Y", "Z"] as const).map((axis, i) => (
        <NumberField key={axis} label={axis} value={value[i]} step={step} min={min} onChange={(v) => onChange(value.map((x, k) => (k === i ? v : x)) as Vec3)} />
      ))}
    </div>
  </div>
);

const PartPanel: React.FC<{ model: Model3D; part: Part; mode: Mode; color: string; onPatch: (p: Parameters<typeof updatePart>[2], key?: string) => void; onFill: (f: FaceName) => void; onGrow: (axis: 0 | 1 | 2, amount: number) => void; onUngroup?: () => void }> = ({ model, part, mode, color, onPatch, onFill, onGrow, onUngroup }) => {
  const banned = new Set([part.id, ...descendants(model, part.id)]);
  const parents = [{ value: "", label: "(ninguna: raíz)" }, ...model.parts.filter((p) => !banned.has(p.id)).map((p) => ({ value: p.id, label: p.name }))];
  return (
    <div className="flex flex-col">
      <Section title="Pieza">
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-[#8a8a92]">Nombre</span>
            <input value={part.name} onChange={(e) => onPatch({ name: e.target.value }, `name-${part.id}`)} className="h-8 rounded-md bg-[#141416] border border-[#2a2a30] px-2 text-[12px]" data-part-name />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-[#8a8a92]">Pieza padre</span>
            <Select value={part.parent ?? ""} onChange={(v) => onPatch({ parent: v || null })} options={parents} />
          </label>
          <Vec3Field label="Pivote (centro de giro)" value={part.pivot} onChange={(v) => onPatch({ pivot: v }, `pivot-${part.id}`)} step={0.5} />
          <Vec3Field label="Rotación de reposo (°)" value={part.rotation} onChange={(v) => onPatch({ rotation: v }, `rot-${part.id}`)} step={5} />
          {mode === "animate" && <p className="text-[11px] text-[#8a8a92] leading-relaxed">En Animar, el gizmo crea fotogramas clave; estos valores cambian el reposo.</p>}
        </div>
      </Section>
      <Section title="Caja">
        {part.box ? (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-[#8a8a92]">Forma</span>
              <Select value={part.box.shape} onChange={(v) => onPatch({ box: { shape: v as Shape } })} options={SHAPES.map((sh) => ({ value: sh, label: SHAPE_LABEL[sh] }))} data-shape-select />
            </label>
            <Vec3Field label="Desde (relativo al pivote)" value={part.box.from} onChange={(v) => onPatch({ box: { from: v } }, `from-${part.id}`)} step={0.5} />
            <Vec3Field label="Tamaño (16 = 1 bloque)" value={part.box.size} onChange={(v) => onPatch({ box: { size: v.map((s) => Math.max(0.1, s)) as Vec3 } }, `size-${part.id}`)} step={0.5} min={0.1} />
            <div className="flex flex-col gap-1" data-grow>
              <span className="text-[11px] text-[#8a8a92]">Agrandar o encoger (desde el centro)</span>
              {(["X", "Y", "Z"] as const).map((axis, i) => (
                <div key={axis} className="flex items-center gap-1">
                  <span className="w-4 text-[11px] text-[#8a8a92]">{axis}</span>
                  {[-16, -8, 8, 16].map((d) => (
                    <button key={d} type="button" onClick={() => onGrow(i as 0 | 1 | 2, d)} className="flex-1 h-6 rounded bg-[#141416] border border-[#2a2a30] hover:border-[#ff8a3d] text-[10px] flex items-center justify-center gap-0.5" title={`${d > 0 ? "Agrandar" : "Encoger"} ${Math.abs(d) === 16 ? "1 bloque" : "½ bloque"} en ${axis}`} data-grow-btn={`${axis}${d > 0 ? "+" : ""}${d}`}>
                      {d > 0 ? <Plus size={10} /> : <Minus size={10} />}
                      {Math.abs(d) === 16 ? "1" : "½"}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <Button onClick={() => onPatch({ box: { color } })}>
              <PaintBucket size={14} /> Pintar toda la caja del color actual
            </Button>
            <Button onClick={() => onPatch({ box: null })}>Quitar la caja (dejar solo el hueso)</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Button onClick={() => onPatch({ box: { from: [-2, 0, -2], size: [4, 4, 4], color } })}>
              <BoxIcon size={14} /> Añadir una caja
            </Button>
            {onUngroup && (
              <Button onClick={onUngroup}>
                <Ungroup size={14} /> Desagrupar (Ctrl+Mayús+G)
              </Button>
            )}
          </div>
        )}
      </Section>
      {part.box && (
        <Section title="Caras" defaultOpen={mode === "paint"}>
          <div className="grid grid-cols-2 gap-1.5">
            {SHAPE_FACES[part.box.shape].map((f) => (
              <button key={f} type="button" onClick={() => onFill(f)} title={`Rellenar «${FACE_LABEL[f]}» con el color actual`} className="flex items-center gap-1.5 h-7 px-2 rounded-md bg-[#141416] border border-[#2a2a30] hover:border-[#ff8a3d] text-[11px] text-left">
                <span className="w-3 h-3 rounded-sm border border-black/40" style={{ background: part.box!.faces[f].color }} />
                <span className="truncate">{FACE_LABEL[f]}</span>
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
};

/** Valor común a todas (o null si difieren). */
const common = (values: number[]) => (values.every((v) => v === values[0]) ? values[0] : null);

const MultiPanel: React.FC<{ model: Model3D; ids: string[]; onGroup: () => void; onDelete: () => void; onMove: (delta: Vec3) => void }> = ({ model, ids, onGroup, onDelete, onMove }) => {
  const parts = ids.map((id) => model.parts.find((p) => p.id === id)).filter((p): p is Part => !!p);
  return (
    <div className="flex flex-col" data-multi-panel>
      <Section title={`${parts.length} piezas seleccionadas`}>
        <div className="flex flex-col gap-2">
          <span className="text-[11px] text-[#8a8a92]">Pivote (vacío si difieren; al escribir se mueven todas lo mismo)</span>
          <div className="grid grid-cols-3 gap-1">
            {(["X", "Y", "Z"] as const).map((axis, i) => {
              const v = common(parts.map((p) => p.pivot[i]));
              return (
                <label key={axis} className="flex items-center gap-1 h-8 rounded-md bg-[#141416] border border-[#2a2a30] px-2 text-[12px]">
                  <span className="text-[#8a8a92]">{axis}</span>
                  <input
                    key={`${axis}-${v}`}
                    defaultValue={v ?? ""}
                    placeholder="—"
                    className="w-full bg-transparent outline-none"
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      const n = parseNumber((e.target as HTMLInputElement).value);
                      if (n == null) return;
                      const delta: Vec3 = [0, 0, 0];
                      delta[i] = v == null ? n : n - v;
                      onMove(delta);
                    }}
                  />
                </label>
              );
            })}
          </div>
          <p className="text-[11px] text-[#8a8a92] leading-relaxed">Con el gizmo (G, R, S) se transforman juntas si cuelgan de la misma pieza.</p>
          <Button onClick={onGroup}>
            <Group size={14} /> Agrupar (Ctrl+G)
          </Button>
          <Button onClick={onDelete}>
            <Trash2 size={14} /> Eliminar las {parts.length} piezas
          </Button>
        </div>
      </Section>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Línea de tiempo
// ---------------------------------------------------------------------------

const Timeline: React.FC<{
  model: Model3D;
  animId: string | null;
  setAnimId: (id: string) => void;
  time: number;
  setTime: (t: number) => void;
  playing: boolean;
  setPlaying: (p: boolean) => void;
  sel: string | null;
  setSel: (id: string) => void;
  ease: Ease;
  setEase: (e: Ease) => void;
  onNew: () => void;
  onKey: () => void;
  onUnkey: () => void;
  onChange: (m: Model3D, key?: string) => void;
  onion: boolean;
  setOnion: (v: boolean) => void;
}> = ({ model, animId, setAnimId, time, setTime, playing, setPlaying, sel, setSel, ease, setEase, onNew, onKey, onUnkey, onChange, onion, setOnion }) => {
  const [curves, setCurves] = useState(false);
  const anim = model.animations.find((a) => a.id === animId) ?? null;
  const barRef = useRef<HTMLDivElement | null>(null);
  const rows = useMemo(() => model.parts.filter((p) => anim?.tracks[p.id]?.length || p.id === sel), [model, anim, sel]);
  const scrub = (clientX: number) => {
    if (!anim || !barRef.current) return;
    const r = barRef.current.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * anim.length;
    setTime(Math.round(t * 24) / 24);
  };
  return (
    <div className="h-52 shrink-0 border-t border-[#2a2a30] bg-[#1b1b1f] flex flex-col" data-timeline>
      <div className="h-10 flex items-center gap-2 px-3 border-b border-[#2a2a30]">
        <Select value={animId ?? ""} onChange={(v) => setAnimId(v)} options={model.animations.length ? model.animations.map((a) => ({ value: a.id, label: a.name })) : [{ value: "", label: "(sin animaciones)" }]} className="w-40" />
        <IconButton icon={Plus} title="Animación nueva" onClick={onNew} />
        <IconButton icon={playing ? Pause : Play} title="Reproducir (Espacio)" onClick={() => setPlaying(!playing)} disabled={!anim} active={playing} />
        <span className="font-mono text-[12px] text-[#c4c4cc] w-24">{anim ? `${time.toFixed(2)} / ${anim.length.toFixed(2)} s` : "—"}</span>
        <IconButton icon={Diamond} title="Fotograma clave en la pieza (K)" onClick={onKey} disabled={!anim || !sel} accent="#ffd166" />
        <IconButton icon={Trash2} title="Quitar el fotograma clave" onClick={onUnkey} disabled={!anim || !sel} />
        <Select value={ease} onChange={(v) => setEase(v as Ease)} options={EASES.map((e) => ({ value: e, label: EASE_LABEL[e] }))} className="w-28" title="Interpolación de las claves nuevas" />
        <IconButton icon={Spline} title="Curvas de la pieza" active={curves} onClick={() => setCurves(!curves)} disabled={!anim} />
        <IconButton icon={Layers} title="Papel cebolla (claves anterior y siguiente)" active={onion} onClick={() => setOnion(!onion)} disabled={!anim} />
        {anim && (
          <>
            <div className="w-28">
              <NumberField label="Duración" value={anim.length} step={0.1} min={0.1} suffix="s" onChange={(v) => onChange(updateAnimation(model, anim.id, { length: v }))} />
            </div>
            <Toggle checked={anim.loop} onChange={(v) => onChange(updateAnimation(model, anim.id, { loop: v }))} label="Bucle" />
          </>
        )}
      </div>
      {anim && curves ? (
        <CurveView model={model} anim={anim} partId={sel} time={time} setTime={setTime} onChange={onChange} />
      ) : anim ? (
        <div className="flex-1 min-h-0 overflow-auto flex">
          <div className="w-44 shrink-0 border-r border-[#2a2a30]">
            <div className="h-6 border-b border-[#2a2a30]" />
            {rows.map((p) => (
              <div key={p.id} onClick={() => setSel(p.id)} className={cx("h-6 px-2 text-[11px] flex items-center truncate cursor-pointer", p.id === sel ? "text-white bg-[#ff8a3d]/15" : "text-[#a1a1aa]")}>
                {p.name}
              </div>
            ))}
          </div>
          <div className="flex-1 relative min-w-[300px]">
            <div ref={barRef} className="h-6 border-b border-[#2a2a30] relative cursor-ew-resize" onPointerDown={(e) => { scrub(e.clientX); const move = (ev: PointerEvent) => scrub(ev.clientX); const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); }; window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); }} data-scrubber>
              {Array.from({ length: Math.floor(anim.length * 4) + 1 }, (_, i) => (
                <span key={i} className="absolute top-0 h-full border-l border-[#33333a] text-[9px] text-[#6e6e76] pl-0.5" style={{ left: `${((i / 4) / anim.length) * 100}%` }}>
                  {i % 4 === 0 ? `${i / 4}s` : ""}
                </span>
              ))}
            </div>
            {rows.map((p) => (
              <div key={p.id} className="h-6 relative border-b border-[#232328]">
                {(anim.tracks[p.id] ?? []).map((k) => (
                  <button key={k.t} type="button" title={`${k.t.toFixed(2)} s · ${EASE_LABEL[k.ease].toLowerCase()}`} onClick={() => { setSel(p.id); setTime(k.t); }} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rotate-45 bg-[#ffd166] border border-[#7a5a10] hover:scale-125" style={{ left: `${(k.t / anim.length) * 100}%` }} data-key />
                ))}
              </div>
            ))}
            <div className="absolute top-0 bottom-0 w-px bg-[#ff8a3d] pointer-events-none" style={{ left: `${(time / anim.length) * 100}%` }} />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-[12px] text-[#8a8a92] gap-2">
          No hay animaciones. <Button onClick={onNew}><Plus size={14} /> Crear una</Button>
        </div>
      )}
    </div>
  );
};

const EASE_LABEL: Record<Ease, string> = { smooth: "Suave", linear: "Lineal", step: "Escalón", "ease-in": "Entrada lenta", "ease-out": "Salida lenta" };
const AXIS_COLOR = ["#ff6b6b", "#7bd88f", "#6ab0ff"];
type Channel = "pos" | "rot" | "scale";
const CHANNEL_LABEL: Record<Channel, string> = { pos: "Posición", rot: "Giro (°)", scale: "Escala" };

/** Curvas de una pieza: un color por eje; las claves se arrastran (tiempo y valor). */
const CurveView: React.FC<{ model: Model3D; anim: Model3D["animations"][number]; partId: string | null; time: number; setTime: (t: number) => void; onChange: (m: Model3D, key?: string) => void }> = ({ model, anim, partId, time, setTime, onChange }) => {
  const [channel, setChannel] = useState<Channel>("rot");
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ t: number; axis: 0 | 1 | 2; n: number } | null>(null);
  const keys = partId ? anim.tracks[partId] ?? [] : [];
  const W = 1000;
  const H = 120;
  const samples = useMemo(() => {
    if (!partId || !keys.length) return [] as number[][];
    return Array.from({ length: 81 }, (_, i) => {
      const t = (i / 80) * anim.length;
      const p = samplePose(model, anim.id, Math.min(t, anim.length - 1e-6)).get(partId);
      return p ? p[channel] : [0, 0, 0];
    });
  }, [model, anim, partId, channel, keys.length]);
  const all = [...samples.flat(), ...keys.flatMap((k) => k[channel])];
  const lo = Math.min(0, ...all);
  const hi = Math.max(lo + 1, ...all);
  const pad = (hi - lo) * 0.1;
  const y = (v: number) => H - ((v - lo + pad) / (hi - lo + 2 * pad)) * H;
  const x = (t: number) => (t / anim.length) * W;
  const toValue = (py: number) => lo - pad + ((H - py) / H) * (hi - lo + 2 * pad);
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !partId || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const t = Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * anim.length * 24) / 24;
    const v = Math.round(toValue(((e.clientY - r.top) / r.height) * H) * 10) / 10;
    try {
      const next = moveKeyframe(model, anim.id, partId, d.t, { t, channel: { kind: channel, axis: d.axis, value: v } });
      onChange(next, `curve-${d.n}`);
      d.t = Math.round(t * 1000) / 1000;
      setTime(d.t);
    } catch {
      /* la clave ya no existe */
    }
  };
  if (!partId) return <div className="flex-1 flex items-center justify-center text-[12px] text-[#8a8a92]">Elige una pieza para ver sus curvas.</div>;
  return (
    <div className="flex-1 min-h-0 flex flex-col px-3 py-2 gap-1" data-curves>
      <div className="flex items-center gap-2 text-[11px] text-[#a1a1aa]">
        {(["pos", "rot", "scale"] as Channel[]).map((c) => (
          <button key={c} type="button" onClick={() => setChannel(c)} className={cx("px-2 h-6 rounded", channel === c ? "bg-[#ff8a3d] text-[#1a1a1d] font-semibold" : "hover:bg-[#2a2a30]")}>
            {CHANNEL_LABEL[c]}
          </button>
        ))}
        <span className="ml-2">{["X", "Y", "Z"].map((a, i) => <span key={a} className="mr-2" style={{ color: AXIS_COLOR[i] }}>■ {a}</span>)}</span>
        {!keys.length && <span>Esta pieza no tiene claves en «{anim.name}».</span>}
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="flex-1 w-full bg-[#141416] rounded border border-[#2a2a30]" onPointerMove={onMove} onPointerUp={() => (drag.current = null)} onPointerLeave={() => (drag.current = null)}>
        <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="#2c2c33" />
        <line x1={x(time)} x2={x(time)} y1={0} y2={H} stroke="#ff8a3d" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {[0, 1, 2].map((axis) => (
          <polyline key={axis} fill="none" stroke={AXIS_COLOR[axis]} strokeWidth={1.5} vectorEffect="non-scaling-stroke" points={samples.map((v, i) => `${(i / 80) * W},${y(v[axis])}`).join(" ")} />
        ))}
        {keys.map((k) =>
          [0, 1, 2].map((axis) => (
            <rect
              key={`${k.t}-${axis}`}
              x={x(k.t) - 6}
              y={y(k[channel][axis]) - 3}
              width={12}
              height={6}
              fill={AXIS_COLOR[axis]}
              stroke="#111"
              className="cursor-move"
              data-curve-key
              onPointerDown={(e) => {
                (e.target as Element).setPointerCapture?.(e.pointerId);
                drag.current = { t: k.t, axis: axis as 0 | 1 | 2, n: Date.now() };
                setTime(k.t);
              }}
            />
          )),
        )}
      </svg>
    </div>
  );
};

export { ACCENT };
