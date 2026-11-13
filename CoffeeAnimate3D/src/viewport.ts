// Visor 3D (three.js): dibuja el modelo con su pose, permite seleccionar piezas,
// moverlas o girarlas con el gizmo, pintar sobre las caras y hacer capturas.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { facePixels } from "./model";
import { CORNER_UV, FACE_GEOMETRY, QUAD_INDICES, faceCorners, uvToPixel } from "./geometry";
import { FACES, TEX, type FaceName, type Model3D, type Pose, type Vec3 } from "./types";

export type GizmoMode = "translate" | "rotate";
export type ViewAngle = "frente" | "detrás" | "izquierda" | "derecha" | "arriba" | "isométrica";

export interface ViewportEvents {
  onSelect: (id: string | null) => void;
  /** Fin de un arrastre del gizmo: nuevo pivote o rotación (en el espacio del padre). */
  onTransform: (id: string, change: { pivot?: Vec3; rotation?: Vec3 }) => void;
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
  private root = new THREE.Group();
  private groups = new Map<string, THREE.Group>();
  private meshes: THREE.Mesh[] = [];
  private outline: THREE.BoxHelper | null = null;
  private selected: string | null = null;
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
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.target.set(0, 10, 0);
    this.orbit.enableDamping = true;
    this.gizmo = new TransformControls(this.camera, this.renderer.domElement);
    this.gizmo.setSize(0.8);
    this.gizmo.setSpace("local");
    this.gizmo.addEventListener("dragging-changed", (e) => {
      this.orbit.enabled = !(e as unknown as { value: boolean }).value;
      if (!(e as unknown as { value: boolean }).value) this.commitGizmo();
    });
    this.scene.add(this.gizmo.getHelper());
    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    const loop = () => {
      this.orbit.update();
      this.outline?.update();
      this.renderer.render(this.scene, this.camera);
      this.raf = requestAnimationFrame(loop);
    };
    loop();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    window.removeEventListener("pointerup", this.onUp);
    this.gizmo.dispose();
    this.orbit.dispose();
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

  private clear() {
    this.gizmo.detach();
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
    if (this.outline) {
      this.scene.remove(this.outline);
      this.outline = null;
    }
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
    this.select(this.selected && this.groups.has(this.selected) ? this.selected : null);
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

  select(id: string | null) {
    this.selected = id;
    if (this.outline) {
      this.scene.remove(this.outline);
      this.outline = null;
    }
    const g = id ? this.groups.get(id) : null;
    if (g && this.mode !== "paint") this.gizmo.attach(g);
    else this.gizmo.detach();
    if (g) {
      this.outline = new THREE.BoxHelper(g, "#ff8a3d");
      this.scene.add(this.outline);
    }
  }

  setGizmo(mode: GizmoMode) {
    this.gizmo.setMode(mode);
  }

  setMode(mode: Viewport["mode"]) {
    this.mode = mode;
    this.select(this.selected);
  }

  private commitGizmo() {
    const id = this.selected;
    const g = id ? this.groups.get(id) : null;
    const part = id && this.model?.parts.find((p) => p.id === id);
    if (!g || !part || !id) return;
    const r = (v: number) => Math.round(v * 100) / 100;
    if (this.gizmo.getMode() === "translate") this.events.onTransform(id, { pivot: [r(g.position.x), r(g.position.y), r(g.position.z)] });
    else this.events.onTransform(id, { rotation: [r(g.rotation.x / DEG), r(g.rotation.y / DEG), r(g.rotation.z / DEG)] });
  }

  private hit(e: PointerEvent): THREE.Intersection | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
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

  private downAt: { x: number; y: number } | null = null;

  private onDown = (e: PointerEvent) => {
    if (e.button !== 0 || this.gizmo.dragging) return;
    this.downAt = { x: e.clientX, y: e.clientY };
    if (this.mode === "paint") {
      const h = this.hit(e);
      if (h) {
        this.painting = true;
        this.orbit.enabled = false;
        this.lastPaint = "";
        this.paintAt(e, false);
      }
    }
  };

  private onMove = (e: PointerEvent) => {
    if (this.painting) this.paintAt(e, false);
  };

  private onUp = (e: PointerEvent) => {
    if (this.painting) {
      this.painting = false;
      this.orbit.enabled = true;
      this.events.onPaint("", "px", 0, 0, true);
      return;
    }
    // Un clic sin arrastrar selecciona la pieza bajo el ratón.
    if (this.downAt && Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) < 4 && !this.gizmo.dragging && e.target === this.renderer.domElement) {
      const h = this.hit(e);
      this.events.onSelect(h ? (h.object.userData.partId as string) : null);
    }
    this.downAt = null;
  };

  /** Encaja la cámara al modelo. */
  frame(angle: ViewAngle = "isométrica") {
    const box = new THREE.Box3().setFromObject(this.root);
    const center = box.isEmpty() ? new THREE.Vector3(0, 8, 0) : box.getCenter(new THREE.Vector3());
    // Vacío: encuadre amplio, como para una criatura mediana.
    const size = box.isEmpty() ? 40 : Math.max(8, box.getSize(new THREE.Vector3()).length());
    const d = size * 1.4;
    const dir: Record<ViewAngle, [number, number, number]> = {
      frente: [0, 0.15, 1],
      detrás: [0, 0.15, -1],
      izquierda: [-1, 0.15, 0],
      derecha: [1, 0.15, 0],
      arriba: [0, 1, 0.001],
      isométrica: [0.7, 0.55, 0.9],
    };
    const v = new THREE.Vector3(...dir[angle]).normalize().multiplyScalar(d);
    this.camera.position.copy(center).add(v);
    this.orbit.target.copy(center);
    this.camera.lookAt(center);
    this.orbit.update();
  }

  /** Captura PNG (sin gizmo ni contorno) desde un ángulo; devuelve un data URL. */
  capture(angle?: ViewAngle, width = 640, height = 480): string {
    const prev = { pos: this.camera.position.clone(), target: this.orbit.target.clone(), aspect: this.camera.aspect };
    const helper = this.gizmo.getHelper();
    const hadHelper = helper.visible;
    helper.visible = false;
    if (this.outline) this.outline.visible = false;
    const oldSize = this.renderer.getSize(new THREE.Vector2());
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (angle) this.frame(angle);
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL("image/png");
    helper.visible = hadHelper;
    if (this.outline) this.outline.visible = true;
    this.renderer.setSize(oldSize.x, oldSize.y, false);
    this.camera.aspect = prev.aspect;
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(prev.pos);
    this.orbit.target.copy(prev.target);
    this.resize();
    return url;
  }
}
