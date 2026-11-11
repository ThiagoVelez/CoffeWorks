// Asistente: plantillas listas para usar, datos de prueba y revisión del
// diseño con arreglos de un clic.

import React, { useMemo, useState } from "react";
import { Sparkles, LayoutTemplate, Wand2, Stethoscope, CheckCircle2, AlertTriangle, Info, XCircle } from "lucide-react";
import type { Schema } from "../types";
import { CoffeeDb } from "../services/engine";
import { TEMPLATES, applyTemplate, diagnoseSchema, generateMockData, type Finding } from "../services/assistant";
import { explain } from "../services/doctor";
import { showMessage, toast } from "./Dialogs";

interface AssistantProps {
  db: CoffeeDb;
  schema: Schema;
  version: number;
  onChanged: () => void;
  onRelationship: (fix: { child: string; column: string; parent: string }) => void;
}

const LEVEL_ICON = { error: XCircle, warning: AlertTriangle, info: Info };
const LEVEL_COLOR = { error: "#b71c1c", warning: "#b26a00", info: "#1d6fa5" };

export const AssistantView: React.FC<AssistantProps> = ({ db, schema, version, onChanged, onRelationship }) => {
  const [mockTable, setMockTable] = useState(schema.tables[0]?.name || "");
  const [mockCount, setMockCount] = useState(25);
  const findings: Finding[] = useMemo(() => {
    try {
      return diagnoseSchema(db, schema);
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, schema, version]);

  const useTemplate = (id: string) => {
    const template = TEMPLATES.find((t) => t.id === id);
    if (!template) return;
    try {
      applyTemplate(db, template);
      onChanged();
      toast(`Plantilla «${template.name}» creada`);
    } catch (err) {
      void showMessage("No se pudo crear la plantilla", explain(err));
    }
  };

  const generate = () => {
    const table = schema.tables.find((t) => t.name === mockTable) ? mockTable : schema.tables[0]?.name;
    if (!table) return;
    try {
      const n = generateMockData(db, table, mockCount);
      onChanged();
      toast(`${n} registros de prueba añadidos a «${table}»`);
    } catch (err) {
      void showMessage("No se pudieron generar datos", explain(err));
    }
  };

  const fix = (f: Finding) => {
    if (f.fix?.relationship) {
      onRelationship(f.fix.relationship);
      return;
    }
    if (f.fix?.sql) {
      try {
        db.run(f.fix.sql);
        onChanged();
        toast("Arreglado");
      } catch (err) {
        void showMessage("No se pudo aplicar", explain(err));
      }
    }
  };

  const card = "bg-white rounded-xl border border-[#ead9db] p-5";
  const title = "flex items-center gap-2 text-[14px] font-semibold text-[#3a1a1e] mb-1";

  return (
    <div className="flex-1 overflow-auto bg-[#fcf8f8] p-6">
      <div className="max-w-5xl mx-auto flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: "#9b111e" }}>
            <Sparkles size={20} />
          </div>
          <div>
            <h1 className="text-[18px] font-semibold text-[#3a1a1e]">Asistente</h1>
            <p className="text-[12px] text-[#7a6265]">Crea bases a partir de plantillas, llénalas de datos de prueba y revisa su diseño. Funciona sin conexión.</p>
          </div>
        </div>

        <section className={card}>
          <div className={title}>
            <LayoutTemplate size={16} className="text-[#9b111e]" /> Plantillas
          </div>
          <p className="text-[12px] text-[#7a6265] mb-3">Tablas, campos y relaciones ya diseñados. Se añaden a la base abierta.</p>
          <div className="grid grid-cols-2 gap-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                data-template={t.id}
                onClick={() => useTemplate(t.id)}
                className="text-left rounded-xl border border-[#ead9db] hover:border-[#9b111e] hover:bg-[#fdf6f6] p-4"
              >
                <div className="text-[13px] font-semibold text-[#3a1a1e]">{t.name}</div>
                <div className="text-[12px] text-[#7a6265] mt-0.5">{t.description}</div>
                <div className="text-[11px] text-[#9b111e] mt-2 font-mono">{t.tables.map((x) => x.name).join(" · ")}</div>
              </button>
            ))}
          </div>
        </section>

        <section className={card}>
          <div className={title}>
            <Wand2 size={16} className="text-[#9b111e]" /> Datos de prueba
          </div>
          <p className="text-[12px] text-[#7a6265] mb-3">
            Nombres, correos, ciudades, precios y fechas realistas. Respeta las relaciones: primero llena las tablas principales (por ejemplo, clientes antes que pedidos).
          </p>
          <div className="flex items-center gap-2">
            <select className="h-9 px-2 text-[13px] rounded-lg border border-[#e2cfd1] min-w-[200px]" value={mockTable} onChange={(e) => setMockTable(e.target.value)} data-mock-table>
              {schema.tables.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} ({t.rowCount})
                </option>
              ))}
            </select>
            <input type="number" min={1} max={10000} className="h-9 w-24 px-2 text-[13px] rounded-lg border border-[#e2cfd1]" value={mockCount} onChange={(e) => setMockCount(Number(e.target.value) || 1)} />
            <span className="text-[12px] text-[#7a6265]">registros</span>
            <button type="button" onClick={generate} disabled={!schema.tables.length} data-mock-generate className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white disabled:opacity-40" style={{ background: "#9b111e" }}>
              Generar
            </button>
          </div>
        </section>

        <section className={card}>
          <div className={title}>
            <Stethoscope size={16} className="text-[#9b111e]" /> Revisión del diseño
          </div>
          {findings.length === 0 ? (
            <div className="flex items-center gap-2 text-[13px] text-[#2e7d32]" data-findings="0">
              <CheckCircle2 size={16} /> Todo en orden: no hay problemas en el diseño.
            </div>
          ) : (
            <div className="flex flex-col gap-2" data-findings={findings.length}>
              {findings.map((f) => {
                const Icon = LEVEL_ICON[f.level];
                return (
                  <div key={f.id} className="flex items-start gap-3 rounded-lg border border-[#f1e6e7] p-3" data-finding={f.id}>
                    <Icon size={16} style={{ color: LEVEL_COLOR[f.level] }} className="shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-[#3a1a1e]">{f.title}</div>
                      <div className="text-[12px] text-[#7a6265]">{f.detail}</div>
                    </div>
                    {f.fix && (
                      <button type="button" onClick={() => fix(f)} className="h-8 px-3 rounded-lg text-[12px] font-semibold border border-[#e2cfd1] hover:bg-[#fbeef0] shrink-0">
                        {f.fix.label}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
