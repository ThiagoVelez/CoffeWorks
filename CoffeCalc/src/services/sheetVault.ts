// Servicio de almacenamiento y persistencia para CoffeCalc (sincronizado con la suite CoffeWorks)
import * as XLSX from "xlsx";
import type { Sheet, WorkbookMetadata, CellData } from "../types";
import { computeCellValue, colIndexToName, parseCellKey } from "./formulaEngine";

const STORAGE_KEY = "coffecalc_active_workbook";

// Plantilla inicial de hoja de cálculo con estética ejecutiva de Microsoft Excel
function createDefaultWorkbook(): { metadata: WorkbookMetadata; sheets: Sheet[]; activeSheetId: string } {
  const metadata: WorkbookMetadata = {
    id: `cfs_${Date.now()}`,
    title: "Libro1",
    author: "Usuario CoffeWorks",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const initialData: Record<string, CellData> = {
    // Encabezado del reporte
    A1: { raw: "INFORME FINANCIERO Y PRESUPUESTO", bold: true, color: "#107c41", format: "general" },
    A2: { raw: "CoffeWorks Enterprise - Trimestre Q4", italic: true, color: "#6f4e37", format: "general" },

    // Encabezados de tabla
    A4: { raw: "CONCEPTO", bold: true, bg: "#107c41", color: "#ffffff", align: "left" },
    B4: { raw: "OCTUBRE", bold: true, bg: "#107c41", color: "#ffffff", align: "right" },
    C4: { raw: "NOVIEMBRE", bold: true, bg: "#107c41", color: "#ffffff", align: "right" },
    D4: { raw: "DICIEMBRE", bold: true, bg: "#107c41", color: "#ffffff", align: "right" },
    E4: { raw: "TOTAL", bold: true, bg: "#0e6b37", color: "#ffffff", align: "right" },

    // Filas de ingresos
    A5: { raw: "Ventas de Café Especial", bold: false, align: "left" },
    B5: { raw: "14500000", format: "currency", align: "right" },
    C5: { raw: "16200000", format: "currency", align: "right" },
    D5: { raw: "19800000", format: "currency", align: "right" },
    E5: { raw: "=SUMA(B5:D5)", bold: true, format: "currency", align: "right" },

    A6: { raw: "Suscripciones Digitales", bold: false, align: "left" },
    B6: { raw: "4800000", format: "currency", align: "right" },
    C6: { raw: "5300000", format: "currency", align: "right" },
    D6: { raw: "6100000", format: "currency", align: "right" },
    E6: { raw: "=SUMA(B6:D6)", bold: true, format: "currency", align: "right" },

    A7: { raw: "Consultoría de Software", bold: false, align: "left" },
    B7: { raw: "8500000", format: "currency", align: "right" },
    C7: { raw: "9100000", format: "currency", align: "right" },
    D7: { raw: "10500000", format: "currency", align: "right" },
    E7: { raw: "=SUMA(B7:D7)", bold: true, format: "currency", align: "right" },

    // Fila total consolidado
    A8: { raw: "TOTAL INGRESOS", bold: true, bg: "#dff6dd", color: "#0e6b37", align: "left" },
    B8: { raw: "=SUMA(B5:B7)", bold: true, bg: "#dff6dd", format: "currency", align: "right" },
    C8: { raw: "=SUMA(C5:C7)", bold: true, bg: "#dff6dd", format: "currency", align: "right" },
    D8: { raw: "=SUMA(D5:D7)", bold: true, bg: "#dff6dd", format: "currency", align: "right" },
    E8: { raw: "=SUMA(E5:E7)", bold: true, bg: "#dff6dd", format: "currency", align: "right" },

    // Estadísticas
    A10: { raw: "Promedio Mensual:", italic: true, bold: true, align: "left" },
    B10: { raw: "=PROMEDIO(B5:B7)", format: "currency", align: "right" },
    C10: { raw: "=PROMEDIO(C5:C7)", format: "currency", align: "right" },
    D10: { raw: "=PROMEDIO(D5:D7)", format: "currency", align: "right" },
  };

  // Pre-computar valores iniciales
  for (const [key, cell] of Object.entries(initialData)) {
    initialData[key].computed = computeCellValue(cell.raw, initialData);
  }

  const sheet1: Sheet = {
    id: "sheet_1",
    name: "Hoja1",
    data: initialData,
    colWidths: { A: 230, B: 140, C: 140, D: 140, E: 160 },
  };

  const sheet2: Sheet = {
    id: "sheet_2",
    name: "Hoja2",
    data: {},
    colWidths: {},
  };

  return {
    metadata,
    sheets: [sheet1, sheet2],
    activeSheetId: "sheet_1",
  };
}

export const sheetVault = {
  // Cargar libro activo desde localStorage o plantilla
  loadWorkbook(): { metadata: WorkbookMetadata; sheets: Sheet[]; activeSheetId: string } {
    if (typeof window === "undefined") return createDefaultWorkbook();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.sheets && parsed.sheets.length > 0) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn("Fallo al leer almacenamiento local de CoffeCalc:", err);
    }
    const def = createDefaultWorkbook();
    this.saveWorkbook(def.metadata, def.sheets, def.activeSheetId);
    return def;
  },

  // Guardar libro y sincronizar con la bóveda del Launcher (/api/vault)
  saveWorkbook(
    metadata: WorkbookMetadata,
    sheets: Sheet[],
    activeSheetId: string
  ): void {
    if (typeof window === "undefined") return;
    try {
      const payload = {
        metadata: {
          ...metadata,
          updatedAt: new Date().toISOString(),
        },
        sheets,
        activeSheetId,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

      // Sincronizar archivo .cfs con el Launcher
      const docItem = {
        id: metadata.id,
        name: metadata.title.endsWith(".cfs") ? metadata.title : `${metadata.title}.cfs`,
        app_id: "coffecalc",
        category: "Finanzas",
        last_modified: "Hace unos instantes",
        is_pinned: false,
        path: `./vault/${metadata.title.endsWith(".cfs") ? metadata.title : `${metadata.title}.cfs`}`,
      };

      fetch("http://localhost:1420/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(docItem),
      }).catch(() => {
        // Ignorar si el launcher no está activo
      });
    } catch (err) {
      console.error("Error al guardar libro de cálculo:", err);
    }
  },

  // Generar CSV para descarga o exportación
  exportToCSV(sheet: Sheet): string {
    const rows: string[][] = [];
    const maxRow = 100;
    const maxCol = 26;

    for (let r = 1; r <= maxRow; r++) {
      const rowVals: string[] = [];
      let hasData = false;
      for (let c = 0; c < maxCol; c++) {
        const colLetter = String.fromCharCode(65 + c);
        const key = `${colLetter}${r}`;
        const cell = sheet.data[key];
        const val = cell ? (cell.computed !== undefined ? String(cell.computed) : cell.raw) : "";
        if (val !== "") hasData = true;
        // Escapar comillas dobles
        rowVals.push(`"${val.replace(/"/g, '""')}"`);
      }
      if (hasData) {
        rows.push(rowVals);
      }
    }

    return rows.map((r) => r.join(",")).join("\n");
  },

  // Exportar todas las hojas a archivo .xlsx nativo de Microsoft Excel
  exportWorkbookToXLSX(sheets: Sheet[], filename: string): void {
    const wb = XLSX.utils.book_new();

    for (const sheet of sheets) {
      const wsData: Record<string, unknown> = {};
      let maxR = 1;
      let maxC = 0;

      for (const [key, cell] of Object.entries(sheet.data)) {
        const parsed = parseCellKey(key);
        if (parsed) {
          if (parsed.row + 1 > maxR) maxR = parsed.row + 1;
          if (parsed.col > maxC) maxC = parsed.col;
        }

        if (cell && (cell.raw || cell.computed !== undefined)) {
          const val = cell.computed !== undefined ? cell.computed : cell.raw;
          if (cell.raw && cell.raw.startsWith("=")) {
            wsData[key] = {
              t: typeof cell.computed === "number" ? "n" : "s",
              f: cell.raw.substring(1),
              v: cell.computed,
            };
          } else if (typeof val === "number") {
            wsData[key] = { t: "n", v: val };
          } else {
            wsData[key] = { t: "s", v: String(val) };
          }
        }
      }

      const endColName = colIndexToName(Math.max(25, maxC));
      const endRowNum = Math.max(100, maxR);
      wsData["!ref"] = `A1:${endColName}${endRowNum}`;
      XLSX.utils.book_append_sheet(wb, wsData as unknown as XLSX.WorkSheet, sheet.name || "Hoja1");
    }

    const safeName = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
    XLSX.writeFile(wb, safeName);
  },

  // Exportar a archivo nativo .xlsx (compatibilidad monohipótesis)
  exportToXLSX(sheet: Sheet, filename: string): void {
    this.exportWorkbookToXLSX([sheet], filename);
  },

  // Importar libro completo con todas sus hojas (multi-pestaña) desde .xlsx, .xls o binario
  importFullWorkbook(
    arrayBuffer: ArrayBuffer,
    filename: string
  ): { metadata: WorkbookMetadata; sheets: Sheet[]; activeSheetId: string } {
    const isBinary = filename.endsWith(".xlsx") || filename.endsWith(".xls");
    const wb = isBinary
      ? XLSX.read(arrayBuffer, {
          type: "array",
          cellDates: true,
          cellFormula: true,
          cellStyles: true,
        })
      : XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });

    const baseTitle = filename.replace(/\.[^/.]+$/, "");
    const metadata: WorkbookMetadata = {
      id: `cfs_${Date.now()}`,
      title: baseTitle || "Libro1",
      author: "Usuario CoffeWorks",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!wb.SheetNames || wb.SheetNames.length === 0) {
      return createDefaultWorkbook();
    }

    const sheets: Sheet[] = wb.SheetNames.map((sheetName, index) => {
      const ws = wb.Sheets[sheetName];
      const data: Record<string, CellData> = {};
      const colWidths: Record<string, number> = {};

      if (ws) {
        // Leer anchos de columnas personalizados si el archivo los especifica
        if (Array.isArray(ws["!cols"])) {
          ws["!cols"].forEach((col, idx) => {
            if (col && (col.wpx || col.wch)) {
              const colName = colIndexToName(idx);
              const width = col.wpx
                ? Math.round(col.wpx)
                : Math.min(350, Math.max(70, Math.round((col.wch || 10) * 8 + 15)));
              colWidths[colName] = width;
            }
          });
        }

        // Leer todas las celdas de la hoja
        for (const key of Object.keys(ws)) {
          if (key.startsWith("!")) continue;
          const cellObj = ws[key];
          if (!cellObj) continue;

          let raw = "";
          let computed: string | number | undefined = undefined;

          // Si contiene fórmula
          if (cellObj.f) {
            raw = `=${cellObj.f}`;
            if (cellObj.v !== undefined && cellObj.v !== null) {
              computed = cellObj.v;
            } else if (cellObj.w !== undefined) {
              computed = cellObj.w;
            }
          } else if (cellObj.w !== undefined && cellObj.w !== null && cellObj.w !== "") {
            raw = String(cellObj.w);
            computed = cellObj.v !== undefined ? cellObj.v : cellObj.w;
          } else if (cellObj.v !== undefined && cellObj.v !== null) {
            raw = String(cellObj.v);
            computed = cellObj.v;
          }

          const isNum =
            typeof computed === "number" ||
            (!isNaN(Number(raw)) && raw.trim() !== "" && !raw.startsWith("="));

          let format: "general" | "currency" | "percent" | "number" = "general";
          if (typeof cellObj.z === "string") {
            const zLower = cellObj.z.toLowerCase();
            if (
              zLower.includes("$") ||
              zLower.includes("cop") ||
              zLower.includes("€") ||
              zLower.includes("usd")
            ) {
              format = "currency";
            } else if (zLower.includes("%")) {
              format = "percent";
            }
          }

          data[key.toUpperCase()] = {
            raw,
            computed: computed !== undefined ? computed : raw,
            align: isNum ? "right" : "left",
            format,
          };
        }
      }

      return {
        id: `sheet_${Date.now()}_${index}`,
        name: sheetName,
        data,
        colWidths,
      };
    });

    return {
      metadata,
      sheets,
      activeSheetId: sheets[0]?.id || "sheet_1",
    };
  },

  // Importar desde archivo binario .xlsx, .xls o texto .csv (compatibilidad con hoja simple)
  importSpreadsheetFile(arrayBuffer: ArrayBuffer, filename: string): Record<string, CellData> {
    const wb = this.importFullWorkbook(arrayBuffer, filename);
    return wb.sheets[0]?.data || {};
  },

  // Importar contenido de CSV plano
  importFromCSV(csvText: string): Record<string, CellData> {
    const wb = XLSX.read(csvText, { type: "string" });
    const firstSheetName = wb.SheetNames[0];
    if (!firstSheetName) return {};
    const ws = wb.Sheets[firstSheetName];
    const data: Record<string, CellData> = {};

    for (const key of Object.keys(ws)) {
      if (key.startsWith("!")) continue;
      const cellObj = ws[key];
      if (!cellObj) continue;
      const val = cellObj.v;
      const raw = val !== undefined && val !== null ? String(val) : "";
      const isNum = typeof val === "number" || (!isNaN(Number(raw)) && raw.trim() !== "");

      data[key.toUpperCase()] = {
        raw,
        computed: val !== undefined ? val : raw,
        align: isNum ? "right" : "left",
      };
    }

    return data;
  },
};
