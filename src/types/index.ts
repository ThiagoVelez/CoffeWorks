// Definiciones de tipos para el launcher de CoffeWorks

export interface SuiteApp {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  version: string;
  installed: boolean;
  size_mb: number;
  status: string;
  color_badge: "primary" | "secondary" | "tertiary" | "tertiary-fixed" | "secondary-fixed" | "outline";
  icon_name: string;
  icon_url?: string;
}

export interface RecentDocument {
  id: string;
  name: string;
  app_id: string;
  category: string;
  last_modified: string;
  is_pinned: boolean;
  path: string;
}

export type DocumentFilter = "all" | "documents" | "spreadsheets" | "presentations" | "pinned";

export interface WorkspaceProfile {
  name: string;
  team: string;
}
