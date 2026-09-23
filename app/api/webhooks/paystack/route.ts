// app/api/webhooks/paystack/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';

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
    const hash = crypto
      .createHmac('sha512', secretKey)
      .update(bodyText)
      .digest('hex');

    if (hash !== paystackSignature) {
      console.error('Invalid Paystack signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(bodyText);

    // 2. Process successful payments
    if (event.event === 'charge.success') {
      const data = event.data;
      const { reference, amount, metadata, customer } = data;
      const cartItems = metadata?.cart_items || [];
      const customerName = metadata?.customer_name || 'Online Customer';
      const customerPhone = metadata?.customer_phone || '';
      const email = customer?.email || '';

      // Convert Kobo back to Naira
      const totalAmount = amount / 100;

      // 3. Call the atomic database RPC function in Supabase
      const { data: result, error } = await supabase.rpc('process_online_order', {
        p_paystack_ref: reference,
        p_customer_name: customerName,
        p_customer_email: email,
        p_customer_phone: customerPhone,
        p_total_amount: totalAmount,
        p_items: cartItems, // JSON array of items: [{ id, quantity, price }]
      });

      if (error) {
        console.error('Error executing process_online_order RPC:', error);
        return NextResponse.json({ error: 'Failed to record online order' }, { status: 500 });
      }

      console.log(`Order successfully processed for ref ${reference}:`, result);
    }

    // Always acknowledge receipt to Paystack
    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}