// app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireStaff } from '../../../lib/auth';
import { sendOrderEmail, type OrderEmailStage } from '../../../lib/orderEmails';

// Which status transitions are allowed from which starting status, and the
// email stage each one fires. Kept as one table so the route can't be
// tricked into skipping a step (e.g. jumping straight from 'paid' to
// 'delivered').
const TRANSITIONS: Record<string, { to: string; stage: OrderEmailStage; deliveryOnly?: boolean }> = {
  confirm: { to: 'confirmed', stage: 'confirmed' },
  refund: { to: 'refunded', stage: 'refunded' },
  ship: { to: 'shipped', stage: 'out_for_delivery', deliveryOnly: true },
  deliver: { to: 'delivered', stage: 'delivered' },
};

const FROM_STATUS: Record<string, string[]> = {
  confirm: ['paid'],
  refund: ['paid', 'confirmed'],
  ship: ['confirmed'],
  deliver: ['confirmed', 'shipped'],
};

export async function GET(req: NextRequest) {
  const staff = await requireStaff(req);
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*, order_items(quantity, price_at_purchase, item_type, products(name))')
    .neq('status', 'pending') // unpaid/abandoned checkouts aren't staff-actionable
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data });
}

export async function PATCH(req: NextRequest) {
  const staff = await requireStaff(req);
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { orderId, action } = await req.json();
  const transition = TRANSITIONS[action];
  if (!orderId || !transition) {
    return NextResponse.json({ error: 'Invalid orderId or action' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: order, error: fetchErr } = await supabaseAdmin
    .from('orders')
    .select('*, order_items(quantity, price_at_purchase, item_type, products(name))')
    .eq('id', orderId)
    .single();

  if (fetchErr || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  if (transition.deliveryOnly && order.delivery_method !== 'delivery') {
    return NextResponse.json({ error: 'This action only applies to delivery orders.' }, { status: 400 });
  }
  if (!FROM_STATUS[action].includes(order.status)) {
    return NextResponse.json(
      { error: `Can't ${action} an order that is currently "${order.status}".` },
      { status: 400 }
    );
  }

  const { error: updateErr } = await supabaseAdmin
    .from('orders')
    .update({ status: transition.to })
    .eq('id', orderId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  const items = (order.order_items || []).map((i: any) => ({
    name: i.products?.name || 'Item',
    item_type: i.item_type || 'Full Unit',
    quantity: i.quantity,
    price_at_purchase: i.price_at_purchase,
  }));

  // Best-effort — the status change above is already committed regardless
  // of whether the notification email succeeds.
  const emailResult = await sendOrderEmail(transition.stage, order, items);

  return NextResponse.json({ success: true, newStatus: transition.to, emailSent: emailResult.success });
}