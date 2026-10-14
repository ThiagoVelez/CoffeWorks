import React, { useState } from "react";
import {
  LayoutTemplate,
  Search,
  FileText,
  Table as TableIcon,
  Presentation,
  CheckCircle2,
  ArrowUpRight,
} from "lucide-react";

export interface TemplateItem {
  id: string;
  appId: "coffedoc" | "coffecalc" | "coffeview";
  appName: string;
  title: string;
  category: string;
  description: string;
  features: string[];
  port: number;
  badgeBg: string;
  badgeText: string;
  accentBorder: string;
  initialData?: any;
}

const TEMPLATES: TemplateItem[] = [
  // --- COFFEDOC (3 PLANTILLAS) ---
  {
    id: "doc-informe-ejecutivo",
    appId: "coffedoc",
    appName: "CoffeDoc",
    title: "Informe Ejecutivo y Técnico Trimestral",
    category: "Gestión & Negocios",
    description:
      "Documento formal con estructura corporativa para comités directivos. Incluye resumen ejecutivo, tabla de indicadores clave (KPIs), objetivos y recomendaciones.",
    features: [
      "Lista numerada de hitos y acuerdos",
      "Tabla ejecutiva con estilo azul corporativo",
      "Estructura tipográfica lista para exportar a PDF",
    ],
    port: 1421,
    badgeBg: "bg-[#e8f1fc]",
    badgeText: "text-[#185abd]",
    accentBorder: "hover:border-[#185abd]",
    initialData: {
      title: "Informe Ejecutivo Trimestral",
      content: `<h1>Informe Ejecutivo y Técnico Trimestral</h1>
<p><strong>Fecha:</strong> Octubre 2026 &nbsp;|&nbsp; <strong>Autor:</strong> Dirección de Operaciones &nbsp;|&nbsp; <strong>Estado:</strong> Aprobado</p>
<hr/>
<h2>1. Resumen Ejecutivo</h2>
<p>El presente informe consolida los resultados operacionales y estratégicos alcanzados durante el trimestre. Se destaca un incremento del 24% en la eficiencia de entregas de la suite.</p>
<h2>2. Objetivos Principales</h2>
<ol>
  <li>Despliegue de la arquitectura modular local sin dependencia de servidores externos.</li>
  <li>Optimización del rendimiento de renderizado en CoffeDoc, CoffeCalc y CoffeView.</li>
  <li>Consolidación del sistema de plantillas empresariales listas para producción.</li>
</ol>
<h2>3. Indicadores de Rendimiento (KPIs)</h2>
<table style="width:100%; border-collapse:collapse; margin:16px 0; font-size:13px;">
  <thead>
    <tr style="background:#185abd; color:#ffffff;">
      <th style="padding:8px 12px; border:1px solid #d2d0ce; text-align:left;">Métrica</th>
      <th style="padding:8px 12px; border:1px solid #d2d0ce; text-align:center;">Meta</th>
      <th style="padding:8px 12px; border:1px solid #d2d0ce; text-align:center;">Resultado Real</th>
      <th style="padding:8px 12px; border:1px solid #d2d0ce; text-align:center;">Cumplimiento</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:8px 12px; border:1px solid #d2d0ce;">Disponibilidad Local</td>
      <td style="padding:8px 12px; border:1px solid #d2d0ce; text-align:center;">99.5%</td>
      <td style="padding:8px 12px; border:1px solid #d2d0ce; text-align:center;">99.9%</td>
      <td style="padding:8px 12px; border:1px solid #d2d0ce; text-align:center; font-weight:bold; color:#107c41;">100.4%</td>
    </tr>
    <tr style="background:#f8f9fa;">
      <td style="padding:8px 12px; border:1px solid #d2d0ce;">Tiempo de Carga Inicial</td>
      <td style="padding:8px 12px; border:1px solid #d2d0ce; text-align:center;">&lt; 500 ms</td>
      <td style="padding:8px 12px; border:1px solid #d2d0ce; text-align:center;">320 ms</td>
      <td style="padding:8px 12px; border:1px solid #d2d0ce; text-align:center; font-weight:bold; color:#107c41;">Superado</td>
    </tr>
  </tbody>
</table>
<h2>4. Conclusiones y Próximos Pasos</h2>
<p>Se recomienda continuar con la fase de integración de complementos locales y mantener la política de cero dependencias externas en tiempo de ejecución.</p>`,
    },
  },
  {
    id: "doc-cv-profesional",
    appId: "coffedoc",
    appName: "CoffeDoc",
    title: "Currículum Vitae Profesional Moderno",
    category: "Desarrollo Profesional",
    description:
      "Diseño de currículum de alto impacto con cabecera limpia, perfil profesional destacado, trayectoria laboral cronológica y competencias clave.",
    features: [
      "Diseño tipográfico pulido con interlineado optimizado",
      "Secciones estructuradas para experiencia y logros",
      "Formato probado para lectura rápida y filtros ATS",
    ],
    port: 1421,
    badgeBg: "bg-[#e8f1fc]",
    badgeText: "text-[#185abd]",
    accentBorder: "hover:border-[#185abd]",
    initialData: {
      title: "Currículum Vitae Profesional",
      content: `<h1>Santiago Morales</h1>
<p style="font-size:14px; color:#5c3a21; font-weight:600;">Ingeniero de Software Senior & Líder de Arquitectura</p>
<p>santiago.morales@coffeworks.internal &nbsp;|&nbsp; +57 (300) 123-4567 &nbsp;|&nbsp; Bóveda Local CoffeWorks</p>
<hr/>
<h2>Perfil Profesional</h2>
<p>Ingeniero de software con más de 8 años de trayectoria diseñando soluciones de escritorio y web de alto rendimiento. Especialista en TypeScript, arquitecturas desacopladas y aplicaciones autónomas con persistencia local garantizada.</p>
<h2>Experiencia Laboral</h2>
<h3>Líder de Desarrollo de Software &mdash; CoffeWorks Suite (2023 &ndash; Presente)</h3>
<ul>
  <li>Arquitectura integral de las tres herramientas centrales de la suite: CoffeDoc, CoffeCalc y CoffeView.</li>
  <li>Implementación de sistemas de cinta Ribbon con menús emergentes PortalMenu desacoplados.</li>
  <li>Optimización del tiempo de compilación y empaquetado reduciendo el tamaño final en 35%.</li>
</ul>
<h3>Ingeniero Frontend Senior &mdash; Cloud & Enterprise Corp (2019 &ndash; 2023)</h3>
<ul>
  <li>Desarrollo de módulos de procesamiento documental en tiempo real con sincronización local.</li>
  <li>Liderazgo de equipo de 6 ingenieros bajo estándares de pruebas rigurosas y cero regresiones.</li>
</ul>
<h2>Habilidades Técnicas</h2>
<p><strong>Lenguajes y Entornos:</strong> TypeScript, JavaScript ESNext, Rust, HTML5 Semántico, CSS3 Vanilla.</p>
<p><strong>Frameworks y Herramientas:</strong> React 19, Tailwind CSS, Vite, Tauri, Git, Jest, Vitest.</p>`,
    },
  },
  {
    id: "doc-propuesta-comercial",
    appId: "coffedoc",
    appName: "CoffeDoc",
    title: "Propuesta Comercial y de Servicios",
    category: "Ventas & Consultoría",
    description:
      "Estructura comercial para cotizaciones corporativas, licitaciones y consultorías. Incluye alcance del proyecto, cronograma, cotización y firmas.",
    features: [
      "Desglose de fases con hitos entregables",
      "Tabla de inversión económica y términos comerciales",
      "Cláusulas de confidencialidad y garantía incluidas",
    ],
    port: 1421,
    badgeBg: "bg-[#e8f1fc]",
    badgeText: "text-[#185abd]",
    accentBorder: "hover:border-[#185abd]",
    initialData: {
      title: "Propuesta Comercial de Servicios",
      content: `<h1>Propuesta Comercial y Técnica de Servicios</h1>
<p><strong>Cliente:</strong> Corporación Industrial del Norte &nbsp;|&nbsp; <strong>Fecha de Emisión:</strong> Octubre 2026</p>
<hr/>
<h2>1. Objetivo del Proyecto</h2>
<p>Proveer la infraestructura integral de gestión documental y cálculo analítico local sin dependencia de servidores cloud, garantizando total privacidad y soberanía de datos.</p>
<h2>2. Fases de Implementación</h2>
<ol>
  <li><strong>Fase I: Diagnóstico e Instalación:</strong> Despliegue de CoffeWorks Suite en terminales de trabajo.</li>
  <li><strong>Fase II: Capacitación y Personalización:</strong> Parametrización de plantillas ejecutivas y hojas de cálculo.</li>
  <li><strong>Fase III: Puesta en Producción y Soporte:</strong> Acompañamiento continuo durante el primer mes de operación.</li>
</ol>
<h2>3. Presupuesto y Cotización</h2>
<table style="width:100%; border-collapse:collapse; margin:16px 0; font-size:13px;">
  <thead>
    <tr style="background:#185abd; color:#ffffff;">
      <th style="padding:8px 12px; border:1px solid #d2d0ce; text-align:left;">Concepto</th>
      <th style="padding:8px 12px; border:1px solid #d2d0ce; text-align:center;">Dedicación</th>
      <th style="padding:8px 12px; border:1px solid #d2d0ce; text-align:right;">Inversión (USD)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:8px 12px; border:1px solid #d2d0ce;">Licenciamiento Corporativo Suite Completa</td>
      <td style="padding:8px 12px; border:1px solid #d2d0ce; text-align:center;">Perpetua</td>
      <td style="padding:8px 12px; border:1px solid #d2d0ce; text-align:right;">$1,850.00</td>
    </tr>
    <tr style="background:#f8f9fa;">
      <td style="padding:8px 12px; border:1px solid #d2d0ce;">Consultoría de Migración y Plantillas</td>
      <td style="padding:8px 12px; border:1px solid #d2d0ce; text-align:center;">40 Horas</td>
      <td style="padding:8px 12px; border:1px solid #d2d0ce; text-align:right;">$1,200.00</td>
    </tr>
    <tr style="font-weight:bold; background:#e8f1fc;">
      <td colspan="2" style="padding:8px 12px; border:1px solid #d2d0ce; text-align:right;">TOTAL PROPUESTA:</td>
      <td style="padding:8px 12px; border:1px solid #d2d0ce; text-align:right; color:#185abd;">$3,050.00</td>
    </tr>
  </tbody>
</table>
<p><em>Validez de la oferta: 30 días calendario a partir de su emisión.</em></p>`,
    },
  },

  // --- COFFECALC (3 PLANTILLAS) ---
  {
    id: "calc-presupuesto-flujo",
    appId: "coffecalc",
    appName: "CoffeCalc",
    title: "Presupuesto Financiero y Flujo de Caja",
    category: "Finanzas & Contabilidad",
    description:
      "Plantilla contable con proyección mensual de ingresos, egresos operativos, nómina y cálculo de balance neto mediante fórmulas matemáticas automáticas.",
    features: [
      "Fórmulas preconfiguradas con SUMA",
      "Formato condicional numérico y monetario",
      "Cálculo de margen operativo y flujo acumulado",
    ],
    port: 1422,
    badgeBg: "bg-[#e1f3e7]",
    badgeText: "text-[#107c41]",
    accentBorder: "hover:border-[#107c41]",
  },
  {
    id: "calc-inventario-kardex",
    appId: "coffecalc",
    appName: "CoffeCalc",
    title: "Control de Inventario y Kardex de Productos",
    category: "Operaciones & Logística",
    description:
      "Matriz de control de existencias con códigos SKU, stock mínimo de seguridad, registro de entradas, salidas, existencias actuales y valor total de inventario.",
    features: [
      "Fórmulas de saldo actual (=Inicial + Entradas - Salidas)",
      "Multiplicación de valorización total por costo unitario",
      "Columnas con filtros y ordenamiento rápido A-Z",
    ],
    port: 1422,
    badgeBg: "bg-[#e1f3e7]",
    badgeText: "text-[#107c41]",
    accentBorder: "hover:border-[#107c41]",
  },
  {
    id: "calc-factura-comercial",
    appId: "coffecalc",
    appName: "CoffeCalc",
    title: "Factura Comercial con Cálculo de Impuestos",
    category: "Facturación & Ventas",
    description:
      "Formato de factura empresarial para clientes con encabezado fiscal, desglose de cantidades, precios unitarios, cálculo de IVA (19%) y total final a pagar.",
    features: [
      "Cálculo de subtotal automático por línea de producto",
      "Determinación exacta de impuestos y descuentos",
      "Diseño listo para impresión o exportación CSV/XLSX",
    ],
    port: 1422,
    badgeBg: "bg-[#e1f3e7]",
    badgeText: "text-[#107c41]",
    accentBorder: "hover:border-[#107c41]",
  },

  // --- COFFEVIEW (3 PLANTILLAS) ---
  {
    id: "view-pitch-deck",
    appId: "coffeview",
    appName: "CoffeView",
    title: "Pitch Deck para Inversionistas",
    category: "Startups & Venture Capital",
    description:
      "Presentación ejecutiva de 4 diapositivas para levantar capital: Portada con tesis de inversión, Problema & Oportunidad, Solución Tecnológica y Métricas de Tracción.",
    features: [
      "4 diapositivas estructuradas bajo metodología VC",
      "Formas geométricas y llamadas visuales destacadas",
      "Tipografía Segoe UI y esquema cromático de alto contraste",
    ],
    port: 1423,
    badgeBg: "bg-[#fbe7e1]",
    badgeText: "text-[#c43e1c]",
    accentBorder: "hover:border-[#c43e1c]",
  },
  {
    id: "view-qbr-estrategia",
    appId: "coffeview",
    appName: "CoffeView",
    title: "Presentación de Resultados Trimestrales (QBR)",
    category: "Estrategia Empresarial",
    description:
      "Deck corporativo para reuniones ejecutivas y juntas directivas con resumen de KPIs alcanzados, análisis de desviaciones y mapa de ruta para el siguiente periodo.",
    features: [
      "Diapositivas de análisis cualitativo y cuantitativo",
      "Estructura en dos columnas para comparativas",
      "Notas del orador preconfiguradas para guiar la exposición",
    ],
    port: 1423,
    badgeBg: "bg-[#fbe7e1]",
    badgeText: "text-[#c43e1c]",
    accentBorder: "hover:border-[#c43e1c]",
  },
  {
    id: "view-portafolio-corporativo",
    appId: "coffeview",
    appName: "CoffeView",
    title: "Portafolio Corporativo de Soluciones & Servicios",
    category: "Marketing & Comercial",
    description:
      "Presentación institucional para clientes y prospectos comerciales. Muestra la historia de la empresa, catálogo de productos, casos de éxito y datos de contacto.",
    features: [
      "Lienzo 16:9 con diseño limpio y profesional",
      "Transiciones cinematográficas de diapositiva suaves",
      "Compatible con modo orador y presentación a pantalla completa (F5)",
    ],
    port: 1423,
    badgeBg: "bg-[#fbe7e1]",
    badgeText: "text-[#c43e1c]",
    accentBorder: "hover:border-[#c43e1c]",
  },
];

interface TemplatesViewProps {
  onNotify: (msg: string) => void;
}

export const TemplatesView: React.FC<TemplatesViewProps> = ({ onNotify }) => {
  const [selectedAppFilter, setSelectedAppFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const filteredTemplates = TEMPLATES.filter((tpl) => {
    const matchesFilter =
      selectedAppFilter === "all" || tpl.appId === selectedAppFilter;
    const matchesSearch =
      tpl.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tpl.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tpl.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleUseTemplate = (tpl: TemplateItem) => {
    // Si la plantilla tiene contenido inicial para CoffeDoc, lo inyectamos en localStorage
    if (tpl.appId === "coffedoc" && tpl.initialData) {
      try {
        localStorage.setItem(
          "coffedoc_active_document",
          JSON.stringify({
            title: tpl.initialData.title,
            content: tpl.initialData.content,
            updatedAt: new Date().toISOString(),
          })
        );
      } catch {
        // En caso de que falle localStorage no bloquea la navegación
      }
    }

    // Abrir la aplicación correspondiente en la ventana local
    const url = `http://localhost:${tpl.port}`;
    window.open(url, "_blank");
    onNotify(`Cargando plantilla "${tpl.title}" en ${tpl.appName}`);
  };

  const getAppIcon = (appId: string) => {
    if (appId === "coffedoc") return <FileText size={18} className="text-[#185abd]" />;
    if (appId === "coffecalc") return <TableIcon size={18} className="text-[#107c41]" />;
    return <Presentation size={18} className="text-[#c43e1c]" />;
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in select-none">
      {/* Encabezado con título e información */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-[#e8dfd8] shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#eeddd0] flex items-center justify-center text-[#5c3a21] shrink-0 border border-[#dfd3c7]">
            <LayoutTemplate size={22} strokeWidth={2.4} />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-[#2c1b12]">
              Catálogo de Plantillas Ejecutivas
            </h1>
            <p className="text-xs text-[#795548] font-sans mt-0.5">
              9 plantillas profesionales listas para usar en CoffeDoc, CoffeCalc y CoffeView.
            </p>
          </div>
        </div>

        {/* Buscador de plantillas */}
        <div className="relative w-full md:w-72">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Buscar plantillas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#dfd3c7] bg-[#faf7f2] text-xs text-[#2c1b12] placeholder-stone-400 focus:outline-none focus:border-[#6f4e37] focus:bg-white transition-colors"
          />
        </div>
      </div>

      {/* Barra de Filtros por Aplicación */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { id: "all", label: "Todas las plantillas (9)" },
          { id: "coffedoc", label: "CoffeDoc (3 Documentos)", color: "text-[#185abd]" },
          { id: "coffecalc", label: "CoffeCalc (3 Hojas de cálculo)", color: "text-[#107c41]" },
          { id: "coffeview", label: "CoffeView (3 Presentaciones)", color: "text-[#c43e1c]" },
        ].map((tab) => {
          const isActive = selectedAppFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedAppFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? "bg-[#5c3a21] text-white shadow-xs font-semibold"
                  : "bg-white text-[#5c3a21] border border-[#e8dfd8] hover:border-[#5c3a21]"
              }`}
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Cuadrícula de 9 Plantillas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTemplates.map((tpl) => (
          <div
            key={tpl.id}
            className={`flex flex-col justify-between p-5 rounded-2xl bg-white border border-[#e8dfd8] ${tpl.accentBorder} transition-all hover:shadow-md group`}
          >
            <div>
              {/* Encabezado de la card con Badges */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-[#faf7f2] border border-[#e8dfd8]">
                    {getAppIcon(tpl.appId)}
                  </span>
                  <span
                    className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-full ${tpl.badgeBg} ${tpl.badgeText}`}
                  >
                    {tpl.appName}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-stone-500 font-medium bg-[#faf7f2] px-2 py-0.5 rounded-full border border-[#e8dfd8]">
                  {tpl.category}
                </span>
              </div>

              {/* Título y descripción */}
              <h2 className="font-sans text-sm font-bold text-[#2c1b12] mb-1.5 group-hover:text-[#5c3a21] transition-colors">
                {tpl.title}
              </h2>
              <p className="text-xs text-stone-600 leading-relaxed mb-3.5">
                {tpl.description}
              </p>

              {/* Lista de características clave */}
              <div className="flex flex-col gap-1.5 pt-3 border-t border-[#f4ede6] mb-4">
                {tpl.features.map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-[11px] text-[#5c3a21]">
                    <CheckCircle2 size={13} className="text-[#107c41] shrink-0" />
                    <span className="truncate">{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Botón de acción para usar la plantilla */}
            <button
              type="button"
              onClick={() => handleUseTemplate(tpl)}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#faf7f2] hover:bg-[#5c3a21] text-[#5c3a21] hover:text-white font-medium text-xs transition-colors border border-[#e8dfd8] group-hover:border-transparent cursor-pointer shadow-2xs"
            >
              <span>Usar esta plantilla</span>
              <ArrowUpRight size={14} />
            </button>
          </div>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="p-12 text-center bg-white rounded-2xl border border-[#e8dfd8]">
          <p className="text-sm font-medium text-stone-500">
            No se encontraron plantillas que coincidan con "{searchTerm}".
          </p>
        </div>
      )}
    </div>
  );
};
