import type { Product } from '../types';

export function buildProductSkuMap(products: Product[]): Map<string, string> {
  const map = new Map<string, string>();
  products.forEach((p) => {
    map.set(p.id, p.sku);
    map.set(p.name.toLowerCase(), p.sku);
  });
  return map;
}

export function buildProductPriceMap(products: Product[]): Map<string, number> {
  const map = new Map<string, number>();
  products.forEach((p) => {
    map.set(p.id, p.unit_price);
    map.set(p.name.toLowerCase(), p.unit_price);
  });
  return map;
}

export function getItemSKU(
  item: { product_id?: string; product_name?: string; item_name?: string; sku?: string },
  productSkuMap: Map<string, string>
): string {
  if (item.sku) return item.sku;
  if (item.product_id && productSkuMap.has(item.product_id)) return productSkuMap.get(item.product_id)!;
  const name = item.product_name || item.item_name;
  if (name && productSkuMap.has(name.toLowerCase())) return productSkuMap.get(name.toLowerCase())!;
  return 'N/A';
}