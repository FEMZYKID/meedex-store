// Shared domain types for DEPRINCE POS & Inventory.

export interface Product {
  id: string;
  name: string;
  sku: string;
  category?: string;
  unit_price: number;
  price?: number; // Alias for unit_price (used in online storefront)
  is_splittable: boolean;
  adapter_price?: number;
  cable_price?: number;
  stock_adapter?: number | null;
  stock_cable?: number | null;
  stock_qty?: number | null;
  stock_quantity?: number | null; // Alias for stock_qty (used in online storefront)
  image_url?: string;
}

// Unified CartItem satisfying strict POS requirements and Storefront compatibility
export interface CartItem {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  item_type: 'Full Unit' | 'Adapter' | 'Cable';
  unit_price: number;
  price?: number; // Optional for storefront access
  quantity: number;
  subtotal: number;
  image_url?: string;
}

export interface SaleItem {
  id: string;
  product_id?: string;
  item_name: string;
  item_type: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  sku?: string;
  image_url?: string;
  products?: {
    sku?: string;
    image_url?: string;
  } | null;
}

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