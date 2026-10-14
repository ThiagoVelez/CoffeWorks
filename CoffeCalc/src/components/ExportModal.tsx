import React, { useState } from "react";
import { X, Download, Copy, Check, FileSpreadsheet } from "lucide-react";
import type { Sheet, WorkbookMetadata } from "../types";
import { sheetVault } from "../services/sheetVault";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: WorkbookMetadata;
  activeSheet: Sheet;
  sheets?: Sheet[];
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  metadata,
  activeSheet,
  sheets,
}) => {
  const [copied, setCopied] = useState(false);
  const [format, setFormat] = useState<"xlsx" | "csv" | "cfs" | "json">("xlsx");

  if (!isOpen) return null;

  const csvContent = sheetVault.exportToCSV(activeSheet);
  const jsonContent = JSON.stringify({ metadata, sheets: sheets || [activeSheet] }, null, 2);

  const getExportData = () => {
    if (format === "xlsx") return "Archivo binario de Microsoft Excel (.xlsx)";
    if (format === "csv") return csvContent;
    return jsonContent;
  };

  const handleDownload = () => {
    if (format === "xlsx") {
      const allSheets = sheets && sheets.length > 0 ? sheets : [activeSheet];
      sheetVault.exportWorkbookToXLSX(allSheets, metadata.title);
      return;
    }
    const data = getExportData();
    const mime = format === "csv" ? "text/csv;charset=utf-8;" : "application/json";
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${metadata.title}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getExportData()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#d2d0ce] max-w-lg w-full flex flex-col overflow-hidden">
        {/* Cabecera */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-[#fbf9f6]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#dff6dd] text-[#107c41] flex items-center justify-center border border-[#b2e2b0]">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <h2 className="font-display font-bold text-base text-[#201f1e]">Exportar Libro de Cálculo</h2>
              <p className="text-xs text-gray-500 font-mono">Formatos universales de datos</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="p-5 flex flex-col gap-4 text-xs">
          {/* Selector de formato */}
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-gray-700">Formato de salida:</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "xlsx", label: "Excel (.xlsx)", desc: "Libro de Microsoft Excel nativo" },
                { id: "csv", label: "CSV (.csv)", desc: "Valores separados por comas" },
                { id: "cfs", label: "CoffeSheet (.cfs)", desc: "Formato nativo de la suite" },
                { id: "json", label: "JSON (.json)", desc: "Estructura de datos completa" },
              ].map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setFormat(fmt.id as "xlsx" | "csv" | "cfs" | "json")}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    format === fmt.id
                      ? "border-[#107c41] bg-[#dff6dd]/40 text-[#0e6b37] font-bold shadow-xs"
                      : "border-gray-200 hover:border-gray-300 bg-white text-gray-700"
                  }`}
                >
                  <div className="font-bold text-xs">{fmt.label}</div>
                  <div className="text-[10px] text-gray-500 font-normal mt-0.5">{fmt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Vista previa */}
          <div className="flex flex-col gap-1.5">
            <span className="font-semibold text-gray-700">Vista previa del contenido:</span>
            <pre className="p-3 rounded-xl bg-gray-50 border border-gray-200 font-mono text-[11px] text-gray-800 max-h-44 overflow-auto whitespace-pre leading-relaxed">
              {getExportData()}
            </pre>
          </div>
        </div>

        {/* Pie con botones de acción */}
        <div className="px-5 py-3.5 bg-[#fbf9f6] border-t border-gray-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-300 hover:bg-white text-gray-700 font-medium transition-colors text-xs"
          >
            {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            <span>{copied ? "Copiado al portapapeles" : "Copiar datos"}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-gray-600 hover:bg-gray-200 transition-colors text-xs font-medium"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#107c41] hover:bg-[#0e6b37] text-white font-bold transition-all text-xs shadow-xs"
            >
              <Download size={14} />
              <span>Descargar archivo</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
