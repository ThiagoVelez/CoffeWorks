import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TitleBar } from "./components/TitleBar";
import { Sidebar, type NavTab } from "./components/Sidebar";
import { WelcomeBanner } from "./components/WelcomeBanner";
import { AppGrid } from "./components/AppGrid";
import { RecentDocuments } from "./components/RecentDocuments";
import { CommandPalette } from "./components/CommandPalette";
import { CreateDocModal } from "./components/CreateDocModal";
import { TemplatesView } from "./components/TemplatesView";
import { AddonsView } from "./components/AddonsView";
import { GamesView } from "./components/GamesView";
import { ThemeSwitch } from "./theme/ThemeSwitch";
import { UpdateBanner, UpdateSettings, useUpdates } from "./components/Updates";
import { McpSettings } from "./components/McpSettings";
import { APP_STAGE, APP_VERSION } from "./version";
import { isTauri, tauriBridge } from "./services/tauriBridge";
import type { RecentDocument, SuiteApp, SuiteInfo } from "./types";
import { Settings, FolderOpen } from "lucide-react";

interface Toast {
  message: string;
  isError: boolean;
}

export const App: React.FC = () => {
  const [apps, setApps] = useState<SuiteApp[]>([]);
  const [documents, setDocuments] = useState<RecentDocument[]>([]);
  const [suiteInfo, setSuiteInfo] = useState<SuiteInfo | null>(null);
  const [focusMode, setFocusMode] = useState<boolean>(() => tauriBridge.getFocusMode());
  // Menú lateral plegable (sólo iconos); se recuerda entre sesiones
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("coffeeworks_sidebar_collapsed") === "1";
    } catch {
      return false;
    }
  });
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      try {
        localStorage.setItem("coffeeworks_sidebar_collapsed", prev ? "0" : "1");
      } catch {
        /* sin almacenamiento */
      }
      return !prev;
    });
  }, []);
  const [currentTab, setCurrentTab] = useState<NavTab>("launcher");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [createModal, setCreateModal] = useState<{ open: boolean; docType: string }>({
    open: false,
    docType: "coffeedoc",
  });
  const [toast, setToast] = useState<Toast | null>(null);
  const updates = useUpdates();

  const filteredApps = selectedCategory
    ? apps.filter((app) => (app.category || "Office").toLowerCase() === selectedCategory.toLowerCase())
    : apps;

  const showNotification = useCallback((message: string, isError = false) => {
    setToast({ message, isError });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toast.isError ? 6000 : 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const refreshData = useCallback(async () => {
    try {
      const [loadedApps, loadedDocs] = await Promise.all([
        tauriBridge.getSuiteApps(),
        tauriBridge.getRecentDocuments(),
      ]);
      setApps(loadedApps);
      setDocuments(loadedDocs);
    } catch (err) {
      console.error("No se pudo actualizar el Launcher:", err);
    }
  }, []);

  // Datos iniciales y actualización periódica (las apps registran sus documentos)
  useEffect(() => {
    void refreshData();
    void tauriBridge.getSuiteInfo().then(setSuiteInfo).catch(() => setSuiteInfo(null));
    window.addEventListener("focus", refreshData);
    const interval = window.setInterval(refreshData, 3000);
    return () => {
      window.removeEventListener("focus", refreshData);
      window.clearInterval(interval);
    };
  }, [refreshData]);

  // Atajo global Ctrl+K
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

  const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

  /** Tras abrir una app, el modo enfoque minimiza el Launcher. */
  const afterLaunch = () => {
    if (focusMode) void tauriBridge.minimizeWindow();
  };

  const requireInstalled = (appId: string): SuiteApp | null => {
    const app = apps.find((a) => a.id === appId);
    if (app && !app.installed) {
      showNotification(`${app.name} no está instalada. Instálala desde la Tienda de Apps.`, true);
      return null;
    }
    return app || null;
  };

  const handleLaunchApp = async (appId: string) => {
    const app = requireInstalled(appId);
    if (!app) return;
    try {
      await tauriBridge.launchApp(appId);
      showNotification(`Abriendo ${app.name}…`);
      afterLaunch();
    } catch (err) {
      showNotification(errorText(err), true);
    }
  };

  const handleInstallApp = async (appId: string) => {
    const updated = await tauriBridge.installApp(appId);
    setApps((prev) => prev.map((app) => (app.id === appId ? updated : app)));
    showNotification(`${updated.name} instalada correctamente`);
  };

  const handleUninstallApp = async (appId: string) => {
    const updated = await tauriBridge.uninstallApp(appId);
    setApps((prev) => prev.map((app) => (app.id === appId ? updated : app)));
    showNotification(`${updated.name} desinstalada. Tus documentos se conservan.`);
  };

  const handleToggleFocus = () => {
    const next = !focusMode;
    setFocusMode(next);
    tauriBridge.setFocusMode(next);
    showNotification(
      next ? "Modo enfoque activado: el Launcher se minimizará al abrir una app" : "Modo enfoque desactivado"
    );
  };

  const handleOpenDoc = async (doc: RecentDocument) => {
    try {
      await tauriBridge.openDocument(doc);
      showNotification(`Abriendo ${doc.name}…`);
      afterLaunch();
    } catch (err) {
      showNotification(errorText(err), true);
      void refreshData();
    }
  };

  const handleTogglePin = async (id: string) => {
    const next = documents.map((doc) => (doc.id === id ? { ...doc, is_pinned: !doc.is_pinned } : doc));
    setDocuments(next);
    try {
      await tauriBridge.saveDocuments(next);
    } catch (err) {
      showNotification(errorText(err), true);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    const doc = documents.find((d) => d.id === id);
    try {
      setDocuments(await tauriBridge.deleteDocument(id));
      showNotification(`${doc?.name || "Documento"} eliminado de la bóveda`);
    } catch (err) {
      showNotification(errorText(err), true);
    }
  };

  const handleCreateDocument = async (docType: string, title: string) => {
    const app = requireInstalled(docType);
    if (!app) return;
    try {
      await tauriBridge.launchApp(docType, title.trim());
      showNotification(`Creando «${title.trim() || "documento nuevo"}» en ${app.name}…`);
      afterLaunch();
    } catch (err) {
      showNotification(errorText(err), true);
    }
  };

  const handleOpenVault = async () => {
    try {
      await tauriBridge.openVaultFolder();
    } catch (err) {
      showNotification(errorText(err), true);
    }
  };

  const installedCount = apps.filter((app) => app.installed).length;
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const app of apps) counts.set(app.category || "Office", (counts.get(app.category || "Office") || 0) + 1);
    return [...counts].map(([name, count]) => ({ name, count }));
  }, [apps]);
  const infoRows: Array<[string, string]> = suiteInfo
    ? [
        ["Versión de CoffeeWorks", `${suiteInfo.version} ${suiteInfo.stage}`.trim()],
        ["Carpeta de documentos (bóveda)", suiteInfo.vault_dir],
        ["Aplicaciones instaladas en", suiteInfo.apps_dir],
        ["Paquetes de instalación", suiteInfo.packages_dir],
        ["Datos de la suite", suiteInfo.data_dir],
        ["Motor web (WebView)", suiteInfo.webview_version],
        ["Sistema", suiteInfo.platform],
      ]
    : [
        ["Versión de CoffeeWorks", `${APP_VERSION} ${APP_STAGE} (modo web de desarrollo)`],
        ["Documentos", "Se guardan en el almacenamiento de este navegador"],
      ];

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col antialiased">
      <TitleBar
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        version={suiteInfo?.version ?? APP_VERSION}
        stage={suiteInfo ? suiteInfo.stage : APP_STAGE}
        notice={toast}
      />

      <div className="flex flex-1 pt-10">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          appCount={apps.length}
          categories={categories}
          installedCount={installedCount}
          documentCount={documents.length}
          onOpenVault={isTauri ? () => void handleOpenVault() : undefined}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebar}
        />

        <main className={`flex-1 min-w-0 ${sidebarCollapsed ? "ml-[68px]" : "ml-64"} p-5 lg:p-8 flex flex-col gap-8 max-w-7xl transition-[margin] duration-200`}>
          <UpdateBanner info={updates.info} onError={(message) => showNotification(message, true)} />
          {currentTab === "launcher" && (
            <>
              <WelcomeBanner
                focusMode={focusMode}
                onToggleFocusMode={handleToggleFocus}
                installedCount={installedCount}
                appCount={apps.length}
                onCreateNewDoc={() => setCreateModal({ open: true, docType: "coffeedoc" })}
              />

              <AppGrid
                apps={filteredApps}
                selectedCategory={selectedCategory}
                onClearCategory={() => setSelectedCategory(null)}
                onLaunchApp={(id) => void handleLaunchApp(id)}
                onInstallApp={handleInstallApp}
                onUninstallApp={handleUninstallApp}
                onError={(message) => showNotification(message, true)}
                onOpenVault={isTauri ? () => void handleOpenVault() : undefined}
              />

              <RecentDocuments
                documents={documents}
                onOpenDoc={(doc) => void handleOpenDoc(doc)}
                onTogglePinDoc={(id) => void handleTogglePin(id)}
                onDeleteDoc={(id) => void handleDeleteDoc(id)}
                onOpenVault={isTauri ? () => void handleOpenVault() : undefined}
              />
            </>
          )}

          {currentTab === "games" && <GamesView />}

          {currentTab === "templates" && <TemplatesView onNotify={showNotification} />}

          {currentTab === "addons" && (
            <AddonsView apps={apps} onNotify={showNotification} onOpenVault={isTauri ? () => void handleOpenVault() : undefined} />
          )}

          {currentTab === "settings" && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <Settings size={24} className="text-[#6f4e37]" />
                <h1 className="font-display text-2xl font-bold text-[#2c1b12]">Ajustes de la suite</h1>
              </div>

              <div className="p-6 rounded-2xl bg-white border border-[#dfd3c7] flex flex-col font-mono text-xs text-[#795548]">
                {infoRows.map(([label, value], index) => (
                  <div
                    key={label}
                    className={`flex justify-between gap-6 py-2.5 ${index < infoRows.length - 1 ? "border-b border-[#efe6dd]" : ""}`}
                  >
                    <span className="shrink-0">{label}:</span>
                    <span className="text-[#2c1b12] font-semibold text-right break-all select-text">{value}</span>
                  </div>
                ))}
              </div>

              <div className="p-6 rounded-2xl bg-white border border-[#dfd3c7] flex items-center justify-between gap-4 text-xs text-[#5c3a21]" data-appearance>
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-sm text-[#2c1b12]">Apariencia</span>
                  <span>Modo claro u oscuro para el Launcher y las apps de la suite. Las apps de Ilustración son siempre oscuras.</span>
                </div>
                <ThemeSwitch className="text-[#2c1b12] shrink-0" />
              </div>

              <UpdateSettings
                updates={updates}
                version={suiteInfo?.version ?? APP_VERSION}
                stage={suiteInfo ? suiteInfo.stage : APP_STAGE}
                onNotify={showNotification}
              />

              <McpSettings onNotify={showNotification} />

              <div className="p-6 rounded-2xl bg-white border border-[#dfd3c7] flex flex-col gap-4 text-xs text-[#5c3a21]">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={focusMode} onChange={handleToggleFocus} className="mt-0.5" />
                  <span>
                    <span className="font-bold text-[#2c1b12] block">Modo enfoque</span>
                    Minimizar el Launcher automáticamente al abrir una aplicación o un documento.
                  </span>
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {isTauri && (
                    <button
                      type="button"
                      onClick={() => void handleOpenVault()}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#eeddd0] hover:bg-[#6f4e37] hover:text-white text-[#3e2723] font-bold border border-[#dfd3c7] transition-colors"
                    >
                      <FolderOpen size={14} />
                      Abrir la carpeta de documentos
                    </button>
                  )}
                  <span className="font-mono text-[11px] text-[#795548]">
                    {installedCount} de {apps.length} aplicaciones instaladas · {documents.length} documentos recientes
                  </span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        apps={apps}
        documents={documents}
        onLaunchApp={(id) => void handleLaunchApp(id)}
        onOpenDoc={(doc) => void handleOpenDoc(doc)}
      />

      <CreateDocModal
        isOpen={createModal.open}
        docType={createModal.docType}
        onClose={() => setCreateModal({ open: false, docType: "coffeedoc" })}
        onCreate={(docType, title) => void handleCreateDocument(docType, title)}
      />

    </div>
  );
};
