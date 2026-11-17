'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

interface PendingItem {
  quantity: number;
  price_at_purchase: number;
  item_type: string;
  products: { name: string } | { name: string }[] | null;
}

interface PendingOrder {
  id: string;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  total_amount: number;
  delivery_fee: number | null;
  delivery_method: 'pickup' | 'delivery';
  order_items: PendingItem[];
}

interface Note {
  kind: 'good' | 'info' | 'bad';
  text: string;
}

// Younger than this: the customer is probably still on the payment page
const IN_PROGRESS_MINUTES = 10;

function minutesAgo(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

function ageLabel(minutes: number) {
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

function nameOf(item: PendingItem) {
  return (Array.isArray(item.products) ? item.products[0]?.name : item.products?.name) || 'Item';
}

export default function PendingOrdersPage() {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, Note>>({});

  const authHeader = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session ? { Authorization: `Bearer ${session.access_token}` } : null;
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const headers = await authHeader();
    if (!headers) {
      setLoadError('Please log in again.');
      setLoading(false);
      return;
    }
    const res = await fetch('/api/admin/pending-orders', { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setLoadError(data.error || 'Could not load pending orders.');
    else setOrders(data.orders || []);
    setLoading(false);
  }, [authHeader]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  async function act(orderId: string, action: 'check' | 'remove') {
    if (
      action === 'remove' &&
      !confirm('Remove this unpaid order? Paystack is asked first, and it will be refused if the customer actually paid.')
    ) {
      return;
    }

    setBusyId(orderId);
    const headers = await authHeader();
    if (!headers) {
      setBusyId(null);
      alert('Please log in again.');
      return;
    }

    const res = await fetch('/api/admin/pending-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ orderId, action }),
    });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);

    if (!res.ok) {
      setNotes((prev) => ({ ...prev, [orderId]: { kind: 'bad', text: data.error || 'Something went wrong.' } }));
      return;
    }

    const result: string = data.result;
    const kind: Note['kind'] = result === 'processed' ? 'good' : result === 'removed' ? 'info' : 'info';
    setNotes((prev) => ({ ...prev, [orderId]: { kind, text: data.message || 'Done.' } }));

    // Processed or removed orders leave this list
    if (['processed', 'removed', 'already_processed', 'out_of_stock_handled'].includes(result)) {
      setTimeout(fetchOrders, 1500);
    }
  }

  return (
    <section className="bg-slate-800 border border-slate-700/80 p-4 sm:p-5 rounded-2xl shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <span>⏳</span> Pending Payments ({orders.length})
        </h2>
        <button
          onClick={fetchOrders}
          className="text-xs bg-slate-900 border border-slate-700 hover:border-cyan-500 text-cyan-400 px-3 py-1 rounded-lg font-medium transition cursor-pointer"
        >
          ↻ Refresh
        </button>
      </div>
      <p className="text-[11px] text-slate-400 mb-4">
        Checkouts where the customer started to pay but no payment has been recorded. Most are abandoned checkouts and
        are safe to remove. If a customer says they paid, press <strong>Check payment</strong>: it asks Paystack, and
        if the money arrived, the order moves to New orders.
      </p>

      {loading ? (
        <p className="text-xs text-slate-500">Loading…</p>
      ) : loadError ? (
        <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">{loadError}</p>
      ) : orders.length === 0 ? (
        <p className="text-xs text-slate-500 py-6 text-center">No pending orders. 🎉</p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const total = Number(o.total_amount) + Number(o.delivery_fee || 0);
            const mins = minutesAgo(o.created_at);
            const inProgress = mins < IN_PROGRESS_MINUTES;
            const note = notes[o.id];
            const busy = busyId === o.id;

            return (
              <div key={o.id} className="bg-slate-900 border border-slate-700/70 rounded-xl p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-500 font-mono">#{o.id.slice(0, 8)}</p>
                    <p className="text-sm font-bold text-white">{o.customer_name || 'Unnamed customer'}</p>
                    <p className="text-xs text-slate-400 break-all">
                      {o.customer_phone} · {o.customer_email}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-400">₦{total.toLocaleString()}</p>
                    <p className="text-[11px] text-slate-400">{ageLabel(mins)}</p>
                    <span
                      className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                        inProgress
                          ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                          : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {inProgress ? 'Payment in progress' : 'Not completed'}
                    </span>
                  </div>
                </div>

                <ul className="mt-2 space-y-0.5">
                  {o.order_items.map((item, i) => (
                    <li key={i} className="text-[11px] text-slate-300">
                      {item.quantity} × {nameOf(item)}
                      {item.item_type !== 'Full Unit' ? ` (${item.item_type})` : ''}
                    </li>
                  ))}
                </ul>

                {note && (
                  <p
                    className={`mt-3 text-xs rounded-lg p-2.5 border ${
                      note.kind === 'good'
                        ? 'text-emerald-200 bg-emerald-500/10 border-emerald-500/30'
                        : note.kind === 'bad'
                          ? 'text-rose-200 bg-rose-500/10 border-rose-500/30'
                          : 'text-slate-200 bg-slate-800 border-slate-600'
                    }`}
                  >
                    {note.text}
                  </p>
                )}

                <div className="flex flex-wrap justify-end gap-2 mt-3 pt-2 border-t border-slate-800">
                  <button
                    disabled={busy}
                    onClick={() => act(o.id, 'check')}
                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-[11px] font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 cursor-pointer"
                  >
                    {busy ? 'Checking…' : 'Check payment'}
                  </button>
                  {!inProgress && (
                    <button
                      disabled={busy}
                      onClick={() => act(o.id, 'remove')}
                      className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}