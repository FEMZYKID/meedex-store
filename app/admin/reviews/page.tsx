/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import StarRating from '../../../components/StarRating';

type Status = 'pending' | 'approved' | 'rejected';

interface ReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  reviewer_name: string;
  status: Status;
  created_at: string;
  order_id: string | null;
  products: { name: string; image_url: string | null } | { name: string; image_url: string | null }[] | null;
}

const TABS: { key: Status; label: string }[] = [
  { key: 'pending', label: 'Waiting for approval' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

function productOf(r: ReviewRow) {
  return Array.isArray(r.products) ? r.products[0] : r.products;
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Status>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('product_reviews')
      .select('id, rating, comment, reviewer_name, status, created_at, order_id, products(name, image_url)')
      .order('created_at', { ascending: false });
    if (error) alert('Could not load reviews: ' + error.message);
    else setReviews((data as unknown as ReviewRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  async function setStatus(id: string, status: Status) {
    setBusyId(id);
    const { data, error } = await supabase
      .from('product_reviews')
      .update({ status, moderated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id');
    setBusyId(null);

    if (error || !data || data.length === 0) {
      alert('Could not update this review.' + (error ? ' ' + error.message : ''));
      return;
    }
    await fetchReviews();
  }

  async function remove(id: string) {
    if (!confirm('Delete this review permanently?')) return;
    setBusyId(id);
    const { error } = await supabase.from('product_reviews').delete().eq('id', id);
    setBusyId(null);
    if (error) {
      alert('Could not delete: ' + error.message);
      return;
    }
    await fetchReviews();
  }

  const counts = (s: Status) => reviews.filter((r) => r.status === s).length;
  const shown = reviews.filter((r) => r.status === tab);

  return (
    <section className="bg-slate-800 border border-slate-700/80 p-4 sm:p-5 rounded-2xl shadow-xl">
      <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2">
        <span>⭐</span> Customer Reviews
      </h2>
      <p className="text-[11px] text-slate-400 mb-4">
        Only verified buyers can review. Nothing shows on the store until you approve it.
      </p>

      <div className="flex gap-2 overflow-x-auto pb-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition cursor-pointer ${
              tab === t.key
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {t.label} ({counts(t.key)})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-xs text-slate-500">Loading reviews…</p>
      ) : shown.length === 0 ? (
        <p className="text-xs text-slate-500 py-6 text-center">Nothing here.</p>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => {
            const p = productOf(r);
            const busy = busyId === r.id;
            return (
              <div key={r.id} className="bg-slate-900 border border-slate-700/70 rounded-xl p-3.5">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 shrink-0 bg-slate-800 rounded-lg overflow-hidden border border-slate-700 flex items-center justify-center text-slate-500">
                    {p?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      '🔌'
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white break-words">{p?.name || 'Deleted product'}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <StarRating rating={r.rating} size={14} />
                      <span className="text-[11px] text-slate-300">{r.reviewer_name}</span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(r.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                        {r.order_id ? ` · order #${r.order_id.slice(0, 8)}` : ''}
                      </span>
                    </div>
                    {r.comment ? (
                      <p className="text-xs text-slate-200 mt-2 whitespace-pre-line break-words">{r.comment}</p>
                    ) : (
                      <p className="text-[11px] text-slate-500 mt-2 italic">No comment, stars only.</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2 mt-3 pt-2 border-t border-slate-800">
                  {r.status !== 'approved' && (
                    <button
                      disabled={busy}
                      onClick={() => setStatus(r.id, 'approved')}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 cursor-pointer"
                    >
                      Approve
                    </button>
                  )}
                  {r.status !== 'rejected' && (
                    <button
                      disabled={busy}
                      onClick={() => setStatus(r.id, 'rejected')}
                      className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 cursor-pointer"
                    >
                      {r.status === 'approved' ? 'Hide' : 'Reject'}
                    </button>
                  )}
                  <button
                    disabled={busy}
                    onClick={() => remove(r.id)}
                    className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}