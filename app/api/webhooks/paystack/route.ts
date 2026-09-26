// app/api/webhooks/paystack/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

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
    }

    // Always acknowledge receipt to Paystack
    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}