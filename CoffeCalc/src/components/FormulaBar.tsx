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
    <div className="h-8 bg-white border-b border-[#e1dfdd] flex items-center px-3 gap-2 text-xs select-none z-30">
      {/* 1. Cuadro de nombres de Google Sheets (Name Box) */}
      <div className="w-16 shrink-0">
        <input
          type="text"
          value={nameBoxValue}
          onChange={(e) => setNameBoxValue(e.target.value.toUpperCase())}
          onKeyDown={handleNameBoxKeyDown}
          title="Cuadro de nombres"
          className="w-full text-center font-mono font-medium text-xs py-0.5 border border-transparent hover:border-gray-300 rounded focus:bg-white focus:outline-none focus:border-[#1a73e8] text-[#1f1f1f]"
        />
      </div>

      <div className="h-4 w-px bg-gray-200 shrink-0" />

      {/* 2. Botón de función fx de Google Sheets */}
      <div className="flex items-center gap-1 shrink-0 relative">
        <button
          type="button"
          onClick={() => setFnMenuOpen(!fnMenuOpen)}
          title="Funciones (fx)"
          className="px-1.5 py-0.5 rounded hover:bg-gray-100 font-serif italic text-xs font-semibold text-[#5f6368] transition-colors"
        >
          fx
        </button>

        {formulaValue && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={onCancelFormula}
              title="Cancelar (Esc)"
              className="p-0.5 rounded hover:bg-gray-100 text-gray-500"
            >
              <X size={12} />
            </button>
            <button
              type="button"
              onClick={onCommitFormula}
              title="Introducir (Enter)"
              className="p-0.5 rounded hover:bg-gray-100 text-[#0F9D58]"
            >
              <Check size={12} />
            </button>
          </div>
        )}

        {fnMenuOpen && (
          <div
            className="absolute left-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-50"
            onClick={() => setFnMenuOpen(false)}
          >
            <div className="px-3 py-1 font-mono text-[10px] text-gray-400 uppercase font-semibold border-b border-gray-100">
              Funciones
            </div>
            {[
              { name: "SUM", desc: "Suma un rango de celdas" },
              { name: "AVERAGE", desc: "Calcula la media" },
              { name: "COUNT", desc: "Cuenta celdas numéricas" },
              { name: "MAX", desc: "Valor máximo" },
              { name: "MIN", desc: "Valor mínimo" },
            ].map((fn) => (
              <button
                key={fn.name}
                type="button"
                onClick={() => onInsertFunction(fn.name)}
                className="w-full text-left px-3 py-1.5 hover:bg-[#f0f4f9] flex flex-col transition-colors"
              >
                <span className="font-bold text-xs text-[#0F9D58]">={fn.name}()</span>
                <span className="text-[10px] text-gray-500">{fn.desc}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-4 w-px bg-gray-200 shrink-0" />

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
          placeholder=""
          className="w-full font-sans text-xs px-2 py-0.5 border border-transparent hover:border-gray-200 focus:border-[#1a73e8] focus:bg-white rounded focus:outline-none transition-colors text-[#1f1f1f]"
        />
      </div>
    </div>
  );
};
