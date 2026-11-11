// Inicio: resumen de la base de datos y accesos rápidos.

import React from "react";
import { Table2, Rows3, Link2, FileSearch, HardDrive, Plus, Upload, Sparkles, Code2, Share2 } from "lucide-react";
import type { Schema } from "../types";

interface HomeProps {
  schema: Schema;
  sizeBytes: number;
  onNewTable: () => void;
  onImport: () => void;
  onAssistant: () => void;
  onSql: () => void;
  onRelations: () => void;
  onOpenTable: (name: string) => void;
}

const fmtSize = (b: number) => (b > 1 << 20 ? `${(b / (1 << 20)).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export const HomeView: React.FC<HomeProps> = ({ schema, sizeBytes, onNewTable, onImport, onAssistant, onSql, onRelations, onOpenTable }) => {
  const rows = schema.tables.reduce((s, t) => s + t.rowCount, 0);
  const relations = schema.tables.reduce((s, t) => s + t.foreignKeys.length, 0);
  const stats = [
    { label: "Tablas", value: schema.tables.length, icon: Table2 },
    { label: "Registros", value: rows.toLocaleString("es"), icon: Rows3 },
    { label: "Relaciones", value: relations, icon: Link2 },
    { label: "Consultas", value: schema.queries.length + schema.views.length, icon: FileSearch },
    { label: "Tamaño", value: fmtSize(sizeBytes), icon: HardDrive },
  ];
  const actions = [
    { label: "Nueva tabla", hint: "Diseña los campos", icon: Plus, onClick: onNewTable },
    { label: "Importar datos", hint: "Excel, CSV, .accdb, .mdb", icon: Upload, onClick: onImport },
    { label: "Asistente", hint: "Plantillas y datos de prueba", icon: Sparkles, onClick: onAssistant },
    { label: "Consulta SQL", hint: "Escribe y ejecuta", icon: Code2, onClick: onSql },
    { label: "Relaciones", hint: "Diagrama de tablas", icon: Share2, onClick: onRelations },
  ];
  const maxRows = Math.max(1, ...schema.tables.map((t) => t.rowCount));

  return (
    <div className="flex-1 overflow-auto bg-[#fcf8f8] p-6">
      <div className="max-w-5xl mx-auto flex flex-col gap-5">
        <div className="grid grid-cols-5 gap-3" data-home-stats>
          {stats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white rounded-xl border border-[#ead9db] p-4">
              <div className="flex items-center gap-2 text-[12px] text-[#7a6265]">
                <Icon size={14} className="text-[#9b111e]" /> {label}
              </div>
              <div className="text-[22px] font-semibold text-[#3a1a1e] mt-1">{value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-5 gap-3">
          {actions.map(({ label, hint, icon: Icon, onClick }) => (
            <button key={label} type="button" onClick={onClick} className="bg-white rounded-xl border border-[#ead9db] hover:border-[#9b111e] p-4 text-left group">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[#9b111e] bg-[#fbe9eb] group-hover:bg-[#9b111e] group-hover:text-white transition-colors">
                <Icon size={17} />
              </div>
              <div className="text-[13px] font-semibold text-[#3a1a1e] mt-2">{label}</div>
              <div className="text-[11px] text-[#7a6265]">{hint}</div>
            </button>
          ))}
        </div>

        <section className="bg-white rounded-xl border border-[#ead9db]">
          <div className="px-5 py-3 border-b border-[#f1e6e7] text-[13px] font-semibold text-[#3a1a1e]">Tablas</div>
          {schema.tables.length === 0 && (
            <div className="px-5 py-8 text-center text-[13px] text-[#7a6265]">
              La base está vacía. Crea una tabla, importa un archivo o usa una plantilla del asistente.
            </div>
          )}
          {schema.tables.map((t) => (
            <button key={t.name} type="button" onClick={() => onOpenTable(t.name)} className="w-full px-5 py-2.5 flex items-center gap-3 border-b border-[#f6eeef] hover:bg-[#fdf6f6] text-left">
              <Table2 size={15} className="text-[#9b111e]" />
              <span className="text-[13px] font-semibold w-48 truncate">{t.name}</span>
              <span className="text-[11px] text-[#7a6265] w-28">{t.columns.length} campos</span>
              <div className="flex-1 h-2 rounded-full bg-[#f6eeef] overflow-hidden">
                <div className="h-full rounded-full bg-[#c0392b]" style={{ width: `${(t.rowCount / maxRows) * 100}%` }} />
              </div>
              <span className="text-[12px] font-mono w-20 text-right">{t.rowCount.toLocaleString("es")}</span>
            </button>
          ))}
        </section>
      </div>
    </div>
  );
};
