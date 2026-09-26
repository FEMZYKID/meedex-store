'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import ImageUploader from '@/components/ImageUploader';
import CategoryFilterBar from '@/components/CategoryFilterBar';
import CategoryRow from '@/components/CategoryRow';
import { generateSKU } from '../../../lib/sku';
import { filterAndSortProducts } from '../../../lib/categories';
import { buildCategoryTree } from '../../../lib/categoryTree';
import { useProducts } from '../../../hooks/useProducts';
import { useCategories } from '../../../hooks/useCategories';
import type { Product, Category } from '../../../types';

export default function AdminProductsPage() {
  const { products, loadingProducts, fetchProducts } = useProducts();
  const { categoryList, loadingCategories, fetchCategories } = useCategories();

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [savingProduct, setSavingProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    category: '',
    unit_price: '',
    is_splittable: false,
    adapter_price: '',
    cable_price: '',
    stock_adapter: '0',
    stock_cable: '0',
    stock_qty: '0',
    image_url: '',
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [categoryRenameId, setCategoryRenameId] = useState<string | null>(null);
  const [categoryRenameValue, setCategoryRenameValue] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  const handleAddCategory = async (name: string, parentId: string | null = null): Promise<boolean> => {
    const cleanName = name.trim();
    if (!cleanName) return false;

    if (categoryList.some((c) => c.name.toLowerCase() === cleanName.toLowerCase())) {
      alert('That category already exists.');
      return false;
    }

    const siblings = categoryList.filter((c) => (c.parent_id || null) === parentId);
    const nextOrder = siblings.length > 0 ? Math.max(...siblings.map((c) => c.sort_order)) + 1 : 1;

    const { error } = await supabase
      .from('categories')
      .insert([{ name: cleanName, sort_order: nextOrder, parent_id: parentId }]);
    if (error) {
      alert('Error adding category: ' + error.message);
      return false;
    }
    await fetchCategories();
    return true;
  };

  const handleRenameCategory = async (id: string, oldName: string) => {
    const newName = categoryRenameValue.trim();
    if (!newName || newName === oldName) {
      setCategoryRenameId(null);
      return;
    }
    if (categoryList.some((c) => c.id !== id && c.name.toLowerCase() === newName.toLowerCase())) {
      alert('That category name is already in use.');
      return;
    }

    setSavingCategory(true);
    const { error: renameErr } = await supabase.from('categories').update({ name: newName }).eq('id', id);
    if (renameErr) {
      alert('Error renaming category: ' + renameErr.message);
      setSavingCategory(false);
      return;
    }
    const { error: productsErr } = await supabase
      .from('products')
      .update({ category: newName })
      .eq('category', oldName);
    if (productsErr) {
      alert('Category renamed, but some products may not have updated: ' + productsErr.message);
    }

    setCategoryRenameId(null);
    setSavingCategory(false);
    await fetchCategories();
    await fetchProducts();
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    const productsUsingIt = products.filter((p) => p.category === name).length;
    if (productsUsingIt > 0) {
      alert(
        `Can't delete "${name}" — ${productsUsingIt} product(s) still use it. Reassign or rename them first.`
      );
      return;
    }
    const childCount = categoryList.filter((c) => c.parent_id === id).length;
    const warning =
      childCount > 0
        ? `"${name}" has ${childCount} subcategory(ies) under it. Deleting it will NOT delete them — they'll just move back up to become top-level categories. Continue?`
        : `Delete category "${name}"? This can't be undone.`;
    if (!confirm(warning)) return;

    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) alert('Error deleting category: ' + error.message);
    else await fetchCategories();
  };

  // Reordering is scoped to siblings — a category only moves up/down among
  // others that share the same parent (or among other top-level categories
  // if it has none), never across the whole flat list.
  const handleMoveCategory = async (cat: Category, direction: 'up' | 'down') => {
    const siblings = categoryList
      .filter((c) => (c.parent_id || null) === (cat.parent_id || null))
      .sort((a, b) => a.sort_order - b.sort_order);
    const index = siblings.findIndex((c) => c.id === cat.id);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (index === -1 || targetIndex < 0 || targetIndex >= siblings.length) return;

    const current = siblings[index];
    const neighbor = siblings[targetIndex];

    setSavingCategory(true);
    await Promise.all([
      supabase.from('categories').update({ sort_order: neighbor.sort_order }).eq('id', current.id),
      supabase.from('categories').update({ sort_order: current.sort_order }).eq('id', neighbor.id),
    ]);
    setSavingCategory(false);
    await fetchCategories();
  };

  // Moves a category to become a subcategory of `newParentId`, or back to
  // top-level if `newParentId` is null. Placed at the end of its new
  // sibling group. Two-level hierarchy is enforced by the dropdown only
  // ever offering top-level categories (with no children of their own) as
  // a parent choice — see the "Assign to" select below.
  const handleChangeParent = async (catId: string, newParentId: string | null) => {
    const newSiblings = categoryList.filter((c) => (c.parent_id || null) === newParentId && c.id !== catId);
    const nextOrder = newSiblings.length > 0 ? Math.max(...newSiblings.map((c) => c.sort_order)) + 1 : 1;

    setSavingCategory(true);
    const { error } = await supabase
      .from('categories')
      .update({ parent_id: newParentId, sort_order: nextOrder })
      .eq('id', catId);
    setSavingCategory(false);
    if (error) alert('Error moving category: ' + error.message);
    else await fetchCategories();
  };

  const resetProductForm = () => {
    setEditingProductId(null);
    setIsAddingNewCategory(false);
    setNewCategoryInput('');
    setProductForm({
      name: '',
      sku: '',
      category: '',
      unit_price: '',
      is_splittable: false,
      adapter_price: '',
      cable_price: '',
      stock_adapter: '0',
      stock_cable: '0',
      stock_qty: '0',
      image_url: '',
    });
  };

  const handleEditProduct = (product: Product) => {
    setEditingProductId(product.id);
    setIsAddingNewCategory(false);
    setNewCategoryInput('');
    setProductForm({
      name: product.name,
      sku: product.sku || '',
      category: product.category || '',
      unit_price: product.unit_price?.toString() || '',
      is_splittable: product.is_splittable || false,
      adapter_price: product.adapter_price?.toString() || '',
      cable_price: product.cable_price?.toString() || '',
      stock_adapter: product.stock_adapter?.toString() || '0',
      stock_cable: product.stock_cable?.toString() || '0',
      stock_qty: product.stock_qty?.toString() || '0',
      image_url: product.image_url || '',
    });
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProduct(true);

    let finalCategory = productForm.category.trim();
    let finalSku = productForm.sku;
    if (isAddingNewCategory) {
      finalCategory = newCategoryInput.trim();
      if (!finalCategory) {
        alert('Please enter a category name, or cancel adding a new one.');
        setSavingProduct(false);
        return;
      }
      const existing = categoryList.find((c) => c.name.toLowerCase() === finalCategory.toLowerCase());
      if (!existing) {
        const created = await handleAddCategory(finalCategory);
        if (!created) {
          setSavingProduct(false);
          return;
        }
      }
      finalSku = generateSKU(productForm.name, finalCategory, products);
    }

    const payload = {
      name: productForm.name,
      sku: finalSku,
      category: finalCategory || null,
      unit_price: Number(productForm.unit_price) || 0,
      is_splittable: productForm.is_splittable,
      adapter_price: productForm.is_splittable ? Number(productForm.adapter_price) || 0 : null,
      cable_price: productForm.is_splittable ? Number(productForm.cable_price) || 0 : null,
      stock_adapter: productForm.is_splittable ? Number(productForm.stock_adapter) || 0 : null,
      stock_cable: productForm.is_splittable ? Number(productForm.stock_cable) || 0 : null,
      stock_qty: productForm.is_splittable ? null : Number(productForm.stock_qty) || 0,
      image_url: productForm.image_url.trim() || null,
    };

    if (editingProductId) {
      const { error } = await supabase.from('products').update(payload).eq('id', editingProductId);
      if (error) alert('Error updating product: ' + error.message);
      else alert('Product updated!');
    } else {
      const { error } = await supabase.from('products').insert([payload]);
      if (error) alert('Error adding product: ' + error.message);
      else alert('Product added!');
    }

    setSavingProduct(false);
    resetProductForm();
    await fetchProducts();
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) alert('Error deleting product: ' + error.message);
    else await fetchProducts();
  };

  const categoryPillNames = useMemo(() => ['All', ...categoryList.map((c) => c.name)], [categoryList]);
  const categoryTree = useMemo(() => buildCategoryTree(categoryList), [categoryList]);
  // Only top-level categories can be picked as a parent — a category that
  // is itself already a child can't have children of its own, which keeps
  // the hierarchy to two levels, never three. A single parent can still
  // have as many children as you like.
  const possibleParents = useMemo(() => categoryList.filter((c) => !c.parent_id), [categoryList]);

  const filteredProducts = useMemo(() => {
    return filterAndSortProducts(products, categoryList, selectedCategory, searchQuery);
  }, [products, selectedCategory, searchQuery, categoryList]);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="bg-slate-800 border border-slate-700/80 p-5 rounded-2xl h-fit sticky top-6 shadow-xl">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-700">
            <h2 className="text-base font-bold text-white">
              {editingProductId ? 'Edit Product' : 'Add New Product'}
            </h2>
            {editingProductId && (
              <button onClick={resetProductForm} className="text-xs text-rose-400 hover:underline cursor-pointer">
                Cancel Edit
              </button>
            )}
          </div>

          <form onSubmit={handleProductSubmit} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Product Name</label>
              <input
                type="text"
                required
                value={productForm.name}
                onChange={(e) => {
                  const newName = e.target.value;
                  setProductForm((prev) => ({
                    ...prev,
                    name: newName,
                    sku: generateSKU(newName, prev.category, products),
                  }));
                }}
                placeholder="Oraimo Fast Charger 20W"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">SKU / Code (auto-generated)</label>
                <input
                  type="text"
                  readOnly
                  value={productForm.sku}
                  placeholder="Auto-generated from name"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-400 cursor-not-allowed font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 flex items-center justify-between">
                  <span>Category</span>
                  <button
                    type="button"
                    onClick={() => setShowCategoryManager(true)}
                    className="text-cyan-400 hover:underline cursor-pointer text-[11px]"
                  >
                    Manage
                  </button>
                </label>
                {isAddingNewCategory ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      autoFocus
                      value={newCategoryInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewCategoryInput(val);
                        setProductForm((prev) => ({ ...prev, sku: generateSKU(prev.name, val, products) }));
                      }}
                      placeholder="New category name"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingNewCategory(false);
                        setNewCategoryInput('');
                        setProductForm((prev) => ({ ...prev, sku: generateSKU(prev.name, prev.category, products) }));
                      }}
                      className="text-slate-400 hover:text-white px-2 cursor-pointer text-[11px] whitespace-nowrap"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <select
                    value={productForm.category}
                    onChange={(e) => {
                      if (e.target.value === '__add_new__') {
                        setIsAddingNewCategory(true);
                        setNewCategoryInput('');
                      } else {
                        const newCategory = e.target.value;
                        setProductForm((prev) => ({
                          ...prev,
                          category: newCategory,
                          sku: generateSKU(prev.name, newCategory, products),
                        }));
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">— No category —</option>
                    {categoryList.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                    <option value="__add_new__">+ Add new category…</option>
                  </select>
                )}
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Full Unit Price (₦)</label>
              <input
                type="number"
                required
                value={productForm.unit_price}
                onChange={(e) => setProductForm({ ...productForm, unit_price: e.target.value })}
                placeholder="5500"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Product Image</label>
              <ImageUploader
                currentImageUrl={productForm.image_url}
                onUploadSuccess={(url) =>
                  setProductForm((prev) => ({ ...prev, image_url: url }))
                }
              />
            </div>

            <div className="flex items-center gap-2 py-2 border-y border-slate-700/60">
              <input
                type="checkbox"
                id="is_splittable"
                checked={productForm.is_splittable}
                onChange={(e) => setProductForm({ ...productForm, is_splittable: e.target.checked })}
                className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
              />
              <label htmlFor="is_splittable" className="text-slate-300 font-medium cursor-pointer">
                Can be split (Adapter & Cable)
              </label>
            </div>

            {productForm.is_splittable && (
              <div className="grid grid-cols-2 gap-3 bg-slate-900/60 p-3 rounded-lg border border-indigo-500/30">
                <div>
                  <label className="block text-indigo-300 mb-1">Adapter Price (₦)</label>
                  <input
                    type="number"
                    value={productForm.adapter_price}
                    onChange={(e) => setProductForm({ ...productForm, adapter_price: e.target.value })}
                    placeholder="3000"
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-indigo-300 mb-1">Cable Price (₦)</label>
                  <input
                    type="number"
                    value={productForm.cable_price}
                    onChange={(e) => setProductForm({ ...productForm, cable_price: e.target.value })}
                    placeholder="2500"
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
              </div>
            )}

            {productForm.is_splittable ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Adapter Stock</label>
                  <input
                    type="number"
                    required
                    value={productForm.stock_adapter}
                    onChange={(e) => setProductForm({ ...productForm, stock_adapter: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Cable Stock</label>
                  <input
                    type="number"
                    required
                    value={productForm.stock_cable}
                    onChange={(e) => setProductForm({ ...productForm, stock_cable: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-slate-400 mb-1">Stock</label>
                <input
                  type="number"
                  required
                  value={productForm.stock_qty}
                  onChange={(e) => setProductForm({ ...productForm, stock_qty: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={savingProduct}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold py-2.5 rounded-lg transition cursor-pointer"
            >
              {savingProduct ? 'Saving...' : editingProductId ? 'Update Product' : 'Add to Inventory'}
            </button>
          </form>
        </section>

        <section className="lg:col-span-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
            <h2 className="text-base font-bold text-white">
              Inventory Products ({filteredProducts.length})
            </h2>
          </div>

          <CategoryFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            categories={categoryPillNames}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />

          {loadingProducts ? (
            <div className="p-6 text-center text-slate-400 bg-slate-800 rounded-xl">Loading products...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-6 text-center text-slate-500 bg-slate-800/50 border border-slate-800 rounded-xl text-xs">
              No products found matching search or category criteria.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center justify-between gap-4 shadow-md"
                >
                  <div className="flex items-center gap-4">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-14 h-14 object-cover rounded-lg border border-slate-700"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-slate-900 rounded-lg flex items-center justify-center text-slate-500 border border-slate-700">
                        🔌
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-white text-sm">{product.name}</h3>
                        {product.category && (
                          <span className="text-[10px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.5 rounded uppercase">
                            {product.category}
                          </span>
                        )}
                        {product.is_splittable && (
                          <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded">
                            Splittable
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 font-mono">SKU: {product.sku || 'N/A'}</p>
                      <div className="text-xs font-bold text-emerald-400 mt-0.5">
                        ₦{Number(product.unit_price).toLocaleString()}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {product.is_splittable
                          ? `Stock: Adapter (${product.stock_adapter || 0}) | Cable (${product.stock_cable || 0})`
                          : `Stock: ${product.stock_qty || 0}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditProduct(product)}
                      className="bg-slate-700 hover:bg-slate-600 text-cyan-300 text-xs font-medium px-3 py-1.5 rounded transition cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(product.id, product.name)}
                      className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium px-3 py-1.5 rounded transition cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {showCategoryManager && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-md text-white shadow-2xl relative max-h-[85vh] flex flex-col">
            <button
              onClick={() => {
                setShowCategoryManager(false);
                setCategoryRenameId(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white font-bold text-sm cursor-pointer"
            >
              ✕
            </button>
            <h3 className="text-sm font-bold text-white mb-1">Manage Categories</h3>
            <p className="text-[11px] text-slate-400 mb-4">
              Reorder with the arrows, rename, delete, or use the dropdown to group a category under
              another (e.g. nest &quot;Screen Protectors&quot; types under one heading). This order also
              controls the storefront homepage sections and the filter pills here and on the register.
            </p>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {loadingCategories ? (
                <p className="text-xs text-slate-500">Loading…</p>
              ) : categoryTree.length === 0 ? (
                <p className="text-xs text-slate-500">No categories yet.</p>
              ) : (
                categoryTree.map((parent) => (
                  <div key={parent.id} className="space-y-1.5">
                    <CategoryRow
                      cat={parent}
                      indent={false}
                      hasChildren={parent.children.length > 0}
                      categoryList={categoryList}
                      possibleParents={possibleParents}
                      categoryRenameId={categoryRenameId}
                      categoryRenameValue={categoryRenameValue}
                      savingCategory={savingCategory}
                      setCategoryRenameId={setCategoryRenameId}
                      setCategoryRenameValue={setCategoryRenameValue}
                      onMove={handleMoveCategory}
                      onRename={handleRenameCategory}
                      onDelete={handleDeleteCategory}
                      onChangeParent={handleChangeParent}
                    />
                    {parent.children.map((child) => (
                      <CategoryRow
                        key={child.id}
                        cat={child}
                        indent={true}
                        hasChildren={false}
                        categoryList={categoryList}
                        possibleParents={possibleParents}
                        categoryRenameId={categoryRenameId}
                        categoryRenameValue={categoryRenameValue}
                        savingCategory={savingCategory}
                        setCategoryRenameId={setCategoryRenameId}
                        setCategoryRenameValue={setCategoryRenameValue}
                        onMove={handleMoveCategory}
                        onRename={handleRenameCategory}
                        onDelete={handleDeleteCategory}
                        onChangeParent={handleChangeParent}
                      />
                    ))}
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 mt-2 border-t border-slate-800 flex gap-2">
              <input
                type="text"
                value={newCategoryInput}
                onChange={(e) => setNewCategoryInput(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    const ok = await handleAddCategory(newCategoryInput);
                    if (ok) setNewCategoryInput('');
                  }
                }}
                placeholder="New category name"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={async () => {
                  const ok = await handleAddCategory(newCategoryInput);
                  if (ok) setNewCategoryInput('');
                }}
                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-3 rounded-lg text-xs cursor-pointer"
              >
                + Add
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}