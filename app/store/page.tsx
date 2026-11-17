'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStoreProducts } from '../../hooks/useStoreProducts';
import { useCategories } from '../../hooks/useCategories';
import { useCategoryBrowser } from '../../hooks/useCategoryBrowser';
import { useCart } from '../../contexts/CartContext';
import CartDrawer from '../../components/CartDrawer';
import SupportWidget from '../../components/SupportWidget';
import CategoryBrowserBar from '../../components/CategoryBrowserBar';
import DeveloperCredit from '../../components/DeveloperCredit';
import StarRating from '../../components/StarRating';
import ProductDetailsModal from '../../components/ProductDetailsModal';
import type { StoreProduct } from '../../types';

// No single order line can exceed this (the server enforces the real limits)
const MAX_PER_LINE = 20;

// Image, category, name and star rating. Tapping it opens the details popup.
function CardTop({
  product,
  onOpen,
  children,
}: {
  product: StoreProduct;
  onOpen: () => void;
  children?: React.ReactNode;
}) {
  const hasRatings = product.rating_count > 0 && product.rating_avg !== null;

  return (
    <div className="p-3">
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen();
          }
        }}
        aria-label={`View details and reviews for ${product.name}`}
        className="cursor-pointer"
      >
        <div className="w-full h-36 bg-gray-100 rounded flex items-center justify-center overflow-hidden mb-3">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt={product.name} className="object-cover h-full w-full" />
          ) : (
            <span className="text-gray-400 text-xs">No Image</span>
          )}
        </div>
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{product.category || 'General'}</p>
        <h3 className="font-semibold text-gray-800 text-sm line-clamp-2 h-10">{product.name}</h3>
        <div className="h-4 mt-1 flex items-center gap-1">
          {hasRatings ? (
            <>
              <StarRating rating={Number(product.rating_avg)} size={12} />
              <span className="text-[10px] text-gray-500">({product.rating_count})</span>
            </>
          ) : (
            <span className="text-[10px] text-gray-400">No reviews yet</span>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function ProductCard({
  product,
  onAdd,
  onOpen,
}: {
  product: StoreProduct;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAdd: (p: StoreProduct, opts?: any) => void;
  onOpen: () => void;
}) {
  if (product.is_splittable) {
    // Only the options customers can actually order are shown
    const options = [
      { label: 'Full Set', price: product.unit_price, ok: product.web_ok_full, itemType: 'Full Unit' as const },
      { label: 'Adapter Only', price: product.adapter_price ?? 0, ok: product.web_ok_adapter, itemType: 'Adapter' as const },
      { label: 'Cable Only', price: product.cable_price ?? 0, ok: product.web_ok_cable, itemType: 'Cable' as const },
    ].filter((o) => o.ok);

    return (
      <div className="bg-white border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between">
        <CardTop product={product} onOpen={onOpen} />

        <div className="p-3 border-t bg-gray-50 space-y-1.5">
          {options.map((opt) => (
            <button
              key={opt.itemType}
              onClick={() => onAdd(product, { itemType: opt.itemType, price: opt.price, maxQuantity: MAX_PER_LINE })}
              className="w-full flex items-center justify-between px-2.5 py-2 rounded text-xs font-bold transition bg-amber-500 hover:bg-amber-600 text-slate-900"
            >
              <span>+ Add {opt.label}</span>
              <span>₦{opt.price.toLocaleString()}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const displayPrice = product.unit_price ?? 0;

  return (
    <div className="bg-white border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between">
      <CardTop product={product} onOpen={onOpen}>
        <p className="text-indigo-900 font-extrabold text-base mt-2">₦{displayPrice.toLocaleString()}</p>
      </CardTop>

      <div className="p-3 border-t bg-gray-50">
        <button
          onClick={() => onAdd(product, { itemType: 'Full Unit', price: displayPrice, maxQuantity: MAX_PER_LINE })}
          className="w-full py-2 rounded text-xs font-bold transition bg-amber-500 hover:bg-amber-600 text-slate-900"
        >
          Add to Cart
        </button>
      </div>
    </div>
  );
}

export default function StorefrontPage() {
  const { products, loadingProducts, fetchProducts } = useStoreProducts();
  const { categoryList, fetchCategories } = useCategories();
  const { addToCart, clearCart, totalItems } = useCart();
  const router = useRouter();

  const browser = useCategoryBrowser(products, categoryList);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [detailsProduct, setDetailsProduct] = useState<StoreProduct | null>(null);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After a successful Paystack payment, Paystack's callback_url sends the
  // customer back here with ?payment=success. Empty the cart (the order is
  // already placed) and show a confirmation, then strip the query param so
  // refreshing the page doesn't re-trigger this.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      clearCart();
      setShowSuccessBanner(true);
      router.replace('/store');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <header className="sticky top-0 z-40 bg-indigo-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="MEEDEX Logo"
              className="w-15 h-15 object-contain rounded-xl bg-slate-900 border border-cyan-500/40 p-1"
            />
          </div>

          <div className="flex-1 max-w-xl mx-2">
            <input
              type="text"
              placeholder="Search products, brands, categories..."
              value={browser.search}
              onChange={(e) => browser.setSearch(e.target.value)}
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

      {showSuccessBanner && (
        <div className="bg-emerald-600 text-white px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">
            ✅ Payment successful! Your order has been placed — check your email for confirmation and details.
          </p>
          <button onClick={() => setShowSuccessBanner(false)} className="text-white/80 hover:text-white text-xl leading-none">
            &times;
          </button>
        </div>
      )}

      <section className="bg-slate-900 border-t-2 border-amber-500 text-white py-8 px-4 text-center">
        <h2 className="text-2xl md:text-3xl font-extrabold mb-2">
          Quality Gadgets at <span className="text-amber-400">Unbeatable Prices</span>
        </h2>
        <p className="text-slate-300 text-xs md:text-sm max-w-md mx-auto">
          Instant online checkout powered by Paystack.
        </p>
      </section>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <CategoryBrowserBar browser={browser} variant="store" />

        <div className="mt-4">
          {loadingProducts ? (
            <div className="text-center py-20 text-gray-500 font-medium">Loading catalog...</div>
          ) : browser.sections.length === 0 ? (
            <div className="text-center py-20 text-gray-500 font-medium">No products found.</div>
          ) : (
            <div className="space-y-10">
              {browser.sections.map((section) => (
                <div key={section.key}>
                  <h2 className="text-lg font-bold text-gray-800 mb-3 pb-2 border-b-2 border-amber-500 inline-block">
                    {section.name}
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-3">
                    {section.items.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onAdd={addToCart}
                        onOpen={() => setDetailsProduct(product)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {detailsProduct && (
        <ProductDetailsModal
          product={detailsProduct}
          maxPerLine={MAX_PER_LINE}
          onClose={() => setDetailsProduct(null)}
          onAdd={addToCart}
        />
      )}

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <SupportWidget />
      <DeveloperCredit clearFloating />
    </div>
  );
}