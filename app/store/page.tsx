'use client';

import { useState, useEffect, useMemo } from 'react';
import { useProducts } from '../../hooks/useProducts';
import { useCategories } from '../../hooks/useCategories';
import { useCart } from '../../contexts/CartContext';
import { buildCategoryTree, buildLeafOrder } from '../../lib/categoryTree';
import CartDrawer from '../../components/CartDrawer';
import type { Product } from '../../types';

function ProductCard({ product, onAdd }: { product: Product; onAdd: (p: Product) => void }) {
  const displayPrice = product.price ?? product.unit_price ?? 0;
  const currentStock = product.stock_quantity ?? product.stock_qty ?? 0;
  const inStock = currentStock > 0;

  return (
    <div className="bg-white border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between">
      <div className="p-3">
        <div className="w-full h-36 bg-gray-100 rounded flex items-center justify-center overflow-hidden mb-3">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="object-cover h-full w-full" />
          ) : (
            <span className="text-gray-400 text-xs">No Image</span>
          )}
        </div>
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{product.category || 'General'}</p>
        <h3 className="font-semibold text-gray-800 text-sm line-clamp-2 h-10">{product.name}</h3>
        <p className="text-indigo-900 font-extrabold text-base mt-2">₦{displayPrice.toLocaleString()}</p>
      </div>

      <div className="p-3 border-t bg-gray-50">
        <button
          onClick={() => onAdd({ ...product, price: displayPrice })}
          disabled={!inStock}
          className={`w-full py-2 rounded text-xs font-bold transition ${
            inStock ? 'bg-amber-500 hover:bg-amber-600 text-slate-900' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {inStock ? 'Add to Cart' : 'Out of Stock'}
        </button>
      </div>
    </div>
  );
}

export default function StorefrontPage() {
  const { products, loadingProducts, fetchProducts } = useProducts();
  const { categoryList, fetchCategories } = useCategories();
  const { addToCart, totalItems } = useCart();

  const [search, setSearch] = useState('');
  const [selectedParent, setSelectedParent] = useState<string | null>(null); // top-level category id, null = 'All'
  const [selectedLeaf, setSelectedLeaf] = useState<string | null>(null); // specific category name to filter to
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categoryTree = useMemo(() => buildCategoryTree(categoryList), [categoryList]);
  const leafOrder = useMemo(() => buildLeafOrder(categoryList), [categoryList]);
  const activeParent = categoryTree.find((p) => p.id === selectedParent) || null;

  const searchFiltered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter((p) => p.name.toLowerCase().includes(query) || (p.sku || '').toLowerCase().includes(query));
  }, [products, search]);

  // Sections: one per leaf category, in admin-defined order, each holding
  // just the products tagged with that exact category name. Empty
  // categories are skipped so we never render a heading with nothing under it.
  const sections = useMemo(() => {
    let leaves = leafOrder;
    if (selectedLeaf) {
      leaves = leaves.filter((l) => l.name === selectedLeaf);
    } else if (activeParent) {
      leaves = activeParent.children.length > 0 ? activeParent.children : [activeParent];
    }

    const known = new Set(leaves.map((l) => l.name.toLowerCase()));
    const result = leaves
      .map((leaf) => ({
        name: leaf.name,
        items: searchFiltered.filter((p) => (p.category || '').toLowerCase() === leaf.name.toLowerCase()),
      }))
      .filter((s) => s.items.length > 0);

    // Products whose category isn't in the managed list at all (e.g. set
    // directly in the DB) shouldn't just vanish — group them at the end
    // under "Other", but only when browsing everything unfiltered.
    if (!selectedLeaf && !activeParent) {
      const uncategorized = searchFiltered.filter((p) => !known.has((p.category || '').toLowerCase()));
      if (uncategorized.length > 0) result.push({ name: 'Other', items: uncategorized });
    }

    return result;
  }, [leafOrder, selectedLeaf, activeParent, searchFiltered]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <header className="sticky top-0 z-40 bg-indigo-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <span className="text-xl font-extrabold tracking-wide">MEEDEX STORE</span>

          <div className="flex-1 max-w-xl mx-2">
            <input
              type="text"
              placeholder="Search products, brands, categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 text-gray-900 rounded-md focus:outline-none bg-white text-sm"
            />
          </div>

          <button
            onClick={() => setIsCartOpen(true)}
            className="relative bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-4 py-2 rounded-md transition flex items-center gap-2 text-sm"
          >
            🛒 Cart
            {totalItems > 0 && (
              <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full font-extrabold">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </header>

      <section className="bg-gradient-to-r from-indigo-800 to-indigo-600 text-white py-8 px-4 text-center">
        <h2 className="text-2xl md:text-3xl font-extrabold mb-2">Quality Gadgets at Unbeatable Prices</h2>
        <p className="text-indigo-100 text-xs md:text-sm max-w-md mx-auto">
          Instant online checkout powered by Paystack with live stock availability.
        </p>
      </section>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {/* Top-level category chips */}
        <div className="flex gap-2 overflow-x-auto pb-3 border-b border-gray-200">
          <button
            onClick={() => {
              setSelectedParent(null);
              setSelectedLeaf(null);
            }}
            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              !selectedParent && !selectedLeaf
                ? 'bg-amber-500 text-slate-900 shadow-sm'
                : 'bg-white text-gray-700 hover:bg-gray-200 border'
            }`}
          >
            All
          </button>
          {categoryTree.map((parent) => (
            <button
              key={parent.id}
              onClick={() => {
                setSelectedParent(parent.id);
                setSelectedLeaf(parent.children.length > 0 ? null : parent.name);
              }}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                selectedParent === parent.id
                  ? 'bg-amber-500 text-slate-900 shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-200 border'
              }`}
            >
              {parent.name}
            </button>
          ))}
        </div>

        {/* Subcategory chips — only when a parent with children is active */}
        {activeParent && activeParent.children.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pt-3 pb-4 mb-2">
            <button
              onClick={() => setSelectedLeaf(null)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition ${
                !selectedLeaf ? 'bg-indigo-800 text-white' : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
              }`}
            >
              All {activeParent.name}
            </button>
            {activeParent.children.map((child) => (
              <button
                key={child.id}
                onClick={() => setSelectedLeaf(child.name)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition ${
                  selectedLeaf === child.name
                    ? 'bg-indigo-800 text-white'
                    : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
                }`}
              >
                {child.name}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4">
          {loadingProducts ? (
            <div className="text-center py-20 text-gray-500 font-medium">Loading catalog...</div>
          ) : sections.length === 0 ? (
            <div className="text-center py-20 text-gray-500 font-medium">No products found.</div>
          ) : (
            <div className="space-y-10">
              {sections.map((section) => (
                <div key={section.name}>
                  <h2 className="text-lg font-bold text-gray-800 mb-3 pb-2 border-b-2 border-amber-500 inline-block">
                    {section.name}
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-3">
                    {section.items.map((product) => (
                      <ProductCard key={product.id} product={product} onAdd={addToCart} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
}