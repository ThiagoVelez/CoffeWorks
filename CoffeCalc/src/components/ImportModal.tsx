import React, { useState } from "react";
import { X, Upload, FileText, CheckCircle2 } from "lucide-react";
import { sheetVault } from "../services/sheetVault";
import type { CellData, Sheet, WorkbookMetadata } from "../types";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyImport: (importedData: Record<string, CellData>) => void;
  onImportWorkbook?: (workbook: { metadata: WorkbookMetadata; sheets: Sheet[]; activeSheetId: string }) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onApplyImport,
  onImportWorkbook,
}) => {
  const [csvText, setCsvText] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);

    // Si es un archivo binario de Excel (.xlsx, .xls)
    if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      try {
        const buffer = await file.arrayBuffer();
        if (onImportWorkbook) {
          const wb = sheetVault.importFullWorkbook(buffer, file.name);
          onImportWorkbook(wb);
        } else {
          const data = sheetVault.importSpreadsheetFile(buffer, file.name);
          onApplyImport(data);
        }
        onClose();
      } catch (err) {
        console.error("Error al importar XLSX:", err);
        setErrorMsg("Fallo al procesar el archivo Excel .xlsx");
      }
      return;
    }

    // Si es CSV o texto
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvText(content || "");
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!csvText.trim()) {
      setErrorMsg("Pega texto CSV o carga un archivo antes de continuar.");
      return;
    }
    try {
      const parsed = sheetVault.importFromCSV(csvText);
      onApplyImport(parsed);
      onClose();
    } catch {
      setErrorMsg("El formato de datos no es válido.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#d2d0ce] max-w-lg w-full flex flex-col overflow-hidden">
        {/* Cabecera */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-[#fbf9f6]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#dff6dd] text-[#107c41] flex items-center justify-center border border-[#b2e2b0]">
              <Upload size={18} />
            </div>
            <div>
              <h2 className="font-display font-bold text-base text-[#201f1e]">Importar Datos CSV</h2>
              <p className="text-xs text-gray-500 font-mono">Carga de hojas de cálculo externas</p>
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
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-gray-700">Subir archivo Excel (.xlsx, .xls) o .csv desde tu equipo:</label>
            <label className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-[#107c41] bg-gray-50 hover:bg-[#dff6dd]/20 cursor-pointer transition-colors text-center">
              <input
                type="file"
                accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-1.5 text-gray-600">
                <FileText size={22} className="text-[#107c41]" />
                <span className="font-medium">Haz clic aquí para seleccionar archivo Excel o CSV</span>
              </div>
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-gray-700">O pega directamente el contenido CSV:</label>
            <textarea
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                setErrorMsg(null);
              }}
              rows={6}
              placeholder="Ejemplo:&#10;Producto,Precio,Cantidad&#10;Café Tostado,15000,4&#10;Molino Manual,45000,2"
              className="p-3 rounded-xl border border-gray-300 font-mono text-xs focus:outline-none focus:border-[#107c41] focus:ring-1 focus:ring-[#107c41]"
            />
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="px-5 py-3.5 bg-[#fbf9f6] border-t border-gray-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl text-gray-600 hover:bg-gray-200 transition-colors text-xs font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleImport}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#107c41] hover:bg-[#0e6b37] text-white font-bold transition-all text-xs shadow-xs"
          >
            <CheckCircle2 size={14} />
            <span>Aplicar a la hoja</span>
          </button>
        </div>
      </div>
    </div>
  );
};
