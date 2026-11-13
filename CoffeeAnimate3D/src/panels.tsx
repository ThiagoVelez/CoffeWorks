// Diálogos de los complementos: «Render» y «Piezas».

import React, { useEffect, useMemo, useState } from "react";
import { X, Image as ImageIcon, Clapperboard, Package, Loader2 } from "lucide-react";
import { Button, Select, Toggle, cx } from "./studio/ui";
import { saveFileAs } from "./studio/desktop";
import { toast } from "./studio/Dialogs";
import { canWebM, encodeGifJob, encodeWebM } from "./studio/videoExport";
import { DEFAULT_RENDER, RENDER_SIZES, RenderSession, type RenderOptions } from "./render";
import { loadPieceIndex, type PieceEntry } from "./addonsLib";
import type { Viewport } from "./viewport";

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className={cx("bg-[#1f1f23] border border-[#2a2a30] rounded-xl shadow-2xl flex flex-col max-h-[90vh]", wide ? "w-[760px]" : "w-[460px]")} data-dialog={title}>
      <div className="flex items-center justify-between px-4 h-11 border-b border-[#2a2a30]">
        <span className="text-[13px] font-semibold">{title}</span>
        <button type="button" onClick={onClose} className="text-[#8a8a92] hover:text-white" title="Cerrar">
          <X size={16} />
        </button>
      </div>
      <div className="p-4 overflow-auto">{children}</div>
    </div>
  </div>
);

const toBytes = async (canvas: HTMLCanvasElement) => new Uint8Array(await (await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/png"))).arrayBuffer());

export const RenderDialog: React.FC<{ viewport: () => Viewport | null; title: string; onClose: () => void }> = ({ viewport, title, onClose }) => {
  const [o, setO] = useState<RenderOptions>(DEFAULT_RENDER);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const size = RENDER_SIZES.findIndex((s) => s.width === o.width && s.height === o.height);

  useEffect(() => {
    // Vista previa pequeña cada vez que cambian las opciones.
    const vp = viewport();
    if (!vp) return;
    const t = window.setTimeout(() => {
      // Una vista previa cada vez (no se acumulan contextos WebGL).
      const s = new RenderSession(vp, { ...o, width: 480, height: Math.round((480 * o.height) / o.width) });
      try {
        setPreview(s.render().toDataURL("image/png"));
      } finally {
        s.dispose();
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [o, viewport]);

  const still = async () => {
    const vp = viewport();
    if (!vp) return;
    setBusy("Renderizando…");
    try {
      const s = new RenderSession(vp, o);
      let bytes: Uint8Array;
      try {
        bytes = await toBytes(s.render());
      } finally {
        s.dispose();
      }
      if (await saveFileAs(`${title || "modelo"}-render.png`, [{ name: "Imagen PNG", extensions: ["png"] }], bytes, "Guardar render")) toast("Render guardado");
    } catch (e) {
      toast(String((e as Error).message), "error");
    } finally {
      setBusy(null);
    }
  };

  const turntable = async () => {
    const vp = viewport();
    if (!vp) return;
    const s = new RenderSession(vp, { ...o, width: Math.min(o.width, 1280), height: Math.round((Math.min(o.width, 1280) * o.height) / o.width) });
    const webm = canWebM() && !o.transparent;
    const job = {
      width: s.canvas.width,
      height: s.canvas.height,
      fps: 24,
      frames: 96,
      alpha: o.transparent,
      render: (i: number) => s.render(i / 96),
      onProgress: (f: number) => setBusy(`Vuelta 360°: ${Math.round(f * 100)} %`),
    };
    try {
      setBusy("Vuelta 360°: 0 %");
      const blob = webm ? await encodeWebM(job) : await encodeGifJob(job, 640);
      const ext = webm ? "webm" : "gif";
      if (await saveFileAs(`${title || "modelo"}-360.${ext}`, [{ name: webm ? "Video WebM" : "Animación GIF", extensions: [ext] }], blob, "Guardar vuelta 360°")) toast(`Vuelta 360° guardada (${ext.toUpperCase()})`);
    } catch (e) {
      toast(String((e as Error).message), "error");
    } finally {
      s.dispose();
      setBusy(null);
    }
  };

  return (
    <Modal title="Render" onClose={onClose} wide>
      <div className="flex gap-4">
        <div className="flex-1 min-w-0 rounded-lg overflow-hidden border border-[#2a2a30]" style={{ background: "repeating-conic-gradient(#2a2a30 0 25%, #1f1f23 0 50%) 0 0/16px 16px" }}>
          {preview ? <img src={preview} alt="Vista previa del render" className="w-full block" data-render-preview /> : <div className="aspect-video" />}
        </div>
        <div className="w-60 shrink-0 flex flex-col gap-3 text-[12px]">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-[#8a8a92]">Tamaño</span>
            <Select value={String(size < 0 ? 1 : size)} onChange={(v) => setO({ ...o, width: RENDER_SIZES[+v].width, height: RENDER_SIZES[+v].height })} options={RENDER_SIZES.map((s, i) => ({ value: String(i), label: s.label }))} />
          </label>
          <Toggle checked={o.shadows} onChange={(v) => setO({ ...o, shadows: v })} label="Sombras" />
          <Toggle checked={o.ao} onChange={(v) => setO({ ...o, ao: v })} label="Oclusión ambiental" />
          <Toggle checked={o.transparent} onChange={(v) => setO({ ...o, transparent: v })} label="Fondo transparente" />
          {!o.transparent && (
            <label className="flex items-center gap-2">
              <input type="color" value={o.background} onChange={(e) => setO({ ...o, background: e.target.value })} className="w-7 h-7 rounded bg-transparent" />
              <span className="text-[#a1a1aa]">Color del cielo</span>
            </label>
          )}
          <p className="text-[11px] text-[#8a8a92] leading-relaxed">Se usa la vista actual del visor. La vuelta de 360° gira la cámara alrededor del modelo (4 s a 24 fps; con fondo transparente, GIF).</p>
          <Button primary onClick={() => void still()} disabled={!!busy}>
            <ImageIcon size={14} /> Guardar imagen (PNG)
          </Button>
          <Button onClick={() => void turntable()} disabled={!!busy}>
            <Clapperboard size={14} /> Vuelta 360°
          </Button>
          {busy && (
            <span className="flex items-center gap-1.5 text-[#ffb27a]">
              <Loader2 size={13} className="animate-spin" /> {busy}
            </span>
          )}
        </div>
      </div>
    </Modal>
  );
};

export const PiecesDialog: React.FC<{ onInsert: (entry: PieceEntry) => void; onClose: () => void }> = ({ onInsert, onClose }) => {
  const [index, setIndex] = useState<PieceEntry[] | null | "loading">("loading");
  useEffect(() => {
    let alive = true;
    loadPieceIndex()
      .then((i) => alive && (i ? setIndex(i) : onClose()))
      .catch((e) => {
        toast(String((e as Error).message), "error");
        onClose();
      });
    return () => {
      alive = false;
    };
  }, [onClose]);
  const groups = useMemo(() => {
    const out = new Map<string, PieceEntry[]>();
    if (Array.isArray(index)) for (const p of index) out.set(p.category, [...(out.get(p.category) ?? []), p]);
    return [...out];
  }, [index]);
  return (
    <Modal title="Piezas" onClose={onClose} wide>
      {index === "loading" ? (
        <div className="flex items-center gap-2 text-[12px] text-[#a1a1aa]">
          <Loader2 size={14} className="animate-spin" /> Cargando el pack de piezas…
        </div>
      ) : (
        <div className="flex flex-col gap-4" data-pieces>
          <p className="text-[12px] text-[#a1a1aa]">Cada pieza se inserta como un grupo en la raíz del modelo; luego puedes moverla, pintarla o cambiarla.</p>
          {groups.map(([cat, items]) => (
            <div key={cat} className="flex flex-col gap-2">
              <span className="text-[11px] uppercase tracking-wider text-[#8a8a92] font-semibold">{cat}</span>
              <div className="grid grid-cols-3 gap-2">
                {items.map((p) => (
                  <button key={p.file} type="button" onClick={() => onInsert(p)} className="flex items-center gap-2 h-9 px-3 rounded-md bg-[#141416] border border-[#2a2a30] hover:border-[#ff8a3d] text-[12px] text-left" data-piece={p.name}>
                    <Package size={14} className="text-[#ffb27a] shrink-0" />
                    <span className="truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};
