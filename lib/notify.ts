// lib/notify.ts
// Staff alerts: Telegram (instant) plus email (backup). Both are best-effort
// and never throw, so a failed alert can't affect an order.
import { sendEmail } from './email';
import type { OrderForEmail, OrderItemForEmail } from './orderEmails';

interface OrderForNotify extends OrderForEmail {
  customer_phone?: string | null;
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

export async function notifyStaff(subject: string, text: string) {
  await Promise.allSettled([sendTelegram(`${subject}\n\n${text}`), sendStaffEmail(subject, text)]);
}

export async function notifyNewOrder(order: OrderForNotify, items: OrderItemForEmail[]) {
  const total = Number(order.total_amount) + Number(order.delivery_fee || 0);
  const lines = items
    .slice(0, 30)
    .map(
      (i) =>
        `• ${i.quantity} x ${cut(i.name, 60)}${i.item_type !== 'Full Unit' ? ` (${i.item_type})` : ''}`
    )
    .join('\n');

  const fulfilment =
    order.delivery_method === 'pickup'
      ? 'Store pickup'
      : `Delivery - ${cut(order.delivery_zone, 50)}${
          order.shipping_address ? `, ${cut(order.shipping_address, 200)}` : ''
        }`;

  const text = [
    `Order #${order.id.slice(0, 8)} is paid and waiting for confirmation.`,
    '',
    `Customer: ${cut(order.customer_name, 100) || 'Unnamed'}`,
    `Phone: ${cut(order.customer_phone, 20) || 'n/a'}`,
    `Fulfilment: ${fulfilment}`,
    '',
    lines,
    '',
    `Total paid: ${naira(total)}`,
    order.delivery_method === 'delivery' && !(order.delivery_fee && order.delivery_fee > 0)
      ? 'Delivery fee not charged yet: confirm it with the customer.'
      : '',
    '',
    `Open: ${STAFF_SITE}/online-orders`,
  ]
    .filter((line, idx, arr) => line !== '' || arr[idx - 1] !== '')
    .join('\n');

  await notifyStaff(`🛒 New online order - ${naira(total)}`, text);
}