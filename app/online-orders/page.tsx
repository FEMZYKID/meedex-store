/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

interface OrderItem {
  quantity: number;
  price_at_purchase: number;
  item_type: string;
  products: { name: string } | null;
}

interface Order {
  id: string;
  status: string;
  total_amount: number;
  delivery_fee: number | null;
  delivery_method: 'pickup' | 'delivery';
  delivery_zone: string | null;
  shipping_address: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  paystack_reference: string | null;
  created_at: string;
  order_items: OrderItem[];
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  paid: { label: 'New — Needs Confirmation', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  confirmed: { label: 'Confirmed', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
  shipped: { label: 'Out for Delivery', color: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' },
  delivered: { label: 'Delivered / Picked Up', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  refunded: { label: 'Refunded', color: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
  failed: { label: 'Failed', color: 'bg-slate-700 text-slate-400 border-slate-600' },
  cancelled: { label: 'Cancelled', color: 'bg-slate-700 text-slate-400 border-slate-600' },
};

const TABS = ['paid', 'confirmed', 'shipped', 'delivered', 'refunded'] as const;

export default function OnlineOrdersPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('paid');
  const [actingOn, setActingOn] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch('/api/orders', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    if (res.ok) setOrders(data.orders || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      const { data: profile } = await supabase.from('staff').select('id').eq('id', session.user.id).maybeSingle();
      if (!profile) {
        await supabase.auth.signOut();
        router.push('/login');
        return;
      }
      setReady(true);
      fetchOrders();
    };
    init();
  }, [router, fetchOrders]);

  async function runAction(orderId: string, action: 'confirm' | 'refund' | 'ship' | 'deliver') {
    if (action === 'refund' && !confirm('Have you already refunded this customer via Paystack? This only records it and emails them — it does NOT trigger the actual refund.')) {
      return;
    }
    setActingOn(orderId);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ orderId, action }),
    });
    const data = await res.json();
    setActingOn(null);

    if (!res.ok) {
      alert(data.error || 'Something went wrong.');
      return;
    }
    fetchOrders();
  }

  if (!ready) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">Loading…</div>;
  }

  const filtered = orders.filter((o) => o.status === activeTab);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-black uppercase tracking-wider">
          🛒 Online <span className="text-indigo-400">Orders</span>
        </h1>
        <Link
          href="/pos"
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3.5 py-1.5 rounded-lg text-xs font-bold transition"
        >
          ← Back to Register
        </Link>
      </header>

      <div className="max-w-5xl mx-auto p-6">
        <div className="flex gap-2 overflow-x-auto pb-4">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap border transition ${
                activeTab === tab
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800'
              }`}
            >
              {STATUS_LABEL[tab]?.label || tab} ({orders.filter((o) => o.status === tab).length})
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-slate-500 text-sm">Loading orders…</p>
        ) : filtered.length === 0 ? (
          <p className="text-slate-500 text-sm">No orders here.</p>
        ) : (
          <div className="space-y-4">
            {filtered.map((order) => {
              const total = Number(order.total_amount) + Number(order.delivery_fee || 0);
              const busy = actingOn === order.id;

              return (
                <div key={order.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                    <div>
                      <p className="text-xs text-slate-500 font-mono">#{order.id.slice(0, 8)}</p>
                      <p className="font-bold text-sm">{order.customer_name || 'Unnamed customer'}</p>
                      <p className="text-xs text-slate-400">{order.customer_phone} · {order.customer_email}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded border ${STATUS_LABEL[order.status]?.color}`}>
                      {STATUS_LABEL[order.status]?.label || order.status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded-lg p-3 mb-3">
                    <p className="mb-1">
                      <span className="text-slate-500">Fulfilment: </span>
                      {order.delivery_method === 'pickup'
                        ? 'Store Pickup'
                        : `Delivery — ${order.delivery_zone}${order.shipping_address ? `, ${order.shipping_address}` : ''}`}
                    </p>
                    <p className="mb-1">
                      <span className="text-slate-500">Placed: </span>
                      {new Date(order.created_at).toLocaleString()}
                    </p>
                    {order.paystack_reference && (
                      <p>
                        <span className="text-slate-500">Ref: </span>
                        {order.paystack_reference}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1 mb-3">
                    {order.order_items.map((item, i) => (
                      <div key={i} className="flex justify-between text-xs text-slate-300">
                        <span>
                          {item.products?.name || 'Item'}
                          {item.item_type !== 'Full Unit' ? ` (${item.item_type})` : ''} × {item.quantity}
                        </span>
                        <span>₦{(item.price_at_purchase * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                    <span className="font-bold text-emerald-400 text-sm">₦{total.toLocaleString()}</span>

                    <div className="flex gap-2">
                      {order.status === 'paid' && (
                        <>
                          <button
                            disabled={busy}
                            onClick={() => runAction(order.id, 'confirm')}
                            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
                          >
                            Confirm
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => runAction(order.id, 'refund')}
                            className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
                          >
                            Refund
                          </button>
                        </>
                      )}
                      {order.status === 'confirmed' && order.delivery_method === 'delivery' && (
                        <button
                          disabled={busy}
                          onClick={() => runAction(order.id, 'ship')}
                          className="bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
                        >
                          Out for Delivery
                        </button>
                      )}
                      {order.status === 'confirmed' && order.delivery_method === 'pickup' && (
                        <button
                          disabled={busy}
                          onClick={() => runAction(order.id, 'deliver')}
                          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
                        >
                          Mark Picked Up
                        </button>
                      )}
                      {order.status === 'shipped' && (
                        <button
                          disabled={busy}
                          onClick={() => runAction(order.id, 'deliver')}
                          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
                        >
                          Mark Delivered
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}