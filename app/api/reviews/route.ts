// app/api/reviews/route.ts
//
// Customers send reviews here from the link in their "delivered" email.
// The link holds a private token tied to ONE order. Nothing is saved unless
// that order exists, is delivered, and the item was part of it.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { notifyStaff } from '../../../lib/notify';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVIEW_WINDOW_DAYS = 90;
const MAX_COMMENT = 500;
const MAX_ITEMS = 30;

// Best-effort, in memory: slows down scripts, not a hard guarantee
const WINDOW_MS = 10 * 60 * 1000;
const hits = new Map<string, { count: number; windowStart: number }>();

function tooMany(key: string, max: number): boolean {
  const now = Date.now();
  if (hits.size > 500) {
    for (const [k, v] of hits) if (now - v.windowStart > WINDOW_MS) hits.delete(k);
  }
  const entry = hits.get(key);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    hits.set(key, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > max;
}

function getIp(req: NextRequest) {
  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

interface OrderRow {
  id: string;
  status: string;
  customer_name: string | null;
  created_at: string;
  order_items:
    | {
        product_id: string;
        products: { name: string; image_url: string | null } | { name: string; image_url: string | null }[] | null;
      }[]
    | null;
}

async function loadOrder(token: string): Promise<OrderRow | null> {
  const { data } = await getSupabaseAdmin()
    .from('orders')
    .select('id, status, customer_name, created_at, order_items(product_id, products(name, image_url))')
    .eq('review_token', token)
    .maybeSingle();
  return (data as unknown as OrderRow) || null;
}

function problemWith(order: OrderRow): string | null {
  if (order.status !== 'delivered') {
    return 'You can review your items once your order has been delivered or picked up.';
  }
  const ageDays = (Date.now() - new Date(order.created_at).getTime()) / 86_400_000;
  if (ageDays > REVIEW_WINDOW_DAYS) return 'This review link has expired.';
  return null;
}

// "john alaofin" becomes "John A."
function displayName(full: string | null): string {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Customer';
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  const first = cap(parts[0]).slice(0, 30);
  return parts.length > 1 ? `${first} ${parts[parts.length - 1].charAt(0).toUpperCase()}.` : first;
}

function uniqueProducts(order: OrderRow) {
  const map = new Map<string, { name: string; image_url: string | null }>();
  for (const row of order.order_items || []) {
    const p = one(row.products);
    if (!map.has(row.product_id)) {
      map.set(row.product_id, { name: p?.name || 'Item', image_url: p?.image_url || null });
    }
  }
  return map;
}

export async function GET(req: NextRequest) {
  if (tooMany(`get:${getIp(req)}`, 60)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  const token = req.nextUrl.searchParams.get('t') || '';
  if (!UUID_RE.test(token)) {
    return NextResponse.json({ error: 'This review link is not valid.' }, { status: 404 });
  }

  const order = await loadOrder(token);
  if (!order) return NextResponse.json({ error: 'This review link is not valid.' }, { status: 404 });

  const problem = problemWith(order);
  if (problem) return NextResponse.json({ error: problem }, { status: 403 });

  const { data: existing } = await getSupabaseAdmin()
    .from('product_reviews')
    .select('product_id')
    .eq('order_id', order.id);
  const reviewed = new Set((existing || []).map((r: { product_id: string }) => r.product_id));

  const items = Array.from(uniqueProducts(order).entries()).map(([product_id, p]) => ({
    product_id,
    name: p.name,
    image_url: p.image_url,
    already_reviewed: reviewed.has(product_id),
  }));

  return NextResponse.json({
    firstName: displayName(order.customer_name).split(' ')[0],
    items,
  });
}

export async function POST(req: NextRequest) {
  if (tooMany(`post:${getIp(req)}`, 10)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  let body: { token?: unknown; reviews?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const token = String(body?.token ?? '');
  if (!UUID_RE.test(token)) {
    return NextResponse.json({ error: 'This review link is not valid.' }, { status: 404 });
  }
  if (!Array.isArray(body.reviews) || body.reviews.length === 0 || body.reviews.length > MAX_ITEMS) {
    return NextResponse.json({ error: 'Please rate at least one item.' }, { status: 400 });
  }

  const order = await loadOrder(token);
  if (!order) return NextResponse.json({ error: 'This review link is not valid.' }, { status: 404 });

  const problem = problemWith(order);
  if (problem) return NextResponse.json({ error: problem }, { status: 403 });

  const allowed = uniqueProducts(order);
  const admin = getSupabaseAdmin();

  const { data: existing } = await admin.from('product_reviews').select('product_id').eq('order_id', order.id);
  const alreadyReviewed = new Set((existing || []).map((r: { product_id: string }) => r.product_id));

  const reviewer = displayName(order.customer_name);
  const rows: {
    product_id: string;
    order_id: string;
    reviewer_name: string;
    rating: number;
    comment: string | null;
    status: 'pending';
  }[] = [];
  const seen = new Set<string>();

  for (const raw of body.reviews as { product_id?: unknown; rating?: unknown; comment?: unknown }[]) {
    const productId = String(raw?.product_id ?? '');
    const rating = Number(raw?.rating);
    const comment = String(raw?.comment ?? '').trim().slice(0, MAX_COMMENT);

    if (!UUID_RE.test(productId) || !allowed.has(productId)) {
      return NextResponse.json({ error: 'One of the items is not part of this order.' }, { status: 400 });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Ratings must be from 1 to 5 stars.' }, { status: 400 });
    }
    if (alreadyReviewed.has(productId) || seen.has(productId)) continue;

    seen.add(productId);
    rows.push({
      product_id: productId,
      order_id: order.id,
      reviewer_name: reviewer,
      rating,
      comment: comment || null,
      status: 'pending',
    });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: 'You have already reviewed these items. Thank you!' }, { status: 409 });
  }

  const { error } = await admin.from('product_reviews').insert(rows);
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'You have already reviewed these items. Thank you!' }, { status: 409 });
    }
    console.error('[reviews] insert failed:', error.message);
    return NextResponse.json({ error: 'Could not save your review. Please try again.' }, { status: 500 });
  }

  try {
    await notifyStaff(
      '⭐ New review to approve',
      `${rows.length} new ${rows.length === 1 ? 'review' : 'reviews'} from ${reviewer} (order #${order.id.slice(0, 8)}).\nOpen Admin → Reviews to approve or reject.`,
      { email: false }
    );
  } catch (err) {
    console.error('[reviews] alert failed:', err);
  }

  return NextResponse.json({ saved: rows.length });
}