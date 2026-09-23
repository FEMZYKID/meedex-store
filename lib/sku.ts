import type { Product } from '../types';

// SKU format: [2 letters of name]-[2 letters of category]-[3-digit serial][1 letter]
// Serial counts existing products already in that category, so it naturally
// increments per category rather than globally.
export function generateSKU(name: string, category: string, products: Product[]): string {
  const cleanName = name.trim().toUpperCase().replace(/[^A-Z0-9\s]/g, '');
  const cleanCat = category.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (!cleanName) return '';

  const namePart = cleanName.slice(0, 2).padEnd(2, 'X');
  const catPart = cleanCat ? cleanCat.slice(0, 2).padEnd(2, 'X') : 'GN';

  const currentCategoryCount =
    products.filter((p) => (p.category || '').trim().toLowerCase() === category.trim().toLowerCase()).length + 1;
  const serialPart = String(currentCategoryCount).padStart(3, '0');

  const words = cleanName.split(/\s+/).filter(Boolean);
  const secondWordPart = words.length > 1 ? words[1].charAt(0) : 'X';

  return `${namePart}-${catPart}-${serialPart}${secondWordPart}`;
}