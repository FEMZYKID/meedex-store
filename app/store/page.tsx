// app/store/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useProducts } from '@/hooks/useProducts';
import { useCart } from '@/contexts/CartContext';
import CartDrawer from '@/components/CartDrawer';

export default function StorefrontPage() {
  const { products, loadingProducts, fetchProducts } = useProducts();
  const { addToCart, totalItems } = useCart();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const categories = ['All', ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))];

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Header Bar */}
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

      {/* Hero Banner */}
      <section className="bg-gradient-to-r from-indigo-800 to-indigo-600 text-white py-8 px-4 text-center">
        <h2 className="text-2xl md:text-3xl font-extrabold mb-2">Quality Gadgets at Unbeatable Prices</h2>
        <p className="text-indigo-100 text-xs md:text-sm max-w-md mx-auto">
          Instant online checkout powered by Paystack with live stock availability.
        </p>
      </section>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {/* Categories Bar */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-6 border-b border-gray-200">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat as string)}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-slate-900 shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-200 border'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        {loadingProducts ? (
          <div className="text-center py-20 text-gray-500 font-medium">Loading catalog...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 text-gray-500 font-medium">No products found.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredProducts.map((product) => {
              const inStock = (product.stock_quantity ?? 0) > 0;
              return (
                <div
                  key={product.id}
                  className="bg-white border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between"
                >
                  <div className="p-3">
                    <div className="w-full h-36 bg-gray-100 rounded flex items-center justify-center overflow-hidden mb-3">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="object-cover h-full w-full" />
                      ) : (
                        <span className="text-gray-400 text-xs">No Image</span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                      {product.category || 'General'}
                    </p>
                    <h3 className="font-semibold text-gray-800 text-sm line-clamp-2 h-10">{product.name}</h3>
                    <p className="text-indigo-900 font-extrabold text-base mt-2">
                      ₦{product.price?.toLocaleString()}
                    </p>
                  </div>

                  <div className="p-3 border-t bg-gray-50">
                    <button
                      onClick={() => addToCart(product)}
                      disabled={!inStock}
                      className={`w-full py-2 rounded text-xs font-bold transition ${
                        inStock
                          ? 'bg-amber-500 hover:bg-amber-600 text-slate-900'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {inStock ? 'Add to Cart' : 'Out of Stock'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
}