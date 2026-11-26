// Señales para separar la voz y sacar la letra: FFT de cualquier tamaño, STFT/ISTFT como
// torch.stft (ventana de Hann periódica, centrada con reflejo), remuestreo y WAV. Todo puro.

// ---------- FFT ----------

/** FFT compleja en el sitio, tamaño potencia de dos. */
function fft2(re: Float64Array, im: Float64Array, inversa = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inversa ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

interface Plan { n: number; m: number; wr: Float64Array; wi: Float64Array; br: Float64Array; bi: Float64Array }
const planes = new Map<number, Plan>();

/** Bluestein: DFT de tamaño n con FFTs de potencia de dos. */
function plan(n: number): Plan {
  let p = planes.get(n);
  if (p) return p;
  let m = 1;
  while (m < 2 * n - 1) m <<= 1;
  const wr = new Float64Array(n), wi = new Float64Array(n);
  for (let k = 0; k < n; k++) { const a = (Math.PI * ((k * k) % (2 * n))) / n; wr[k] = Math.cos(a); wi[k] = -Math.sin(a); }
  const br = new Float64Array(m), bi = new Float64Array(m);
  br[0] = wr[0]; bi[0] = -wi[0];
  for (let k = 1; k < n; k++) { br[k] = br[m - k] = wr[k]; bi[k] = bi[m - k] = -wi[k]; }
  fft2(br, bi);
  p = { n, m, wr, wi, br, bi };
  planes.set(n, p);
  return p;
}

/** DFT compleja de tamaño cualquiera (directa). */
function dft(re: Float64Array, im: Float64Array): [Float64Array, Float64Array] {
  const n = re.length;
  if ((n & (n - 1)) === 0) { const r = Float64Array.from(re), i = Float64Array.from(im); fft2(r, i); return [r, i]; }
  const { m, wr, wi, br, bi } = plan(n);
  const ar = new Float64Array(m), ai = new Float64Array(m);
  for (let k = 0; k < n; k++) { ar[k] = re[k] * wr[k] - im[k] * wi[k]; ai[k] = re[k] * wi[k] + im[k] * wr[k]; }
  fft2(ar, ai);
  for (let k = 0; k < m; k++) { const r = ar[k] * br[k] - ai[k] * bi[k]; ai[k] = ar[k] * bi[k] + ai[k] * br[k]; ar[k] = r; }
  fft2(ar, ai, true);
  const or = new Float64Array(n), oi = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const r = ar[k] / m, i = ai[k] / m;
    or[k] = r * wr[k] - i * wi[k]; oi[k] = r * wi[k] + i * wr[k];
  }
  return [or, oi];
}

/** FFT de una señal real: bandas 0…n/2. */
export function rfft(x: ArrayLike<number>): { re: Float64Array; im: Float64Array } {
  const n = x.length;
  const [r, i] = dft(Float64Array.from(x), new Float64Array(n));
  const b = Math.floor(n / 2) + 1;
  return { re: r.subarray(0, b), im: i.subarray(0, b) };
}

/** Inversa de rfft (simetría hermítica), tamaño n. */
export function irfft(re: ArrayLike<number>, im: ArrayLike<number>, n: number): Float64Array {
  const r = new Float64Array(n), i = new Float64Array(n);
  const b = Math.floor(n / 2) + 1;
  for (let k = 0; k < b; k++) { r[k] = re[k]; i[k] = -im[k]; }
  for (let k = b; k < n; k++) { r[k] = re[n - k]; i[k] = im[n - k]; }
  const [or] = dft(r, i); // conj(DFT(conj X)) / n; la parte real basta
  for (let k = 0; k < n; k++) or[k] /= n;
  return or;
}

// ---------- STFT ----------

const ventanas = new Map<number, Float64Array>();
export function hann(n: number): Float64Array {
  let w = ventanas.get(n);
  if (!w) { w = Float64Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n)); ventanas.set(n, w); }
  return w;
}

export interface Espectro { re: Float32Array; im: Float32Array; bandas: number; cuadros: number }

/** Como torch.stft(center=True, pad reflect, hann periódica). Disposición: [banda][cuadro]. */
export function stft(x: Float32Array, nFft: number, salto: number): Espectro {
  const pad = nFft >> 1;
  const n = x.length;
  const refl = (i: number) => {
    // reflejo sin repetir el borde (como numpy «reflect»)
    if (n === 1) return x[0];
    const p = 2 * (n - 1);
    let j = ((i % p) + p) % p;
    if (j >= n) j = p - j;
    return x[j];
  };
  const cuadros = 1 + Math.floor(n / salto);
  const bandas = (nFft >> 1) + 1;
  const re = new Float32Array(bandas * cuadros), im = new Float32Array(bandas * cuadros);
  const w = hann(nFft);
  const marco = new Float64Array(nFft);
  for (let t = 0; t < cuadros; t++) {
    const ini = t * salto - pad;
    for (let k = 0; k < nFft; k++) marco[k] = refl(ini + k) * w[k];
    const f = rfft(marco);
    for (let b = 0; b < bandas; b++) { re[b * cuadros + t] = f.re[b]; im[b * cuadros + t] = f.im[b]; }
  }
  return { re, im, bandas, cuadros };
}

/** Inversa de stft (suma solapada con normalización por la ventana al cuadrado). */
export function istft(re: Float32Array, im: Float32Array, bandas: number, cuadros: number, nFft: number, salto: number, largo: number): Float32Array {
  const w = hann(nFft);
  const total = nFft + salto * (cuadros - 1);
  const out = new Float64Array(total), norma = new Float64Array(total);
  const r = new Float64Array(bandas), i = new Float64Array(bandas);
  for (let t = 0; t < cuadros; t++) {
    for (let b = 0; b < bandas; b++) { r[b] = re[b * cuadros + t]; i[b] = im[b * cuadros + t]; }
    const marco = irfft(r, i, nFft);
    const ini = t * salto;
    for (let k = 0; k < nFft; k++) { out[ini + k] += marco[k] * w[k]; norma[ini + k] += w[k] * w[k]; }
  }
  const pad = nFft >> 1;
  const y = new Float32Array(largo);
  for (let k = 0; k < largo; k++) {
    const j = k + pad;
    y[k] = j < total && norma[j] > 1e-10 ? out[j] / norma[j] : 0;
  }
  return y;
}

// ---------- Remuestreo ----------

/** Remuestreo con sinc enventanado (Kaiser aproximado con Blackman), sin desfase. */
export function remuestrear(x: Float32Array, de: number, a: number): Float32Array {
  if (de === a) return Float32Array.from(x);
  const razon = a / de;
  const largo = Math.round(x.length * razon);
  const corte = Math.min(1, razon) * 0.97;
  const ancho = 16; // lóbulos a cada lado (en muestras de entrada / corte)
  const radio = Math.ceil(ancho / corte);
  const y = new Float32Array(largo);
  for (let k = 0; k < largo; k++) {
    const pos = k / razon;
    const c = Math.floor(pos);
    let s = 0, wsum = 0;
    for (let j = c - radio + 1; j <= c + radio; j++) {
      if (j < 0 || j >= x.length) continue;
      const d = pos - j;
      const arg = d * corte;
      const sincv = arg === 0 ? 1 : Math.sin(Math.PI * arg) / (Math.PI * arg);
      const u = d / radio;
      if (Math.abs(u) >= 1) continue;
      const vent = 0.42 + 0.5 * Math.cos(Math.PI * u) + 0.08 * Math.cos(2 * Math.PI * u);
      const peso = corte * sincv * vent;
      s += x[j] * peso;
      wsum += peso;
    }
    y[k] = wsum ? (s / wsum) * 1 : 0;
  }
  return y;
}

/** Cualquier audio → estéreo a 44,1 kHz (lo que espera el separador). */
export function aEstereo44(canales: Float32Array[], rate: number): [Float32Array, Float32Array] {
  const l = canales[0], r = canales[1] ?? canales[0];
  return [remuestrear(l, rate, 44100), remuestrear(r, rate, 44100)];
}

/** Estéreo a 44,1 kHz → frecuencia y número de canales originales. */
export function deEstereo44(l: Float32Array, r: Float32Array, rate: number, canales: number): Float32Array[] {
  const L = remuestrear(l, 44100, rate), R = remuestrear(r, 44100, rate);
  if (canales === 1) return [L.map((v, i) => (v + R[i]) / 2)];
  return [L, R, ...Array.from({ length: canales - 2 }, () => L.map((v, i) => (v + R[i]) / 2))];
}

/** Mezcla a mono a 16 kHz (lo que espera Whisper). */
export function aMono16(canales: Float32Array[], rate: number): Float32Array {
  const n = canales[0].length;
  const m = new Float32Array(n);
  for (const c of canales) for (let i = 0; i < n; i++) m[i] += c[i] / canales.length;
  return remuestrear(m, rate, 16000);
}

// ---------- WAV ----------

export function wav16(canales: Float32Array[], rate: number): Uint8Array {
  const n = canales[0].length, ch = canales.length;
  const buf = new ArrayBuffer(44 + n * ch * 2);
  const v = new DataView(buf);
  const txt = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  txt(0, "RIFF"); v.setUint32(4, 36 + n * ch * 2, true); txt(8, "WAVE"); txt(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); txt(36, "data"); v.setUint32(40, n * ch * 2, true);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++, o += 2) v.setInt16(o, Math.max(-1, Math.min(1, canales[c][i])) * 32767, true);
  return new Uint8Array(buf);
}

/** WAV PCM 16/24/32 bits o flotante de 32 bits. */
export function leerWav(bytes: Uint8Array): { canales: Float32Array[]; rate: number } {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let o = 12, ch = 1, rate = 44100, bits = 16, fmt = 1;
  while (o + 8 <= bytes.length) {
    const id = String.fromCharCode(...bytes.subarray(o, o + 4));
    const tam = v.getUint32(o + 4, true);
    if (id === "fmt ") { fmt = v.getUint16(o + 8, true); ch = v.getUint16(o + 10, true); rate = v.getUint32(o + 12, true); bits = v.getUint16(o + 22, true); }
    if (id === "data") {
      const bps = bits / 8, n = Math.floor(Math.min(tam, bytes.length - o - 8) / (bps * ch));
      const canales = Array.from({ length: ch }, () => new Float32Array(n));
      let p = o + 8;
      for (let i = 0; i < n; i++)
        for (let c = 0; c < ch; c++, p += bps)
          canales[c][i] = fmt === 3 ? v.getFloat32(p, true) : bits === 16 ? v.getInt16(p, true) / 32768 : bits === 24 ? ((v.getUint8(p) | (v.getUint8(p + 1) << 8) | (v.getInt8(p + 2) << 16)) / 8388608) : v.getInt32(p, true) / 2147483648;
      return { canales, rate };
    }
    o += 8 + tam + (tam & 1);
  }
  throw new Error("WAV sin datos");
}
