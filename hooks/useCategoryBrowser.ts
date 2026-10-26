import { useMemo, useState } from 'react';
import type { Category, Product } from '../types';
import { buildCategoryTree, type CategoryNode } from '../lib/categoryTree';
import { buildSections, parentsWithDirectProducts } from '../lib/categorySections';

export function useCategoryBrowser(products: Product[], categoryList: Category[]) {
  const [search, setSearch] = useState('');
  const [selectedParent, setSelectedParent] = useState<string | null>(null);
  const [selectedLeaf, setSelectedLeaf] = useState<string | null>(null);

  const tree = useMemo<CategoryNode[]>(() => buildCategoryTree(categoryList), [categoryList]);
  const activeParent = useMemo(
    () => tree.find((p) => p.id === selectedParent) || null,
    [tree, selectedParent]
  );
  const otherParentIds = useMemo(() => parentsWithDirectProducts(products, tree), [products, tree]);
  const sections = useMemo(
    () => buildSections(products, tree, selectedParent, selectedLeaf, search),
    [products, tree, selectedParent, selectedLeaf, search]
  );
  const totalCount = useMemo(() => sections.reduce((n, s) => n + s.items.length, 0), [sections]);

  const selectAll = () => {
    setSelectedParent(null);
    setSelectedLeaf(null);
  };
  const selectParent = (id: string) => {
    setSelectedParent(id);
    setSelectedLeaf(null);
  };
  const selectLeaf = (key: string | null) => setSelectedLeaf(key);

  return {
    search,
    setSearch,
    tree,
    selectedParent,
    selectedLeaf,
    activeParent,
    otherParentIds,
    sections,
    totalCount,
    selectAll,
    selectParent,
    selectLeaf,
  };
}