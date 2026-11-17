import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { processSuccessfulPayment } from '../../../../lib/orderPayments';

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const paystackSignature = req.headers.get('x-paystack-signature') || '';

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      console.error('PAYSTACK_SECRET_KEY is not defined.');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Verify Paystack's signature (proves the message really came from Paystack)
    const expected = crypto.createHmac('sha512', secretKey).update(bodyText).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(paystackSignature);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      console.error('Invalid Paystack signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(bodyText);

    if (event.event === 'charge.success') {
      const data = event.data;
      const orderId = data?.metadata?.order_id;
      const reference = data?.reference;

      if (!orderId || !reference) {
        console.error('Webhook charge.success with no order_id or reference:', reference);
        return NextResponse.json({ error: 'Missing order_id in metadata' }, { status: 400 });
      }

      const result = await processSuccessfulPayment({ orderId, reference, tx: data });

      // A real failure: tell Paystack so it retries later
      if (result === 'error') {
        return NextResponse.json({ error: 'Failed to record online order' }, { status: 500 });
      }
      return NextResponse.json({ status: result }, { status: 200 });
    }

    // Always acknowledge other events
    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}