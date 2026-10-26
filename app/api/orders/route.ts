// app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireStaff } from '../../../lib/auth';
import { sendOrderEmail, type OrderEmailStage } from '../../../lib/orderEmails';

type Action = 'confirm' | 'ship' | 'deliver' | 'cancel' | 'refund';

// Which status moves are allowed, from which starting status, and which
// email each one sends. Kept in one table so the route can't be tricked
// into skipping a step.
const TRANSITIONS: Record<Action, { to: string; stage: OrderEmailStage; from: string[] }> = {
  confirm: { to: 'confirmed', stage: 'confirmed', from: ['paid'] },
  ship: { to: 'shipped', stage: 'out_for_delivery', from: ['confirmed'] },
  deliver: { to: 'delivered', stage: 'delivered', from: ['confirmed', 'shipped'] },
  cancel: { to: 'cancelled', stage: 'cancelled', from: ['paid', 'confirmed', 'shipped'] },
  refund: { to: 'refunded', stage: 'refunded', from: ['cancelled'] },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_REASON = 5;
const MAX_REASON = 300;

export async function GET(req: NextRequest) {
  const staff = await requireStaff(req);
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*, order_items(quantity, price_at_purchase, item_type, products(name))')
    .neq('status', 'pending') // unpaid/abandoned checkouts aren't staff-actionable
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Orders fetch failed:', error.message);
    return NextResponse.json({ error: 'Could not load orders.' }, { status: 500 });
  }
  return NextResponse.json({ orders: data });
}

export async function PATCH(req: NextRequest) {
  const staff = await requireStaff(req);
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const orderId = String(body?.orderId ?? '');
  const action = body?.action as Action;
  const transition = TRANSITIONS[action];

  if (!UUID_RE.test(orderId) || !transition) {
    return NextResponse.json({ error: 'Invalid orderId or action' }, { status: 400 });
  }

  let reason = '';
  if (action === 'cancel') {
    reason = String(body?.reason ?? '').trim().slice(0, MAX_REASON);
    if (reason.length < MIN_REASON) {
      return NextResponse.json(
        { error: `Please give a reason for cancelling (at least ${MIN_REASON} characters).` },
        { status: 400 }
      );
    }
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: order, error: fetchErr } = await supabaseAdmin
    .from('orders')
    .select('*, order_items(quantity, price_at_purchase, item_type, products(name))')
    .eq('id', orderId)
    .single();

  if (fetchErr || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  if (!transition.from.includes(order.status)) {
    return NextResponse.json(
      { error: `Can't ${action} an order that is currently "${order.status}".` },
      { status: 400 }
    );
  }
  if (action === 'ship' && order.delivery_method !== 'delivery') {
    return NextResponse.json({ error: 'Out for delivery only applies to delivery orders.' }, { status: 400 });
  }
  if (action === 'deliver' && order.status === 'confirmed' && order.delivery_method !== 'pickup') {
    return NextResponse.json(
      { error: 'A delivery order must be marked out for delivery first.' },
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = { status: transition.to };
  if (action === 'cancel') update.cancellation_reason = reason;

  // Only update if nobody else changed the order in the meantime.
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('orders')
    .update(update)
    .eq('id', orderId)
    .eq('status', order.status)
    .select('id');

  if (updateErr) {
    console.error('Order update failed:', updateErr.message);
    return NextResponse.json({ error: 'Could not update the order.' }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json(
      { error: 'This order was just changed by someone else. Please refresh.' },
      { status: 409 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (order.order_items || []).map((i: any) => ({
    name: i.products?.name || 'Item',
    item_type: i.item_type || 'Full Unit',
    quantity: i.quantity,
    price_at_purchase: i.price_at_purchase,
  }));

  // Best-effort: the status change above is already saved whether or not
  // the email succeeds.
  const emailResult = await sendOrderEmail(
    transition.stage,
    action === 'cancel' ? { ...order, cancellation_reason: reason } : order,
    items
  );

  return NextResponse.json({ success: true, newStatus: transition.to, emailSent: emailResult.success });
}