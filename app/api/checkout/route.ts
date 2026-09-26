// app/api/checkout/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export async function POST(req: Request) {
  const supabaseAdmin = getSupabaseAdmin();
  let createdOrderId: string | null = null;

  try {
    const {
      items,
      email,
      customerName,
      customerPhone,
      deliveryMethod,
      deliveryZone,
      address,
    } = await req.json();

    if (!items || items.length === 0 || !email) {
      return NextResponse.json({ error: 'Missing required cart items or email.' }, { status: 400 });
    }
    if (!deliveryMethod || !['pickup', 'delivery'].includes(deliveryMethod)) {
      return NextResponse.json({ error: 'Invalid delivery method.' }, { status: 400 });
    }
    if (deliveryMethod === 'delivery' && (!deliveryZone || !address)) {
      return NextResponse.json({ error: 'Delivery zone and address are required for delivery.' }, { status: 400 });
    }

    const totalAmount = items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);

    // Known flat fees for the two campus zones; "Others" varies by exact
    // location, so it's left null here and confirmed with the customer
    // directly after checkout (see CartDrawer's messaging for this).
    const DELIVERY_FEES: Record<string, number> = {
      'LASU On-Campus': 400,
      'LASU Off-Campus': 800,
    };
    const deliveryFee =
      deliveryMethod === 'delivery' ? DELIVERY_FEES[deliveryZone] ?? null : null;

    // 1. Create the order up front, in 'pending' status — this is the row
    // the Paystack webhook will later flip to 'paid' and deduct stock
    // against, once payment is actually confirmed.
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .insert({
        total_amount: totalAmount,
        status: 'pending',
        customer_name: customerName || null,
        customer_email: email,
        customer_phone: customerPhone || null,
        delivery_method: deliveryMethod,
        delivery_zone: deliveryMethod === 'delivery' ? deliveryZone : null,
        delivery_fee: deliveryFee,
        shipping_address: address || null,
      })
      .select('id')
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: orderErr?.message || 'Could not create order.' }, { status: 500 });
    }
    createdOrderId = order.id;

    const orderItemsPayload = items.map((item: any) => ({
      order_id: order.id,
      product_id: item.product_id || item.id,
      quantity: item.quantity,
      price_at_purchase: item.price ?? item.unit_price ?? 0,
      item_type: item.item_type || 'Full Unit',
    }));

    const { error: itemsErr } = await supabaseAdmin.from('order_items').insert(orderItemsPayload);
    if (itemsErr) {
      await supabaseAdmin.from('orders').delete().eq('id', order.id);
      return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    }

    // 2. Initialize the Paystack transaction, carrying the order id so the
    // webhook knows exactly which order to reconcile on payment success.
    const amountInKobo = totalAmount * 100;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountInKobo,
        callback_url: `${siteUrl}/store?payment=success`,
        metadata: {
          order_id: order.id,
          customer_name: customerName,
          customer_phone: customerPhone,
          delivery_method: deliveryMethod,
          delivery_zone: deliveryZone || null,
          delivery_fee: deliveryFee,
        },
      }),
    });

    const data = await response.json();

    if (!data.status) {
      await supabaseAdmin.from('orders').delete().eq('id', order.id);
      return NextResponse.json({ error: data.message || 'Paystack initialization failed.' }, { status: 400 });
    }

    return NextResponse.json({ authorization_url: data.data.authorization_url });
  } catch (error: any) {
    console.error('Checkout error:', error);
    if (createdOrderId) {
      await supabaseAdmin.from('orders').delete().eq('id', createdOrderId);
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}