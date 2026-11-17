'use client';

import { useEffect, useState } from 'react';

interface ReviewItem {
  product_id: string;
  name: string;
  image_url: string | null;
  already_reviewed: boolean;
}

interface Draft {
  rating: number;
  comment: string;
}

const MAX_COMMENT = 500;

function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
          onClick={() => onChange(n)}
          className={`text-4xl leading-none transition ${
            n <= value ? 'text-amber-500' : 'text-gray-300 hover:text-amber-300'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function ReviewPage() {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [firstName, setFirstName] = useState('');
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('t') || '';
    setToken(t);
    if (!t) {
      setErrorMsg('This review link is not valid.');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/reviews?t=${encodeURIComponent(t)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErrorMsg(data.error || 'This review link is not valid.');
        } else {
          setFirstName(data.firstName || '');
          setItems(data.items || []);
        }
      } catch {
        setErrorMsg('Could not load your order. Please check your connection and try again.');
      }
      setLoading(false);
    })();
  }, []);

  const setDraft = (productId: string, patch: Partial<Draft>) =>
    setDrafts((prev) => ({
      ...prev,
      [productId]: { rating: 0, comment: '', ...prev[productId], ...patch },
    }));

  const toReview = items.filter((i) => !i.already_reviewed);
  const rated = toReview.filter((i) => (drafts[i.product_id]?.rating || 0) > 0);

  async function submit() {
    if (rated.length === 0) {
      setErrorMsg('Please give at least one item a star rating.');
      return;
    }
    setErrorMsg('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          reviews: rated.map((i) => ({
            product_id: i.product_id,
            rating: drafts[i.product_id].rating,
            comment: drafts[i.product_id].comment || '',
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not send your review. Please try again.');
      } else {
        setDone(true);
      }
    } catch {
      setErrorMsg('Could not send your review. Please check your connection and try again.');
    }
    setSubmitting(false);
  }

  return (
    <main className="min-h-screen bg-gray-100 text-gray-900">
      <header className="bg-indigo-900 text-white">
        <div className="max-w-xl mx-auto px-4 py-4">
          <span className="font-extrabold tracking-wide">MEEDEX GADGETS</span>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-6">
        {loading ? (
          <p className="text-sm text-gray-500">Loading your order…</p>
        ) : done ? (
          <div className="bg-white border rounded-xl p-6 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <h1 className="text-lg font-bold mb-1">Thank you{firstName ? `, ${firstName}` : ''}!</h1>
            <p className="text-sm text-gray-600 mb-4">
              Your review has been received. It will appear on the store once we have approved it.
            </p>
            <a href="/store" className="inline-block bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-sm px-5 py-2.5 rounded-lg">
              Back to the store
            </a>
          </div>
        ) : errorMsg && items.length === 0 ? (
          <div className="bg-white border rounded-xl p-6 text-center">
            <p className="text-sm text-gray-700">{errorMsg}</p>
            <a href="/store" className="inline-block mt-4 text-indigo-700 font-semibold text-sm underline">
              Go to the store
            </a>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-extrabold mb-1">How was your order{firstName ? `, ${firstName}` : ''}?</h1>
            <p className="text-sm text-gray-600 mb-5">
              Rate the items you received. Your review helps other shoppers, and appears after we approve it.
            </p>

            <div className="space-y-4">
              {items.map((item) => {
                const draft = drafts[item.product_id] || { rating: 0, comment: '' };
                return (
                  <section key={item.product_id} className="bg-white border rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-14 h-14 shrink-0 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                        {item.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.image_url} alt={item.name} className="object-cover w-full h-full" />
                        ) : (
                          <span className="text-gray-400 text-[10px]">No image</span>
                        )}
                      </div>
                      <h2 className="font-semibold text-sm text-gray-900">{item.name}</h2>
                    </div>

                    {item.already_reviewed ? (
                      <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                        ✓ You have already reviewed this item. Thank you!
                      </p>
                    ) : (
                      <>
                        <StarInput value={draft.rating} onChange={(v) => setDraft(item.product_id, { rating: v })} />
                        <textarea
                          rows={3}
                          maxLength={MAX_COMMENT}
                          value={draft.comment}
                          onChange={(e) => setDraft(item.product_id, { comment: e.target.value })}
                          placeholder="Tell others what you think (optional)"
                          className="w-full mt-3 px-3 py-2 border rounded-lg text-sm text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <p className="text-[11px] text-gray-400 text-right">
                          {draft.comment.length}/{MAX_COMMENT}
                        </p>
                      </>
                    )}
                  </section>
                );
              })}
            </div>

            {errorMsg && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5 mt-4">{errorMsg}</p>
            )}

            {toReview.length > 0 && (
              <button
                onClick={submit}
                disabled={submitting || rated.length === 0}
                className="w-full mt-4 py-3 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold rounded-lg shadow transition disabled:bg-gray-300 disabled:text-gray-500 text-sm"
              >
                {submitting ? 'Sending…' : 'Send my review'}
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}