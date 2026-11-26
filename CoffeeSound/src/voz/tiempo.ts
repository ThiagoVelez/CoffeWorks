// Estimación del tiempo restante para las barras de progreso.

/** «quedan ~3 min» a partir de lo que ya se hizo. */
export function quedan(fraccion: number, msTranscurridos: number): string {
  if (fraccion < 0.03 || msTranscurridos < 2000) return "";
  const resto = (msTranscurridos * (1 - fraccion)) / fraccion / 1000;
  return resto < 60 ? " · menos de 1 min" : ` · quedan ~${Math.round(resto / 60)} min`;
}
