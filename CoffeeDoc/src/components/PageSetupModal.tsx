import React, { useEffect, useState } from "react";
import { X, FileCog } from "lucide-react";
import type { ColumnCount, PageMargins, PageOrientation, PageSettings, PageSize } from "../types";

interface PageSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PageSettings;
  onApply: (settings: PageSettings) => void;
}

const PAGE_COLORS = ["#ffffff", "#fdf6e3", "#f1f8e9", "#e8f0fe", "#fce4ec", "#f5f5f5"];

/** Configuración de página: tamaño, orientación, márgenes, columnas, color y marca de agua. */
export const PageSetupModal: React.FC<PageSetupModalProps> = ({
  isOpen,
  onClose,
  settings,
  onApply,
}) => {
  const [draft, setDraft] = useState<PageSettings>(settings);

  useEffect(() => {
    if (isOpen) setDraft(settings);
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const set = <K extends keyof PageSettings>(key: K, value: PageSettings[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const selectClass =
    "w-full border border-[#c4c7c5] rounded-md px-2.5 py-1.5 text-sm text-[#1f1f1f] bg-white outline-none focus:border-[#0b57d0]";
  const labelClass = "flex flex-col gap-1 text-xs font-medium text-[#444746]";

  return (
    <div
      className="fixed inset-0 z-[999980] bg-black/40 flex items-center justify-center p-4 select-none print:hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onApply(draft);
          onClose();
        }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 flex flex-col gap-4 text-[#1f1f1f]"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCog size={18} className="text-[#0b57d0]" />
            <h2 className="text-base font-semibold">Configuración de página</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 text-[#444746]"
            title="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            <span>Tamaño del papel</span>
            <select
              className={selectClass}
              value={draft.pageSize}
              onChange={(e) => set("pageSize", e.target.value as PageSize)}
            >
              <option value="A4">A4 (21 × 29,7 cm)</option>
              <option value="Letter">Carta (21,6 × 27,9 cm)</option>
              <option value="Legal">Oficio (21,6 × 35,6 cm)</option>
            </select>
          </label>

          <label className={labelClass}>
            <span>Orientación</span>
            <select
              className={selectClass}
              value={draft.orientation}
              onChange={(e) => set("orientation", e.target.value as PageOrientation)}
            >
              <option value="portrait">Vertical</option>
              <option value="landscape">Horizontal</option>
            </select>
          </label>

          <label className={labelClass}>
            <span>Márgenes</span>
            <select
              className={selectClass}
              value={draft.margins}
              onChange={(e) => set("margins", e.target.value as PageMargins)}
            >
              <option value="narrow">Estrechos (1,27 cm)</option>
              <option value="normal">Normales (2,54 cm)</option>
              <option value="wide">Anchos (3,81 cm)</option>
            </select>
          </label>

          <label className={labelClass}>
            <span>Columnas</span>
            <select
              className={selectClass}
              value={draft.columns}
              onChange={(e) => set("columns", Number(e.target.value) as ColumnCount)}
            >
              <option value={1}>Una</option>
              <option value={2}>Dos</option>
              <option value={3}>Tres</option>
            </select>
          </label>
        </div>

        <div className={labelClass}>
          <span>Color de la página</span>
          <div className="flex items-center gap-2">
            {PAGE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                title={color}
                onClick={() => set("pageColor", color)}
                style={{ backgroundColor: color }}
                className={`w-7 h-7 rounded-full border ${
                  draft.pageColor.toLowerCase() === color ? "border-[#0b57d0] ring-2 ring-[#0b57d0]/30" : "border-[#c4c7c5]"
                }`}
              />
            ))}
            <input
              type="color"
              value={draft.pageColor}
              onChange={(e) => set("pageColor", e.target.value)}
              title="Color personalizado"
              className="w-8 h-8 p-0.5 border border-[#c4c7c5] rounded-md bg-white cursor-pointer"
            />
          </div>
        </div>

        <label className={labelClass}>
          <span>Marca de agua (opcional)</span>
          <input
            type="text"
            value={draft.watermark}
            maxLength={24}
            onChange={(e) => set("watermark", e.target.value)}
            placeholder="Por ejemplo: BORRADOR o CONFIDENCIAL"
            className={selectClass}
          />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-full text-xs font-semibold text-[#0b57d0] hover:bg-[#e8f0fe] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-[#0b57d0] hover:bg-[#0a4cb8] transition-colors"
          >
            Aplicar
          </button>
        </div>
      </form>
    </div>
  );
};
