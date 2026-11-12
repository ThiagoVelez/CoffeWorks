// Complemento «Revisión del PDF original»: revisa la ortografía del texto que
// ya trae el PDF (y, en páginas escaneadas, del texto reconocido con OCR).
// Sin el complemento, CoffeePDF solo revisa los textos que agrega el usuario.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, ScanText } from "lucide-react";
import type { Annotation, PageItem } from "../types";
import type { SourcePdf } from "../services/pdfEngine";
import { isTauri } from "../services/desktop";
import { totalRotation } from "../services/geometry";
import { ADDON_ID, correctionAnnotations, readOriginal, visibleText, type OriginalItem, type PageOriginal } from "../services/originalText";
import { askConfirm, showMessage, toast } from "./Dialogs";

interface AddonInfo {
  installed: boolean;
  can_install: boolean;
  download_size: string;
  manual_hint: string;
  description: string;
}

type AddonStatus = "checking" | "missing" | "installing" | "installed";

const STORAGE_KEY = "coffeepdf_original_check";
const readOn = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
};

const signature = (page: PageItem) => `${page.source}:${page.index}:${totalRotation(page)}`;

export function useOriginalText(sources: SourcePdf[], pages: PageItem[], loaded: boolean) {
  const [status, setStatus] = useState<AddonStatus>("checking");
  const [info, setInfo] = useState<AddonInfo | null>(null);
  const [on, setOnState] = useState(readOn);
  const [data, setData] = useState<Map<string, { sig: string; page: PageOriginal }>>(() => new Map());
  const [progress, setProgress] = useState<string | null>(null);
  const runRef = useRef(0);

  // ¿Está instalado? En el navegador (modo de desarrollo) se revisa el texto digital sin OCR.
  useEffect(() => {
    if (!isTauri) {
      setStatus("installed");
      return;
    }
    invoke<AddonInfo>("core_addon_status", { id: ADDON_ID })
      .then((addon) => {
        setInfo(addon);
        setStatus(addon.installed ? "installed" : "missing");
      })
      .catch(() => setStatus("missing"));
  }, []);

  const setOn = useCallback((value: boolean) => {
    setOnState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      /* sin almacenamiento */
    }
  }, []);

  // Al abrir otro PDF se empieza de cero
  useEffect(() => setData(new Map()), [sources]);

  const active = on && status === "installed" && loaded;
  const pagesSig = pages.map((p) => `${p.id}=${signature(p)}`).join("|");

  // Lee las páginas una a una, en segundo plano
  useEffect(() => {
    if (!active) {
      setProgress(null);
      return;
    }
    const run = ++runRef.current;
    const todo = pages.filter((p) => p.source !== null && data.get(p.id)?.sig !== signature(p));
    if (!todo.length) return;
    let failed = "";
    void (async () => {
      for (let i = 0; i < todo.length; i++) {
        if (runRef.current !== run) return;
        const page = todo[i];
        setProgress(todo.length > 1 ? `Revisando el original… ${i + 1}/${todo.length}` : "Revisando el original…");
        let result: PageOriginal = { items: [], scanned: false };
        try {
          result = await readOriginal(sources, page, isTauri);
        } catch (err) {
          failed = err instanceof Error ? err.message : String(err);
        }
        if (runRef.current !== run) return;
        setData((prev) => new Map(prev).set(page.id, { sig: signature(page), page: result }));
      }
      setProgress(null);
      if (failed) toast(`No se pudo reconocer el texto de alguna página: ${failed}`, "error");
    })();
    return () => {
      runRef.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, sources, pagesSig]);

  const { segments, layers, owner } = useMemo(() => {
    const segments: Array<{ key: string; text: string; label: string }> = [];
    const layers = new Map<string, Array<{ item: OriginalItem; text: string }>>();
    const owner = new Map<string, { pageId: string; item: OriginalItem }>();
    if (!active) return { segments, layers, owner };
    pages.forEach((page, index) => {
      const entry = data.get(page.id);
      if (!entry || entry.sig !== signature(page)) return;
      const list = entry.page.items.map((item) => ({ item, text: visibleText(item, page.annotations) }));
      layers.set(page.id, list);
      for (const { item, text } of list) {
        segments.push({ key: item.key, text, label: `Página ${index + 1} · texto original${item.ocr ? " (OCR)" : ""}` });
        owner.set(item.key, { pageId: page.id, item });
      }
    });
    return { segments, layers, owner };
  }, [active, pages, data]);

  const pageOf = useCallback((key: string) => owner.get(key)?.pageId ?? null, [owner]);

  const correction = useCallback(
    (key: string, start: number, end: number, replacement: string): { pageId: string; annotations: Annotation[] } | null => {
      const found = owner.get(key);
      return found ? { pageId: found.pageId, annotations: correctionAnnotations(found.item, start, end, replacement) } : null;
    },
    [owner]
  );

  const install = useCallback(async () => {
    const size = info?.download_size || "45 MB";
    if (info && !info.can_install) {
      await showMessage("Revisión del PDF original", info.manual_hint);
      return;
    }
    const ok = await askConfirm({
      title: "Revisión del PDF original",
      message: `CoffeePDF revisa por ahora solo los textos que agregas. Este complemento también revisa la ortografía del texto que ya trae el PDF, y en los documentos escaneados lo reconoce con OCR (español e inglés). Las faltas se corrigen con clic derecho: la palabra se tapa y la corrección se escribe encima.\n\nSe descargará una sola vez (${size}) y también aparecerá en el Launcher, en Complementos.`,
      confirmLabel: `Instalar (${size})`,
    });
    if (!ok) return;
    setStatus("installing");
    try {
      const addon = await invoke<AddonInfo>("core_addon_install", { id: ADDON_ID });
      setInfo(addon);
      setStatus(addon.installed ? "installed" : "missing");
      if (addon.installed) {
        setOn(true);
        toast("Complemento instalado: ahora también se revisa el texto original del PDF.");
      }
    } catch (err) {
      setStatus("missing");
      await showMessage("No se pudo instalar el complemento", err instanceof Error ? err.message : String(err));
    }
  }, [info, setOn]);

  const scannedPages = useMemo(() => [...data.values()].filter((d) => d.page.scanned).length, [data]);

  return { status, on, setOn, install, progress, segments, layers, pageOf, correction, scannedPages };
}

export type OriginalTextState = ReturnType<typeof useOriginalText>;

/** Botón de la barra inferior: instalar, activar o desactivar la revisión del original. */
export const OriginalCheck: React.FC<{ state: OriginalTextState }> = ({ state }) => {
  if (state.status === "checking") return null;
  const base = "flex items-center gap-1 px-1.5 h-5 rounded font-sans text-[11px] hover:bg-white/15 shrink-0";
  if (state.status === "missing")
    return (
      <button
        type="button"
        className={`${base} opacity-90`}
        onClick={() => void state.install()}
        title="Instala el complemento «Revisión del PDF original» para revisar también el texto que ya trae el documento"
        data-original-check="missing"
      >
        <ScanText size={13} /> Revisar el original…
      </button>
    );
  if (state.status === "installing")
    return (
      <span className={base} data-original-check="installing">
        <Loader2 size={13} className="animate-spin" /> Instalando complemento…
      </span>
    );
  return (
    <button
      type="button"
      className={`${base} ${state.on ? "" : "opacity-60"}`}
      onClick={() => state.setOn(!state.on)}
      title={state.on ? "Se revisa también el texto original del PDF. Clic para revisar solo lo que agregas." : "Clic para revisar también el texto original del PDF"}
      data-original-check={state.on ? "on" : "off"}
    >
      {state.progress ? <Loader2 size={13} className="animate-spin" /> : <ScanText size={13} />}
      {state.progress || (state.on ? "Original: sí" : "Original: no")}
    </button>
  );
};
