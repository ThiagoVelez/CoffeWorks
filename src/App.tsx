import React, { useState, useEffect } from "react";
import { TitleBar } from "./components/TitleBar";
import { Sidebar, type NavTab } from "./components/Sidebar";
import { WelcomeBanner } from "./components/WelcomeBanner";
import { AppGrid } from "./components/AppGrid";
import { CommandPalette } from "./components/CommandPalette";
import { CreateDocModal } from "./components/CreateDocModal";
import { tauriBridge } from "./services/tauriBridge";
import type { SuiteApp, RecentDocument } from "./types";
import { LayoutTemplate, GitFork, Settings, CheckCircle2 } from "lucide-react";

export const App: React.FC = () => {
  const [apps, setApps] = useState<SuiteApp[]>([]);
  const [documents, setDocuments] = useState<RecentDocument[]>([]);
  const [focusMode, setFocusMode] = useState<boolean>(true);
  const [currentTab, setCurrentTab] = useState<NavTab>("launcher");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);
  const [createModal, setCreateModal] = useState<{ open: boolean; docType: string }>({
    open: false,
    docType: "coffedoc",
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filtrado de aplicaciones según la categoría seleccionada en el acordeón de Coffee Apps
  const filteredApps = selectedCategory
    ? apps.filter(
        (app) => (app.category || "Office").toLowerCase() === selectedCategory.toLowerCase()
      )
    : apps;

  // Cargar datos iniciales y sincronizar en tiempo real
  useEffect(() => {
    const refreshData = async () => {
      const [loadedApps, loadedDocs] = await Promise.all([
        tauriBridge.getSuiteApps(),
        tauriBridge.getRecentDocuments(),
      ]);
      setApps(loadedApps);
      setDocuments(loadedDocs);
    };

    refreshData();

    // Sincronizar automáticamente cuando el usuario regresa a la pestaña del Launcher
    window.addEventListener("focus", refreshData);
    const interval = setInterval(refreshData, 2500);

    return () => {
      window.removeEventListener("focus", refreshData);
      clearInterval(interval);
    };
  }, []);

  // Atajo global Ctrl+K o Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const handleLaunchApp = async (appId: string) => {
    const app = apps.find((a) => a.id === appId);
    const msg = await tauriBridge.launchApp(appId);
    showNotification(`Iniciando ${app?.name || appId}: ${msg}`);
  };

  const handleInstallApp = (appId: string) => {
    setApps((prev) =>
      prev.map((app) =>
        app.id === appId
          ? {
              ...app,
              installed: true,
              version: "v1.0 (Recién instalada)",
              status: `Instalada (${app.size_mb} MB)`,
            }
          : app
      )
    );
    showNotification(`Paquete ${appId} instalado en el almacenamiento local`);
  };

  const handleUninstallApp = (appId: string) => {
    setApps((prev) =>
      prev.map((app) =>
        app.id === appId
          ? {
              ...app,
              installed: false,
              status: `No instalada • v1.0`,
            }
          : app
      )
    );
    showNotification(`Aplicación ${appId} desinstalada de la bóveda local`);
  };

  const handleToggleFocus = async () => {
    const nextState = await tauriBridge.toggleFocusMode();
    setFocusMode(nextState);
    showNotification(nextState ? "Modo Enfoque Activado" : "Modo Enfoque Pausado");
  };

  const handleOpenDoc = (doc: RecentDocument) => {
    if (doc.app_id === "coffedoc") {
      window.open("http://localhost:1421", "_blank");
      showNotification(`Abriendo documento ${doc.name} en CoffeDoc`);
      return;
    }
    if (doc.app_id === "coffecalc" || doc.app_id === "coffesheet") {
      window.open("http://localhost:1422", "_blank");
      showNotification(`Abriendo hoja de cálculo ${doc.name} en CoffeCalc`);
      return;
    }
    if (doc.app_id === "coffeview" || doc.app_id === "coffeslides" || doc.name.toLowerCase().endsWith(".csl")) {
      window.open("http://localhost:1423", "_blank");
      showNotification(`Abriendo presentación ${doc.name} en CoffeView`);
      return;
    }
    showNotification(`Abriendo documento ${doc.name} en ${doc.app_id}`);
  };

  const handleOpenCreateModal = (docType: string) => {
    setCreateModal({ open: true, docType });
  };

  const handleCreateDocument = async (docType: string, title: string) => {
    const newDoc = await tauriBridge.createDocument(docType, title);
    setDocuments((prev) => [newDoc, ...prev]);
    showNotification(`Documento ${newDoc.name} creado con éxito`);
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col antialiased">
      {/* Barra de título de escritorio */}
      <TitleBar onOpenCommandPalette={() => setCommandPaletteOpen(true)} />

      {/* Contenedor principal con barra lateral y área de contenido */}
      <div className="flex flex-1 pt-10">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        {/* Área central desplazable */}
        <main className="flex-1 ml-64 p-5 lg:p-8 flex flex-col gap-8 max-w-7xl">
          {currentTab === "launcher" && (
            <>
              {/* Banner superior de bienvenida y modo enfoque */}
              <WelcomeBanner
                focusMode={focusMode}
                onToggleFocusMode={handleToggleFocus}
                onCreateNewDoc={handleOpenCreateModal}
              />

              {/* Tienda de aplicaciones de la suite CoffeWorks (cuadrícula de 2 columnas) */}
              <AppGrid
                apps={filteredApps}
                selectedCategory={selectedCategory}
                onClearCategory={() => setSelectedCategory(null)}
                onLaunchApp={handleLaunchApp}
                onInstallApp={handleInstallApp}
                onUninstallApp={handleUninstallApp}
              />
            </>
          )}

          {currentTab === "templates" && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <LayoutTemplate size={24} className="text-tertiary" />
                <h1 className="font-display text-2xl font-bold">Plantillas Ejecutivas</h1>
              </div>
              <div className="p-8 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-center font-mono text-xs text-outline">
                Catálogo de más de 45 plantillas locales para CoffeDoc, CoffeSheet y CoffeSlides listo para sincronización.
              </div>
            </div>
          )}

          {currentTab === "integrations" && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <GitFork size={24} className="text-secondary" />
                <h1 className="font-display text-2xl font-bold">Integraciones Locales & P2P</h1>
              </div>
              <div className="p-8 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-center font-mono text-xs text-outline">
                Conectores activos: Repositorio Git local, Bóveda SQLite cifrada y Motor de IA Offline.
              </div>
            </div>
          )}

          {currentTab === "settings" && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <Settings size={24} className="text-outline" />
                <h1 className="font-display text-2xl font-bold">Ajustes de la Suite</h1>
              </div>
              <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-3 font-mono text-xs text-outline">
                <div className="flex justify-between py-2 border-b border-outline-variant/20">
                  <span>Versión de CoffeWorks Launcher:</span>
                  <span className="text-on-surface font-semibold">2.4.0 Pro (Tauri + Rust Core)</span>
                </div>
                <div className="flex justify-between py-2 border-b border-outline-variant/20">
                  <span>Ruta de almacenamiento de Bóveda:</span>
                  <span className="text-on-surface">./vault/</span>
                </div>
                <div className="flex justify-between py-2">
                  <span>Aceleración por Hardware (WebView2):</span>
                  <span className="text-primary font-semibold">Habilitada</span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Paleta de comandos (Ctrl + K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        apps={apps}
        documents={documents}
        onLaunchApp={handleLaunchApp}
        onOpenDoc={handleOpenDoc}
      />

      {/* Modal para crear documento */}
      <CreateDocModal
        isOpen={createModal.open}
        docType={createModal.docType}
        onClose={() => setCreateModal({ open: false, docType: "coffedoc" })}
        onCreate={handleCreateDocument}
      />

      {/* Notificación Toast flotante */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-white border border-[#dfd3c7] text-[#2c1b12] shadow-2xl animate-fade-in font-mono text-xs">
          <CheckCircle2 size={16} className="text-[#6f4e37] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
