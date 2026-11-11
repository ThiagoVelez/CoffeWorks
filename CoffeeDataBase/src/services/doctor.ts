// «Doctor de errores»: traduce los mensajes de SQLite a una explicación en
// español con una sugerencia para resolverlos.

export interface Diagnosis {
  title: string;
  explanation: string;
  tip: string;
  original: string;
}

const RULES: { test: RegExp; title: string; explanation: string; tip: string }[] = [
  {
    test: /FOREIGN KEY constraint failed/i,
    title: "Registro relacionado inexistente",
    explanation: "El valor que intentas guardar en un campo relacionado no existe en la tabla principal, o intentas borrar un registro que otros registros todavía usan.",
    tip: "Comprueba que el registro relacionado exista (por ejemplo, que el cliente exista antes de crear su pedido) o borra primero los registros que dependen de él.",
  },
  {
    test: /UNIQUE constraint failed: ([\w."]+)/i,
    title: "Valor repetido",
    explanation: "El campo $1 no admite valores repetidos y ya existe un registro con ese valor.",
    tip: "Usa un valor distinto o edita el registro existente.",
  },
  {
    test: /NOT NULL constraint failed: ([\w."]+)/i,
    title: "Falta un dato obligatorio",
    explanation: "El campo $1 es obligatorio y quedó vacío.",
    tip: "Rellena ese campo, o en el diseño de la tabla desmarca «Requerido» si puede quedar vacío.",
  },
  {
    test: /CHECK constraint failed/i,
    title: "El valor no cumple una regla",
    explanation: "La tabla tiene una regla de validación que el valor no cumple.",
    tip: "Revisa el valor introducido.",
  },
  {
    test: /no such table: ([\w."]+)/i,
    title: "La tabla no existe",
    explanation: "La consulta usa la tabla $1, que no está en la base de datos.",
    tip: "Revisa el nombre (en el panel de la izquierda verás todas las tablas). Si tiene espacios o tildes, escríbelo entre comillas dobles.",
  },
  {
    test: /no such column: ([\w."]+)/i,
    title: "El campo no existe",
    explanation: "La consulta usa el campo $1, que no existe en la tabla.",
    tip: "Revisa el nombre del campo. Los textos van entre comillas simples ('así'); las comillas dobles son para nombres de campos.",
  },
  {
    test: /table ([\w."]+) already exists/i,
    title: "Ya existe una tabla con ese nombre",
    explanation: "Hay otra tabla llamada $1.",
    tip: "Elige otro nombre o borra la tabla anterior.",
  },
  {
    test: /near "([^"]*)": syntax error/i,
    title: "Error de escritura en la consulta",
    explanation: "SQL no entiende la consulta cerca de «$1».",
    tip: "Revisa comas, paréntesis y comillas. Ejemplo válido: SELECT nombre, precio FROM productos WHERE precio > 10 ORDER BY nombre;",
  },
  {
    test: /incomplete input/i,
    title: "La consulta está incompleta",
    explanation: "Falta el final de la consulta (un paréntesis, una comilla o parte de la instrucción).",
    tip: "Revisa que cada paréntesis y comilla abierta esté cerrada.",
  },
  {
    test: /datatype mismatch/i,
    title: "Tipo de dato incorrecto",
    explanation: "El valor no corresponde al tipo del campo (por ejemplo, texto en un campo autonumérico).",
    tip: "Introduce un valor del tipo correcto.",
  },
  {
    test: /ambiguous column name: ([\w."]+)/i,
    title: "Campo ambiguo",
    explanation: "Varias tablas de la consulta tienen un campo llamado $1.",
    tip: "Indica la tabla delante del campo: tabla.campo.",
  },
  {
    test: /database is locked|database disk image is malformed/i,
    title: "No se puede usar la base de datos",
    explanation: "El archivo está dañado o lo está usando otro programa.",
    tip: "Cierra los otros programas que la usen. Si el archivo está dañado, abre una copia de seguridad.",
  },
];

export function diagnose(error: unknown): Diagnosis {
  const original = error instanceof Error ? error.message : String(error);
  for (const rule of RULES) {
    const match = rule.test.exec(original);
    if (match) {
      const fill = (text: string) => text.replace(/\$1/g, `«${(match[1] || "").replace(/"/g, "")}»`);
      return { title: rule.title, explanation: fill(rule.explanation), tip: fill(rule.tip), original };
    }
  }
  return { title: "No se pudo completar la operación", explanation: original, tip: "Revisa los datos o la consulta e inténtalo de nuevo.", original };
}

export const explain = (error: unknown) => {
  const d = diagnose(error);
  return `${d.explanation}\n\n${d.tip}`;
};
