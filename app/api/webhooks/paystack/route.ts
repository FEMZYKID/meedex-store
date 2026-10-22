import { NextResponse } from 'next/server';
import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { sendOrderEmail } from '../../../../lib/orderEmails';

// Stock ran out between checkout and payment: cancel the order and refund.
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

  try {
    const res = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction: reference }),
    });
    const json = await res.json();
    if (res.ok && json.status) {
      await admin.from('orders').update({ status: 'refunded' }).eq('id', orderId);
      console.log(`Order ${orderId} out of stock: refund started for ${reference}`);
    } else {
      console.error(`REFUND NEEDED MANUALLY: order ${orderId}, ref ${reference}:`, json.message);
    }
  } catch (err) {
    console.error(`REFUND NEEDED MANUALLY: order ${orderId}, ref ${reference}:`, err);
  }
}

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const paystackSignature = req.headers.get('x-paystack-signature');

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      console.error('PAYSTACK_SECRET_KEY is not defined.');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const hash = crypto.createHmac('sha512', secretKey).update(bodyText).digest('hex');
    if (hash !== paystackSignature) {
      console.error('Invalid Paystack signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(bodyText);

    if (event.event === 'charge.success') {
      const data = event.data;
      const { reference, metadata } = data;
      const orderId = metadata?.order_id;

      if (!orderId) {
        console.error('Webhook charge.success with no order_id in metadata:', reference);
        return NextResponse.json({ error: 'Missing order_id in metadata' }, { status: 400 });
      }

      const supabaseAdmin = getSupabaseAdmin();

      // Look up the order: skip repeats and verify the amount paid.
      const { data: orderRow } = await supabaseAdmin
        .from('orders')
        .select('status, total_amount, delivery_fee')
        .eq('id', orderId)
        .single();

      if (!orderRow) {
        console.error('Webhook: order not found', orderId);
        return NextResponse.json({ status: 'ignored' }, { status: 200 });
      }
      if (orderRow.status !== 'pending') {
        // Paystack retry or already handled; do nothing (no duplicate emails)
        return NextResponse.json({ status: 'already_processed' }, { status: 200 });
      }

      const expectedKobo = Math.round(
        (Number(orderRow.total_amount) + Number(orderRow.delivery_fee || 0)) * 100
      );
      if (data.currency !== 'NGN' || Number(data.amount) !== expectedKobo) {
        console.error(
          `Webhook: AMOUNT MISMATCH, order ${orderId}: paid ${data.amount} ${data.currency}, expected ${expectedKobo} NGN. Review manually.`
        );
        return NextResponse.json({ status: 'ignored' }, { status: 200 });
      }

      const { error } = await supabaseAdmin.rpc('process_online_order', {
        p_order_id: orderId,
        p_reference: reference,
      });

      if (error) {
        if (/insufficient stock/i.test(error.message)) {
          await handleOutOfStock(supabaseAdmin, orderId, reference, secretKey);
          return NextResponse.json({ status: 'out_of_stock_handled' }, { status: 200 });
        }
        console.error('Error executing process_online_order RPC:', error.message);
        return NextResponse.json({ error: 'Failed to record online order' }, { status: 500 });
      }

      console.log(`Order ${orderId} successfully marked paid for ref ${reference}`);

      // Best-effort email; never affects the 200 response to Paystack.
      try {
        const { data: order } = await supabaseAdmin.from('orders').select('*').eq('id', orderId).single();
        const { data: orderItems } = await supabaseAdmin
          .from('order_items')
          .select('quantity, price_at_purchase, item_type, products(name)')
          .eq('order_id', orderId);

        if (order) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const items = (orderItems || []).map((i: any) => ({
            name: i.products?.name || 'Item',
            item_type: i.item_type || 'Full Unit',
            quantity: i.quantity,
            price_at_purchase: i.price_at_purchase,
          }));
          await sendOrderEmail('processing', order, items);
        }
      } catch (emailErr) {
        console.error('Failed to send order-processing email:', emailErr);
      }
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}