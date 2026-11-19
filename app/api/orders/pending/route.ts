// app/api/orders/pending/route.ts
//
// Tools for orders that are still "pending": checkouts where the customer
// started to pay but no payment has been recorded. Used by the
// "Pending Payments" tab on the Online Orders page.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireStaff } from '../../../../lib/auth';
import { processSuccessfulPayment, type PaystackTransaction } from '../../../../lib/orderPayments';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Verification {
  ok: boolean;
  notFound?: boolean;
  tx?: PaystackTransaction & { metadata?: { order_id?: string } };
  message?: string;
}

// Ask Paystack what really happened to this payment
async function verifyWithPaystack(reference: string): Promise<Verification> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return { ok: false, message: 'Paystack is not configured.' };

  try {
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
      signal: AbortSignal.timeout(10000),
    });
    const json = await res.json().catch(() => ({}));

    if (res.status === 404 || (json?.status === false && /not found/i.test(String(json?.message || '')))) {
      return { ok: true, notFound: true };
    }
    if (!res.ok || !json?.status) {
      return { ok: false, message: json?.message || `Paystack returned an error (${res.status}).` };
    }
    return { ok: true, tx: json.data };
  } catch {
    return { ok: false, message: 'Could not reach Paystack. Please try again.' };
  }
}

const SELECT =
  'id, created_at, customer_name, customer_phone, customer_email, total_amount, delivery_fee, delivery_method, order_items(quantity, price_at_purchase, item_type, products(name))';

export async function GET(req: NextRequest) {
  const staff = await requireStaff(req);
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await getSupabaseAdmin()
    .from('orders')
    .select(SELECT)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[pending-orders] list failed:', error.message);
    return NextResponse.json({ error: 'Could not load pending orders.' }, { status: 500 });
  }
  return NextResponse.json({ orders: data });
}

export async function POST(req: NextRequest) {
  const staff = await requireStaff(req);
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const orderId = String(body?.orderId ?? '');
  const action = String(body?.action ?? '');

  if (!UUID_RE.test(orderId) || !['check', 'remove'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: order } = await admin.from('orders').select('id, status').eq('id', orderId).maybeSingle();
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  if (order.status !== 'pending') {
    return NextResponse.json({
      result: 'already_processed',
      message: 'This order is no longer pending. It has already been handled.',
    });
  }

  const reference = `mdx-${orderId}`;
  const verification = await verifyWithPaystack(reference);
  if (!verification.ok) {
    return NextResponse.json({ error: verification.message }, { status: 502 });
  }

  const paid = !!verification.tx && verification.tx.status === 'success';

  if (action === 'remove') {
    if (paid) {
      return NextResponse.json(
        { error: 'This order WAS paid. Use "Check payment" to process it instead of removing it.' },
        { status: 409 }
      );
    }
    await admin.from('order_items').delete().eq('order_id', orderId);
    const { error } = await admin.from('orders').delete().eq('id', orderId).eq('status', 'pending');
    if (error) {
      console.error('[pending-orders] remove failed:', error.message);
      return NextResponse.json({ error: 'Could not remove the order.' }, { status: 500 });
    }
    return NextResponse.json({ result: 'removed', message: 'Removed.' });
  }

  // action === 'check'
  if (verification.notFound || !verification.tx) {
    return NextResponse.json({
      result: 'no_payment',
      message: 'Paystack has no payment for this order. The customer never reached the payment step.',
    });
  }
  if (!paid) {
    return NextResponse.json({
      result: 'not_paid',
      message: `Paystack says this payment was not completed (status: ${verification.tx.status || 'unknown'}). It is safe to remove.`,
    });
  }

  const metaOrder = verification.tx.metadata?.order_id;
  if (metaOrder && metaOrder !== orderId) {
    console.error('[pending-orders] metadata order mismatch for', orderId);
    return NextResponse.json({ error: 'The payment details do not match this order.' }, { status: 409 });
  }

  const result = await processSuccessfulPayment({
    orderId,
    reference: verification.tx.reference || reference,
    tx: verification.tx,
  });

  const messages: Record<string, string> = {
    processed: 'Payment confirmed. The order is now in New orders, and the customer has been emailed.',
    already_processed: 'This order was already handled.',
    order_not_found: 'Order not found.',
    amount_mismatch:
      'Paystack received a different amount from the order total. The order was NOT marked paid. Check the transaction in Paystack.',
    out_of_stock_handled:
      'The customer paid, but an item has since sold out, so the order was cancelled and a refund was started. Check your Telegram for details.',
    error: 'Something went wrong while processing. Please try again.',
  };

  return NextResponse.json(
    { result, message: messages[result] || 'Done.' },
    { status: result === 'error' ? 500 : 200 }
  );
}