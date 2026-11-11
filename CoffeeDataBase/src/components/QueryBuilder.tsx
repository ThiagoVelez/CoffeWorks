// Diseñador de consultas: arma un SELECT eligiendo tablas, campos, criterios
// y orden, sin escribir SQL. Las tablas relacionadas se unen solas.

import React, { useMemo, useState } from "react";
import { Plus, Trash2, Play, Save, Code2 } from "lucide-react";
import type { QueryResult, Schema } from "../types";
import { CoffeeDb, quoteId, quoteValue } from "../services/engine";
import { diagnose } from "../services/doctor";
import { ResultGrid } from "./ResultGrid";

interface BuilderProps {
  db: CoffeeDb;
  schema: Schema;
  onSave: (sql: string) => void;
  onOpenSql: (sql: string) => void;
}

type Operator = "=" | "<>" | ">" | "<" | ">=" | "<=" | "contiene" | "empieza" | "vacío" | "no vacío";

interface Criterion {
  id: number;
  field: string; // tabla.campo
  op: Operator;
  value: string;
}

let cid = 0;

export const QueryBuilder: React.FC<BuilderProps> = ({ db, schema, onSave, onOpenSql }) => {
  const [base, setBase] = useState(schema.tables[0]?.name || "");
  const [joined, setJoined] = useState<string[]>([]);
  const [fields, setFields] = useState<string[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [sort, setSort] = useState<{ field: string; desc: boolean } | null>(null);
  const [limit, setLimit] = useState(100);
  const [groupCount, setGroupCount] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState("");

  const tableMap = useMemo(() => new Map(schema.tables.map((t) => [t.name, t])), [schema]);
  const used = [base, ...joined].filter((t) => tableMap.has(t));

  // Tablas que se pueden unir: relacionadas con alguna de las usadas
  const joinable = useMemo(() => {
    const list: { table: string; on: string }[] = [];
    for (const t of schema.tables) {
      if (used.includes(t.name)) continue;
      for (const u of used) {
        const ut = tableMap.get(u);
        const out = ut?.foreignKeys.find((f) => f.table === t.name);
        const inc = t.foreignKeys.find((f) => f.table === u);
        if (out) list.push({ table: t.name, on: `${quoteId(t.name)}.${quoteId(out.to)} = ${quoteId(u)}.${quoteId(out.column)}` });
        else if (inc) list.push({ table: t.name, on: `${quoteId(t.name)}.${quoteId(inc.column)} = ${quoteId(u)}.${quoteId(inc.to)}` });
        if (out || inc) break;
      }
    }
    return list;
  }, [schema, used, tableMap]);

  const [joins, setJoins] = useState<Record<string, string>>({});

  const allFields = used.flatMap((t) => (tableMap.get(t)?.columns || []).map((c) => `${t}.${c.name}`));
  const ref = (f: string) => {
    const [t, ...rest] = f.split(".");
    return `${quoteId(t)}.${quoteId(rest.join("."))}`;
  };

  const sql = useMemo(() => {
    if (!base) return "";
    const selected = fields.filter((f) => allFields.includes(f));
    const cols = selected.length ? selected.map((f) => (used.length > 1 ? `${ref(f)} AS ${quoteId(f.replace(".", "_"))}` : ref(f))) : ["*"];
    const select = groupCount && selected.length ? [...selected.map(ref), "COUNT(*) AS total"] : cols;
    const lines = [`SELECT ${select.join(", ")}`, `FROM ${quoteId(base)}`];
    for (const t of joined) if (joins[t]) lines.push(`LEFT JOIN ${quoteId(t)} ON ${joins[t]}`);
    const where = criteria
      .filter((c) => c.field && allFields.includes(c.field))
      .map((c) => {
        const r = ref(c.field);
        const v = c.value.trim();
        const literal = v !== "" && !Number.isNaN(Number(v)) ? v : quoteValue(v);
        switch (c.op) {
          case "contiene":
            return `${r} LIKE ${quoteValue(`%${v}%`)}`;
          case "empieza":
            return `${r} LIKE ${quoteValue(`${v}%`)}`;
          case "vacío":
            return `(${r} IS NULL OR ${r} = '')`;
          case "no vacío":
            return `(${r} IS NOT NULL AND ${r} <> '')`;
          default:
            return `${r} ${c.op} ${literal}`;
        }
      });
    if (where.length) lines.push(`WHERE ${where.join("\n  AND ")}`);
    if (groupCount && selected.length) lines.push(`GROUP BY ${selected.map(ref).join(", ")}`);
    if (sort && allFields.includes(sort.field)) lines.push(`ORDER BY ${ref(sort.field)}${sort.desc ? " DESC" : ""}`);
    else if (groupCount && selected.length) lines.push("ORDER BY total DESC");
    if (limit > 0) lines.push(`LIMIT ${limit}`);
    return `${lines.join("\n")};`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, joined, joins, fields, criteria, sort, limit, groupCount, schema]);

  const run = () => {
    try {
      setResult(db.query(sql, [], 5000));
      setError("");
    } catch (err) {
      const d = diagnose(err);
      setError(`${d.title}: ${d.explanation}`);
      setResult(null);
    }
  };

  if (!schema.tables.length) {
    return <div className="flex-1 flex items-center justify-center text-[13px] text-[#7a6265]">Crea una tabla para diseñar consultas.</div>;
  }

  const field = "h-8 px-2 text-[12px] rounded-md border border-[#e2cfd1] outline-none focus:border-[#9b111e] bg-white";

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#fcf8f8]">
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        <div className="grid grid-cols-[1fr_1.2fr] gap-4">
          <section className="bg-white rounded-xl border border-[#ead9db] p-4 flex flex-col gap-3">
            <div className="text-[12px] font-semibold text-[#5a3a3e]">1. Tablas</div>
            <label className="flex items-center gap-2 text-[12px]">
              Tabla principal
              <select
                className={field}
                value={base}
                onChange={(e) => {
                  setBase(e.target.value);
                  setJoined([]);
                  setJoins({});
                  setFields([]);
                  setCriteria([]);
                  setSort(null);
                }}
                data-builder-base
              >
                {schema.tables.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            {joined.map((t) => (
              <div key={t} className="flex items-center gap-2 text-[12px] bg-[#fbeef0] rounded-lg px-2 py-1.5">
                <span className="font-semibold">+ {t}</span>
                <span className="text-[10px] font-mono text-[#8a6268] truncate">{joins[t]}</span>
                <button
                  type="button"
                  className="ml-auto text-[#9b111e]"
                  onClick={() => {
                    setJoined((prev) => prev.filter((x) => x !== t));
                    setFields((prev) => prev.filter((f) => !f.startsWith(`${t}.`)));
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {joinable.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {joinable.map((j) => (
                  <button
                    key={j.table}
                    type="button"
                    className="h-7 px-2 rounded-md text-[11px] border border-dashed border-[#d9b6ba] hover:bg-[#fbeef0] flex items-center gap-1"
                    onClick={() => {
                      setJoined((prev) => [...prev, j.table]);
                      setJoins((prev) => ({ ...prev, [j.table]: j.on }));
                    }}
                  >
                    <Plus size={11} /> Unir {j.table}
                  </button>
                ))}
              </div>
            )}
            <div className="text-[12px] font-semibold text-[#5a3a3e] mt-1">2. Campos a mostrar</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 max-h-48 overflow-y-auto">
              {allFields.map((f) => (
                <label key={f} className="flex items-center gap-1.5 text-[12px] truncate">
                  <input
                    type="checkbox"
                    className="accent-[#9b111e]"
                    checked={fields.includes(f)}
                    onChange={(e) => setFields((prev) => (e.target.checked ? [...prev, f] : prev.filter((x) => x !== f)))}
                  />
                  <span className="truncate">{used.length > 1 ? f : f.split(".").slice(1).join(".")}</span>
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-[12px]">
              <input type="checkbox" className="accent-[#9b111e]" checked={groupCount} onChange={(e) => setGroupCount(e.target.checked)} />
              Agrupar por los campos elegidos y contar registros
            </label>
          </section>

          <section className="bg-white rounded-xl border border-[#ead9db] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-[#5a3a3e]">3. Criterios</span>
              <button
                type="button"
                className="h-7 px-2 rounded-md text-[11px] border border-[#e2cfd1] hover:bg-[#fbeef0] flex items-center gap-1"
                onClick={() => setCriteria((prev) => [...prev, { id: cid++, field: allFields[0] || "", op: "=", value: "" }])}
                data-add-criterion
              >
                <Plus size={11} /> Criterio
              </button>
            </div>
            {criteria.length === 0 && <p className="text-[11px] text-[#9a8285]">Sin criterios: se muestran todos los registros.</p>}
            {criteria.map((c) => (
              <div key={c.id} className="flex items-center gap-1.5">
                <select className={`${field} flex-1 min-w-0`} value={c.field} onChange={(e) => setCriteria((prev) => prev.map((x) => (x.id === c.id ? { ...x, field: e.target.value } : x)))}>
                  {allFields.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <select className={`${field} w-28`} value={c.op} onChange={(e) => setCriteria((prev) => prev.map((x) => (x.id === c.id ? { ...x, op: e.target.value as Operator } : x)))}>
                  {(["=", "<>", ">", "<", ">=", "<=", "contiene", "empieza", "vacío", "no vacío"] as Operator[]).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                {c.op !== "vacío" && c.op !== "no vacío" && (
                  <input className={`${field} w-32`} value={c.value} onChange={(e) => setCriteria((prev) => prev.map((x) => (x.id === c.id ? { ...x, value: e.target.value } : x)))} placeholder="valor" />
                )}
                <button type="button" className="text-[#9b111e] p-1" onClick={() => setCriteria((prev) => prev.filter((x) => x.id !== c.id))}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <div className="text-[12px] font-semibold text-[#5a3a3e] mt-1">4. Orden y límite</div>
            <div className="flex items-center gap-2">
              <select className={`${field} flex-1`} value={sort?.field || ""} onChange={(e) => setSort(e.target.value ? { field: e.target.value, desc: sort?.desc || false } : null)}>
                <option value="">Sin orden</option>
                {allFields.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <select className={`${field} w-32`} value={sort?.desc ? "desc" : "asc"} disabled={!sort} onChange={(e) => sort && setSort({ ...sort, desc: e.target.value === "desc" })}>
                <option value="asc">Ascendente</option>
                <option value="desc">Descendente</option>
              </select>
              <input type="number" min={0} className={`${field} w-20`} value={limit} onChange={(e) => setLimit(Number(e.target.value) || 0)} title="Límite (0 = sin límite)" />
            </div>
          </section>
        </div>

        <section className="bg-white rounded-xl border border-[#ead9db] p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-[#5a3a3e]">SQL generado</span>
            <div className="flex-1" />
            <button type="button" onClick={run} data-builder-run className="h-8 px-4 rounded-lg text-[12px] font-semibold text-white flex items-center gap-1.5" style={{ background: "#9b111e" }}>
              <Play size={13} className="fill-white" /> Ver resultados
            </button>
            <button type="button" onClick={() => onSave(sql)} className="h-8 px-3 rounded-lg text-[12px] flex items-center gap-1.5 border border-[#e2cfd1] hover:bg-[#fbeef0]">
              <Save size={13} /> Guardar consulta
            </button>
            <button type="button" onClick={() => onOpenSql(sql)} className="h-8 px-3 rounded-lg text-[12px] flex items-center gap-1.5 border border-[#e2cfd1] hover:bg-[#fbeef0]">
              <Code2 size={13} /> Abrir en la consola SQL
            </button>
          </div>
          <pre className="font-mono text-[12px] bg-[#fbf6f6] border border-[#f1e6e7] rounded-lg p-3 whitespace-pre-wrap" data-builder-sql>
            {sql}
          </pre>
          {error && <div className="text-[12px] text-[#9b111e]">{error}</div>}
          {result && <ResultGrid columns={result.columns} rows={result.rows} maxHeight="320px" />}
        </section>
      </div>
    </div>
  );
};
