// Shared domain types for DEPRINCE POS & Inventory.
// Previously these were each declared separately (and slightly inconsistently)
// in both app/page.tsx and app/admin/page.tsx. One source of truth now.

export interface Product {
    id: string;
    name: string;
    sku: string;
    // Admin's version had this optional; POS's version had it required, even
    // though the database column is nullable and both files already guard
    // every read with `product.category || 'General'`. Optional is correct.
    category?: string;
    unit_price: number;
    is_splittable: boolean;
    adapter_price?: number;
    cable_price?: number;
    stock_adapter?: number | null;
    stock_cable?: number | null;
    stock_qty?: number | null;
    image_url?: string;
  }
  
  export interface CartItem {
    id: string;
    product_id: string;
    name: string;
    sku: string;
    item_type: 'Full Unit' | 'Adapter' | 'Cable';
    unit_price: number;
    quantity: number;
    subtotal: number;
  }
  
  export interface SaleItem {
    id: string;
    product_id?: string;
    item_name: string;
    item_type: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    // These three were only on the POS page's copy (used for receipt
    // printing) — kept here so nothing is lost, harmless as optional fields
    // on the admin side where they're simply never populated.
    sku?: string;
    image_url?: string;
    products?: {
      sku?: string;
      image_url?: string;
    } | null;
  }
  
  // Was two identical interfaces under two different names (Sale in admin,
  // SaleTransaction in the POS page). Same shape, so one name going forward.
  export interface Sale {
    id: string;
    total_amount: number;
    payment_method: string;
    cashier_id: string;
    cashier_name: string;
    created_at: string;
    sale_items: SaleItem[];
  }
  
  export interface StaffMember {
    id: string;
    name: string;
    username: string;
    role: 'Admin' | 'Cashier';
    failed_attempts: number;
    lockout_until: string | null;
    is_locked: boolean;
    created_at: string;
  }
  
  export interface AllowedDevice {
    id: string;
    device_name: string;
    status: 'approved' | 'pending' | 'blocked';
    created_at: string;
  }
  
  export interface DamagedItem {
    id: string;
    product_id: string;
    product_name: string;
    item_type: string;
    quantity: number;
    comment: string;
    reported_by: string;
    created_at: string;
    sku?: string;
  }
  
  export interface ReturnedItem {
    id: string;
    sale_id: string;
    product_id: string;
    product_name: string;
    item_type: string;
    quantity: number;
    refund_amount: number;
    reason: string;
    processed_by: string;
    created_at: string;
    sku?: string;
  }
  
  export interface Category {
    id: string;
    name: string;
    sort_order: number;
  }
  
  export interface CurrentUser {
    id: string;
    name: string;
    role: string;
  }