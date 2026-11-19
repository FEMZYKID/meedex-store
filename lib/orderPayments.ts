// lib/orderPayments.ts
//
// The ONE place that turns a successful Paystack payment into a paid order.
// Used by the webhook (the normal route) and by Admin → Pending Payments
// (when a payment has to be checked by hand), so both behave identically.
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './supabaseAdmin';
import { sendOrderEmail } from './orderEmails';
import { notifyNewOrder, notifyStaff } from './notify';

export interface PaystackTransaction {
  status?: string;
  reference?: string;
  amount?: number;
  requested_amount?: number;
  fees?: number;
  currency?: string;
}

export type PaymentResult =
  | 'processed'
  | 'already_processed'
  | 'order_not_found'
  | 'amount_mismatch'
  | 'out_of_stock_handled'
  | 'error';

// What we expect Paystack to have received for this order, in kobo
export function expectedKobo(totalAmount: number, deliveryFee: number | null): number {
  return Math.round((Number(totalAmount) + Number(deliveryFee || 0)) * 100);
}

// Paystack can be set to make the CUSTOMER pay its fee, so the amount paid is the
// order total PLUS the fee. We accept:
//   1. exactly the order total, or
//   2. Paystack's own "requested amount" equals the order total (fee added on top), or
//   3. amount minus fees equals the order total.
// The currency must always be NGN.
export function paymentMatches(tx: PaystackTransaction, expected: number): boolean {
  if (tx.currency !== 'NGN') return false;
  const paid = Number(tx.amount);
  if (!Number.isFinite(paid)) return false;

  if (paid === expected) return true;

  const requested = tx.requested_amount != null ? Number(tx.requested_amount) : null;
  if (requested !== null && Number.isFinite(requested) && requested === expected && paid >= expected) {
    return true;
  }

  const fees = tx.fees != null ? Number(tx.fees) : null;
  if (fees !== null && Number.isFinite(fees) && fees > 0 && paid - fees === expected) return true;

  return false;
}

export async function loadOrderWithItems(admin: SupabaseClient, orderId: string) {
  const { data: order } = await admin.from('orders').select('*').eq('id', orderId).single();
  const { data: orderItems } = await admin
    .from('order_items')
    .select('quantity, price_at_purchase, item_type, products(name)')
    .eq('order_id', orderId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (orderItems || []).map((i: any) => ({
    name: (Array.isArray(i.products) ? i.products[0]?.name : i.products?.name) || 'Item',
    item_type: i.item_type || 'Full Unit',
    quantity: i.quantity,
    price_at_purchase: i.price_at_purchase,
  }));
  return { order, items };
}

async function sendRefundEmail(admin: SupabaseClient, orderId: string) {
  try {
    const { order, items } = await loadOrderWithItems(admin, orderId);
    if (order) await sendOrderEmail('refunded', order, items);
  } catch (err) {
    console.error('Failed to send refund email:', err);
  }
}

// Website stock ran out between checkout and payment: cancel the order and refund.
async function handleOutOfStock(
  admin: SupabaseClient,
  orderId: string,
  reference: string,
  secretKey: string
) {
  await admin
    .from('orders')
    .update({ status: 'cancelled', paystack_reference: reference })
    .eq('id', orderId)
    .eq('status', 'pending');

  const manualMessage =
    `Order #${orderId.slice(0, 8)} was paid but an item had just sold out, and the automatic refund failed.\n` +
    `Refund reference ${reference} in the Paystack dashboard, then mark the order Refunded on the Cancelled tab.`;

  try {
    const res = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction: reference }),
    });
    const json = await res.json();
    if (res.ok && json.status) {
      await admin.from('orders').update({ status: 'refunded' }).eq('id', orderId);
      await sendRefundEmail(admin, orderId);
      console.log(`Order ${orderId} out of stock: refund started for ${reference}`);
      await notifyStaff(
        '⚠️ Order refunded automatically',
        `Order #${orderId.slice(0, 8)} was paid but an item had just sold out. Paystack refund started for reference ${reference}.`
      );
    } else {
      console.error(`REFUND NEEDED MANUALLY: order ${orderId}, ref ${reference}:`, json.message);
      await notifyStaff('🚨 Manual refund needed', manualMessage);
    }
  } catch (err) {
    console.error(`REFUND NEEDED MANUALLY: order ${orderId}, ref ${reference}:`, err);
    await notifyStaff('🚨 Manual refund needed', manualMessage);
  }
}

export async function processSuccessfulPayment(args: {
  orderId: string;
  reference: string;
  tx: PaystackTransaction;
}): Promise<PaymentResult> {
  const { orderId, reference, tx } = args;
  const admin = getSupabaseAdmin();

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    console.error('PAYSTACK_SECRET_KEY is not defined.');
    return 'error';
  }

  const { data: orderRow } = await admin
    .from('orders')
    .select('status, total_amount, delivery_fee')
    .eq('id', orderId)
    .single();

  if (!orderRow) {
    console.error('Payment for an order that does not exist:', orderId);
    return 'order_not_found';
  }
  if (orderRow.status !== 'pending') {
    // Paystack retry, or already handled: do nothing (no duplicate emails or alerts)
    return 'already_processed';
  }

  const expected = expectedKobo(orderRow.total_amount, orderRow.delivery_fee);
  if (!paymentMatches(tx, expected)) {
    console.error(
      `AMOUNT MISMATCH, order ${orderId}: amount ${tx.amount}, requested ${tx.requested_amount}, fees ${tx.fees}, currency ${tx.currency}, expected ${expected} kobo. Review manually.`
    );
    await notifyStaff(
      '🚨 Payment amount mismatch',
      `Order #${orderId.slice(0, 8)}: Paystack shows amount ${tx.amount}, fees ${tx.fees ?? 'n/a'}, currency ${tx.currency}, but the order total is ${expected} (kobo). Reference ${reference}. The order was NOT marked paid. Open Online Orders → Pending Payments, or check it in Paystack.`
    );
    return 'amount_mismatch';
  }

  const { error } = await admin.rpc('process_online_order', {
    p_order_id: orderId,
    p_reference: reference,
  });

  if (error) {
    if (/insufficient stock/i.test(error.message)) {
      await handleOutOfStock(admin, orderId, reference, secretKey);
      return 'out_of_stock_handled';
    }
    console.error('Error executing process_online_order RPC:', error.message);
    return 'error';
  }

  console.log(`Order ${orderId} successfully marked paid for ref ${reference}`);

  // Best-effort: customer email and staff alert. Failures here never
  // change the result.
  try {
    const { order, items } = await loadOrderWithItems(admin, orderId);
    if (order) {
      await Promise.allSettled([sendOrderEmail('processing', order, items), notifyNewOrder(order, items)]);
    }
  } catch (err) {
    console.error('Failed to send order emails or alerts:', err);
  }

  return 'processed';
}