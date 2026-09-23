// app/api/checkout/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { items, email, customerName, customerPhone } = await req.json();

    if (!items || items.length === 0 || !email) {
      return NextResponse.json({ error: 'Missing required cart items or email.' }, { status: 400 });
    }

    // Calculate total amount in Kobo (Paystack expects amounts multiplied by 100)
    const totalAmount = items.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0
    );
    const amountInKobo = totalAmount * 100;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    // Initialize Paystack transaction
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
          customer_name: customerName,
          customer_phone: customerPhone,
          cart_items: items.map((i: any) => ({
            id: i.id,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
          })),
        },
      }),
    });

    const data = await response.json();

    if (!data.status) {
      return NextResponse.json({ error: data.message || 'Paystack initialization failed.' }, { status: 400 });
    }

    return NextResponse.json({ authorization_url: data.data.authorization_url });
  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}