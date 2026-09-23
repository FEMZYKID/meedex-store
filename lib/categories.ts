import type { Product, Category } from '../types';

// The one, canonical filter+sort used by both the POS page and the admin
// inventory list. Previously each page had its own copy, and they'd already
// drifted apart: the admin version matched category names case-insensitively,
// the POS version didn't — meaning a casing mismatch anywhere could make POS
// silently hide a product that admin would still show. This is the
// case-insensitive (correct) version, now used by both.
export function filterAndSortProducts(
  products: Product[],
  categoryList: Category[],
  selectedCategory: string,
  searchQuery: string
): Product[] {
  return products
    .filter((p) => {
      const matchesCategory =
        selectedCategory === 'All' || (p.category || '').toLowerCase() === selectedCategory.toLowerCase();

      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query || p.name.toLowerCase().includes(query) || (p.sku || '').toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      if (selectedCategory === 'All') {
        const categoryOrderMap = new Map(categoryList.map((cat, idx) => [cat.name.toLowerCase(), idx]));
        const catA = (a.category || '').toLowerCase();
        const catB = (b.category || '').toLowerCase();

        const orderA = categoryOrderMap.has(catA) ? categoryOrderMap.get(catA)! : 9999;
        const orderB = categoryOrderMap.has(catB) ? categoryOrderMap.get(catB)! : 9999;

        if (orderA !== orderB) {
          return orderA - orderB;
        }
      }
      return a.name.localeCompare(b.name);
    });
}

// Builds the POS page's pill list: known categories in their admin-defined
// order, plus a safety net pill for any product category that isn't in the
// categories table yet (e.g. set directly in the DB), so nothing silently
// becomes unreachable. Admin's own pill bar intentionally does NOT do this
// (it renders strictly from the managed category list) — that's a real
// design difference between the two pages, kept as-is, not merged away.
export function buildCategoryPillList(categoryList: Category[], products: Product[]): string[] {
  const knownCategoryNames = categoryList.map((c) => c.name);
  const uncategorizedInUse = Array.from(
    new Set(products.map((p) => p.category || 'General').filter(Boolean))
  ).filter((name) => !knownCategoryNames.includes(name));
  return ['All', ...knownCategoryNames, ...uncategorizedInUse];
}