import React from "react";
import { X, FileCode, FileText, Printer, Download, Globe } from "lucide-react";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: "cfd" | "docx" | "md" | "html" | "pdf") => void;
  documentTitle: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  onExport,
  documentTitle,
}) => {
  if (!isOpen) return null;

  const exportOptions = [
    {
      format: "docx" as const,
      name: "Microsoft Word (.docx)",
      description: "Documento oficial de Word con formato enriquecido, títulos y tablas.",
      icon: FileText,
      badge: "Word Nativo",
      color: "text-[#185abd]",
    },
    {
      format: "cfd" as const,
      name: "Formato Nativo CoffeDoc (.cfd)",
      description: "Archivo estructurado con metadatos, compatible con la suite CoffeWorks.",
      icon: FileText,
      badge: "Recomendado",
      color: "text-primary",
    },
    {
      format: "md" as const,
      name: "Markdown (.md)",
      description: "Formato estándar en texto plano ideal para repositorios de código y notas.",
      icon: FileCode,
      badge: "Estándar",
      color: "text-tertiary",
    },
    {
      format: "html" as const,
      name: "Documento Web (.html)",
      description: "Archivo HTML autónomo para visualización en cualquier navegador.",
      icon: Globe,
      badge: "Web",
      color: "text-secondary",
    },
    {
      format: "pdf" as const,
      name: "Imprimir / Guardar como PDF",
      description: "Generación de documento para impresión con formato de página A4.",
      icon: Printer,
      badge: "Impresión",
      color: "text-primary-fixed-dim",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-surface-container-high border border-outline-variant/40 shadow-2xl p-6 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
          <div>
            <h2 className="font-display text-lg text-on-surface font-bold">
              Exportar Documento
            </h2>
            <p className="font-mono text-[11px] text-outline mt-0.5">
              Archivo actual: {documentTitle || "Documento sin título"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          {exportOptions.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.format}
                type="button"
                onClick={() => {
                  onExport(opt.format);
                  onClose();
                }}
                className="flex items-start gap-3.5 p-3.5 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 hover:border-primary/50 transition-all text-left group"
              >
                <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0 border border-outline-variant/20 group-hover:bg-primary-container/20 group-hover:text-primary transition-colors">
                  <Icon size={18} className={opt.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-on-surface group-hover:text-primary transition-colors">
                      {opt.name}
                    </span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-container-high text-outline">
                      {opt.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-outline mt-1 leading-relaxed">
                    {opt.description}
                  </p>
                </div>
                <Download size={14} className="text-outline group-hover:text-primary shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
