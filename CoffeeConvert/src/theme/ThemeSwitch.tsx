// ⚠ Copia de shared/theme/ThemeSwitch.tsx: edita el original y ejecuta node scripts/sync-shared.mjs
// Interruptor «Modo oscuro» para los ajustes de cada app.

import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./theme";

export const ThemeSwitch: React.FC<{ className?: string; compact?: boolean }> = ({ className = "", compact }) => {
  const [theme, setTheme] = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      onClick={() => setTheme(dark ? "light" : "dark")}
      title={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className={`inline-flex items-center gap-2 text-[12px] select-none ${className}`}
      data-theme-switch
    >
      {dark ? <Moon size={14} /> : <Sun size={14} />}
      {!compact && <span>Modo oscuro</span>}
      <span className={`relative w-8 h-[18px] rounded-full transition-colors ${dark ? "bg-[#4dabf7]" : "bg-[#c8c8cf]"}`}>
        <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-all ${dark ? "left-[16px]" : "left-[2px]"}`} />
      </span>
    </button>
  );
};
