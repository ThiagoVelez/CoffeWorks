// Manual de usuario (F1): temas con buscador.

import React, { useMemo, useState } from "react";
import { X, Search, BookOpen } from "lucide-react";

interface Topic {
  category: string;
  title: string;
  points: string[];
}

const TOPICS: Topic[] = [
  {
    category: "Inicio",
    title: "Crear, abrir y bases recientes",
    points: [
      "Archivo › Nueva base de datos crea una base vacía (.cdb). Se guarda sola en Documentos\\CoffeeWorks mientras trabajas.",
      "Archivo › Abrir… abre archivos .cdb, .db, .sqlite o .sqlite3 (son bases SQLite).",
      "Las bases que abres aparecen en la pantalla de inicio y en el Launcher.",
    ],
  },
  {
    category: "Inicio",
    title: "Copias de seguridad con fecha y hora",
    points: [
      "Archivo › Copia de seguridad guarda una copia de la base en Documentos\\CoffeeWorks\\Copias de seguridad, con la fecha y la hora en el nombre.",
      "Para volver a una copia, ábrela con Archivo › Abrir.",
    ],
  },
  {
    category: "Tablas",
    title: "Diseñador de tablas",
    points: [
      "Crear › Tabla (o el + junto a «Tablas») abre el diseñador.",
      "Cada fila es un campo: nombre, tipo de dato, requerido, único y valor predeterminado.",
      "La llave marca la clave principal. Autonumérico asigna 1, 2, 3… solo.",
      "Para fechas, CURRENT_DATE o CURRENT_TIMESTAMP como valor predeterminado guardan la fecha del momento.",
      "Al guardar cambios los datos se conservan, aunque cambies el nombre de un campo.",
    ],
  },
  {
    category: "Tablas",
    title: "Hoja de datos: edición como en Excel",
    points: [
      "Doble clic (o Intro) en una celda para editarla; Intro guarda y Esc cancela.",
      "La fila amarilla del final sirve para añadir registros: escribe y pulsa Intro.",
      "Haz clic en un encabezado para ordenar; el buscador filtra todas las columnas.",
      "Los campos relacionados muestran una lista con los registros de la otra tabla.",
      "Marca filas y pulsa «Eliminar» para borrarlas.",
    ],
  },
  {
    category: "Tablas",
    title: "Formularios",
    points: ["Muestran un registro cada vez, con botones para moverte, crear, guardar y eliminar.", "Útiles para capturar datos con calma o revisar registros largos."],
  },
  {
    category: "Consultas",
    title: "Consola SQL: editor, historial y errores explicados",
    points: [
      "Escribe la consulta y pulsa Ctrl+Intro. Si seleccionas una parte, solo se ejecuta esa.",
      "Los errores se explican en español con una sugerencia para arreglarlos.",
      "El historial guarda las últimas consultas; «Guardar consulta» la añade al panel de la izquierda.",
      "Los resultados se exportan a Excel, CSV o a un informe para imprimir.",
    ],
  },
  {
    category: "Consultas",
    title: "Diseñador de consultas y unión de tablas (JOIN)",
    points: [
      "Elige la tabla principal y pulsa «Unir …» para añadir tablas relacionadas: la unión se hace sola.",
      "Marca los campos, añade criterios (igual, contiene, mayor que…) y el orden.",
      "«Agrupar y contar» resume, por ejemplo, cuántos pedidos hay por ciudad.",
      "El SQL generado se puede abrir en la consola para ajustarlo.",
    ],
  },
  {
    category: "Consultas",
    title: "ETL de semilleros",
    points: [
      "1. Extraer: elige las tablas de origen; el ETL reconoce los campos de semillero, descripción y observaciones (puedes cambiarlos).",
      "2. Transformar: filtra por semillero, por observaciones (con o sin) y busca texto.",
      "3. Cargar: revisa las fichas o la vista tabular, escribe observaciones con «Nota» (se guardan en el registro original), exporta a Excel o guarda el resultado como una tabla nueva.",
    ],
  },
  {
    category: "Relaciones",
    title: "Diagrama entidad-relación",
    points: [
      "Arrastra las tablas por su barra roja; «Ordenar» las coloca automáticamente.",
      "Arrastra el punto rojo de un campo hasta el campo de otra tabla para relacionarlos.",
      "Uno a varios: un cliente tiene muchos pedidos. Uno a uno: el campo relacionado no se repite.",
      "Al borrar en la tabla principal puedes impedirlo, borrar en cascada o dejar el campo vacío.",
    ],
  },
  {
    category: "Relaciones",
    title: "Tablas intermedias (muchos a muchos)",
    points: [
      "Nueva relación › Varios a varios crea la tabla intermedia con un campo para cada tabla y, si quieres, fecha de asignación y estado.",
      "Ejemplo: estudiantes ↔ semilleros se guarda en «estudiantes_semilleros».",
      "El asistente detecta tablas intermedias sin relaciones y las crea con un clic.",
    ],
  },
  {
    category: "Asistente",
    title: "Asistente: plantillas, datos de prueba y revisión",
    points: [
      "Plantillas: tienda, semilleros, biblioteca e inventario, con sus relaciones.",
      "Datos de prueba: nombres, correos, ciudades, precios y fechas realistas que respetan las relaciones.",
      "Revisión del diseño: tablas sin clave principal, relaciones que faltan, índices recomendados y registros huérfanos.",
    ],
  },
  {
    category: "Datos externos",
    title: "Importar y exportar",
    points: [
      "Importar: Excel (una tabla por hoja), CSV, scripts SQL y bases .accdb/.mdb (se copian sus tablas y datos).",
      "Exportar: todas las tablas a Excel, la tabla actual a CSV, un script SQL completo, un informe o una copia .cdb.",
      "Los tipos de campo se deducen al importar (números, fechas, sí/no o texto).",
    ],
  },
  {
    category: "Atajos",
    title: "Atajos y tema oscuro",
    points: [
      "Ctrl+K o Alt+/: buscar cualquier comando.",
      "F1: este manual · Ctrl+S: guardar · Ctrl+Mayús+S: guardar como · F5: actualizar.",
      "Ver › Tema oscuro cambia entre claro y oscuro (se recuerda en este equipo).",
    ],
  },
];

export const ManualDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? TOPICS.filter((t) => `${t.title} ${t.points.join(" ")}`.toLowerCase().includes(q)) : TOPICS;
  }, [query]);
  const [active, setActive] = useState(0);
  const topic = results[Math.min(active, results.length - 1)];

  return (
    <div data-modal-open className="fixed inset-0 z-[99995] bg-black/40 flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-[860px] max-w-full h-[580px] max-h-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" data-manual>
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#f1e6e7]">
          <BookOpen size={18} className="text-[#9b111e]" />
          <h2 className="text-[15px] font-semibold">Manual de CoffeeDataBase</h2>
          <div className="ml-auto flex items-center gap-1.5 border border-[#e2cfd1] rounded-lg px-2 h-8 w-64">
            <Search size={13} className="text-[#9a8285]" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              placeholder="Buscar en el manual"
              className="flex-1 text-[12px] outline-none"
            />
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#fbeef0]">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 flex overflow-hidden">
          <nav className="w-64 shrink-0 border-r border-[#f1e6e7] overflow-y-auto py-2 bg-[#fdf9f9]">
            {results.map((t, i) => (
              <button
                key={t.title}
                type="button"
                onClick={() => setActive(i)}
                className={`w-full text-left px-4 py-2 text-[12px] ${topic === t ? "bg-white font-semibold text-[#9b111e] border-r-2 border-[#9b111e]" : "hover:bg-[#fbeef0]"}`}
              >
                <span className="block text-[10px] uppercase tracking-wide text-[#a08a8d]">{t.category}</span>
                {t.title}
              </button>
            ))}
            {!results.length && <p className="px-4 py-3 text-[12px] text-[#7a6265]">No se encontraron temas con esa búsqueda.</p>}
          </nav>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {topic && (
              <>
                <div className="text-[11px] uppercase tracking-wide text-[#a08a8d]">{topic.category}</div>
                <h3 className="text-[18px] font-semibold text-[#3a1a1e] mt-0.5 mb-3">{topic.title}</h3>
                <ul className="flex flex-col gap-2.5">
                  {topic.points.map((p) => (
                    <li key={p} className="flex gap-2 text-[13px] text-[#4a2a2e] leading-relaxed">
                      <span className="text-[#9b111e] font-bold">•</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
        <div className="flex justify-end px-5 py-3 border-t border-[#f1e6e7]">
          <button type="button" onClick={onClose} className="h-9 px-5 rounded-lg text-[13px] font-semibold text-white" style={{ background: "#9b111e" }}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
