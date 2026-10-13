import React from "react";
import { Command, Coffee } from "lucide-react";

interface WelcomeBannerProps {
  focusMode: boolean;
  docCount: number;
  onToggleFocusMode: () => void;
  onCreateNewDoc?: (type: string) => void;
}

export const WelcomeBanner: React.FC<WelcomeBannerProps> = ({
  focusMode,
  docCount,
  onToggleFocusMode,
}) => {

  const todayStr = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const formattedDate = todayStr.charAt(0).toUpperCase() + todayStr.slice(1);

  return (
    <section className="relative rounded-2xl bg-gradient-to-br from-white via-[#faf7f2] to-[#f4ede6] p-6 lg:p-7 shadow-sm border border-[#e8dfd8] text-[#2c1b12] z-20">
      {/* Resplandores ambientales decorativos encapsulados */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
        <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-[#eeddd0]/50 blur-3xl" />
        <div className="absolute -left-12 -bottom-12 w-64 h-64 rounded-full bg-[#f5ebe6]/60 blur-2xl" />
      </div>

      <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="flex flex-col gap-2.5 max-w-2xl">
          {/* Etiquetas superiores */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onToggleFocusMode}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[#5c3a21] font-mono text-[11px] font-semibold border border-[#dfd3c7] hover:border-[#6f4e37] transition-colors shadow-xs"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  focusMode ? "bg-[#6f4e37] animate-pulse" : "bg-[#a1887f]"
                }`}
              />
              <span>{focusMode ? "Modo Enfoque Activado" : "Modo Enfoque Pausado"}</span>
            </button>
            <span className="font-mono text-[11px] text-[#795548] font-medium">{formattedDate}</span>
            <span className="text-[#a1887f] font-mono text-[11px]">•</span>
            <span className="font-mono text-[11px] text-[#5c3a21] font-semibold bg-[#eeddd0] px-2 py-0.5 rounded-full border border-[#dfd3c7]">
              {docCount === 1 ? "1 documento en bóveda" : `${docCount} documentos en bóveda`}
            </span>
          </div>

          {/* Título de bienvenida con alusión a café */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#eeddd0] flex items-center justify-center text-[#6f4e37] shrink-0 border border-[#dfd3c7]">
              <Coffee size={18} strokeWidth={2.4} />
            </div>
            <h1 className="font-display text-2xl lg:text-3xl text-[#2c1b12] font-bold tracking-tight">
              Buenos días, listo para crear
            </h1>
          </div>
          <p className="text-sm text-[#5c3a21] leading-relaxed">
            {docCount === 0
              ? "Tu suite ofimática local CoffeWorks está lista. Redacta documentos con CoffeDoc y organízalos en tu bóveda local de alta fidelidad."
              : `Tu suite ofimática CoffeWorks tiene ${docCount} ${
                  docCount === 1 ? "documento sincronizado" : "documentos sincronizados"
                } en tu bóveda local, listos para editar sin conexión.`}
          </p>

          {/* Atajo de teclado */}
          <div className="flex items-center gap-2 text-[#795548] font-mono text-[11px] mt-1">
            <Command size={14} className="text-[#6f4e37] shrink-0" />
            <span>
              Pulsa <kbd className="px-1.5 py-0.5 rounded bg-white text-[#2c1b12] font-mono font-bold border border-[#dfd3c7] shadow-xs">Ctrl + K</kbd> para buscar aplicaciones, documentos o atajos rápidos
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
