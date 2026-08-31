/**
 * Structured settings for restaurant frontend customization.
 * Stored in restaurant_customizations.settings as JSONB.
 * 
 * INVARIANTS:
 * - Menu, cart, and booking elements must ALWAYS remain present and functional
 * - Only reposition or restyle — never remove or break these elements
 */

export type MenuPosition = 'left' | 'right' | 'top' | 'bottom';
export type CartPosition = 'top-right' | 'bottom-right' | 'floating-bottom' | 'sidebar';
export type BookingPosition = 'inline' | 'modal' | 'sidebar' | 'hero-section';

export interface RestaurantSettings {
  // Layout positions
  menuPosition?: MenuPosition;
  cartPosition?: CartPosition;
  bookingPosition?: BookingPosition;

  // Styling
  primaryColor?: string;       // Main background/brand color (hex)
  accentColor?: string;        // Highlight/CTA color (hex)
  textColor?: string;          // Primary text color (hex)
  fontFamily?: string;         // e.g., 'Inter', 'Playfair Display'

  // Custom CSS (advanced — use sparingly)
  customCss?: string;

  // Layout variants
  layoutVariant?: 'default' | 'centered' | 'split' | 'fullwidth';

  // Component visibility (NEVER set to false for core elements)
  showMenu?: boolean;          // Always true in practice
  showCart?: boolean;          // Always true in practice
  showBooking?: boolean;       // Always true in practice

  // Versioning for conflict detection
  version?: number;
}

/**
 * A customization request submitted by a restaurant owner.
 * Stored in customization_requests table.
 */
export interface CustomizationRequest {
  id: string;
  org_id: string;
  requested_changes: Partial<RestaurantSettings>;
  proposed_settings: RestaurantSettings;
  description?: string;        // Human-readable description of the change
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  approved_at?: string;
}

/**
 * The payload sent to the subagent for generating layout changes.
 */
export interface LayoutChangeRequest {
  orgId: string;
  orgSlug: string;
  orgName: string;
  currentSettings: RestaurantSettings;
  proposedSettings: RestaurantSettings;
  userRequest: string;         // Raw text from owner
}

/**
 * The subagent's response after processing a layout change.
 */
export interface LayoutChangeResponse {
  success: boolean;
  description: string;         // Plain-language description for owner
  previewHtml?: string;        // HTML preview of the proposed layout
  fileChanges?: FileChange[];  // Code changes to apply
  error?: string;
}

export interface FileChange {
  path: string;
  type: 'create' | 'modify' | 'delete';
  patch?: string;              // Unified diff for modify
  content?: string;            // Full content for create
}

/**
 * Default settings for a new restaurant.
 */
export const DEFAULT_SETTINGS: RestaurantSettings = {
  menuPosition: 'right',
  cartPosition: 'top-right',
  bookingPosition: 'inline',
  primaryColor: '#141414',
  accentColor: '#f97316',
  textColor: '#f5f5f4',
  fontFamily: 'Inter',
  layoutVariant: 'default',
  showMenu: true,
  showCart: true,
  showBooking: true,
  version: 1,
};
