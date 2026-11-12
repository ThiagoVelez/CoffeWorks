// Red de seguridad de la interfaz: si un componente falla, en lugar de dejar
// la ventana en blanco (y sin botones de ventana que funcionen) se muestra una
// pantalla de recuperación. Los documentos ya están guardados en disco por el
// autoguardado, así que recargar es seguro.

import React from "react";
import { AlertTriangle, RotateCcw, Minus, Square, X } from "lucide-react";
import { appWindow } from "./desktop";

interface ErrorBoundaryProps {
  appName: string;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("Error en la interfaz:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const button =
      "w-8 h-8 flex items-center justify-center rounded text-[#444746] hover:bg-gray-200 transition-colors";
    return (
      <div className="fixed inset-0 flex flex-col bg-[#f9fbfd] text-[#1f1f1f] select-none">
        <header data-tauri-drag-region className="h-10 flex items-center justify-between px-3 border-b border-[#e1dfdd]">
          <span data-tauri-drag-region className="text-xs font-semibold">
            {this.props.appName}
          </span>
          <div className="flex items-center">
            <button type="button" title="Minimizar" className={button} onClick={() => void appWindow.minimize()}>
              <Minus size={14} />
            </button>
            <button type="button" title="Maximizar / Restaurar" className={button} onClick={() => void appWindow.toggleMaximize()}>
              <Square size={12} />
            </button>
            <button
              type="button"
              title="Cerrar"
              className={`${button} hover:!bg-red-500 hover:text-white`}
              onClick={() => void appWindow.close()}
            >
              <X size={14} />
            </button>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl border border-[#e1dfdd] shadow-sm p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-[#b3261e] shrink-0" size={24} />
              <h1 className="text-base font-semibold">{this.props.appName} encontró un problema</h1>
            </div>
            <p className="text-sm text-[#444746] leading-relaxed">
              La ventana se recuperó de un error inesperado. Tus cambios se guardan automáticamente; al recargar
              podrás volver a abrir el documento desde la lista de recientes.
            </p>
            <pre className="text-[11px] font-mono bg-[#f1f3f4] rounded-lg p-3 max-h-32 overflow-auto whitespace-pre-wrap select-text">
              {error.message}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="self-end flex items-center gap-2 px-4 py-2 rounded-full bg-[#0b57d0] hover:bg-[#0a4cb8] text-white text-sm font-semibold"
            >
              <RotateCcw size={15} />
              Recargar
            </button>
          </div>
        </div>
      </div>
    );
  }
}
