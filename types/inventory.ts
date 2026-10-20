export type InventoryUnit = "g" | "ml" | "each";

export type StockStatus = "ok" | "low" | "out" | "untracked";

export type InventoryReason =
  | "initial"
  | "purchase"
  | "usage"
  | "waste"
  | "adjustment"
  | "scan"
  | "order_deduction"
  | "order_reversal";

export type InventorySource = "manual" | "menu_scan" | "inventory_scan";

export interface InventoryItem {
  id: string;
  org_id: string;
  name: string;
  normalized_name: string;
  category: string | null;
  base_unit: InventoryUnit;
  quantity_on_hand: number;
  par_level: number | null;
  low_stock_percent: number;
  unit_cost: number | null;
  storage_location: string | null;
  track_stock: boolean;
  ai_estimated: boolean;
  source: InventorySource;
  archived: boolean;
  archived_at: string | null;
  archived_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryAlias {
  id: string;
  org_id: string;
  inventory_item_id: string;
  alias: string;
  normalized_alias: string;
  created_at: string;
}

export interface MenuItemIngredient {
  id: string;
  org_id: string;
  menu_item_id: string;
  inventory_item_id: string;
  quantity: number;
  ai_estimated: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryTransaction {
  id: string;
  org_id: string;
  inventory_item_id: string;
  delta: number;
  balance_after: number;
  reason: InventoryReason;
  reference_type: string | null;
  reference_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export type InventoryNotificationType = "low" | "out";
export type InventoryNotificationStatus = "unread" | "read" | "resolved" | "cleared";

export interface InventoryNotification {
  id: string;
  org_id: string;
  inventory_item_id: string | null;
  type: InventoryNotificationType;
  title: string;
  body: string | null;
  status: InventoryNotificationStatus;
  created_at: string;
  read_at: string | null;
  resolved_at: string | null;
  cleared_at: string | null;
  cleared_by: string | null;
}

export interface IngredientEstimate {
  name: string;
  quantity: number;
  unit: InventoryUnit;
  par_level?: number | null;
  storage?: string | null;
  confidence?: "low" | "medium" | "high";
  track_stock?: boolean;
}

export interface InventoryScanLine {
  name: string;
  quantity: number;
  unit: string;
  par_level?: number | null;
  unit_price?: number | null;
  total_price?: number | null;
  category?: string | null;
  supplier?: string | null;
  expiry_date?: string | null;
  confidence?: "low" | "medium" | "high";
  matched_item_id?: string | null;
  matched_name?: string | null;
  create_new?: boolean;
}

export interface InventoryScanPreview {
  document_type?: string | null;
  currency?: string | null;
  lines: InventoryScanLine[];
}

export interface InventoryBadgeCounts {
  unreadNotifications: number;
  lowStock: number;
  outOfStock: number;
}
