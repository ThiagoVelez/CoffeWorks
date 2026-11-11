// Diseñador de tablas: campos, tipos, clave principal, requeridos, únicos y
// valores predeterminados, sin escribir SQL.

import React, { useEffect, useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Key, Save, Info } from "lucide-react";
import type { ColumnDraft, FieldType, TableInfo } from "../types";
import { FIELD_TYPES } from "../types";
import { CoffeeDb } from "../services/engine";
import { explain } from "../services/doctor";
import { showMessage, toast } from "./Dialogs";

interface DesignerProps {
  db: CoffeeDb;
  table: TableInfo | null;
  onSaved: (name: string) => void;
}

let seq = 0;
const blank = (name = "", type: FieldType = "shortText"): ColumnDraft => ({
  key: `new_${seq++}`,
  original: null,
  name,
  type,
  pk: type === "autonumber",
  notNull: false,
  unique: false,
  defaultValue: "",
});

export const TableDesigner: React.FC<DesignerProps> = ({ db, table, onSaved }) => {
  const [name, setName] = useState(table?.name || "");
  const [columns, setColumns] = useState<ColumnDraft[]>(() => (table ? db.drafts(table) : [blank("id", "autonumber"), blank("nombre")]));
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    setName(table?.name || "");
    setColumns(table ? db.drafts(table) : [blank("id", "autonumber"), blank("nombre")]);
    setCurrent(0);
  }, [db, table]);

  const patch = (i: number, p: Partial<ColumnDraft>) =>
    setColumns((prev) =>
      prev.map((c, j) => {
        if (j !== i) return p.type === "autonumber" ? { ...c, type: c.type === "autonumber" ? "integer" : c.type, pk: false } : c;
        const next = { ...c, ...p };
        if (p.type === "autonumber") next.pk = true;
        if (p.pk === false && next.type === "autonumber") next.type = "integer";
        return next;
      })
    );

  const move = (i: number, d: number) =>
    setColumns((prev) => {
      const j = i + d;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      setCurrent(j);
      return next;
    });

  const save = () => {
    const tableName = name.trim();
    if (!tableName) {
      void showMessage("Falta el nombre", "Escribe un nombre para la tabla.");
      return;
    }
    const fields = columns.filter((c) => c.name.trim());
    if (!fields.length) {
      void showMessage("La tabla no tiene campos", "Añade al menos un campo.");
      return;
    }
    const seen = new Set<string>();
    for (const c of fields) {
      const key = c.name.trim().toLowerCase();
      if (seen.has(key)) {
        void showMessage("Nombre repetido", `Hay dos campos llamados «${c.name}».`);
        return;
      }
      seen.add(key);
    }
    const cleaned = fields.map((c) => ({ ...c, name: c.name.trim() }));
    try {
      if (!table) {
        if (db.schema().tables.some((t) => t.name.toLowerCase() === tableName.toLowerCase())) throw new Error(`table "${tableName}" already exists`);
        db.createTable(tableName, cleaned, []);
        toast(`Tabla «${tableName}» creada`);
      } else {
        let currentName = table.name;
        if (tableName !== table.name) {
          db.renameTable(table.name, tableName);
          currentName = tableName;
        }
        const fresh = db.tableInfo(currentName);
        db.rebuildTable(currentName, currentName, cleaned, fresh.foreignKeys);
        toast("Diseño guardado");
      }
      onSaved(tableName);
    } catch (err) {
      void showMessage("No se pudo guardar el diseño", explain(err));
    }
  };

  const selected = columns[current];
  const field = "w-full h-8 px-2 text-[12px] rounded-md border border-[#e2cfd1] outline-none focus:border-[#9b111e] bg-white";

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#fcf8f8]">
      <div className="h-12 shrink-0 px-4 flex items-center gap-3 border-b border-[#ead9db] bg-white">
        <label className="text-[12px] font-semibold text-[#5a3a3e]">Nombre de la tabla</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="por ejemplo: clientes" className={`${field} w-64`} data-table-name />
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => {
            setColumns((prev) => [...prev, blank()]);
            setCurrent(columns.length);
          }}
          className="h-8 px-3 rounded-lg text-[12px] flex items-center gap-1.5 border border-[#e2cfd1] hover:bg-[#fbeef0]"
        >
          <Plus size={13} /> Campo
        </button>
        <button type="button" onClick={save} data-save-design className="h-8 px-4 rounded-lg text-[12px] font-semibold text-white flex items-center gap-1.5" style={{ background: "#9b111e" }}>
          <Save size={13} /> {table ? "Guardar diseño" : "Crear tabla"}
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto p-4">
          <table className="w-full text-[12px] bg-white border border-[#ead9db] rounded-lg overflow-hidden" data-designer>
            <thead>
              <tr className="bg-[#f7eced] text-[#4a2a2e] text-left">
                <th className="px-2 py-2 w-8" />
                <th className="px-2 py-2">Campo</th>
                <th className="px-2 py-2 w-44">Tipo de dato</th>
                <th className="px-2 py-2 w-20 text-center">Requerido</th>
                <th className="px-2 py-2 w-16 text-center">Único</th>
                <th className="px-2 py-2 w-40">Valor predeterminado</th>
                <th className="px-2 py-2 w-24" />
              </tr>
            </thead>
            <tbody>
              {columns.map((c, i) => (
                <tr key={c.key} onClick={() => setCurrent(i)} className={`border-t border-[#f1e6e7] ${i === current ? "bg-[#fbeef0]" : ""}`}>
                  <td className="px-2 text-center">
                    <button
                      type="button"
                      title={c.pk ? "Quitar de la clave principal" : "Usar como clave principal"}
                      onClick={(e) => {
                        e.stopPropagation();
                        patch(i, { pk: !c.pk });
                      }}
                    >
                      <Key size={14} className={c.pk ? "text-[#c99a1e]" : "text-[#d6c4c6]"} />
                    </button>
                  </td>
                  <td className="px-2 py-1">
                    <input value={c.name} onChange={(e) => patch(i, { name: e.target.value })} placeholder="nombre_del_campo" className={field} data-field-name={i} />
                  </td>
                  <td className="px-2 py-1">
                    <select value={c.type} onChange={(e) => patch(i, { type: e.target.value as FieldType })} className={field} data-field-type={i}>
                      {FIELD_TYPES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 text-center">
                    <input type="checkbox" checked={c.notNull || c.pk} disabled={c.pk} onChange={(e) => patch(i, { notNull: e.target.checked })} className="accent-[#9b111e]" />
                  </td>
                  <td className="px-2 text-center">
                    <input type="checkbox" checked={c.unique || c.pk} disabled={c.pk} onChange={(e) => patch(i, { unique: e.target.checked })} className="accent-[#9b111e]" />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      value={c.defaultValue}
                      onChange={(e) => patch(i, { defaultValue: e.target.value })}
                      disabled={c.type === "autonumber"}
                      placeholder={c.type === "date" ? "CURRENT_DATE" : ""}
                      className={field}
                    />
                  </td>
                  <td className="px-2">
                    <div className="flex items-center gap-0.5 justify-end">
                      <button type="button" onClick={() => move(i, -1)} className="p-1 rounded hover:bg-[#f3e2e4]" title="Subir">
                        <ChevronUp size={13} />
                      </button>
                      <button type="button" onClick={() => move(i, 1)} className="p-1 rounded hover:bg-[#f3e2e4]" title="Bajar">
                        <ChevronDown size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setColumns((prev) => prev.filter((_, j) => j !== i));
                          setCurrent(Math.max(0, i - 1));
                        }}
                        className="p-1 rounded hover:bg-[#f3e2e4] text-[#9b111e]"
                        title="Eliminar campo"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {table && table.foreignKeys.length > 0 && (
            <div className="mt-4 text-[12px] text-[#5a3a3e]">
              <div className="font-semibold mb-1">Relaciones de esta tabla</div>
              {table.foreignKeys.map((f) => (
                <div key={f.column}>
                  {table.name}.{f.column} → {f.table}.{f.to} (al borrar: {f.onDelete})
                </div>
              ))}
              <div className="text-[11px] text-[#9a8285] mt-1">Se gestionan en la vista Relaciones.</div>
            </div>
          )}
        </div>

        {selected && (
          <aside className="w-72 shrink-0 border-l border-[#ead9db] bg-white p-4 text-[12px] text-[#4a2a2e]">
            <div className="flex items-center gap-2 font-semibold mb-2">
              <Info size={14} className="text-[#9b111e]" /> {selected.name || "Campo nuevo"}
            </div>
            <p className="text-[#6e5559] leading-relaxed">{FIELD_TYPES.find((t) => t.id === selected.type)?.hint}</p>
            <ul className="mt-3 space-y-1.5 text-[#6e5559] list-disc pl-4">
              <li>La llave marca la clave principal: identifica cada registro.</li>
              <li>«Requerido» no deja el campo vacío.</li>
              <li>«Único» impide valores repetidos (por ejemplo, correos).</li>
              <li>El valor predeterminado se usa cuando no se escribe nada. Para fechas: CURRENT_DATE o CURRENT_TIMESTAMP.</li>
            </ul>
            {table && (
              <p className="mt-3 text-[11px] text-[#9a8285]">
                Al guardar, los datos existentes se conservan en los campos que mantienes (aunque les cambies el nombre).
              </p>
            )}
          </aside>
        )}
      </div>
    </div>
  );
};
