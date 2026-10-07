// app/api/webhooks/paystack/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { sendOrderEmail } from '../../../../lib/orderEmails';

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const paystackSignature = req.headers.get('x-paystack-signature');

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      console.error('PAYSTACK_SECRET_KEY is not defined.');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // 1. Verify Paystack HMAC-SHA512 Signature for security
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

      // 2. Reconcile the pending order created at checkout time: marks it
      // paid and atomically deducts stock for each item. Uses the service
      // role client because this updates `products` stock, which RLS
      // otherwise restricts to admins only.
      const supabaseAdmin = getSupabaseAdmin();
      const { error } = await supabaseAdmin.rpc('process_online_order', {
        p_order_id: orderId,
        p_reference: reference,
      });

      if (error) {
        console.error('Error executing process_online_order RPC:', error.message);
        return NextResponse.json({ error: 'Failed to record online order' }, { status: 500 });
      }

      console.log(`Order ${orderId} successfully marked paid for ref ${reference}`);

      // Best-effort: fetch the now-paid order and its items to send the
      // "we received your order" email. A failure here must never affect
      // the 200 response to Paystack — the order itself is already saved.
      try {
        const { data: order } = await supabaseAdmin.from('orders').select('*').eq('id', orderId).single();
        const { data: orderItems } = await supabaseAdmin
          .from('order_items')
          .select('quantity, price_at_purchase, item_type, products(name)')
          .eq('order_id', orderId);

        if (order) {
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

    // Always acknowledge receipt to Paystack
    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}