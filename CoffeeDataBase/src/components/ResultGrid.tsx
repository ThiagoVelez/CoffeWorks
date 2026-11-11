// Tabla de resultados de solo lectura (consultas SQL y diseñador de consultas).

import React from "react";
import { formatCell } from "../services/engine";

export const ResultGrid: React.FC<{ columns: string[]; rows: unknown[][]; maxHeight?: string }> = ({ columns, rows, maxHeight }) => (
  <div className="overflow-auto border border-[#ead9db] rounded-lg bg-white" style={{ maxHeight }}>
    <table className="text-[12px] border-collapse min-w-full" data-result-grid>
      <thead className="sticky top-0 z-10">
        <tr>
          <th className="bg-[#f7eced] text-[#8a6268] font-mono text-[10px] px-2 py-1.5 border-b border-r border-[#ead9db] w-10">#</th>
          {columns.map((c, i) => (
            <th key={`${c}-${i}`} className="bg-[#f7eced] text-[#4a2a2e] text-left font-semibold px-2.5 py-1.5 border-b border-r border-[#ead9db] whitespace-nowrap">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r} className="hover:bg-[#fdf6f6]">
            <td className="text-[#a08a8d] font-mono text-[10px] px-2 py-1 border-b border-r border-[#f1e6e7] text-right">{r + 1}</td>
            {row.map((v, c) => (
              <td
                key={c}
                className={`px-2.5 py-1 border-b border-r border-[#f1e6e7] whitespace-nowrap max-w-[360px] truncate ${
                  v === null ? "text-[#c3b1b3] italic" : typeof v === "number" ? "text-right font-mono" : ""
                }`}
                title={v === null ? "NULL" : formatCell(v)}
              >
                {v === null ? "NULL" : formatCell(v)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    {rows.length === 0 && <div className="px-4 py-6 text-center text-[12px] text-[#9a8285]">Sin resultados</div>}
  </div>
);
