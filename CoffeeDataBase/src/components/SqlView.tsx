// Consola SQL: editor con colores, ejecución (Ctrl+Intro), resultados,
// historial, consultas guardadas y explicación de errores.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Play, Save, History, Download, Printer, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { QueryResult, Schema } from "../types";
import { CoffeeDb } from "../services/engine";
import { diagnose, type Diagnosis } from "../services/doctor";
import { ResultGrid } from "./ResultGrid";

interface SqlViewProps {
  db: CoffeeDb;
  schema: Schema;
  initialSql: string;
  queryName: string | null;
  onExecuted: (changedData: boolean) => void;
  onSave: (sql: string, name: string | null) => void;
  onExport: (columns: string[], rows: unknown[][], kind: "csv" | "xlsx" | "print", title: string) => void;
}

const KEYWORDS =
  "SELECT FROM WHERE AND OR NOT INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE VIEW INDEX DROP ALTER ADD COLUMN JOIN LEFT RIGHT INNER OUTER ON AS GROUP BY ORDER HAVING LIMIT OFFSET DISTINCT UNION ALL CASE WHEN THEN ELSE END IS NULL LIKE IN BETWEEN EXISTS PRIMARY KEY FOREIGN REFERENCES DEFAULT UNIQUE ASC DESC COUNT SUM AVG MIN MAX WITH PRAGMA BEGIN COMMIT ROLLBACK REPLACE".split(
    " "
  );
const KW = new RegExp(`\\b(${KEYWORDS.join("|")})\\b`, "gi");

function highlight(sql: string): string {
  const esc = sql.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // Cadenas y comentarios primero; el resto, palabras clave y números
  return (
    esc
      .split(/('(?:[^']|'')*'?|--[^\n]*)/g)
      .map((part, i) => {
        if (i % 2 === 1) return part.startsWith("--") ? `<span class="text-[#8a9a8f] italic">${part}</span>` : `<span class="text-[#b5651d]">${part}</span>`;
        return part.replace(KW, '<span class="text-[#9b111e] font-semibold">$1</span>').replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="text-[#1d6fa5]">$1</span>');
      })
      .join("") + "\n"
  );
}

const HISTORY_KEY = "coffeedatabase_sql_history";

export const SqlView: React.FC<SqlViewProps> = ({ db, schema, initialSql, queryName, onExecuted, onSave, onExport }) => {
  const [sql, setSql] = useState(initialSql);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<Diagnosis | null>(null);
  const [history, setHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [showHistory, setShowHistory] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setSql(initialSql);
    setResult(null);
    setError(null);
  }, [initialSql, queryName]);

  const html = useMemo(() => highlight(sql), [sql]);

  const run = () => {
    const area = areaRef.current;
    // Si hay texto seleccionado se ejecuta solo esa parte
    const text = area && area.selectionEnd > area.selectionStart ? sql.slice(area.selectionStart, area.selectionEnd) : sql;
    if (!text.trim()) return;
    try {
      const r = db.query(text, [], 5000);
      setResult(r);
      setError(null);
      const next = [text.trim(), ...history.filter((h) => h !== text.trim())].slice(0, 30);
      setHistory(next);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        // Sin espacio
      }
      onExecuted(!r.isSelect || /\b(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|REPLACE)\b/i.test(text));
    } catch (err) {
      setError(diagnose(err));
      setResult(null);
    }
  };

  const tables = schema.tables.map((t) => t.name);
  const examples = tables.length
    ? [
        `SELECT * FROM "${tables[0]}" LIMIT 100;`,
        `SELECT COUNT(*) AS total FROM "${tables[0]}";`,
        ...(schema.tables.find((t) => t.foreignKeys.length)
          ? (() => {
              const t = schema.tables.find((x) => x.foreignKeys.length)!;
              const f = t.foreignKeys[0];
              return [`SELECT *\nFROM "${t.name}" AS a\nJOIN "${f.table}" AS b ON b."${f.to}" = a."${f.column}"\nLIMIT 100;`];
            })()
          : []),
      ]
    : ["CREATE TABLE ejemplo (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL);"];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#fcf8f8]">
      <div className="h-11 shrink-0 px-3 flex items-center gap-2 border-b border-[#ead9db] bg-white">
        <button type="button" onClick={run} data-run-sql className="h-8 px-4 rounded-lg text-[12px] font-semibold text-white flex items-center gap-1.5" style={{ background: "#9b111e" }}>
          <Play size={13} className="fill-white" /> Ejecutar
        </button>
        <span className="text-[11px] text-[#9a8285]">Ctrl+Intro · con texto seleccionado se ejecuta solo esa parte</span>
        <div className="flex-1" />
        <button type="button" onClick={() => setShowHistory((v) => !v)} className="h-8 px-3 rounded-lg text-[12px] flex items-center gap-1.5 border border-[#e2cfd1] hover:bg-[#fbeef0]">
          <History size={13} /> Historial
        </button>
        <button type="button" onClick={() => onSave(sql, queryName)} className="h-8 px-3 rounded-lg text-[12px] flex items-center gap-1.5 border border-[#e2cfd1] hover:bg-[#fbeef0]">
          <Save size={13} /> {queryName ? `Guardar «${queryName}»` : "Guardar consulta"}
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden p-3 gap-3 min-w-0">
          <div className="relative h-48 shrink-0 rounded-lg border border-[#e2cfd1] bg-white overflow-hidden focus-within:border-[#9b111e]">
            <pre
              ref={preRef}
              aria-hidden
              className="absolute inset-0 m-0 p-3 font-mono text-[13px] leading-[1.5] whitespace-pre-wrap break-words overflow-hidden pointer-events-none text-[#2a1a1c]"
              dangerouslySetInnerHTML={{ __html: html }}
            />
            <textarea
              ref={areaRef}
              data-sql-editor
              value={sql}
              spellCheck={false}
              onChange={(e) => setSql(e.target.value)}
              onScroll={(e) => {
                if (preRef.current) preRef.current.scrollTop = e.currentTarget.scrollTop;
              }}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  run();
                }
                if (e.key === "Tab") {
                  e.preventDefault();
                  const el = e.currentTarget;
                  const start = el.selectionStart;
                  setSql(sql.slice(0, start) + "  " + sql.slice(el.selectionEnd));
                  window.setTimeout(() => el.setSelectionRange(start + 2, start + 2), 0);
                }
              }}
              placeholder="Escribe una consulta SQL, por ejemplo: SELECT * FROM clientes;"
              className="absolute inset-0 w-full h-full p-3 font-mono text-[13px] leading-[1.5] whitespace-pre-wrap break-words resize-none outline-none bg-transparent text-transparent caret-[#2a1a1c] select-text"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-[#f2c4c9] bg-[#fdecee] p-3 text-[12px] text-[#5a1018]" data-sql-error>
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={14} /> {error.title}
              </div>
              <p className="mt-1">{error.explanation}</p>
              <p className="mt-1 text-[#7a3a42]">{error.tip}</p>
              <p className="mt-1.5 font-mono text-[10px] text-[#a06a70]">{error.original}</p>
            </div>
          )}

          {result && (
            <div className="flex-1 flex flex-col gap-2 overflow-hidden min-h-0">
              <div className="flex items-center gap-2 text-[12px] text-[#5a3a3e]" data-sql-status>
                <CheckCircle2 size={14} className="text-[#2e7d32]" />
                {result.isSelect
                  ? `${result.rows.length.toLocaleString("es")} filas${result.truncated ? " (se muestran las primeras 5000)" : ""}`
                  : `${result.changes.toLocaleString("es")} filas afectadas`}
                <span className="text-[#a08a8d]">· {result.elapsedMs.toFixed(1)} ms</span>
                {result.isSelect && (
                  <span className="ml-auto flex gap-1.5">
                    <button type="button" className="h-7 px-2 rounded border border-[#e2cfd1] hover:bg-[#fbeef0] flex items-center gap-1" onClick={() => onExport(result.columns, result.rows, "xlsx", queryName || "Consulta")}>
                      <Download size={12} /> Excel
                    </button>
                    <button type="button" className="h-7 px-2 rounded border border-[#e2cfd1] hover:bg-[#fbeef0] flex items-center gap-1" onClick={() => onExport(result.columns, result.rows, "csv", queryName || "Consulta")}>
                      <Download size={12} /> CSV
                    </button>
                    <button type="button" className="h-7 px-2 rounded border border-[#e2cfd1] hover:bg-[#fbeef0] flex items-center gap-1" onClick={() => onExport(result.columns, result.rows, "print", queryName || "Consulta")}>
                      <Printer size={12} /> Informe
                    </button>
                  </span>
                )}
              </div>
              {result.isSelect && <ResultGrid columns={result.columns} rows={result.rows} maxHeight="100%" />}
            </div>
          )}

          {!result && !error && (
            <div className="text-[12px] text-[#7a6265]">
              <div className="font-semibold mb-1.5">Ejemplos</div>
              <div className="flex flex-col gap-1.5">
                {examples.map((ex) => (
                  <button key={ex} type="button" onClick={() => setSql(ex)} className="text-left font-mono text-[11px] bg-white border border-[#ead9db] rounded-lg px-3 py-2 hover:border-[#9b111e] whitespace-pre-wrap">
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {showHistory && (
          <aside className="w-72 shrink-0 border-l border-[#ead9db] bg-white overflow-y-auto">
            <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#9b111e] border-b border-[#f1e6e7]">Historial</div>
            {history.length === 0 && <p className="p-3 text-[12px] text-[#9a8285]">Las consultas que ejecutes aparecerán aquí.</p>}
            {history.map((h, i) => (
              <button key={i} type="button" onClick={() => setSql(h)} className="w-full text-left px-3 py-2 border-b border-[#f6eeef] font-mono text-[11px] hover:bg-[#fbeef0] line-clamp-3 whitespace-pre-wrap">
                {h}
              </button>
            ))}
          </aside>
        )}
      </div>
    </div>
  );
};
