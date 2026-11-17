// lib/notify.ts
// Staff alerts through Telegram. New orders and new reviews go to Telegram
// only. Serious problems (a refund that must be done by hand, a payment
// amount mismatch) still send an email too, as a backup. Everything is
// best-effort and never throws, so a failed alert can't affect an order.
import { sendEmail } from './email';
import { getSupabaseAdmin } from './supabaseAdmin';
import type { OrderForEmail, OrderItemForEmail } from './orderEmails';

interface OrderForNotify extends OrderForEmail {
  customer_phone?: string | null;
  needs_sourcing?: boolean | null;
}

const STAFF_SITE = process.env.STAFF_SITE_URL || 'https://staff.meedex.com.ng';

const naira = (n: number) => `₦${Number(n).toLocaleString()}`;
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cut = (s: string | null | undefined, max: number) => String(s ?? '').slice(0, max);

async function sendTelegram(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn('[notify] Telegram is not configured, skipping.');
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 3500),
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error('[notify] Telegram error:', res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('[notify] Telegram failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

async function sendStaffEmail(subject: string, text: string): Promise<boolean> {
  const to = process.env.NOTIFY_EMAIL;
  if (!to) {
    console.warn('[notify] NOTIFY_EMAIL is not set, skipping email alert.');
    return false;
  }
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;white-space:pre-line;">${esc(text)}</div>`;
  const result = await sendEmail({ to, subject, html });
  return result.success;
}

// Telegram always. Email too, unless you pass { email: false }.
export async function notifyStaff(subject: string, text: string, options: { email?: boolean } = {}) {
  const tasks: Promise<boolean>[] = [sendTelegram(`${subject}\n\n${text}`)];
  if (options.email !== false) tasks.push(sendStaffEmail(subject, text));
  await Promise.allSettled(tasks);
}

// Which items the stock on hand did not cover
async function sourcingLines(orderId: string): Promise<string[]> {
  try {
    const { data } = await getSupabaseAdmin()
      .from('order_items')
      .select('quantity, short_qty, item_type, products(name)')
      .eq('order_id', orderId)
      .gt('short_qty', 0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((i: any) => {
      const product = Array.isArray(i.products) ? i.products[0] : i.products;
      const label = `${cut(product?.name || 'Item', 60)}${
        i.item_type && i.item_type !== 'Full Unit' ? ` (${i.item_type})` : ''
      }`;
      return `• ${label}: short by ${i.short_qty} of ${i.quantity}`;
    });
  } catch (err) {
    console.error('[notify] could not load sourcing lines:', err instanceof Error ? err.message : err);
    return [];
  }
}

// New paid order: Telegram only (no email)
export async function notifyNewOrder(order: OrderForNotify, items: OrderItemForEmail[]) {
  const total = Number(order.total_amount) + Number(order.delivery_fee || 0);
  const lines = items
    .slice(0, 30)
    .map(
      (i) =>
        `• ${i.quantity} x ${cut(i.name, 60)}${i.item_type !== 'Full Unit' ? ` (${i.item_type})` : ''}`
    )
    .join('\n');

  const isDelivery = order.delivery_method === 'delivery';
  const feeKnown = order.delivery_fee !== null && order.delivery_fee !== undefined;

  const fulfilment = !isDelivery
    ? 'Store pickup'
    : `Delivery - ${cut(order.delivery_zone, 50)}${
        order.shipping_address ? `, ${cut(order.shipping_address, 200)}` : ''
      }`;

  let feeLine = '';
  if (isDelivery && !feeKnown) {
    feeLine = 'Delivery fee not charged yet: confirm it with the customer.';
  } else if (isDelivery && Number(order.delivery_fee) === 0) {
    feeLine = 'Delivery fee: FREE';
  }

  let sourcingBlock = '';
  if (order.needs_sourcing) {
    const short = await sourcingLines(order.id);
    sourcingBlock = ['⚠️ NEEDS SOURCING: stock on hand does not cover this order.', ...short].join('\n');
  }

  const text = [
    `Order #${order.id.slice(0, 8)} is paid and waiting for confirmation.`,
    '',
    `Customer: ${cut(order.customer_name, 100) || 'Unnamed'}`,
    `Phone: ${cut(order.customer_phone, 20) || 'n/a'}`,
    `Fulfilment: ${fulfilment}`,
    '',
    lines,
    '',
    sourcingBlock,
    sourcingBlock ? '' : '',
    `Total paid: ${naira(total)}`,
    feeLine,
    '',
    `Open: ${STAFF_SITE}/online-orders`,
  ]
    .filter((line, idx, arr) => line !== '' || arr[idx - 1] !== '')
    .join('\n');

  const subjectPrefix = order.needs_sourcing ? '⚠️ Needs sourcing - ' : '';
  await notifyStaff(`🛒 ${subjectPrefix}New online order - ${naira(total)}`, text, { email: false });
}