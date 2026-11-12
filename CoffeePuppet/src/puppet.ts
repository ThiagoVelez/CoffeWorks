// Dibujo del títere y de la escena a partir de los parámetros (rig).

import type { Character, PuppetDoc, Rig, Scene, Trigger } from "./types";
import { NEUTRAL, RIG_KEYS, TRIGGER_DURATION, type Take } from "./types";

export const CHARACTER_PRESETS: Character[] = [
  { name: "Cafecito", style: "coffee", skin: "#f8f1e7", hair: "#6f4e37", hairStyle: "short", eyes: "#2b1d14", shirt: "#c2410c", accessory: "none", cheeks: true },
  { name: "Lucía", style: "person", skin: "#f1c27d", hair: "#4a2c1d", hairStyle: "long", eyes: "#3b2416", shirt: "#e8590c", accessory: "none", cheeks: true },
  { name: "Mateo", style: "person", skin: "#c68642", hair: "#1c1c1c", hairStyle: "curly", eyes: "#2b1d14", shirt: "#1971c2", accessory: "glasses", cheeks: false },
  { name: "Robi", style: "robot", skin: "#adb5bd", hair: "#f03e3e", hairStyle: "bald", eyes: "#22b8cf", shirt: "#495057", accessory: "headphones", cheeks: false },
  { name: "Michi", style: "cat", skin: "#ffa94d", hair: "#e8590c", hairStyle: "short", eyes: "#2f9e44", shirt: "#ae3ec9", accessory: "bow", cheeks: true },
];

/** Avance (0..1) de una animación disparada, o -1 si no está activa. */
export type ActiveTriggers = Partial<Record<Trigger, number>>;

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const pulse = (u: number) => Math.sin(Math.PI * clamp(u));

function shade(hex: string, k: number): string {
  const h = hex.replace("#", "");
  const n = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0);
  return `rgb(${n.map((v) => Math.round(clamp(k < 0 ? v * (1 + k) : v + (255 - v) * k, 0, 255))).join(",")})`;
}

/** Aplica las expresiones de las animaciones disparadas sobre el rig. */
function withTriggers(r: Rig, tr: ActiveTriggers): Rig {
  const o = { ...r };
  const p = (t: Trigger) => (tr[t] !== undefined ? pulse(tr[t]!) : 0);
  const sur = p("surprise");
  if (sur) {
    o.eyeL = Math.max(o.eyeL, 1 + 0.3 * sur);
    o.eyeR = Math.max(o.eyeR, 1 + 0.3 * sur);
    o.browL += sur;
    o.browR += sur;
    o.mouthOpen = Math.max(o.mouthOpen, 0.8 * sur);
    o.smile *= 1 - sur;
  }
  const sad = p("sad");
  if (sad) {
    o.smile = o.smile * (1 - sad) - sad;
    o.browL -= 0.2 * sad;
    o.browR -= 0.2 * sad;
    o.nod += 0.3 * sad;
  }
  const ang = p("angry");
  if (ang) {
    o.browL -= ang;
    o.browR -= ang;
    o.smile = o.smile * (1 - ang) - 0.5 * ang;
  }
  const laugh = p("laugh");
  if (laugh) {
    o.eyeL *= 1 - laugh * 0.85;
    o.eyeR *= 1 - laugh * 0.85;
    o.smile = Math.max(o.smile, laugh);
    o.mouthOpen = Math.max(o.mouthOpen, 0.6 * laugh * (0.6 + 0.4 * Math.abs(Math.sin((tr.laugh || 0) * 40))));
    o.tilt += Math.sin((tr.laugh || 0) * 30) * 4 * laugh;
  }
  const slp = p("sleep");
  if (slp) {
    o.eyeL *= 1 - slp;
    o.eyeR *= 1 - slp;
    o.tilt += 12 * slp;
    o.nod += 0.3 * slp;
  }
  return o;
}

/** Dibuja la escena completa en un lienzo de `scene.width × scene.height`. */
export function drawScene(g: CanvasRenderingContext2D, doc: PuppetDoc, rig: Rig, tr: ActiveTriggers, time: number, bg?: HTMLImageElement | null) {
  const s = doc.scene;
  const W = s.width;
  const H = s.height;
  if (s.image && bg && bg.complete && bg.naturalWidth) {
    const k = Math.max(W / bg.naturalWidth, H / bg.naturalHeight);
    g.drawImage(bg, (W - bg.naturalWidth * k) / 2, (H - bg.naturalHeight * k) / 2, bg.naturalWidth * k, bg.naturalHeight * k);
  } else if (s.gradient) {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, s.background);
    gr.addColorStop(1, s.background2);
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  } else {
    g.fillStyle = s.background;
    g.fillRect(0, 0, W, H);
  }
  // Suelo
  const floorY = H * s.floor;
  g.fillStyle = "rgba(0,0,0,0.12)";
  g.fillRect(0, floorY, W, H - floorY);
  const k = (H / 1000) * s.scale;
  const jump = tr.jump !== undefined ? pulse(tr.jump) * 180 : 0;
  const x = W / 2 + rig.bodyX * W * 0.35;
  // Sombra
  g.fillStyle = "rgba(0,0,0,0.18)";
  g.beginPath();
  g.ellipse(x, floorY, 210 * k * (1 - jump / 600), 26 * k, 0, 0, Math.PI * 2);
  g.fill();
  g.save();
  g.translate(x, floorY - jump * k);
  g.scale(k, k);
  drawCharacter(g, doc.character, withTriggers(rig, tr), tr, time);
  g.restore();
  // Efectos
  if (tr.hearts !== undefined) {
    const u = tr.hearts;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + u * 2;
      const r = (120 + u * 260) * k;
      g.globalAlpha = 1 - u;
      g.font = `${Math.round(56 * k)}px sans-serif`;
      g.fillText("❤", x + Math.cos(a) * r - 20 * k, floorY - 650 * k - u * 200 * k + Math.sin(a) * r * 0.5);
    }
    g.globalAlpha = 1;
  }
  if (tr.sleep !== undefined) {
    g.fillStyle = "rgba(60,60,90,0.8)";
    for (let i = 0; i < 3; i++) {
      const u = (tr.sleep * 2 + i / 3) % 1;
      g.globalAlpha = pulse(u);
      g.font = `bold ${Math.round((40 + i * 14) * k)}px sans-serif`;
      g.fillText("z", x + (160 + u * 120) * k, floorY - (780 + u * 200) * k);
    }
    g.globalAlpha = 1;
  }
}

/** Personaje en coordenadas locales: pies en (0,0), unos 900 px de alto. */
export function drawCharacter(g: CanvasRenderingContext2D, c: Character, r: Rig, tr: ActiveTriggers, time: number) {
  const breathe = Math.sin(time * 2.2) * 6;
  // Cuerpo
  const bodyTop = -430 + breathe * 0.5;
  g.save();
  g.translate(rig0(r.headX) * 40, 0);
  drawBody(g, c, bodyTop, r, tr, time);
  // Cabeza
  g.save();
  g.translate(r.headX * 70, bodyTop - 40 + r.headY * 40 + r.nod * 25 + breathe * 0.3);
  g.rotate((r.tilt * Math.PI) / 180);
  const shake = tr.angry !== undefined ? Math.sin(tr.angry * 60) * 6 * pulse(tr.angry) : 0;
  g.translate(shake, 0);
  drawHead(g, c, r, tr);
  g.restore();
  g.restore();
}

const rig0 = (v: number) => v * 0.3;

function drawBody(g: CanvasRenderingContext2D, c: Character, top: number, r: Rig, tr: ActiveTriggers, time: number) {
  const shirt = c.style === "coffee" ? c.shirt : c.shirt;
  // Brazos
  const arm = (side: -1 | 1, up: number, waveAng: number) => {
    g.save();
    g.translate(side * 150, top + 70);
    g.rotate(side * (0.25 - up * 2.4) + waveAng);
    g.strokeStyle = c.style === "robot" ? shade(c.skin, -0.25) : shirt;
    g.lineWidth = 52;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, 230);
    g.stroke();
    g.fillStyle = c.style === "robot" ? shade(c.skin, -0.1) : c.style === "cat" ? c.skin : c.style === "coffee" ? "#ffffff" : c.skin;
    g.beginPath();
    g.arc(0, 245, 34, 0, Math.PI * 2);
    g.fill();
    if (tr.thumbs !== undefined && side === 1 && up > 0.2) {
      g.fillRect(-10, 250, 20, 50);
    }
    g.restore();
  };
  const wave = tr.wave !== undefined ? pulse(tr.wave) : 0;
  const thumbs = tr.thumbs !== undefined ? pulse(tr.thumbs) : 0;
  arm(-1, 0, Math.sin(time * 1.3) * 0.03);
  arm(1, Math.max(wave, thumbs * 0.8), wave ? Math.sin((tr.wave || 0) * 28) * 0.45 * wave : Math.sin(time * 1.3 + 1) * 0.03);
  // Torso
  g.fillStyle = shirt;
  g.beginPath();
  if (c.style === "coffee") {
    // Taza: cuerpo con asa
    g.fillStyle = "#ffffff";
    g.strokeStyle = shade(c.shirt, -0.2);
    g.lineWidth = 10;
    g.beginPath();
    g.moveTo(-170, top);
    g.lineTo(170, top);
    g.lineTo(140, -20);
    g.quadraticCurveTo(0, 20, -140, -20);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = c.shirt;
    g.fillRect(-152, top + 270, 304, 56);
    g.lineWidth = 34;
    g.strokeStyle = "#ffffff";
    g.beginPath();
    g.arc(185, top + 140, 70, -Math.PI / 2, Math.PI / 2);
    g.stroke();
  } else {
    g.moveTo(-160, top + 20);
    g.quadraticCurveTo(-170, top - 20, -100, top - 30);
    g.lineTo(100, top - 30);
    g.quadraticCurveTo(170, top - 20, 160, top + 20);
    g.lineTo(140, -10);
    g.lineTo(-140, -10);
    g.closePath();
    g.fill();
    if (c.style === "robot") {
      g.fillStyle = shade(c.shirt, 0.3);
      g.fillRect(-60, top + 60, 120, 80);
      g.fillStyle = Math.sin(time * 4) > 0 ? "#69db7c" : "#2b8a3e";
      g.beginPath();
      g.arc(-30, top + 100, 12, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#ffd43b";
      g.beginPath();
      g.arc(25, top + 100, 12, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillStyle = shade(c.shirt, -0.15);
      g.beginPath();
      g.moveTo(-40, top - 30);
      g.lineTo(0, top + 30);
      g.lineTo(40, top - 30);
      g.closePath();
      g.fill();
    }
    // Piernas
    g.fillStyle = "#343a40";
    g.fillRect(-110, -14, 90, 14);
    g.fillRect(20, -14, 90, 14);
  }
  void r;
}

function drawHead(g: CanvasRenderingContext2D, c: Character, r: Rig, tr: ActiveTriggers) {
  const turn = r.turn;
  const fx = turn * 45; // los rasgos se desplazan al girar
  const fy = r.nod * 25;
  const W = c.style === "coffee" ? 230 : 190;
  const H = c.style === "coffee" ? 170 : 210;
  // En la taza, la «cabeza» es la superficie del café y la cara va en la taza
  const cy = c.style === "coffee" ? 0 : -190;
  // Pelo de atrás
  if ((c.style === "person" && (c.hairStyle === "long" || c.hairStyle === "curly")) || c.hairStyle === "bun") {
    g.fillStyle = c.hair;
    g.beginPath();
    if (c.hairStyle === "long") g.roundRect(-W - 15 - fx * 0.3, cy - 120, (W + 15) * 2, 330, 120);
    else if (c.hairStyle === "curly") for (let i = 0; i < 12; i++) g.arc(Math.cos((i / 12) * Math.PI * 2) * (W + 10) - fx * 0.2, cy - 30 + Math.sin((i / 12) * Math.PI * 2) * (H + 5), 70, 0, Math.PI * 2);
    else g.arc(-fx * 0.2, cy - H - 40, 70, 0, Math.PI * 2);
    g.fill();
  }
  // Orejas
  if (c.style === "cat") {
    g.fillStyle = c.skin;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(s * 70 - fx * 0.5, cy - H + 40);
      g.lineTo(s * 175 - fx * 0.5, cy - H - 70 - (s === 1 ? r.browR : r.browL) * 20);
      g.lineTo(s * 175 - fx * 0.5, cy - H + 90);
      g.closePath();
      g.fill();
      g.fillStyle = "#ffc9c9";
      g.beginPath();
      g.moveTo(s * 100 - fx * 0.5, cy - H + 50);
      g.lineTo(s * 160 - fx * 0.5, cy - H - 40);
      g.lineTo(s * 160 - fx * 0.5, cy - H + 70);
      g.closePath();
      g.fill();
      g.fillStyle = c.skin;
    }
  } else if (c.style === "person") {
    g.fillStyle = shade(c.skin, -0.08);
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(s * (W - 5) - fx * 0.6, cy + 10, 30, 45, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Cara
  g.fillStyle = c.style === "coffee" ? "#3b2416" : c.skin;
  g.beginPath();
  if (c.style === "robot") g.roundRect(-W, cy - H, W * 2, H * 2, 50);
  else if (c.style === "coffee") g.ellipse(0, cy + 40, W, 60, 0, 0, Math.PI * 2);
  else g.ellipse(0, cy, W, H, 0, 0, Math.PI * 2);
  g.fill();
  if (c.style === "coffee") {
    // Espuma y vapor
    g.fillStyle = "#c08552";
    g.beginPath();
    g.ellipse(0, cy + 40, W - 20, 44, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.6)";
    g.lineWidth = 10;
    g.lineCap = "round";
    for (const s of [-60, 0, 60]) {
      g.beginPath();
      g.moveTo(s, cy - 30);
      g.bezierCurveTo(s + 30, cy - 80, s - 30, cy - 120, s, cy - 170);
      g.stroke();
    }
  }
  // Pantalla de robot
  if (c.style === "robot") {
    g.fillStyle = "#212529";
    g.beginPath();
    g.roundRect(-W + 30, cy - H + 50, (W - 30) * 2, H * 2 - 100, 34);
    g.fill();
    g.strokeStyle = c.hair;
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(0, cy - H);
    g.lineTo(0, cy - H - 60);
    g.stroke();
    g.fillStyle = c.hair;
    g.beginPath();
    g.arc(0, cy - H - 70, 18, 0, Math.PI * 2);
    g.fill();
  }
  const eyeY = c.style === "coffee" ? 150 + fy : cy - 20 + fy;
  const eyeDX = c.style === "coffee" ? 70 : 75;
  const eyeColor = c.style === "robot" ? c.eyes : c.eyes;
  // Ojos
  for (const [side, open] of [
    [-1, r.eyeL],
    [1, r.eyeR],
  ] as [number, number][]) {
    const ex = side * eyeDX + fx;
    const o = clamp(open, 0, 1.4);
    if (c.style === "robot") {
      g.fillStyle = eyeColor;
      g.shadowColor = eyeColor;
      g.shadowBlur = 20;
      g.beginPath();
      g.roundRect(ex - 32, eyeY - 30 * o, 64, Math.max(6, 60 * o), 14);
      g.fill();
      g.shadowBlur = 0;
      continue;
    }
    if (o < 0.15) {
      g.strokeStyle = "#2b1d14";
      g.lineWidth = 8;
      g.lineCap = "round";
      g.beginPath();
      if (tr.laugh !== undefined) g.arc(ex, eyeY + 8, 22, Math.PI * 1.15, Math.PI * 1.85);
      else {
        g.moveTo(ex - 26, eyeY);
        g.quadraticCurveTo(ex, eyeY + 14, ex + 26, eyeY);
      }
      g.stroke();
      continue;
    }
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.ellipse(ex, eyeY, 34, 40 * o, 0, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = eyeColor;
    g.beginPath();
    g.arc(ex + r.lookX * 14 + turn * 8, eyeY + r.lookY * 12, 20, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#000";
    g.beginPath();
    g.arc(ex + r.lookX * 14 + turn * 8, eyeY + r.lookY * 12, 10, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#fff";
    g.beginPath();
    g.arc(ex + r.lookX * 14 + turn * 8 + 7, eyeY + r.lookY * 12 - 8, 6, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.strokeStyle = "rgba(0,0,0,0.35)";
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(ex, eyeY, 34, 40 * o, 0, 0, Math.PI * 2);
    g.stroke();
  }
  // Cejas
  if (c.style !== "robot") {
    g.strokeStyle = c.style === "coffee" ? "#2b1d14" : c.style === "cat" ? shade(c.skin, -0.4) : c.hair;
    g.lineWidth = 12;
    g.lineCap = "round";
    for (const [side, b] of [
      [-1, r.browL],
      [1, r.browR],
    ] as [number, number][]) {
      const bx = side * eyeDX + fx;
      const by = eyeY - 62 - b * 26;
      const slant = (b < 0 ? -b : 0) * 14;
      g.beginPath();
      g.moveTo(bx - 32, by - side * slant * -1 + (tr.sad !== undefined ? side * 10 * pulse(tr.sad) : 0));
      g.quadraticCurveTo(bx, by - 10, bx + 32, by + side * slant * -1 - (tr.sad !== undefined ? side * 10 * pulse(tr.sad) : 0));
      g.stroke();
    }
  }
  // Mejillas
  if (c.cheeks) {
    g.fillStyle = tr.angry !== undefined ? `rgba(240,62,62,${0.25 + 0.4 * pulse(tr.angry)})` : "rgba(255,120,120,0.28)";
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(s * (eyeDX + 50) + fx, eyeY + 60, 30, 18, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Nariz / hocico
  if (c.style === "person") {
    g.strokeStyle = shade(c.skin, -0.25);
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(fx * 1.2, eyeY + 20);
    g.quadraticCurveTo(fx * 1.2 + 14, eyeY + 60, fx * 1.2 - 4, eyeY + 66);
    g.stroke();
  } else if (c.style === "cat") {
    g.fillStyle = "#e64980";
    g.beginPath();
    g.moveTo(fx * 1.2 - 14, eyeY + 50);
    g.lineTo(fx * 1.2 + 14, eyeY + 50);
    g.lineTo(fx * 1.2, eyeY + 66);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(0,0,0,0.45)";
    g.lineWidth = 3;
    for (const s of [-1, 1])
      for (const d of [-10, 6]) {
        g.beginPath();
        g.moveTo(fx + s * 50, eyeY + 70 + d);
        g.lineTo(fx + s * 150, eyeY + 60 + d * 2);
        g.stroke();
      }
  }
  // Boca
  const my = eyeY + (c.style === "coffee" ? 80 : 105) + fy * 0.5;
  const mx = fx * 1.1;
  const open = clamp(r.mouthOpen, 0, 1);
  const smile = clamp(r.smile, -1, 1);
  const mw = 60 + smile * 18 - open * 10;
  if (c.style === "robot") {
    g.fillStyle = c.eyes;
    const bars = 9;
    for (let i = 0; i < bars; i++) {
      const h = 6 + open * 50 * (0.5 + 0.5 * Math.sin(i * 1.7 + open * 9));
      g.fillRect(mx - 70 + i * 16, my - h / 2, 10, h);
    }
  } else if (open > 0.06) {
    g.fillStyle = "#5c1a1a";
    g.beginPath();
    g.moveTo(mx - mw, my - smile * 8);
    g.quadraticCurveTo(mx, my + smile * 30 - 10, mx + mw, my - smile * 8);
    g.quadraticCurveTo(mx, my + 20 + open * 90 + smile * 20, mx - mw, my - smile * 8);
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = "#ffffff";
    g.fillRect(mx - mw, my - 30, mw * 2, 22);
    g.fillStyle = "#ff8787";
    g.beginPath();
    g.ellipse(mx, my + open * 80, mw * 0.6, 30, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  } else {
    g.strokeStyle = "#5c1a1a";
    g.lineWidth = 8;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(mx - mw * 0.8, my - smile * 10);
    g.quadraticCurveTo(mx, my + smile * 36, mx + mw * 0.8, my - smile * 10);
    g.stroke();
  }
  if (tr.sad !== undefined && pulse(tr.sad) > 0.3) {
    g.fillStyle = "#74c0fc";
    g.beginPath();
    const ty = eyeY + 40 + tr.sad * 80;
    g.ellipse(-eyeDX + fx, ty, 10, 16, 0, 0, Math.PI * 2);
    g.fill();
  }
  // Pelo de arriba
  if (c.style === "person" && c.hairStyle !== "bald") {
    g.fillStyle = c.hair;
    g.beginPath();
    if (c.hairStyle === "curly") for (let i = 0; i < 9; i++) g.arc(-150 + i * 37 + fx * 0.4, cy - H + 30 + Math.sin(i * 1.3) * 10, 46, 0, Math.PI * 2);
    else {
      g.ellipse(fx * 0.3, cy - H + 60, W + 8, 95, 0, Math.PI, Math.PI * 2);
      g.moveTo(-W, cy - H + 60);
      g.quadraticCurveTo(-W + 40 + fx * 0.3, cy - H + 110, 20 + fx * 0.3, cy - H + 70);
      g.quadraticCurveTo(W - 30, cy - H + 120, W, cy - H + 60);
    }
    g.fill();
  }
  // Accesorios
  if (c.accessory === "glasses") {
    g.strokeStyle = "#212529";
    g.lineWidth = 8;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.roundRect(s * eyeDX + fx - 48, eyeY - 40, 96, 78, 24);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(-eyeDX + fx + 48, eyeY - 5);
    g.lineTo(eyeDX + fx - 48, eyeY - 5);
    g.stroke();
  } else if (c.accessory === "hat") {
    g.fillStyle = "#343a40";
    g.fillRect(-W - 30 + fx * 0.3, cy - H + 30, (W + 30) * 2, 36);
    g.fillRect(-W + 40 + fx * 0.3, cy - H - 130, (W - 40) * 2, 170);
    g.fillStyle = "#e03131";
    g.fillRect(-W + 40 + fx * 0.3, cy - H, (W - 40) * 2, 26);
  } else if (c.accessory === "bow") {
    g.fillStyle = "#f06595";
    const bx = 120 + fx * 0.3;
    const by = cy - H + 40;
    g.beginPath();
    g.moveTo(bx, by);
    g.lineTo(bx - 60, by - 40);
    g.lineTo(bx - 60, by + 40);
    g.closePath();
    g.moveTo(bx, by);
    g.lineTo(bx + 60, by - 40);
    g.lineTo(bx + 60, by + 40);
    g.closePath();
    g.fill();
    g.beginPath();
    g.arc(bx, by, 16, 0, Math.PI * 2);
    g.fill();
  } else if (c.accessory === "headphones") {
    g.strokeStyle = "#212529";
    g.lineWidth = 22;
    g.beginPath();
    g.arc(fx * 0.3, cy - 10, W + 20, Math.PI * 1.05, Math.PI * 1.95);
    g.stroke();
    g.fillStyle = c.hair;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.roundRect(s * (W + 10) - 30 + fx * 0.3, cy - 30, 60, 110, 24);
      g.fill();
    }
  } else if (c.accessory === "crown") {
    g.fillStyle = "#fcc419";
    const by = cy - H + 20;
    g.beginPath();
    g.moveTo(-110 + fx * 0.3, by);
    for (let i = 0; i <= 4; i++) g.lineTo(-110 + i * 55 + fx * 0.3, by - (i % 2 ? 60 : 110));
    g.lineTo(110 + fx * 0.3, by);
    g.closePath();
    g.fill();
  }
}

// ---------------------------------------------------------------------------
// Tomas grabadas
// ---------------------------------------------------------------------------

export const packRig = (r: Rig) => RIG_KEYS.map((k) => Math.round(r[k] * 1000) / 1000);
export const unpackRig = (a: number[]): Rig => {
  const r = { ...NEUTRAL };
  RIG_KEYS.forEach((k, i) => (r[k] = a[i] ?? NEUTRAL[k]));
  return r;
};

/** Rig de la toma en el instante `t` (interpolado entre muestras). */
export function rigAt(take: Take, t: number): Rig {
  const f = take.frames;
  if (!f.length) return { ...NEUTRAL };
  let lo = 0;
  let hi = f.length - 1;
  if (t <= f[0].t) return unpackRig(f[0].r);
  if (t >= f[hi].t) return unpackRig(f[hi].r);
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (f[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const u = (t - f[lo].t) / (f[hi].t - f[lo].t || 1);
  return unpackRig(f[lo].r.map((v, i) => v + (f[hi].r[i] - v) * u));
}

export function triggersAt(events: { t: number; trigger: Trigger }[], t: number): ActiveTriggers {
  const out: ActiveTriggers = {};
  for (const e of events) {
    const u = (t - e.t) / TRIGGER_DURATION;
    if (u >= 0 && u < 1) out[e.trigger] = u;
  }
  return out;
}

export function defaultScene(): Scene {
  return { width: 1920, height: 1080, background: "#ffe8cc", background2: "#ffc078", gradient: true, image: null, scale: 0.78, floor: 0.9 };
}
