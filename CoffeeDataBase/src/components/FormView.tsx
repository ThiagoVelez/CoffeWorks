// Formulario: muestra un registro cada vez, con navegación, alta, edición y
// borrado. Los campos relacionados se eligen de una lista.

import React, { useEffect, useMemo, useState } from "react";
import { ChevronFirst, ChevronLeft, ChevronRight, ChevronLast, Plus, Save, Trash2 } from "lucide-react";
import type { TableInfo } from "../types";
import { fieldLabel } from "../types";
import { CoffeeDb, coerce, formatCell, quoteId } from "../services/engine";
import { explain } from "../services/doctor";
import { askConfirm, showMessage, toast } from "./Dialogs";

interface FormViewProps {
  db: CoffeeDb;
  table: TableInfo;
  version: number;
  onChanged: () => void;
}

export const FormView: React.FC<FormViewProps> = ({ db, table, version, onChanged }) => {
  const [index, setIndex] = useState(0);
  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  const rowids = useMemo(() => db.values<number>(`SELECT rowid FROM ${quoteId(table.name)} ORDER BY rowid`).map((r) => Number(r[0])), [db, table, version]);
  const total = rowids.length;
  const rowid = rowids[Math.min(index, total - 1)];

  const lookups = useMemo(() => {
    const map = new Map<string, { value: unknown; label: string }[]>();
    for (const fk of table.foreignKeys) {
      try {
        const parent = db.tableInfo(fk.table);
        const label = parent.columns.find((c) => c.name !== fk.to && (c.type === "shortText" || c.type === "longText"));
        map.set(
          fk.column,
          db
            .values(`SELECT ${quoteId(fk.to || "rowid")}${label ? `, ${quoteId(label.name)}` : ""} FROM ${quoteId(fk.table)} LIMIT 1000`)
            .map((r) => ({ value: r[0], label: label ? `${r[0]} · ${r[1] ?? ""}` : String(r[0]) }))
        );
      } catch {
        // Tabla relacionada inexistente
      }
    }
    return map;
  }, [db, table, version]);

  useEffect(() => {
    if (creating) return;
    if (rowid === undefined) {
      setValues({});
      return;
    }
    const row = db.values(`SELECT ${table.columns.map((c) => quoteId(c.name)).join(", ")} FROM ${quoteId(table.name)} WHERE rowid = ?`, [rowid])[0] || [];
    setValues(Object.fromEntries(table.columns.map((c, i) => [c.name, row[i] === null || row[i] === undefined ? "" : row[i] instanceof Uint8Array ? "" : String(row[i])])));
    setDirty(false);
  }, [db, table, rowid, creating, version]);

  useEffect(() => {
    setIndex(0);
    setCreating(false);
  }, [table.name]);

  const save = () => {
    try {
      const data: Record<string, string | number | null> = {};
      for (const c of table.columns) {
        if (c.autoIncrement || c.type === "binary") continue;
        data[c.name] = coerce(values[c.name] ?? "", c.type) as string | number | null;
      }
      if (creating) {
        const cleaned = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== null));
        db.insertRow(table.name, cleaned);
        setCreating(false);
        setIndex(total);
        toast("Registro creado");
      } else if (rowid !== undefined) {
        db.transaction(() => {
          for (const [col, v] of Object.entries(data)) db.updateCell(table.name, rowid, col, v);
        });
        toast("Registro guardado");
      }
      setDirty(false);
      onChanged();
    } catch (err) {
      void showMessage("No se pudo guardar", explain(err));
    }
  };

  const remove = async () => {
    if (rowid === undefined) return;
    const ok = await askConfirm({ title: "Eliminar registro", message: "¿Eliminar este registro? No se puede deshacer.", confirmLabel: "Eliminar", danger: true });
    if (!ok) return;
    try {
      db.deleteRows(table.name, [rowid]);
      setIndex(Math.max(0, index - 1));
      onChanged();
    } catch (err) {
      void showMessage("No se pudo eliminar", explain(err));
    }
  };

  const go = (i: number) => {
    setCreating(false);
    setIndex(Math.max(0, Math.min(total - 1, i)));
  };

  const field = "w-full h-9 px-3 text-[13px] rounded-lg border border-[#e2cfd1] outline-none focus:border-[#9b111e] bg-white disabled:bg-[#f7f1f1] disabled:text-[#9a8285]";
  const nav = "h-8 w-8 rounded-lg flex items-center justify-center border border-[#e2cfd1] hover:bg-[#fbeef0] disabled:opacity-30";

  return (
    <div className="flex-1 overflow-auto bg-[#fcf8f8] p-6">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-[#ead9db] shadow-sm">
        <div className="px-6 py-4 border-b border-[#f1e6e7] flex items-center justify-between rounded-t-2xl" style={{ background: "linear-gradient(90deg,#9b111e,#c0392b)" }}>
          <div className="text-white">
            <div className="text-[16px] font-semibold">{table.name}</div>
            <div className="text-[11px] opacity-80">{creating ? "Registro nuevo" : total ? `Registro ${Math.min(index, total - 1) + 1} de ${total}` : "Sin registros"}</div>
          </div>
          {dirty && <span className="text-[11px] text-white/90">Cambios sin guardar</span>}
        </div>
        <div className="px-6 py-5 grid grid-cols-[180px_1fr] gap-x-4 gap-y-3 items-center" data-form>
          {table.columns.map((c) => {
            const options = lookups.get(c.name);
            const value = values[c.name] ?? "";
            const set = (v: string) => {
              setValues((prev) => ({ ...prev, [c.name]: v }));
              setDirty(true);
            };
            return (
              <React.Fragment key={c.name}>
                <label className="text-[12px] font-semibold text-[#5a3a3e]">
                  {c.name}
                  <span className="block text-[10px] font-normal text-[#a08a8d]">
                    {fieldLabel(c.type)}
                    {c.notNull && !c.pk ? " · requerido" : ""}
                  </span>
                </label>
                {c.type === "boolean" ? (
                  <input type="checkbox" checked={value === "1"} onChange={(e) => set(e.target.checked ? "1" : "0")} className="w-5 h-5 accent-[#9b111e]" />
                ) : options ? (
                  <select className={field} value={value} onChange={(e) => set(e.target.value)}>
                    <option value="">(vacío)</option>
                    {options.map((o) => (
                      <option key={String(o.value)} value={String(o.value)}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : c.type === "longText" ? (
                  <textarea className={`${field} h-20 py-2 resize-y`} value={value} onChange={(e) => set(e.target.value)} />
                ) : (
                  <input
                    className={field}
                    value={c.autoIncrement && creating ? "(automático)" : c.type === "binary" ? formatCell(new Uint8Array()) : value}
                    disabled={c.autoIncrement || c.type === "binary"}
                    type={c.type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value || "2000-01-01") ? "date" : "text"}
                    onChange={(e) => set(e.target.value)}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
        <div className="px-6 py-3 border-t border-[#f1e6e7] flex items-center gap-1.5">
          <button type="button" className={nav} disabled={creating || index <= 0} onClick={() => go(0)} title="Primero">
            <ChevronFirst size={15} />
          </button>
          <button type="button" className={nav} disabled={creating || index <= 0} onClick={() => go(index - 1)} title="Anterior">
            <ChevronLeft size={15} />
          </button>
          <button type="button" className={nav} disabled={creating || index >= total - 1} onClick={() => go(index + 1)} title="Siguiente">
            <ChevronRight size={15} />
          </button>
          <button type="button" className={nav} disabled={creating || index >= total - 1} onClick={() => go(total - 1)} title="Último">
            <ChevronLast size={15} />
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setValues(Object.fromEntries(table.columns.map((c) => [c.name, c.defaultValue && !/^CURRENT_/i.test(c.defaultValue) ? c.defaultValue.replace(/^'(.*)'$/, "$1") : ""])));
              setDirty(true);
            }}
            className="h-8 px-3 rounded-lg text-[12px] flex items-center gap-1.5 border border-[#e2cfd1] hover:bg-[#fbeef0]"
          >
            <Plus size={13} /> Nuevo
          </button>
          <button type="button" onClick={() => void remove()} disabled={creating || rowid === undefined} className="h-8 px-3 rounded-lg text-[12px] flex items-center gap-1.5 border border-[#e2cfd1] hover:bg-[#fbeef0] disabled:opacity-40">
            <Trash2 size={13} /> Eliminar
          </button>
          <button type="button" onClick={save} disabled={!dirty} data-form-save className="h-8 px-4 rounded-lg text-[12px] font-semibold text-white flex items-center gap-1.5 disabled:opacity-50" style={{ background: "#9b111e" }}>
            <Save size={13} /> Guardar
          </button>
        </div>
      </div>
    </div>
  );
};
