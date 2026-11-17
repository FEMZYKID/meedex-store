/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import StarRating from './StarRating';
import type { StoreProduct, PublicReview } from '../types';

interface Props {
  product: StoreProduct;
  maxPerLine: number;
  onClose: () => void;
  onAdd: (p: StoreProduct, opts?: any) => void;
}

export default function ProductDetailsModal({ product, maxPerLine, onClose, onAdd }: Props) {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [loading, setLoading] = useState(true);

  // Only approved reviews are ever visible to the public (the database enforces this)
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('product_reviews')
        .select('id, rating, comment, reviewer_name, created_at')
        .eq('product_id', product.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(30);
      if (!active) return;
      setReviews((data as PublicReview[]) || []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [product.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const options = product.is_splittable
    ? [
        { label: 'Full Set', price: product.unit_price, ok: product.web_ok_full, itemType: 'Full Unit' as const },
        { label: 'Adapter Only', price: product.adapter_price ?? 0, ok: product.web_ok_adapter, itemType: 'Adapter' as const },
        { label: 'Cable Only', price: product.cable_price ?? 0, ok: product.web_ok_cable, itemType: 'Cable' as const },
      ].filter((o) => o.ok)
    : product.web_ok_full
      ? [{ label: 'Cart', price: product.unit_price ?? 0, ok: true, itemType: 'Full Unit' as const }]
      : [];

  const hasRatings = product.rating_count > 0 && product.rating_avg !== null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={product.name}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl text-gray-900"
      >
        <div className="sticky top-0 bg-white flex justify-end p-2 z-10">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-3xl leading-none px-2"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="px-5 pb-6 -mt-2">
          <div className="w-full h-56 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden mb-4">
            {product.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image_url} alt={product.name} className="object-contain h-full w-full" />
            ) : (
              <span className="text-gray-400 text-sm">No Image</span>
            )}
          </div>

          <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">{product.category || 'General'}</p>
          <h2 className="text-lg font-bold text-gray-900">{product.name}</h2>

          <div className="flex items-center gap-2 mt-1">
            {hasRatings ? (
              <>
                <StarRating rating={Number(product.rating_avg)} size={16} />
                <span className="text-sm font-semibold text-gray-800">{Number(product.rating_avg).toFixed(1)}</span>
                <span className="text-xs text-gray-500">
                  ({product.rating_count} {product.rating_count === 1 ? 'review' : 'reviews'})
                </span>
              </>
            ) : (
              <span className="text-xs text-gray-400">No reviews yet</span>
            )}
          </div>

          {!product.is_splittable && (
            <p className="text-indigo-900 font-extrabold text-xl mt-3">₦{(product.unit_price ?? 0).toLocaleString()}</p>
          )}

          <div className="mt-4 space-y-2">
            {options.map((opt) => (
              <button
                key={opt.itemType}
                onClick={() => {
                  onAdd(product, { itemType: opt.itemType, price: opt.price, maxQuantity: maxPerLine });
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-bold transition bg-amber-500 hover:bg-amber-600 text-slate-900"
              >
                <span>{product.is_splittable ? `+ Add ${opt.label}` : 'Add to Cart'}</span>
                {product.is_splittable && <span>₦{opt.price.toLocaleString()}</span>}
              </button>
            ))}
          </div>

          <h3 className="text-sm font-bold text-gray-900 mt-6 mb-2 pt-4 border-t">Customer reviews</h3>

          {loading ? (
            <p className="text-xs text-gray-500">Loading reviews…</p>
          ) : reviews.length === 0 ? (
            <p className="text-xs text-gray-500">No reviews yet. Reviews come from customers who have received this item.</p>
          ) : (
            <ul className="space-y-4">
              {reviews.map((r) => (
                <li key={r.id} className="border-b border-gray-100 pb-3 last:border-0">
                  <div className="flex items-center gap-2">
                    <StarRating rating={r.rating} size={13} />
                    <span className="text-xs font-semibold text-gray-800">{r.reviewer_name}</span>
                    <span className="text-[11px] text-gray-400">
                      {new Date(r.created_at).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  {r.comment && <p className="text-sm text-gray-700 mt-1 whitespace-pre-line break-words">{r.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}