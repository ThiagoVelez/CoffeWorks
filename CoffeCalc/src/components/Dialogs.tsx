// Diálogos y avisos propios de la aplicación.
//
// Sustituyen a window.prompt / window.alert / window.confirm, que no están
// disponibles de forma fiable dentro de la ventana de escritorio. Se usan como
// funciones que devuelven promesas: `await askForm(...)`, `await askConfirm(...)`
// y `toast(...)`. Basta con montar <DialogHost /> una vez en la aplicación.

import React, { useEffect, useRef, useState } from "react";
import { X, CheckCircle2, AlertTriangle, Info } from "lucide-react";

export interface FormField {
  name: string;
  label: string;
  type?: "text" | "number" | "select" | "color" | "textarea";
  defaultValue?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
}

interface FormRequest {
  kind: "form";
  title: string;
  message?: string;
  fields: FormField[];
  confirmLabel?: string;
  resolve: (values: Record<string, string> | null) => void;
}

interface ConfirmRequest {
  kind: "confirm";
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string | null;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

type DialogRequest = FormRequest | ConfirmRequest;

export type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

let pushDialog: ((request: DialogRequest) => void) | null = null;
let pushToast: ((message: string, tone: ToastTone) => void) | null = null;

/** Muestra un formulario modal. Devuelve los valores o `null` si se cancela. */
export function askForm(options: {
  title: string;
  message?: string;
  fields: FormField[];
  confirmLabel?: string;
}): Promise<Record<string, string> | null> {
  return new Promise((resolve) => {
    if (!pushDialog) {
      resolve(null);
      return;
    }
    pushDialog({ kind: "form", ...options, resolve });
  });
}

/** Pide un único texto. Devuelve `null` si se cancela. */
export async function askText(options: {
  title: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
}): Promise<string | null> {
  const values = await askForm({
    title: options.title,
    confirmLabel: options.confirmLabel,
    fields: [
      {
        name: "value",
        label: options.label,
        defaultValue: options.defaultValue,
        placeholder: options.placeholder,
      },
    ],
  });
  return values ? values.value : null;
}

/** Pide confirmación al usuario. */
export function askConfirm(options: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!pushDialog) {
      resolve(false);
      return;
    }
    pushDialog({ kind: "confirm", ...options, resolve });
  });
}

/** Muestra un mensaje informativo con un único botón "Entendido". */
export function showMessage(title: string, message: string): Promise<void> {
  return new Promise((resolve) => {
    if (!pushDialog) {
      resolve();
      return;
    }
    pushDialog({
      kind: "confirm",
      title,
      message,
      confirmLabel: "Entendido",
      cancelLabel: null,
      resolve: () => resolve(),
    });
  });
}

/** Aviso breve no bloqueante en la esquina inferior. */
export function toast(message: string, tone: ToastTone = "success"): void {
  pushToast?.(message, tone);
}

const FormDialog: React.FC<{ request: FormRequest; onDone: () => void }> = ({
  request,
  onDone,
}) => {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(request.fields.map((f) => [f.name, f.defaultValue ?? ""]))
  );
  const firstRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const element = firstRef.current;
    if (element) {
      element.focus();
      if (element instanceof HTMLInputElement && element.type !== "color") element.select();
    }
  }, []);

  const finish = (result: Record<string, string> | null) => {
    request.resolve(result);
    onDone();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        finish(values);
      }}
      className="flex flex-col gap-3"
    >
      {request.message && (
        <p className="text-xs text-[#444746] leading-relaxed">{request.message}</p>
      )}
      {request.fields.map((field, index) => {
        const common = {
          value: values[field.name] ?? "",
          onChange: (
            e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
          ) => setValues((prev) => ({ ...prev, [field.name]: e.target.value })),
          className:
            "w-full border border-[#c4c7c5] rounded-md px-2.5 py-1.5 text-sm text-[#1f1f1f] bg-white outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0]",
        };
        return (
          <label key={field.name} className="flex flex-col gap-1 text-xs font-medium text-[#444746]">
            <span>{field.label}</span>
            {field.type === "select" ? (
              <select
                {...common}
                ref={index === 0 ? (el) => void (firstRef.current = el) : undefined}
              >
                {(field.options || []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.type === "textarea" ? (
              <textarea
                {...common}
                rows={4}
                placeholder={field.placeholder}
                ref={index === 0 ? (el) => void (firstRef.current = el) : undefined}
              />
            ) : (
              <input
                {...common}
                type={field.type || "text"}
                min={field.min}
                max={field.max}
                placeholder={field.placeholder}
                className={field.type === "color" ? "w-16 h-8 p-0.5 border border-[#c4c7c5] rounded-md bg-white" : common.className}
                ref={index === 0 ? (el) => void (firstRef.current = el) : undefined}
              />
            )}
          </label>
        );
      })}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={() => finish(null)}
          className="px-4 py-1.5 rounded-full text-xs font-semibold text-[#0b57d0] hover:bg-[#e8f0fe] transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-[#0b57d0] hover:bg-[#0a4cb8] transition-colors"
        >
          {request.confirmLabel || "Aceptar"}
        </button>
      </div>
    </form>
  );
};

export const DialogHost: React.FC = () => {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);

  useEffect(() => {
    pushDialog = (request) => setQueue((prev) => [...prev, request]);
    pushToast = (message, tone) => {
      const id = ++toastId.current;
      setToasts((prev) => [...prev.slice(-3), { id, message, tone }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3500);
    };
    return () => {
      pushDialog = null;
      pushToast = null;
    };
  }, []);

  const current = queue[0];
  const dismiss = () => setQueue((prev) => prev.slice(1));

  const cancelCurrent = () => {
    if (!current) return;
    if (current.kind === "form") current.resolve(null);
    else current.resolve(false);
    dismiss();
  };

  useEffect(() => {
    if (!current) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancelCurrent();
      }
    };
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  });

  return (
    <>
      {current && (
        <div
          className="fixed inset-0 z-[1000000] bg-black/40 flex items-center justify-center p-4 select-none"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) cancelCurrent();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 flex flex-col gap-3 text-[#1f1f1f]"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold leading-snug">{current.title}</h2>
              <button
                type="button"
                onClick={cancelCurrent}
                className="p-1 rounded-full hover:bg-gray-100 text-[#444746] shrink-0"
                title="Cerrar"
              >
                <X size={16} />
              </button>
            </div>

            {current.kind === "form" ? (
              <FormDialog key={queue.length} request={current} onDone={dismiss} />
            ) : (
              <>
                <p className="text-sm text-[#444746] leading-relaxed whitespace-pre-line">
                  {current.message}
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  {current.cancelLabel !== null && (
                    <button
                      type="button"
                      onClick={cancelCurrent}
                      className="px-4 py-1.5 rounded-full text-xs font-semibold text-[#0b57d0] hover:bg-[#e8f0fe] transition-colors"
                    >
                      {current.cancelLabel || "Cancelar"}
                    </button>
                  )}
                  <button
                    type="button"
                    autoFocus
                    onClick={() => {
                      current.resolve(true);
                      dismiss();
                    }}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold text-white transition-colors ${
                      current.danger
                        ? "bg-[#b3261e] hover:bg-[#8c1d18]"
                        : "bg-[#0b57d0] hover:bg-[#0a4cb8]"
                    }`}
                  >
                    {current.confirmLabel || "Aceptar"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[1000001] flex flex-col items-center gap-2 pointer-events-none print:hidden">
        {toasts.map((item) => {
          const Icon =
            item.tone === "error" ? AlertTriangle : item.tone === "info" ? Info : CheckCircle2;
          return (
            <div
              key={item.id}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1f1f1f] text-white text-xs shadow-xl max-w-md"
            >
              <Icon
                size={14}
                className={
                  item.tone === "error"
                    ? "text-[#f2b8b5] shrink-0"
                    : item.tone === "info"
                    ? "text-[#a8c7fa] shrink-0"
                    : "text-[#6dd58c] shrink-0"
                }
              />
              <span>{item.message}</span>
            </div>
          );
        })}
      </div>
    </>
  );
};
