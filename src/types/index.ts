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

export type DocumentFilter = "all" | "documents" | "spreadsheets" | "presentations" | "pdf" | "notes" | "videos" | "pinned";

export interface SuiteInfo {
  version: string;
  vault_dir: string;
  apps_dir: string;
  data_dir: string;
  packages_dir: string;
  webview_version: string;
  platform: string;
}
