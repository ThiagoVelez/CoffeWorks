// Visor 3D (three.js): dibuja el modelo con su pose, permite seleccionar piezas,
// moverlas o girarlas con el gizmo, pintar sobre las caras y hacer capturas.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { facePixels } from "./model";
import { CORNER_UV, FACE_GEOMETRY, QUAD_INDICES, faceCorners, uvToPixel } from "./geometry";
import { FACES, TEX, type FaceName, type Model3D, type Pose, type Vec3 } from "./types";
import { ViewCube, cameraDir } from "./viewcube";
import { ROTATE_STEP, gridAnchor, type SnapStep } from "./snap";
import { topLevel } from "./model";
import type { Quat } from "./rotation";

export type GizmoMode = "translate" | "rotate" | "scale";
export type ViewTool = "select" | "measure";

/** Cambio hecho con el gizmo (al soltar). Coordenadas en el espacio del padre. */
export interface TransformChange {
  ids: string[];
  /** Una pieza movida: pivote nuevo. */
  pivot?: Vec3;
  /** Una pieza girada: rotación nueva (grados). */
  rotation?: Vec3;
  /** Varias piezas movidas. */
  delta?: Vec3;
  /** Varias piezas giradas (cuaternión en el espacio del padre) alrededor de un centro. */
  rotate?: { quat: Quat; center: Vec3 };
  /** Escala: factor por eje (una pieza en Modelar: desde su pivote; en Animar: escala absoluta del hueso). */
  scale?: { factor: Vec3; center: Vec3 };
}
export type ViewAngle = "frente" | "detrás" | "izquierda" | "derecha" | "arriba" | "isométrica";

export interface ViewportEvents {
  /** Clic en una pieza (o en vacío: null). `additive` con Mayús. */
  onSelect: (id: string | null, additive: boolean) => void;
  /** Rectángulo con Mayús+arrastre en vacío. */
  onSelectRect: (ids: string[], additive: boolean) => void;
  /** Fin de un arrastre del gizmo. */
  onTransform: (change: TransformChange) => void;
  /** Distancia medida en unidades (null: sin medida). */
  onMeasure: (distance: number | null) => void;
  /** Pintar: pieza, cara y píxel tocados. `last` es el último del trazo. */
  onPaint: (id: string, face: FaceName, x: number, y: number, last: boolean) => void;
}

const DEG = Math.PI / 180;

function faceTexture(px: Uint8Array): THREE.DataTexture {
  const tex = new THREE.DataTexture(px.slice(), TEX, TEX, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

/** Caja con nuestro orden de caras y UV (igual que la exportación). */
function boxGeometry(box: NonNullable<Model3D["parts"][number]["box"]>): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const geo = new THREE.BufferGeometry();
  FACES.forEach((f, i) => {
    const base = i * 4;
    faceCorners(box, f).forEach((c, k) => {
      pos.push(...c);
      nor.push(...FACE_GEOMETRY[f].normal);
      uv.push(...CORNER_UV[k]);
    });
    idx.push(...QUAD_INDICES.map((q) => q + base));
    geo.addGroup(i * 6, 6, i);
  });
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

export class Viewport {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly orbit: OrbitControls;
  readonly gizmo: TransformControls;
  readonly viewCube: ViewCube;
  private root = new THREE.Group();
  private groups = new Map<string, THREE.Group>();
  private meshes: THREE.Mesh[] = [];
  private outlines: THREE.BoxHelper[] = [];
  private selected: string[] = [];
  /** Objeto auxiliar del gizmo cuando hay varias piezas. */
  private multi = new THREE.Object3D();
  private multiStart = { pos: new THREE.Vector3(), center: [0, 0, 0] as Vec3 };
  private gizmoMode: GizmoMode = "translate";
  private snap: { step: SnapStep; rotate: boolean } = { step: 1, rotate: true };
  private tool: ViewTool = "select";
  private measure: { a: THREE.Vector3 | null; line: THREE.Line | null; dots: THREE.Mesh[] } = { a: null, line: null, dots: [] };
  private rect: { x: number; y: number; el: HTMLDivElement } | null = null;
  private camAnim: { from: THREE.Vector3; to: THREE.Vector3; dist: number; start: number } | null = null;
  private lastQuat = new THREE.Quaternion(2, 0, 0, 0);
  private painting = false;
  private lastPaint = "";
  private raf = 0;
  private ro: ResizeObserver;
  mode: "model" | "paint" | "animate" = "model";
  private model: Model3D | null = null;

  constructor(private host: HTMLElement, private events: ViewportEvents) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = "block";
    this.scene.background = new THREE.Color("#1d1d22");
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.5, 2000);
    this.camera.position.set(34, 30, 46);
    this.scene.add(new THREE.HemisphereLight("#ffffff", "#5a4a40", 1.6));
    const sun = new THREE.DirectionalLight("#fff4e0", 1.6);
    sun.position.set(30, 60, 40);
    this.scene.add(sun);
    // Cuadrícula: líneas cada 16 unidades (un bloque) y finas cada unidad.
    const fine = new THREE.GridHelper(64, 64, "#2c2c33", "#2c2c33");
    const blocks = new THREE.GridHelper(64, 4, "#4a4a55", "#4a4a55");
    blocks.position.y = 0.01;
    this.scene.add(fine, blocks, this.root);
    const el = this.renderer.domElement;
    // Antes que OrbitControls: Mayús+arrastre en vacío es un rectángulo de selección.
    el.addEventListener("pointerdown", this.onDown, { capture: true });
    this.orbit = new OrbitControls(this.camera, el);
    this.orbit.target.set(0, 10, 0);
    this.orbit.enableDamping = true;
    this.gizmo = new TransformControls(this.camera, el);
    this.gizmo.setSize(0.8);
    this.gizmo.setSpace("local");
    this.gizmo.addEventListener("dragging-changed", (e) => {
      const dragging = (e as unknown as { value: boolean }).value;
      this.orbit.enabled = !dragging;
      if (!dragging) this.commitGizmo();
    });
    this.scene.add(this.gizmo.getHelper());
    el.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKey);
    this.viewCube = new ViewCube(host, { onPick: (dir) => this.lookFrom(dir), onHome: () => this.frame("isométrica") });
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.applySnap(false);
    const loop = (now: number) => {
      this.stepCamera(now);
      this.orbit.update();
      for (const o of this.outlines) o.update();
      this.renderer.render(this.scene, this.camera);
      if (!this.camera.quaternion.equals(this.lastQuat)) {
        this.lastQuat.copy(this.camera.quaternion);
        this.viewCube.sync(this.camera.quaternion);
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    window.removeEventListener("pointerup", this.onUp);
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onKey);
    this.viewCube.dispose();
    this.gizmo.dispose();
    this.orbit.dispose();
    this.clearMeasure();
    this.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private resize() {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private clearOutlines() {
    for (const o of this.outlines) {
      this.scene.remove(o);
      o.dispose();
    }
    this.outlines = [];
  }

  private clear() {
    this.gizmo.detach();
    this.multi.removeFromParent();
    for (const m of this.meshes) {
      m.geometry.dispose();
      for (const mat of m.material as THREE.MeshLambertMaterial[]) {
        mat.map?.dispose();
        mat.dispose();
      }
    }
    this.meshes = [];
    this.groups.clear();
    this.root.clear();
    this.clearOutlines();
  }

  /** Vuelve a construir la escena con el modelo y la pose (si se está animando). */
  setModel(model: Model3D, pose?: Map<string, Pose>) {
    this.model = model;
    this.clear();
    for (const p of model.parts) {
      const g = new THREE.Group();
      g.name = p.id;
      g.userData.partId = p.id;
      this.groups.set(p.id, g);
      if (p.box && p.visible) {
        const mats = FACES.map((f) => new THREE.MeshLambertMaterial({ map: faceTexture(facePixels(p.box!.faces[f])) }));
        const mesh = new THREE.Mesh(boxGeometry(p.box), mats);
        mesh.userData.partId = p.id;
        g.add(mesh);
        this.meshes.push(mesh);
      }
    }
    for (const p of model.parts) {
      const g = this.groups.get(p.id)!;
      (p.parent ? this.groups.get(p.parent) ?? this.root : this.root).add(g);
    }
    this.applyPose(pose);
    this.select(this.selected.filter((id) => this.groups.has(id)));
  }

  /** Coloca cada pieza con su pivote, su rotación de reposo y la pose animada. */
  applyPose(pose?: Map<string, Pose>) {
    if (!this.model) return;
    for (const p of this.model.parts) {
      const g = this.groups.get(p.id);
      if (!g) continue;
      const ps = pose?.get(p.id);
      g.position.set(p.pivot[0] + (ps?.pos[0] ?? 0), p.pivot[1] + (ps?.pos[1] ?? 0), p.pivot[2] + (ps?.pos[2] ?? 0));
      g.rotation.set((p.rotation[0] + (ps?.rot[0] ?? 0)) * DEG, (p.rotation[1] + (ps?.rot[1] ?? 0)) * DEG, (p.rotation[2] + (ps?.rot[2] ?? 0)) * DEG, "XYZ");
      g.scale.set(ps?.scale[0] ?? 1, ps?.scale[1] ?? 1, ps?.scale[2] ?? 1);
    }
  }

  /** Piezas seleccionadas; la última es la principal. */
  select(ids: string[]) {
    this.selected = ids.filter((id) => this.groups.has(id));
    this.clearOutlines();
    this.gizmo.detach();
    this.multi.removeFromParent();
    for (const id of this.selected) {
      const o = new THREE.BoxHelper(this.groups.get(id)!, id === this.selected.at(-1) ? "#ff8a3d" : "#ffc08a");
      this.outlines.push(o);
      this.scene.add(o);
    }
    this.attachGizmo();
  }

  private parentsOf(ids: string[]): Set<string | null> {
    return new Set(ids.map((id) => this.model?.parts.find((p) => p.id === id)?.parent ?? null));
  }

  private attachGizmo() {
    const ids = this.selected;
    if (!ids.length || this.mode === "paint" || this.tool === "measure") return;
    if (ids.length === 1) {
      const g = this.groups.get(ids[0])!;
      // Escalar en Modelar cambia la caja (no los hijos): el gizmo va en la malla.
      const mesh = g.children.find((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh | undefined;
      if (this.gizmoMode === "scale" && this.mode === "model") {
        if (mesh) this.gizmo.attach(mesh);
        return;
      }
      this.gizmo.attach(g);
      return;
    }
    // Varias piezas: solo en Modelar y si cuelgan del mismo padre (sin contar las hijas
    // de otras seleccionadas, que ya se mueven con su padre).
    const top = topLevel(this.model!, ids);
    const parents = this.parentsOf(top);
    if (this.mode !== "model" || parents.size !== 1) return;
    const parentId = [...parents][0];
    const parent = parentId ? this.groups.get(parentId) ?? this.root : this.root;
    const pivots = top.map((id) => this.model!.parts.find((p) => p.id === id)!.pivot);
    // En la cuadrícula: así el ajuste del gizmo da desplazamientos enteros de paso.
    const center = gridAnchor(pivots, this.snap.step);
    this.multi.position.set(...center);
    this.multi.rotation.set(0, 0, 0);
    this.multi.scale.set(1, 1, 1);
    this.multiStart = { pos: this.multi.position.clone(), center };
    parent.add(this.multi);
    this.gizmo.attach(this.multi);
  }

  setGizmo(mode: GizmoMode) {
    this.gizmoMode = mode;
    this.gizmo.setMode(mode);
    this.select(this.selected);
  }

  setMode(mode: Viewport["mode"]) {
    this.mode = mode;
    this.select(this.selected);
  }

  /** Ajuste a la cuadrícula del gizmo. Ctrl invierte el paso de giro mientras se pulsa. */
  setSnap(step: SnapStep, rotate: boolean) {
    this.snap = { step, rotate };
    this.applySnap(false);
  }

  private applySnap(ctrl: boolean) {
    this.gizmo.setTranslationSnap(this.snap.step || null);
    this.gizmo.setRotationSnap(this.snap.rotate !== ctrl ? ROTATE_STEP * DEG : null);
    this.gizmo.setScaleSnap(null);
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === "Control") this.applySnap(e.type === "keydown");
  };

  setTool(tool: ViewTool) {
    this.tool = tool;
    this.clearMeasure();
    this.renderer.domElement.style.cursor = tool === "measure" ? "crosshair" : "";
    this.select(this.selected);
  }

  private clearMeasure() {
    const m = this.measure;
    if (m.line) {
      this.scene.remove(m.line);
      m.line.geometry.dispose();
    }
    for (const d of m.dots) {
      this.scene.remove(d);
      d.geometry.dispose();
    }
    this.measure = { a: null, line: null, dots: [] };
    this.events.onMeasure(null);
  }

  private measureAt(point: THREE.Vector3) {
    const m = this.measure;
    if (!m.a || m.line) {
      this.clearMeasure();
      this.measure.a = point.clone();
    } else {
      const geo = new THREE.BufferGeometry().setFromPoints([m.a, point]);
      m.line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: "#ff8a3d", depthTest: false }));
      m.line.renderOrder = 10;
      this.scene.add(m.line);
      this.events.onMeasure(Math.round(m.a.distanceTo(point) * 100) / 100);
    }
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), new THREE.MeshBasicMaterial({ color: "#ff8a3d", depthTest: false }));
    dot.position.copy(point);
    dot.renderOrder = 10;
    this.measure.dots.push(dot);
    this.scene.add(dot);
  }

  private commitGizmo() {
    const ids = [...this.selected];
    if (!ids.length || !this.model) return;
    const r = (v: number) => Math.round(v * 100) / 100 + 0;
    const obj = this.gizmo.object;
    if (!obj) return;
    if (obj === this.multi) {
      const c = this.multiStart.center;
      if (this.gizmoMode === "translate") {
        const d = this.multi.position.clone().sub(this.multiStart.pos);
        this.events.onTransform({ ids, delta: [r(d.x), r(d.y), r(d.z)] });
      } else if (this.gizmoMode === "rotate") {
        const q = this.multi.quaternion;
        this.events.onTransform({ ids, rotate: { quat: [q.x, q.y, q.z, q.w], center: c } });
      } else {
        const s = this.multi.scale;
        this.events.onTransform({ ids, scale: { factor: [r(s.x), r(s.y), r(s.z)], center: c } });
      }
      this.attachGizmo();
      return;
    }
    const id = ids[0];
    const part = this.model.parts.find((p) => p.id === id);
    if (!part) return;
    if (this.gizmoMode === "scale") {
      const s = obj.scale;
      this.events.onTransform({ ids: [id], scale: { factor: [r(s.x), r(s.y), r(s.z)], center: part.pivot } });
      if ((obj as THREE.Mesh).isMesh) obj.scale.set(1, 1, 1);
      return;
    }
    const g = this.groups.get(id)!;
    if (this.gizmoMode === "translate") this.events.onTransform({ ids: [id], pivot: [r(g.position.x), r(g.position.y), r(g.position.z)] });
    else this.events.onTransform({ ids: [id], rotation: [r(g.rotation.x / DEG), r(g.rotation.y / DEG), r(g.rotation.z / DEG)] });
  }

  private ndc(e: PointerEvent): THREE.Vector2 {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  }

  private hit(e: PointerEvent): THREE.Intersection | null {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(this.ndc(e), this.camera);
    return ray.intersectObjects(this.meshes, false)[0] ?? null;
  }

  private paintAt(e: PointerEvent, last: boolean) {
    const h = this.hit(e);
    if (!h || !h.uv || h.face == null) return;
    const id = h.object.userData.partId as string;
    const face = FACES[h.face.materialIndex];
    const [x, y] = uvToPixel(h.uv.x, h.uv.y);
    const key = `${id}:${face}:${x}:${y}`;
    if (key === this.lastPaint && !last) return;
    this.lastPaint = key;
    this.events.onPaint(id, face, x, y, last);
  }

  private downAt: { x: number; y: number; shift: boolean } | null = null;

  private onDown = (e: PointerEvent) => {
    if (e.button !== 0 || this.gizmo.dragging || this.gizmo.axis) return;
    this.downAt = { x: e.clientX, y: e.clientY, shift: e.shiftKey };
    if (this.mode === "paint") {
      const h = this.hit(e);
      if (h) {
        this.painting = true;
        this.orbit.enabled = false;
        this.lastPaint = "";
        this.paintAt(e, false);
      }
      return;
    }
    if (e.shiftKey && this.tool === "select" && !this.hit(e)) {
      // Rectángulo de selección: OrbitControls no debe girar ni desplazar.
      this.orbit.enabled = false;
      const div = document.createElement("div");
      div.dataset.selectRect = "";
      Object.assign(div.style, { position: "absolute", border: "1px solid #ff8a3d", background: "rgba(255,138,61,.12)", pointerEvents: "none", zIndex: "4" });
      this.host.appendChild(div);
      this.rect = { x: e.clientX, y: e.clientY, el: div };
      this.updateRect(e);
    }
  };

  private updateRect(e: PointerEvent) {
    if (!this.rect) return;
    const hb = this.host.getBoundingClientRect();
    const x0 = Math.min(this.rect.x, e.clientX) - hb.left;
    const y0 = Math.min(this.rect.y, e.clientY) - hb.top;
    Object.assign(this.rect.el.style, { left: `${x0}px`, top: `${y0}px`, width: `${Math.abs(e.clientX - this.rect.x)}px`, height: `${Math.abs(e.clientY - this.rect.y)}px` });
  }

  private onMove = (e: PointerEvent) => {
    if (this.painting) this.paintAt(e, false);
    else if (this.rect) this.updateRect(e);
  };

  private onUp = (e: PointerEvent) => {
    if (this.painting) {
      this.painting = false;
      this.orbit.enabled = true;
      this.events.onPaint("", "px", 0, 0, true);
      return;
    }
    if (this.rect) {
      const { x, y, el } = this.rect;
      this.rect = null;
      el.remove();
      this.orbit.enabled = true;
      const rect = this.renderer.domElement.getBoundingClientRect();
      const [x0, x1] = [Math.min(x, e.clientX), Math.max(x, e.clientX)];
      const [y0, y1] = [Math.min(y, e.clientY), Math.max(y, e.clientY)];
      if (x1 - x0 > 4 || y1 - y0 > 4) {
        const ids: string[] = [];
        for (const m of this.meshes) {
          const c = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()).project(this.camera);
          const sx = rect.left + ((c.x + 1) / 2) * rect.width;
          const sy = rect.top + ((1 - c.y) / 2) * rect.height;
          if (c.z < 1 && sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) ids.push(m.userData.partId as string);
        }
        this.events.onSelectRect(ids, true);
        this.downAt = null;
        return;
      }
    }
    // Un clic sin arrastrar selecciona (o mide) bajo el ratón.
    if (this.downAt && Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) < 4 && !this.gizmo.dragging && e.target === this.renderer.domElement) {
      const h = this.hit(e);
      if (this.tool === "measure") {
        if (h) this.measureAt(h.point);
      } else this.events.onSelect(h ? (h.object.userData.partId as string) : null, this.downAt.shift);
    }
    this.downAt = null;
  };

  private target(): { center: THREE.Vector3; size: number } {
    const box = new THREE.Box3().setFromObject(this.root);
    const center = box.isEmpty() ? new THREE.Vector3(0, 8, 0) : box.getCenter(new THREE.Vector3());
    // Vacío: encuadre amplio, como para una criatura mediana.
    const size = box.isEmpty() ? 40 : Math.max(8, box.getSize(new THREE.Vector3()).length());
    return { center, size };
  }

  /** Encaja la cámara al modelo, desde un ángulo con nombre o una dirección. */
  frame(angle: ViewAngle | Vec3 = "isométrica") {
    this.camAnim = null;
    const { center, size } = this.target();
    const d = size * 1.4;
    const dir: Record<ViewAngle, Vec3> = {
      frente: [0, 0.15, 1],
      detrás: [0, 0.15, -1],
      izquierda: [-1, 0.15, 0],
      derecha: [1, 0.15, 0],
      arriba: [0, 1, 0.001],
      isométrica: [0.7, 0.55, 0.9],
    };
    const v = new THREE.Vector3(...cameraDir(typeof angle === "string" ? dir[angle] : angle)).multiplyScalar(d);
    this.camera.position.copy(center).add(v);
    this.orbit.target.copy(center);
    this.camera.lookAt(center);
    this.orbit.update();
  }

  /** Gira la cámara alrededor del objetivo hasta mirar desde `dir`, sin cambiar la distancia. */
  lookFrom(dir: Vec3, animate = true) {
    const offset = this.camera.position.clone().sub(this.orbit.target);
    const dist = offset.length() || 40;
    const to = new THREE.Vector3(...cameraDir(dir, offset.toArray() as Vec3));
    if (!animate) {
      this.camera.position.copy(this.orbit.target).add(to.multiplyScalar(dist));
      this.camera.lookAt(this.orbit.target);
      this.orbit.update();
      return;
    }
    this.camAnim = { from: offset.normalize(), to, dist, start: performance.now() };
  }

  private stepCamera(now: number) {
    const a = this.camAnim;
    if (!a) return;
    const t = Math.min(1, (now - a.start) / 300);
    const k = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const dir = a.from.clone().lerp(a.to, k);
    if (dir.lengthSq() < 1e-6) dir.copy(a.to); // direcciones opuestas: salta al final
    dir.normalize();
    this.camera.position.copy(this.orbit.target).add(dir.multiplyScalar(a.dist));
    this.camera.lookAt(this.orbit.target);
    if (t >= 1) this.camAnim = null;
  }

  /** Captura PNG (sin gizmo ni contorno) desde un ángulo; devuelve un data URL. */
  capture(angle?: ViewAngle | Vec3, width = 640, height = 480): string {
    const prev = { pos: this.camera.position.clone(), target: this.orbit.target.clone(), aspect: this.camera.aspect };
    const helper = this.gizmo.getHelper();
    const hadHelper = helper.visible;
    helper.visible = false;
    for (const o of this.outlines) o.visible = false;
    const oldSize = this.renderer.getSize(new THREE.Vector2());
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (angle) this.frame(angle);
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL("image/png");
    helper.visible = hadHelper;
    for (const o of this.outlines) o.visible = true;
    this.renderer.setSize(oldSize.x, oldSize.y, false);
    this.camera.aspect = prev.aspect;
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(prev.pos);
    this.orbit.target.copy(prev.target);
    this.resize();
    return url;
  }
}
