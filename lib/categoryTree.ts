import type { Category } from '../types';

export interface CategoryNode extends Category {
  children: Category[];
}

// Builds a two-level tree: top-level categories (parent_id is null), each
// carrying its own children (sorted by sort_order). Categories are limited
// to two levels on purpose — a child cannot itself have children — so this
// never needs to recurse.
export function buildCategoryTree(categoryList: Category[]): CategoryNode[] {
  const topLevel = categoryList
    .filter((c) => !c.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order);

  return topLevel.map((parent) => ({
    ...parent,
    children: categoryList
      .filter((c) => c.parent_id === parent.id)
      .sort((a, b) => a.sort_order - b.sort_order),
  }));
}

// The order products should be grouped in on the storefront homepage: for
// each top-level category (in order), its children in order if it has any,
// otherwise the top-level category itself (it's acting as its own leaf).
export function buildLeafOrder(categoryList: Category[]): Category[] {
  const tree = buildCategoryTree(categoryList);
  const leaves: Category[] = [];
  for (const parent of tree) {
    if (parent.children.length > 0) {
      leaves.push(...parent.children);
    } else {
      leaves.push(parent);
    }
  }
  return leaves;
}