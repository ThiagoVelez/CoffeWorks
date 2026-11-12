// Definiciones de tipos para el Launcher de CoffeeWorks

export interface SuiteApp {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  version: string;
  installed: boolean;
  /** El paquete está presente y la aplicación puede instalarse. */
  available: boolean;
  size_mb: number;
  status: string;
  color_badge: string;
  icon_name: string;
  icon_url?: string;
  category?: string;
  install_path?: string;
}

export interface RecentDocument {
  id: string;
  name: string;
  app_id: string;
  category: string;
  last_modified: string;
  is_pinned: boolean;
  path: string;
  updated_at?: number;
}

export type DocumentFilter = "all" | "documents" | "spreadsheets" | "presentations" | "pdf" | "notes" | "videos" | "databases" | "designs" | "art" | "pinned";

export interface SuiteInfo {
  version: string;
  stage: string;
  vault_dir: string;
  apps_dir: string;
  data_dir: string;
  packages_dir: string;
  webview_version: string;
  platform: string;
}

/** Complemento opcional de la suite (Launcher › Complementos). */
export interface AddonInfo {
  id: string;
  name: string;
  summary: string;
  description: string;
  apps: string[];
  version: string;
  download_size: string;
  publisher: string;
  license: string;
  installed: boolean;
  installed_bytes: number;
  can_install: boolean;
  manual_hint: string;
}

/** Estado de las actualizaciones automáticas. */
export interface UpdateInfo {
  current: string;
  stage: string;
  supported: boolean;
  auto_install: boolean;
  last_check: number;
  latest: string;
  notes: string;
  url: string;
  size: number;
  ready: boolean;
}
