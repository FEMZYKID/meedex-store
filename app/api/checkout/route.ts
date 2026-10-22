// app/api/checkout/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

type ItemType = 'Full Unit' | 'Adapter' | 'Cable';
const ITEM_TYPES: ItemType[] = ['Full Unit', 'Adapter', 'Cable'];
const MAX_LINES = 30;
const MAX_QTY_PER_LINE = 20;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ProductRow {
  id: string;
  unit_price: number | null;
  adapter_price: number | null;
  cable_price: number | null;
  is_splittable: boolean | null;
  stock_qty: number | null;
  stock_adapter: number | null;
  stock_cable: number | null;
}
interface Line {
  product_id: string;
  item_type: ItemType;
  quantity: number;
  price: number;
}

function unitPriceFor(p: ProductRow, t: ItemType): number | null {
  if (t === 'Adapter') return p.adapter_price;
  if (t === 'Cable') return p.cable_price;
  return p.unit_price;
}
function availableFor(p: ProductRow, t: ItemType): number {
  if (t === 'Adapter') return p.stock_adapter ?? 0;
  if (t === 'Cable') return p.stock_cable ?? 0;
  if (p.is_splittable) return Math.min(p.stock_adapter ?? 0, p.stock_cable ?? 0);
  return p.stock_qty ?? 0;
}

export async function POST(req: Request) {
  const supabaseAdmin = getSupabaseAdmin();
  let createdOrderId: string | null = null;

  try {
    const body = await req.json();
    const { items, email, customerName, customerPhone, deliveryMethod, deliveryZone, address } = body;

    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_LINES) {
      return NextResponse.json({ error: 'Missing or invalid cart items.' }, { status: 400 });
    }
    if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
    }
    if (!deliveryMethod || !['pickup', 'delivery'].includes(deliveryMethod)) {
      return NextResponse.json({ error: 'Invalid delivery method.' }, { status: 400 });
    }
    if (deliveryMethod === 'delivery' && (!deliveryZone || !address)) {
      return NextResponse.json({ error: 'Delivery zone and address are required for delivery.' }, { status: 400 });
    }

    // 1. Validate each line and merge duplicates (same product + type)
    const wanted = new Map<string, { product_id: string; item_type: ItemType; quantity: number }>();
    for (const raw of items) {
      const productId = String(raw?.product_id ?? raw?.id ?? '');
      const quantity = Number(raw?.quantity);
      const itemType = (raw?.item_type ?? 'Full Unit') as ItemType;

      if (!UUID_RE.test(productId)) {
        return NextResponse.json({ error: 'Invalid product in cart.' }, { status: 400 });
      }
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY_PER_LINE) {
        return NextResponse.json({ error: 'Invalid quantity in cart.' }, { status: 400 });
      }
      if (!ITEM_TYPES.includes(itemType)) {
        return NextResponse.json({ error: 'Invalid item type in cart.' }, { status: 400 });
      }
      const key = `${productId}|${itemType}`;
      const existing = wanted.get(key);
      if (existing) existing.quantity += quantity;
      else wanted.set(key, { product_id: productId, item_type: itemType, quantity });
    }

    // 2. Real prices and stock come from the database, never the browser
    const productIds = Array.from(new Set(Array.from(wanted.values()).map((w) => w.product_id)));
    const { data: products, error: productsErr } = await supabaseAdmin
      .from('products')
      .select('id, unit_price, adapter_price, cable_price, is_splittable, stock_qty, stock_adapter, stock_cable')
      .in('id', productIds);

    if (productsErr || !products) {
      console.error('Checkout product lookup failed:', productsErr?.message);
      return NextResponse.json({ error: 'Could not verify cart items.' }, { status: 500 });
    }

    const byId = new Map<string, ProductRow>(
      (products as ProductRow[]).map((p): [string, ProductRow] => [p.id, p])
    );
    const lines: Line[] = [];

    for (const w of wanted.values()) {
      const product = byId.get(w.product_id);
      if (!product) {
        return NextResponse.json({ error: 'One or more items are no longer available.' }, { status: 400 });
      }
      if (w.item_type !== 'Full Unit' && !product.is_splittable) {
        return NextResponse.json({ error: 'Invalid item type for a product in your cart.' }, { status: 400 });
      }
      const price = unitPriceFor(product, w.item_type);
      if (price === null || !(Number(price) > 0)) {
        return NextResponse.json({ error: 'One or more items cannot be purchased right now.' }, { status: 400 });
      }
      if (w.quantity > availableFor(product, w.item_type)) {
        return NextResponse.json({ error: 'One or more items are out of stock or low on stock.' }, { status: 400 });
      }
      lines.push({ product_id: w.product_id, item_type: w.item_type, quantity: w.quantity, price: Number(price) });
    }

    const totalAmount = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);

    const DELIVERY_FEES: Record<string, number> = {
      'LASU On-Campus': 400,
      'LASU Off-Campus': 800,
    };
    const deliveryFee =
      deliveryMethod === 'delivery' ? DELIVERY_FEES[deliveryZone] ?? null : null;

    // 3. Create the pending order
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
      console.error('Order insert failed:', orderErr?.message);
      return NextResponse.json({ error: 'Could not create order.' }, { status: 500 });
    }
    createdOrderId = order.id;

    const { error: itemsErr } = await supabaseAdmin.from('order_items').insert(
      lines.map((l) => ({
        order_id: order.id,
        product_id: l.product_id,
        quantity: l.quantity,
        price_at_purchase: l.price,
        item_type: l.item_type,
      }))
    );
    if (itemsErr) {
      console.error('Order items insert failed:', itemsErr.message);
      await supabaseAdmin.from('orders').delete().eq('id', order.id);
      return NextResponse.json({ error: 'Could not create order.' }, { status: 500 });
    }

    // 4. Start the Paystack payment with the server-calculated amount
    const amountToCharge = totalAmount + (deliveryFee || 0);
    const amountInKobo = Math.round(amountToCharge * 100);
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
      console.error('Paystack init failed:', data.message);
      await supabaseAdmin.from('orders').delete().eq('id', order.id);
      return NextResponse.json({ error: 'Payment could not be started. Please try again.' }, { status: 400 });
    }

    return NextResponse.json({ authorization_url: data.data.authorization_url });
  } catch (error) {
    console.error('Checkout error:', error);
    if (createdOrderId) {
      await supabaseAdmin.from('orders').delete().eq('id', createdOrderId);
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}