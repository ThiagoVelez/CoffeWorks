// Cubo de vista: cubo blanco en la esquina del visor que gira con la cámara.
// Clic en una cara, arista o esquina → la cámara mira desde ahí. «Casa» → isométrica.

import * as THREE from "three";
import { VIEWCUBE_REGIONS, type CubeRegion } from "./viewcube-data";
import type { Vec3 } from "./types";

export { VIEWCUBE_REGIONS, cameraDir } from "./viewcube-data";

const SIZE = 110;
const BASE = "#f2f2f4";
const HOVER = "#ff8a3d";

function labelTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#3a3a42";
  g.font = "600 30px 'Hanken Grotesk', system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 64, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class ViewCube {
  readonly el: HTMLDivElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
  private regions: THREE.Mesh[] = [];
  private hover: THREE.Mesh | null = null;
  private down: { x: number; y: number } | null = null;

  constructor(host: HTMLElement, private opts: { onPick: (dir: Vec3) => void; onHome: () => void }) {
    this.el = document.createElement("div");
    this.el.dataset.viewcube = "";
    Object.assign(this.el.style, { position: "absolute", top: "8px", right: "8px", width: `${SIZE}px`, zIndex: "5", userSelect: "none" });
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setSize(SIZE, SIZE);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = this.renderer.domElement;
    canvas.style.cursor = "pointer";
    canvas.title = "Cubo de vista: clic en una cara, arista o esquina";
    this.el.appendChild(canvas);
    const home = document.createElement("button");
    home.type = "button";
    home.title = "Vista inicial (isométrica)";
    home.dataset.viewcubeHome = "";
    home.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/></svg>';
    Object.assign(home.style, { position: "absolute", left: "0", top: "0", width: "22px", height: "22px", display: "grid", placeItems: "center", borderRadius: "6px", background: "rgba(40,40,48,.85)", color: "#e6e6ea", border: "1px solid #3a3a42", cursor: "pointer" });
    home.addEventListener("click", () => this.opts.onHome());
    this.el.appendChild(home);
    host.appendChild(this.el);

    this.scene.add(new THREE.AmbientLight("#ffffff", 2.2));
    const light = new THREE.DirectionalLight("#ffffff", 1.2);
    light.position.set(2, 3, 4);
    this.scene.add(light);
    const cube = new THREE.Group();
    for (const r of VIEWCUBE_REGIONS) cube.add(this.regionMesh(r));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: "#8a8a96" }));
    edges.raycast = () => {};
    cube.add(edges);
    this.scene.add(cube);
    this.camera.zoom = 1.25;
    this.camera.updateProjectionMatrix();

    canvas.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("pointerleave", () => this.setHover(null));
    canvas.addEventListener("pointerdown", (e) => (this.down = { x: e.clientX, y: e.clientY }));
    canvas.addEventListener("pointerup", this.onUp);
  }

  /** Un trozo del cubo: centro de cara 0,6, borde 0,2; juntos forman un cubo de 1. */
  private regionMesh(r: CubeRegion): THREE.Mesh {
    const size = r.dir.map((d) => (d ? 0.2 : 0.6));
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), new THREE.MeshLambertMaterial({ color: BASE }));
    mesh.position.set(r.dir[0] * 0.4, r.dir[1] * 0.4, r.dir[2] * 0.4);
    mesh.userData.dir = r.dir;
    mesh.userData.id = r.id;
    if (r.label) {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.98), new THREE.MeshBasicMaterial({ map: labelTexture(r.label), transparent: true, depthWrite: false }));
      // Justo por fuera de la cara (el trozo está a 0,4 del centro y mide 0,2).
      const n = new THREE.Vector3(...r.dir);
      plane.position.copy(n.clone().multiplyScalar(0.101));
      if (r.dir[1]) plane.rotation.x = -r.dir[1] * (Math.PI / 2);
      else plane.lookAt(n.clone().multiplyScalar(2));
      plane.raycast = () => {};
      mesh.add(plane);
    }
    this.regions.push(mesh);
    return mesh;
  }

  /** Orienta el cubo como la cámara principal y lo vuelve a dibujar. */
  sync(q: THREE.Quaternion) {
    this.camera.position.set(0, 0, 5).applyQuaternion(q);
    this.camera.quaternion.copy(q);
    this.renderer.render(this.scene, this.camera);
  }

  private pick(e: PointerEvent): THREE.Mesh | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    return (ray.intersectObjects(this.regions, false)[0]?.object as THREE.Mesh) ?? null;
  }

  private setHover(m: THREE.Mesh | null) {
    if (m === this.hover) return;
    if (this.hover) (this.hover.material as THREE.MeshLambertMaterial).color.set(BASE);
    this.hover = m;
    if (m) (m.material as THREE.MeshLambertMaterial).color.set(HOVER);
    this.renderer.render(this.scene, this.camera);
  }

  private onMove = (e: PointerEvent) => this.setHover(this.pick(e));

  private onUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return;
    const m = this.pick(e);
    if (m) this.opts.onPick([...(m.userData.dir as Vec3)] as Vec3);
  };

  dispose() {
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const mat = mesh.material as THREE.Material | undefined;
      if (mat) {
        (mat as THREE.MeshBasicMaterial).map?.dispose();
        mat.dispose();
      }
    });
    this.renderer.dispose();
    this.el.remove();
  }
}
