// Cálculos del texto al importar PowerPoint (sin DOM, para poder probarlos).
// PowerPoint mide la letra en puntos sobre una diapositiva de tamaño real (por ejemplo
// 20 pulgadas en los pósteres que crea iLovePDF desde un PDF); CoffeeView dibuja sobre
// un lienzo de ancho fijo, así que la letra se escala en la misma proporción que las cajas.

const EMU_PER_POINT = 12700;
const DEFAULT_SLIDE_EMU = 9144000; // 10 pulgadas

/**
 * Tamaño de letra en píxeles del lienzo.
 * @param szHundredths tamaño de PowerPoint en centésimas de punto (`sz="1800"` = 18 pt)
 * @param slideWidthEmu ancho de la diapositiva (`sldSz cx`)
 * @param canvasWidth ancho del lienzo de CoffeeView en px
 * @param fontScale ajuste automático de PowerPoint (`normAutofit fontScale`, 100000 = 100 %)
 */
export function fontPx(szHundredths: number, slideWidthEmu: number, canvasWidth: number, fontScale = 100000): number {
  const slidePoints = (slideWidthEmu > 0 ? slideWidthEmu : DEFAULT_SLIDE_EMU) / EMU_PER_POINT;
  const scale = fontScale > 0 ? fontScale / 100000 : 1;
  return Math.max(1, Math.round((szHundredths / 100) * (canvasWidth / slidePoints) * scale));
}

export interface RunInfo {
  text: string;
  sz?: number;
  b?: boolean;
  i?: boolean;
  color?: string;
}

/** El fragmento que más texto ocupa: su formato representa a la caja entera. */
export function dominantRun(runs: RunInfo[]): RunInfo | null {
  let best: RunInfo | null = null;
  for (const r of runs) if (!best || r.text.trim().length > best.text.trim().length) best = r;
  return best;
}
