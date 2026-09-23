import type { Product } from '../types';

// For a splittable product, "Full Unit" availability is capped by whichever
// of adapter/cable stock is lower (selling a full unit consumes one of each).
export function getAvailableStock(product: Product, type: 'Full Unit' | 'Adapter' | 'Cable'): number {
  if (type === 'Adapter') return product.stock_adapter || 0;
  if (type === 'Cable') return product.stock_cable || 0;
  if (product.is_splittable) {
    return Math.min(product.stock_adapter || 0, product.stock_cable || 0);
  }
  return product.stock_qty || 0;
}