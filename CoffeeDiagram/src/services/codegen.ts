// Generación de código a partir de los diagramas e importación de SQL.

import type { DEdge, DNode, Diagram, Member } from "../types";
import { addNodes, makeEdge, makeNode, member } from "./model";

export type CodeLanguage = "java" | "csharp" | "typescript" | "python" | "sql" | "mermaid" | "plantuml";

export const LANGUAGES: { id: CodeLanguage; label: string; ext: string; kinds: string[] }[] = [
  { id: "java", label: "Java", ext: "java", kinds: ["class"] },
  { id: "csharp", label: "C#", ext: "cs", kinds: ["class"] },
  { id: "typescript", label: "TypeScript", ext: "ts", kinds: ["class"] },
  { id: "python", label: "Python", ext: "py", kinds: ["class"] },
  { id: "sql", label: "SQL (CREATE TABLE)", ext: "sql", kinds: ["er", "class"] },
  { id: "mermaid", label: "Mermaid", ext: "mmd", kinds: ["class", "er", "sequence", "flowchart", "activity", "state", "usecase", "mindmap"] },
  { id: "plantuml", label: "PlantUML", ext: "puml", kinds: ["class", "usecase", "sequence", "activity", "state", "component", "deployment", "er", "object", "package"] },
];

const ident = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/^(\d)/, "_$1") || "Elemento";

const VIS_JAVA: Record<string, string> = { "+": "public", "-": "private", "#": "protected", "~": "" };

const classes = (d: Diagram) => Object.values(d.nodes).filter((n) => n.type === "class" || n.type === "interface" || n.type === "enum");
const out = (d: Diagram, id: string, kinds: string[]) => Object.values(d.edges).filter((e) => e.source === id && kinds.includes(e.kind));

/** Relaciones de una clase: padre, interfaces y campos por asociación. */
function relations(d: Diagram, n: DNode) {
  const parent = out(d, n.id, ["generalization"]).map((e) => d.nodes[e.target]).find((t) => t && t.type !== "interface");
  const interfaces = [...out(d, n.id, ["realization"]), ...out(d, n.id, ["generalization"]).filter((e) => d.nodes[e.target]?.type === "interface")].map((e) => d.nodes[e.target]).filter(Boolean);
  const fields: { name: string; type: string; many: boolean }[] = [];
  for (const e of Object.values(d.edges)) {
    if (!["association", "directed", "aggregation", "composition"].includes(e.kind)) continue;
    // El extremo «otro» de la asociación se convierte en un campo
    let other: DNode | undefined;
    let mult = "";
    let role = "";
    if (e.source === n.id) {
      other = d.nodes[e.target];
      mult = e.targetLabel;
      role = "";
    } else if (e.target === n.id && e.kind !== "directed") {
      other = d.nodes[e.source];
      mult = e.sourceLabel;
    } else continue;
    if (!other || other.id === n.id) continue;
    const many = /\*|\.\.n|\.\.[2-9]/i.test(mult);
    const base = ident(other.name);
    fields.push({ name: role || base.charAt(0).toLowerCase() + base.slice(1) + (many ? "s" : ""), type: base, many });
  }
  return { parent, interfaces, fields };
}

const mapType = (t: string, lang: CodeLanguage): string => {
  const k = t.trim();
  if (!k) return lang === "python" ? "object" : lang === "typescript" ? "unknown" : "Object";
  const lower = k.toLowerCase();
  const table: Record<string, Partial<Record<CodeLanguage, string>>> = {
    string: { java: "String", csharp: "string", typescript: "string", python: "str" },
    int: { java: "int", csharp: "int", typescript: "number", python: "int" },
    integer: { java: "int", csharp: "int", typescript: "number", python: "int" },
    long: { java: "long", csharp: "long", typescript: "number", python: "int" },
    double: { java: "double", csharp: "double", typescript: "number", python: "float" },
    float: { java: "float", csharp: "float", typescript: "number", python: "float" },
    decimal: { java: "BigDecimal", csharp: "decimal", typescript: "number", python: "Decimal" },
    boolean: { java: "boolean", csharp: "bool", typescript: "boolean", python: "bool" },
    bool: { java: "boolean", csharp: "bool", typescript: "boolean", python: "bool" },
    date: { java: "LocalDate", csharp: "DateTime", typescript: "Date", python: "date" },
    datetime: { java: "LocalDateTime", csharp: "DateTime", typescript: "Date", python: "datetime" },
    void: { java: "void", csharp: "void", typescript: "void", python: "None" },
  };
  return table[lower]?.[lang] ?? k;
};

function params(p: string, lang: CodeLanguage): string {
  return p
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const [name, type = ""] = x.split(":").map((s) => s.trim());
      if (lang === "java" || lang === "csharp") return `${mapType(type, lang)} ${ident(name)}`;
      if (lang === "typescript") return `${ident(name)}: ${mapType(type, lang)}`;
      return type ? `${ident(name)}: ${mapType(type, lang)}` : ident(name);
    })
    .join(", ");
}

const defaultReturn = (t: string, lang: CodeLanguage) => {
  const k = mapType(t, lang);
  if (!t || k === "void" || k === "None") return "";
  if (lang === "python") return "        raise NotImplementedError\n";
  const value = /^(int|long|double|float|number|decimal)$/i.test(k) ? "0" : /^(boolean|bool)$/i.test(k) ? "false" : lang === "csharp" ? "default" : "null";
  return value;
};

function genJavaLike(d: Diagram, lang: "java" | "csharp"): string {
  const files: string[] = [];
  for (const n of classes(d)) {
    const name = ident(n.name);
    const { parent, interfaces, fields } = relations(d, n);
    const lines: string[] = [];
    if (n.type === "enum") {
      lines.push(`public enum ${name} {`, `    ${n.literals.map(ident).join(", ")}${lang === "java" ? ";" : ""}`, "}");
      files.push(lines.join("\n"));
      continue;
    }
    const kw = n.type === "interface" ? "interface" : `${n.isAbstract ? "abstract " : ""}class`;
    let head = `public ${kw} ${name}`;
    if (lang === "java") {
      if (parent && n.type !== "interface") head += ` extends ${ident(parent.name)}`;
      if (interfaces.length) head += `${n.type === "interface" ? " extends " : " implements "}${interfaces.map((i) => ident(i.name)).join(", ")}`;
    } else {
      const bases = [...(parent ? [parent] : []), ...interfaces].map((i) => ident(i.name));
      if (bases.length) head += ` : ${bases.join(", ")}`;
    }
    lines.push(`${head} {`);
    for (const a of n.attributes) {
      const vis = lang === "java" ? VIS_JAVA[a.visibility] : a.visibility === "+" ? "public" : a.visibility === "#" ? "protected" : a.visibility === "~" ? "internal" : "private";
      lines.push(`    ${vis ? `${vis} ` : ""}${a.isStatic ? "static " : ""}${mapType(a.type, lang)} ${ident(a.name)}${a.value ? ` = ${a.value}` : ""};`);
    }
    for (const f of fields) {
      const t = f.many ? (lang === "java" ? `List<${f.type}>` : `List<${f.type}>`) : f.type;
      lines.push(`    private ${t} ${f.name}${f.many ? ` = new ${lang === "java" ? "ArrayList<>" : `List<${f.type}>`}()` : ""};`);
    }
    if ((n.attributes.length || fields.length) && n.operations.length) lines.push("");
    for (const o of n.operations) {
      const vis = lang === "java" ? VIS_JAVA[o.visibility] : o.visibility === "+" ? "public" : o.visibility === "#" ? "protected" : o.visibility === "~" ? "internal" : "private";
      const ret = mapType(o.type || "void", lang);
      const sig = `${n.type === "interface" ? "" : `${vis ? `${vis} ` : ""}`}${o.isStatic ? "static " : ""}${o.isAbstract && n.type !== "interface" ? "abstract " : ""}${ret} ${lang === "csharp" ? ident(o.name).charAt(0).toUpperCase() + ident(o.name).slice(1) : ident(o.name)}(${params(o.params, lang)})`;
      if (n.type === "interface" || o.isAbstract) lines.push(`    ${sig};`);
      else {
        const r = defaultReturn(o.type, lang);
        lines.push(`    ${sig} {`, `        // TODO: implementar`, ...(r ? [`        return ${r};`] : []), "    }");
      }
    }
    lines.push("}");
    files.push(lines.join("\n"));
  }
  const header = lang === "java" ? "import java.util.*;\nimport java.math.BigDecimal;\nimport java.time.*;\n\n" : "using System;\nusing System.Collections.Generic;\n\n";
  return header + files.join("\n\n") + "\n";
}

function genTypeScript(d: Diagram): string {
  const files: string[] = [];
  for (const n of classes(d)) {
    const name = ident(n.name);
    const { parent, interfaces, fields } = relations(d, n);
    if (n.type === "enum") {
      files.push(`export enum ${name} {\n${n.literals.map((l) => `  ${ident(l)} = "${l}",`).join("\n")}\n}`);
      continue;
    }
    const lines: string[] = [];
    if (n.type === "interface") {
      lines.push(`export interface ${name}${interfaces.length ? ` extends ${interfaces.map((i) => ident(i.name)).join(", ")}` : ""} {`);
      for (const a of n.attributes) lines.push(`  ${ident(a.name)}: ${mapType(a.type, "typescript")};`);
      for (const o of n.operations) lines.push(`  ${ident(o.name)}(${params(o.params, "typescript")}): ${mapType(o.type || "void", "typescript")};`);
      lines.push("}");
      files.push(lines.join("\n"));
      continue;
    }
    let head = `export ${n.isAbstract ? "abstract " : ""}class ${name}`;
    if (parent) head += ` extends ${ident(parent.name)}`;
    if (interfaces.length) head += ` implements ${interfaces.map((i) => ident(i.name)).join(", ")}`;
    lines.push(`${head} {`);
    const vis = (v: string) => (v === "-" ? "private " : v === "#" ? "protected " : "");
    for (const a of n.attributes) lines.push(`  ${vis(a.visibility)}${a.isStatic ? "static " : ""}${ident(a.name)}${a.value ? "" : "!"}: ${mapType(a.type, "typescript")}${a.value ? ` = ${a.value}` : ""};`);
    for (const f of fields) lines.push(`  private ${f.name}: ${f.many ? `${f.type}[] = []` : `${f.type} | null = null`};`);
    for (const o of n.operations) {
      const sig = `  ${vis(o.visibility)}${o.isStatic ? "static " : ""}${o.isAbstract ? "abstract " : ""}${ident(o.name)}(${params(o.params, "typescript")}): ${mapType(o.type || "void", "typescript")}`;
      if (o.isAbstract) lines.push(`${sig};`);
      else {
        const r = defaultReturn(o.type, "typescript");
        lines.push(`${sig} {`, `    // TODO: implementar`, ...(r ? [`    return ${r === "null" ? `null as unknown as ${mapType(o.type, "typescript")}` : r};`] : []), "  }");
      }
    }
    lines.push("}");
    files.push(lines.join("\n"));
  }
  return files.join("\n\n") + "\n";
}

function genPython(d: Diagram): string {
  const parts: string[] = ["from __future__ import annotations", "from abc import ABC, abstractmethod", "from dataclasses import dataclass, field", "from enum import Enum", ""];
  for (const n of classes(d)) {
    const name = ident(n.name);
    const { parent, interfaces, fields } = relations(d, n);
    if (n.type === "enum") {
      parts.push(`class ${name}(Enum):`, ...n.literals.map((l, i) => `    ${ident(l)} = ${i + 1}`), "", "");
      continue;
    }
    const bases = [...(parent ? [ident(parent.name)] : []), ...interfaces.map((i) => ident(i.name))];
    if (n.type === "interface" || n.isAbstract) bases.push("ABC");
    parts.push(`class ${name}${bases.length ? `(${bases.join(", ")})` : ""}:`);
    const body: string[] = [];
    const init = [...n.attributes.filter((a) => !a.isStatic), ...fields.map((f) => member({ name: f.name, type: f.many ? `list[${f.type}]` : f.type }))];
    for (const a of n.attributes.filter((x) => x.isStatic)) body.push(`    ${ident(a.name)}: ${mapType(a.type, "python")} = ${a.value || "None"}`);
    if (init.length) {
      body.push("    def __init__(self) -> None:");
      for (const a of init) {
        const prefix = a.visibility === "-" ? "_" : "";
        body.push(`        self.${prefix}${ident(a.name)}: ${a.type.startsWith("list[") ? a.type : mapType(a.type, "python")} = ${a.value || (a.type.startsWith("list[") ? "[]" : "None")}`);
      }
    }
    for (const o of n.operations) {
      if (body.length) body.push("");
      const p = params(o.params, "python");
      if (o.isAbstract || n.type === "interface") body.push("    @abstractmethod");
      if (o.isStatic) body.push("    @staticmethod");
      body.push(`    def ${ident(o.name)}(${o.isStatic ? "" : "self"}${p ? `${o.isStatic ? "" : ", "}${p}` : ""}) -> ${mapType(o.type || "void", "python")}:`);
      body.push(o.isAbstract || n.type === "interface" ? "        ..." : `        # TODO: implementar\n${defaultReturn(o.type, "python") || "        pass\n"}`.trimEnd());
    }
    parts.push(...(body.length ? body : ["    pass"]), "", "");
  }
  return parts.join("\n").replace(/\n{3,}/g, "\n\n\n").trimEnd() + "\n";
}

function sqlType(m: Member): string {
  const t = m.type.trim();
  if (!t) return "VARCHAR(255)";
  const map: Record<string, string> = { string: "VARCHAR(255)", int: "INTEGER", integer: "INTEGER", long: "BIGINT", double: "DOUBLE PRECISION", float: "REAL", boolean: "BOOLEAN", bool: "BOOLEAN", date: "DATE", datetime: "TIMESTAMP", decimal: "DECIMAL(19,4)" };
  return map[t.toLowerCase()] || t.toUpperCase();
}

function genSql(d: Diagram): string {
  const tables = Object.values(d.nodes).filter((n) => n.type === "entity" || n.type === "class");
  const parts: string[] = ["-- Script generado por CoffeeDiagram", ""];
  const fkLines = new Map<string, string[]>();
  // Las relaciones con cardinalidad «muchos» crean la clave foránea en ese lado
  for (const e of Object.values(d.edges).filter((x) => x.kind === "erRelation" || x.kind === "association" || x.kind === "aggregation" || x.kind === "composition")) {
    const s = d.nodes[e.source];
    const t = d.nodes[e.target];
    if (!s || !t || !tables.includes(s) || !tables.includes(t)) continue;
    const sMany = (e.sourceCard || e.sourceLabel).includes("*");
    const tMany = (e.targetCard || e.targetLabel).includes("*");
    if (sMany && tMany) continue; // varios a varios: requiere tabla intermedia
    const child = tMany || (!sMany && e.kind === "erRelation") ? t : s;
    const parent = child === t ? s : t;
    const pk = parent.attributes.find((m) => m.pk);
    const base = ident(parent.name).toLowerCase();
    const singular = base.replace(/es$/, "").replace(/s$/, "");
    const candidates = [`${base}_${pk ? ident(pk.name) : "id"}`, `${singular}_id`, `${base}_id`, `id_${singular}`, `id_${base}`];
    // Si la tabla hija ya tiene la columna de la clave foránea, solo se añade la restricción
    const existing = child.attributes.find((m) => (m.ref && m.ref.toLowerCase() === parent.name.toLowerCase()) || candidates.includes(m.name.toLowerCase()));
    const col = existing ? existing.name : candidates[0];
    if (existing) {
      const list = fkLines.get(child.id) || [];
      list.push(`  FOREIGN KEY (${col}) REFERENCES ${ident(parent.name)}(${pk ? ident(pk.name) : "id"})`);
      fkLines.set(child.id, list);
      continue;
    }
    const list = fkLines.get(child.id) || [];
    list.push(`  ${col} ${pk ? sqlType(pk) : "INTEGER"}${(child === t ? e.sourceCard : e.targetCard) === "1" ? " NOT NULL" : ""} REFERENCES ${ident(parent.name)}(${pk ? ident(pk.name) : "id"})`);
    fkLines.set(child.id, list);
  }
  // Las tablas referenciadas se crean primero
  const deps = new Map<string, Set<string>>();
  for (const e of Object.values(d.edges)) {
    const s = d.nodes[e.source];
    const t = d.nodes[e.target];
    if (!s || !t || !tables.includes(s) || !tables.includes(t)) continue;
    const tMany = (e.targetCard || e.targetLabel).includes("*");
    const sMany = (e.sourceCard || e.sourceLabel).includes("*");
    if (sMany && tMany) continue;
    const [child, parent] = tMany || (!sMany && e.kind === "erRelation") ? [t, s] : [s, t];
    (deps.get(child.id) || deps.set(child.id, new Set()).get(child.id)!).add(parent.id);
  }
  const ordered: DNode[] = [];
  const visiting = new Set<string>();
  const visit = (n: DNode) => {
    if (ordered.includes(n) || visiting.has(n.id)) return;
    visiting.add(n.id);
    for (const p of deps.get(n.id) || []) if (d.nodes[p]) visit(d.nodes[p]);
    visiting.delete(n.id);
    ordered.push(n);
  };
  tables.forEach(visit);
  for (const n of ordered) {
    const cols = n.attributes.map((m) => {
      const pkSolo = m.pk && n.attributes.filter((x) => x.pk).length === 1;
      return `  ${ident(m.name)} ${sqlType(m)}${pkSolo ? " PRIMARY KEY" : ""}${!m.nullable && !m.pk ? " NOT NULL" : ""}${m.unique && !m.pk ? " UNIQUE" : ""}`;
    });
    const pks = n.attributes.filter((m) => m.pk);
    if (pks.length > 1) cols.push(`  PRIMARY KEY (${pks.map((m) => ident(m.name)).join(", ")})`);
    if (!pks.length && n.type === "class") cols.unshift("  id INTEGER PRIMARY KEY");
    const fks = fkLines.get(n.id) || [];
    parts.push(`CREATE TABLE ${ident(n.name)} (`, [...cols, ...fks].join(",\n"), ");", "");
  }
  return parts.join("\n");
}

function genMermaid(d: Diagram): string {
  const name = (n: DNode) => ident(n.name || n.type);
  const lines: string[] = [];
  const edges = Object.values(d.edges);
  switch (d.kind) {
    case "class": {
      lines.push("classDiagram");
      for (const n of classes(d)) {
        lines.push(`  class ${name(n)} {`);
        if (n.type === "interface") lines.push("    <<interface>>");
        if (n.type === "enum") lines.push("    <<enumeration>>", ...n.literals.map((l) => `    ${l}`));
        for (const a of n.attributes) lines.push(`    ${a.visibility}${a.type ? `${a.type} ` : ""}${a.name}${a.isStatic ? "$" : ""}`);
        for (const o of n.operations) lines.push(`    ${o.visibility}${o.name}(${o.params})${o.isAbstract ? "*" : ""}${o.type ? ` ${o.type}` : ""}`);
        lines.push("  }");
      }
      const arrow: Record<string, string> = { association: "--", directed: "-->", aggregation: "o--", composition: "*--", generalization: "--|>", realization: "..|>", dependency: "..>" };
      for (const e of edges) {
        const s = d.nodes[e.source];
        const t = d.nodes[e.target];
        if (!arrow[e.kind] || !s || !t) continue;
        const [l, r] = e.kind === "aggregation" || e.kind === "composition" ? [s, t] : [s, t];
        lines.push(`  ${name(l)}${e.sourceLabel ? ` "${e.sourceLabel}"` : ""} ${arrow[e.kind]}${e.targetLabel ? ` "${e.targetLabel}"` : ""} ${name(r)}${e.label ? ` : ${e.label}` : ""}`);
      }
      break;
    }
    case "er": {
      lines.push("erDiagram");
      const card = (c: string, left: boolean) => (c === "1" ? "||" : c === "0..1" ? (left ? "|o" : "o|") : c === "1..*" ? (left ? "}|" : "|{") : c === "0..*" ? (left ? "}o" : "o{") : "||");
      for (const e of edges.filter((x) => x.kind === "erRelation")) {
        const s = d.nodes[e.source];
        const t = d.nodes[e.target];
        if (s && t) lines.push(`  ${name(s)} ${card(e.sourceCard, true)}--${card(e.targetCard, false)} ${name(t)} : "${e.label || "relaciona"}"`);
      }
      for (const n of Object.values(d.nodes).filter((x) => x.type === "entity")) {
        lines.push(`  ${name(n)} {`, ...n.attributes.map((m) => `    ${(m.type || "string").replace(/\W+/g, "_")} ${ident(m.name)}${m.pk ? " PK" : m.fk ? " FK" : ""}`), "  }");
      }
      break;
    }
    case "sequence": {
      lines.push("sequenceDiagram");
      const parts = Object.values(d.nodes).filter((n) => n.type === "lifeline" || n.type === "actorLifeline").sort((a, b) => a.x - b.x);
      for (const p of parts) lines.push(`  ${p.type === "actorLifeline" ? "actor" : "participant"} ${name(p)} as ${p.name}`);
      const owner = (id: string) => {
        const n = d.nodes[id];
        if (!n || n.type !== "activation") return n;
        return parts.find((p) => Math.abs(p.x + p.w / 2 - (n.x + n.w / 2)) < p.w / 2) || n;
      };
      const arrow: Record<string, string> = { message: "->>", asyncMessage: "-)", reply: "-->>", createMessage: "->>" };
      for (const e of edges.filter((x) => arrow[x.kind]).sort((a, b) => (a.y || 0) - (b.y || 0))) {
        const s = owner(e.source);
        const t = owner(e.target);
        if (s && t) lines.push(`  ${name(s)}${arrow[e.kind]}${name(t)}: ${e.label || " "}`);
      }
      break;
    }
    case "state": {
      lines.push("stateDiagram-v2");
      const id = (n: DNode) => (n.type === "initial" || n.type === "final" ? "[*]" : name(n));
      for (const n of Object.values(d.nodes).filter((x) => x.type === "state")) if (n.name !== name(n)) lines.push(`  ${name(n)} : ${n.name}`);
      for (const e of edges.filter((x) => x.kind === "flow")) {
        const s = d.nodes[e.source];
        const t = d.nodes[e.target];
        if (s && t) lines.push(`  ${id(s)} --> ${id(t)}${e.label ? ` : ${e.label}` : ""}`);
      }
      break;
    }
    case "mindmap": {
      lines.push("mindmap");
      const root = Object.values(d.nodes).find((n) => n.type === "topic") || Object.values(d.nodes)[0];
      const seen = new Set<string>();
      const walk = (n: DNode, depth: number) => {
        if (seen.has(n.id)) return;
        seen.add(n.id);
        lines.push(`${"  ".repeat(depth + 1)}${depth ? n.name : `((${n.name}))`}`);
        for (const e of edges) {
          const other = e.source === n.id ? d.nodes[e.target] : e.target === n.id ? d.nodes[e.source] : null;
          if (other && (other.type === "topic" || other.type === "subtopic")) walk(other, depth + 1);
        }
      };
      if (root) walk(root, 0);
      break;
    }
    default: {
      // Flujo, actividad y casos de uso como diagrama de flujo
      lines.push("flowchart TD");
      const shape = (n: DNode) => {
        const t = (n.name || " ").replace(/"/g, "'");
        if (n.type === "decision" || n.type === "choice") return `{"${t}"}`;
        if (n.type === "terminator" || n.type === "usecase") return `(["${t}"])`;
        if (n.type === "initial") return "((inicio))";
        if (n.type === "final" || n.type === "flowFinal") return "((fin))";
        if (n.type === "database") return `[("${t}")]`;
        if (n.type === "io") return `[/"${t}"/]`;
        if (n.type === "actor") return `["👤 ${t}"]`;
        if (n.type === "fork") return "[ ]";
        return `["${t}"]`;
      };
      for (const n of Object.values(d.nodes).filter((x) => !["note", "text", "swimlane", "system"].includes(x.type))) lines.push(`  ${n.id.replace(/\W/g, "")}${shape(n)}`);
      for (const e of edges.filter((x) => x.kind !== "anchor")) lines.push(`  ${e.source.replace(/\W/g, "")} ${e.kind === "line" || e.kind === "link" ? "---" : "-->"}${e.label ? `|${e.label}|` : ""} ${e.target.replace(/\W/g, "")}`);
    }
  }
  return lines.join("\n") + "\n";
}

function genPlantUml(d: Diagram): string {
  const name = (n: DNode) => `"${(n.name || n.type).replace(/"/g, "'")}"`;
  const alias = (n: DNode) => n.id.replace(/\W/g, "");
  const lines = ["@startuml", "skinparam shadowing false", ""];
  const edges = Object.values(d.edges);
  const arrow: Record<string, string> = {
    association: "--",
    directed: "-->",
    aggregation: "o--",
    composition: "*--",
    generalization: "--|>",
    realization: "..|>",
    dependency: "..>",
    include: "..>",
    extend: "..>",
    link: "--",
    flow: "-->",
    line: "--",
    anchor: "..",
    message: "->",
    asyncMessage: "->>",
    reply: "-->",
    createMessage: "->",
    erRelation: "--",
  };
  if (d.kind === "sequence") {
    const parts = Object.values(d.nodes).filter((n) => n.type === "lifeline" || n.type === "actorLifeline").sort((a, b) => a.x - b.x);
    for (const p of parts) lines.push(`${p.type === "actorLifeline" ? "actor" : "participant"} ${name(p)} as ${alias(p)}`);
    const owner = (id: string) => {
      const n = d.nodes[id];
      if (!n || n.type !== "activation") return n;
      return parts.find((p) => Math.abs(p.x + p.w / 2 - (n.x + n.w / 2)) < p.w / 2) || n;
    };
    for (const e of edges.filter((x) => x.y !== undefined).sort((a, b) => (a.y || 0) - (b.y || 0))) {
      const s = owner(e.source);
      const t = owner(e.target);
      if (s && t) lines.push(`${alias(s)} ${arrow[e.kind] || "->"} ${alias(t)}${e.kind === "createMessage" ? " ** " : ""}: ${e.label || ""}`);
    }
    lines.push("", "@enduml");
    return lines.join("\n") + "\n";
  }
  for (const n of Object.values(d.nodes)) {
    const a = alias(n);
    switch (n.type) {
      case "class":
      case "interface":
      case "enum":
      case "entity":
      case "object": {
        const kw = n.type === "interface" ? "interface" : n.type === "enum" ? "enum" : n.type === "entity" ? "entity" : n.type === "object" ? "object" : n.isAbstract ? "abstract class" : "class";
        lines.push(`${kw} ${name(n)} as ${a} {`);
        if (n.type === "enum") lines.push(...n.literals.map((l) => `  ${l}`));
        for (const m of n.attributes) lines.push(n.type === "entity" ? `  ${m.pk ? "* " : ""}${m.name} : ${m.type}${m.fk ? " <<FK>>" : ""}` : n.type === "object" ? `  ${m.name} = ${m.value}` : `  ${m.isStatic ? "{static} " : ""}${m.visibility}${m.name} : ${m.type}`);
        for (const o of n.operations) lines.push(`  ${o.isAbstract ? "{abstract} " : ""}${o.isStatic ? "{static} " : ""}${o.visibility}${o.name}(${o.params})${o.type ? ` : ${o.type}` : ""}`);
        lines.push("}");
        break;
      }
      case "actor":
      case "actorLifeline":
        lines.push(`actor ${name(n)} as ${a}`);
        break;
      case "usecase":
        lines.push(`usecase ${name(n)} as ${a}`);
        break;
      case "system":
      case "package":
        lines.push(`rectangle ${name(n)} as ${a}`);
        break;
      case "component":
        lines.push(`component ${name(n)} as ${a}`);
        break;
      case "providedInterface":
        lines.push(`interface ${name(n)} as ${a}`);
        break;
      case "node":
      case "device":
        lines.push(`node ${name(n)} as ${a}`);
        break;
      case "artifact":
        lines.push(`artifact ${name(n)} as ${a}`);
        break;
      case "database":
        lines.push(`database ${name(n)} as ${a}`);
        break;
      case "note":
        lines.push(`note ${JSON.stringify(n.text || n.name)} as ${a}`);
        break;
      case "initial":
      case "final":
        lines.push(`circle " " as ${a}`);
        break;
      case "state":
        lines.push(`state ${name(n)} as ${a}`);
        break;
      default:
        if (n.name) lines.push(`rectangle ${name(n)} as ${a}`);
    }
  }
  lines.push("");
  for (const e of edges) {
    const s = d.nodes[e.source];
    const t = d.nodes[e.target];
    if (!s || !t) continue;
    const label = e.kind === "include" ? "<<include>>" : e.kind === "extend" ? "<<extend>>" : e.label;
    lines.push(`${alias(s)}${e.sourceLabel ? ` "${e.sourceLabel}"` : ""} ${arrow[e.kind] || "--"}${e.targetLabel ? ` "${e.targetLabel}"` : ""} ${alias(t)}${label ? ` : ${label}` : ""}`);
  }
  lines.push("", "@enduml");
  return lines.join("\n") + "\n";
}

export function generate(d: Diagram, lang: CodeLanguage): string {
  switch (lang) {
    case "java":
      return genJavaLike(d, "java");
    case "csharp":
      return genJavaLike(d, "csharp");
    case "typescript":
      return genTypeScript(d);
    case "python":
      return genPython(d);
    case "sql":
      return genSql(d);
    case "mermaid":
      return genMermaid(d);
    case "plantuml":
      return genPlantUml(d);
  }
}

// ---------------------------------------------------------------------------
// Importar SQL → modelo entidad-relación
// ---------------------------------------------------------------------------

/** Lee sentencias CREATE TABLE (por ejemplo, el script exportado de CoffeeDataBase). */
export function importSql(d: Diagram, sql: string): { diagram: Diagram; tables: number } {
  const clean = sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"[]?([\w.]+)[`"\]]?\s*\(([\s\S]*?)\)\s*;/gi;
  const tables: { name: string; node: DNode; fks: { col: string; ref: string }[] }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    const name = m[1];
    const body = m[2];
    // Separar por comas de primer nivel
    const parts: string[] = [];
    let depth = 0;
    let cur = "";
    for (const ch of body) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === "," && depth === 0) {
        parts.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    if (cur.trim()) parts.push(cur.trim());
    const cols: Member[] = [];
    const fks: { col: string; ref: string }[] = [];
    const pkCols = new Set<string>();
    for (const p of parts) {
      const up = p.toUpperCase();
      const unq = (s: string) => s.replace(/[`"[\]]/g, "");
      if (up.startsWith("PRIMARY KEY")) {
        (p.match(/\(([^)]*)\)/)?.[1] || "").split(",").forEach((c) => pkCols.add(unq(c.trim())));
        continue;
      }
      if (up.startsWith("FOREIGN KEY")) {
        const fk = p.match(/FOREIGN\s+KEY\s*\(([^)]*)\)\s*REFERENCES\s+[`"[]?([\w.]+)/i);
        if (fk) fks.push({ col: unq(fk[1].trim()), ref: fk[2] });
        continue;
      }
      if (/^(CONSTRAINT|UNIQUE|CHECK|INDEX|KEY)\b/i.test(p)) continue;
      const col = p.match(/^[`"[]?(\w+)[`"\]]?\s+([\w]+(?:\s*\([^)]*\))?)?(.*)$/s);
      if (!col) continue;
      const rest = (col[3] || "").toUpperCase();
      const ref = p.match(/REFERENCES\s+[`"[]?([\w.]+)/i);
      if (ref) fks.push({ col: col[1], ref: ref[1] });
      cols.push(member({ name: col[1], type: (col[2] || "").toUpperCase(), pk: /PRIMARY\s+KEY/.test(rest), fk: !!ref, ref: ref?.[1], nullable: !/NOT\s+NULL/.test(rest) && !/PRIMARY\s+KEY/.test(rest), unique: /UNIQUE/.test(rest) }));
    }
    for (const c of cols) if (pkCols.has(c.name)) Object.assign(c, { pk: true, nullable: false });
    for (const fk of fks) {
      const c = cols.find((x) => x.name === fk.col);
      if (c) Object.assign(c, { fk: true, ref: fk.ref });
    }
    tables.push({ name, node: makeNode("entity", { name, attributes: cols }), fks });
  }
  // Colocación en cuadrícula
  const perRow = Math.max(2, Math.ceil(Math.sqrt(tables.length)));
  const existing = Object.values(d.nodes);
  const startY = existing.length ? Math.max(...existing.map((n) => n.y + n.h)) + 80 : 40;
  let rowH = 0;
  let offset = 0;
  tables.forEach((t, i) => {
    if (i % perRow === 0 && i) {
      offset += rowH + 70;
      rowH = 0;
    }
    t.node.x = 40 + (i % perRow) * 300;
    t.node.y = startY + offset;
    rowH = Math.max(rowH, t.node.h);
  });
  let next = addNodes(d, tables.map((t) => t.node));
  const byName = new Map(tables.map((t) => [t.name.toLowerCase(), t.node]));
  for (const n of existing) if (n.type === "entity") byName.set(n.name.toLowerCase(), n);
  for (const t of tables)
    for (const fk of t.fks) {
      const parent = byName.get(fk.ref.toLowerCase());
      if (!parent) continue;
      const col = t.node.attributes.find((c) => c.name === fk.col);
      const edge: DEdge = makeEdge("erRelation", parent.id, t.node.id, { sourceCard: col && !col.nullable ? "1" : "0..1", targetCard: "0..*" });
      next = { ...next, edges: { ...next.edges, [edge.id]: edge } };
    }
  return { diagram: next, tables: tables.length };
}
