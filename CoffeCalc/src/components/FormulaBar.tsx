import React, { useState, useEffect } from "react";
import { Check, X } from "lucide-react";

interface FormulaBarProps {
  activeCellKey: string;
  onNavigateToCell: (key: string) => void;
  formulaValue: string;
  onChangeFormula: (val: string) => void;
  onCommitFormula: () => void;
  onCancelFormula: () => void;
  onInsertFunction: (fnName: string) => void;
}

export const FormulaBar: React.FC<FormulaBarProps> = ({
  activeCellKey,
  onNavigateToCell,
  formulaValue,
  onChangeFormula,
  onCommitFormula,
  onCancelFormula,
  onInsertFunction,
}) => {
  const [nameBoxValue, setNameBoxValue] = useState(activeCellKey);
  const [fnMenuOpen, setFnMenuOpen] = useState(false);

  useEffect(() => {
    setNameBoxValue(activeCellKey);
  }, [activeCellKey]);

  const handleNameBoxKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onNavigateToCell(nameBoxValue.toUpperCase().trim());
    }
  };

  return (
    <div className="h-8 bg-white border-b border-[#d2d0ce] flex items-center px-2 gap-1 text-xs select-none shadow-xs z-30">
      {/* 1. Cuadro de nombres de Excel (Name Box) */}
      <div className="w-20 shrink-0">
        <input
          type="text"
          value={nameBoxValue}
          onChange={(e) => setNameBoxValue(e.target.value.toUpperCase())}
          onKeyDown={handleNameBoxKeyDown}
          title="Cuadro de nombres (escribe una celda y presiona Enter)"
          className="w-full text-center font-mono font-bold text-xs py-0.5 border border-[#d2d0ce] rounded bg-[#fcfaf7] focus:bg-white focus:outline-none focus:border-[#107c41] text-[#201f1e]"
        />
      </div>

      <div className="h-4 w-px bg-gray-300 mx-1 shrink-0" />

      {/* 2. Botones de Aceptar (✓), Cancelar (✕) y Función (fx) */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={onCancelFormula}
          title="Cancelar edición (Esc)"
          className="p-1 rounded hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors"
        >
          <X size={13} />
        </button>

        <button
          type="button"
          onClick={onCommitFormula}
          title="Introducir fórmula (Enter)"
          className="p-1 rounded hover:bg-emerald-50 text-gray-500 hover:text-emerald-700 transition-colors"
        >
          <Check size={13} />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setFnMenuOpen(!fnMenuOpen)}
            title="Insertar función (fx)"
            className="px-1.5 py-0.5 rounded hover:bg-[#dff6dd] font-serif italic font-bold text-xs text-[#107c41] transition-colors"
          >
            fx
          </button>

          {fnMenuOpen && (
            <div
              className="absolute left-0 top-full mt-1 w-44 bg-white border border-[#d2d0ce] rounded-xl shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95"
              onClick={() => setFnMenuOpen(false)}
            >
              <div className="px-3 py-1 font-mono text-[10px] text-gray-500 uppercase font-bold border-b border-gray-100">
                Funciones de Excel
              </div>
              {[
                { name: "SUMA", desc: "Suma un rango de celdas" },
                { name: "PROMEDIO", desc: "Calcula la media aritmética" },
                { name: "CONTAR", desc: "Cuenta celdas con números" },
                { name: "MAX", desc: "Valor máximo en el rango" },
                { name: "MIN", desc: "Valor mínimo en el rango" },
              ].map((fn) => (
                <button
                  key={fn.name}
                  type="button"
                  onClick={() => onInsertFunction(fn.name)}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#dff6dd] flex flex-col transition-colors"
                >
                  <span className="font-bold text-xs text-[#107c41]">={fn.name}()</span>
                  <span className="text-[10px] text-gray-500">{fn.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="h-4 w-px bg-gray-300 mx-1 shrink-0" />

      {/* 3. Input de contenido de la barra de fórmulas */}
      <div className="flex-1 relative flex items-center min-w-0">
        <input
          type="text"
          value={formulaValue}
          onChange={(e) => onChangeFormula(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommitFormula();
            if (e.key === "Escape") onCancelFormula();
          }}
          placeholder="Escribe un valor o fórmula comenzando con '=' (ej: =SUMA(A1:A5))"
          className="w-full font-mono text-xs px-2 py-0.5 border border-transparent hover:border-[#d2d0ce] focus:border-[#107c41] focus:bg-white rounded focus:outline-none transition-colors text-[#201f1e]"
        />
      </div>
    </div>
  );
};
