import type { Product } from '../types';
import type { CategoryNode } from './categoryTree';

export interface CategorySection {
  key: string;
  name: string;
  items: Product[];
  isOther: boolean;
}

export const otherKey = (parentId: string) => `other:${parentId}`;

const norm = (s: string | null | undefined) => (s || '').trim().toLowerCase();

export function productMatchesSearch(p: Product, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q);
}

// Main categories that have subcategories AND still have products sitting
// directly in them (these get an "Other <main>" custom section).
export function parentsWithDirectProducts(products: Product[], tree: CategoryNode[]): Set<string> {
  const names = new Set(products.map((p) => norm(p.category)));
  const ids = new Set<string>();
  for (const parent of tree) {
    if (parent.children.length > 0 && names.has(norm(parent.name))) ids.add(parent.id);
  }
  return ids;
}

export function buildSections(
  products: Product[],
  tree: CategoryNode[],
  selectedParent: string | null,
  selectedLeaf: string | null,
  search: string
): CategorySection[] {
  const visible = products.filter((p) => productMatchesSearch(p, search));

  const byCategory = new Map<string, Product[]>();
  for (const p of visible) {
    const key = norm(p.category);
    const list = byCategory.get(key);
    if (list) list.push(p);
    else byCategory.set(key, [p]);
  }
  const itemsFor = (name: string) =>
    [...(byCategory.get(norm(name)) || [])].sort((a, b) => a.name.localeCompare(b.name));

  const known = new Set<string>();
  for (const parent of tree) {
    known.add(norm(parent.name));
    for (const child of parent.children) known.add(norm(child.name));
  }

  let sections: CategorySection[] = [];
  for (const parent of tree) {
    if (selectedParent && parent.id !== selectedParent) continue;

    if (parent.children.length === 0) {
      sections.push({ key: parent.id, name: parent.name, items: itemsFor(parent.name), isOther: false });
    } else {
      for (const child of parent.children) {
        sections.push({ key: child.id, name: child.name, items: itemsFor(child.name), isOther: false });
      }
      sections.push({
        key: otherKey(parent.id),
        name: `Other ${parent.name}`,
        items: itemsFor(parent.name),
        isOther: true,
      });
    }
  }

  if (selectedLeaf) sections = sections.filter((s) => s.key === selectedLeaf);
  sections = sections.filter((s) => s.items.length > 0);

  if (!selectedParent && !selectedLeaf) {
    const uncategorized = visible
      .filter((p) => !known.has(norm(p.category)))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (uncategorized.length > 0) {
      sections.push({ key: 'uncategorized', name: 'Uncategorized', items: uncategorized, isOther: true });
    }
  }

  return sections;
}