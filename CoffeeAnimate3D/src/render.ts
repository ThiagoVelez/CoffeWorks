// Complemento «Render»: imagen de calidad del modelo (sol y cielo, sombras, oclusión
// ambiental, fondo de color o transparente) y vueltas de 360° como fotogramas.
// Usa un renderizador aparte: el visor no cambia de tamaño ni de cámara.

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import type { Viewport, ViewAngle } from "./viewport";
import type { Vec3 } from "./types";

export interface RenderOptions {
  width: number;
  height: number;
  /** Fondo transparente (PNG con alfa). */
  transparent: boolean;
  /** Color del cielo de fondo. */
  background: string;
  shadows: boolean;
  /** Oclusión ambiental (sombras suaves en los rincones). */
  ao: boolean;
  /** Ángulo o dirección; si falta, la cámara actual del visor. */
  angle?: ViewAngle | Vec3;
}

export const RENDER_SIZES: { label: string; width: number; height: number }[] = [
  { label: "1280 × 720", width: 1280, height: 720 },
  { label: "1920 × 1080 (Full HD)", width: 1920, height: 1080 },
  { label: "3840 × 2160 (4K)", width: 3840, height: 2160 },
];

export const DEFAULT_RENDER: RenderOptions = { width: 1920, height: 1080, transparent: false, background: "#a9d4f5", shadows: true, ao: true };

/** Sesión de render: monta la escena una vez y dibuja desde distintas cámaras. */
export class RenderSession {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private passes: { dispose(): void }[] = [];
  private sun: THREE.DirectionalLight;
  private ground: THREE.Mesh | null = null;
  readonly target: THREE.Vector3;
  private distance: number;
  private height: number;

  constructor(vp: Viewport, o: RenderOptions) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(o.width, o.height, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = o.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.canvas = this.renderer.domElement;
    if (o.transparent) this.renderer.setClearColor(0x000000, 0);
    else this.scene.background = new THREE.Color(o.background);

    const model = vp.modelRoot.clone(true);
    model.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = o.shadows;
        mesh.receiveShadow = o.shadows;
      }
    });
    this.scene.add(model);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const center = box.isEmpty() ? new THREE.Vector3(0, 8, 0) : box.getCenter(new THREE.Vector3());
    const radius = box.isEmpty() ? 20 : Math.max(8, box.getSize(new THREE.Vector3()).length() / 2);

    this.scene.add(new THREE.HemisphereLight("#dbefff", "#6b5a48", 1.4));
    const sun = (this.sun = new THREE.DirectionalLight("#fff1d6", 2.4));
    sun.position.copy(center).add(new THREE.Vector3(radius * 1.2, radius * 2.2, radius * 1.6));
    sun.target.position.copy(center);
    sun.castShadow = o.shadows;
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -radius * 1.6;
    sc.right = sc.top = radius * 1.6;
    sc.near = 0.5;
    sc.far = radius * 8;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    this.scene.add(sun, sun.target);
    if (o.shadows) {
      const ground = (this.ground = new THREE.Mesh(new THREE.PlaneGeometry(radius * 8, radius * 8), new THREE.ShadowMaterial({ opacity: 0.3 })));
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(center.x, box.isEmpty() ? 0 : box.min.y, center.z);
      ground.receiveShadow = true;
      this.scene.add(ground);
    }

    const main = vp.camera;
    this.camera = new THREE.PerspectiveCamera(main.fov, o.width / o.height, 0.5, 4000);
    if (o.angle) {
      const f = vp.framing(o.angle);
      this.camera.position.copy(f.position);
      this.target = f.target;
    } else {
      this.camera.position.copy(main.position);
      this.target = vp.orbit.target.clone();
    }
    this.camera.lookAt(this.target);
    const off = this.camera.position.clone().sub(this.target);
    this.distance = Math.hypot(off.x, off.z);
    this.height = off.y;

    if (o.ao) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.setSize(o.width, o.height);
      const renderPass = new RenderPass(this.scene, this.camera);
      this.composer.addPass(renderPass);
      const ssao = new SSAOPass(this.scene, this.camera, o.width, o.height);
      ssao.kernelRadius = Math.max(2, radius / 6);
      ssao.minDistance = 0.001;
      ssao.maxDistance = 0.08;
      this.composer.addPass(ssao);
      const output = new OutputPass();
      this.composer.addPass(output);
      this.passes = [renderPass, ssao, output];
    }
  }

  /** Dibuja; con `turn` (0–1) gira la cámara alrededor del modelo esa fracción de vuelta. */
  render(turn?: number): HTMLCanvasElement {
    if (turn !== undefined) {
      const a0 = Math.atan2(this.camera.position.x - this.target.x, this.camera.position.z - this.target.z);
      const a = turn === 0 ? a0 : this.startAngle + turn * Math.PI * 2;
      if (turn === 0) this.startAngle = a0;
      this.camera.position.set(this.target.x + Math.sin(a) * this.distance, this.target.y + this.height, this.target.z + Math.cos(a) * this.distance);
      this.camera.lookAt(this.target);
    }
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
    return this.canvas;
  }
  private startAngle = 0;

  /** Libera todo, también el contexto WebGL: el navegador solo admite unos 16 a la vez. */
  dispose() {
    for (const p of this.passes) p.dispose();
    this.composer?.dispose();
    this.sun.shadow.dispose();
    if (this.ground) {
      this.ground.geometry.dispose();
      (this.ground.material as THREE.Material).dispose();
    }
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
