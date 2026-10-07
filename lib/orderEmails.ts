// lib/orderEmails.ts
import { sendEmail } from './email';
import {
  STORE_PICKUP_ADDRESS,
  PICKUP_WINDOW_NOTE,
  DELIVERY_TIMEFRAMES,
  DEFAULT_DELIVERY_TIMEFRAME_NOTE,
  SUPPORT_PHONE,
  SUPPORT_EMAIL,
  type DeliveryZone,
} from './storeConfig';

export type OrderEmailStage = 'processing' | 'confirmed' | 'refunded' | 'out_for_delivery' | 'delivered';

export interface OrderForEmail {
  id: string;
  paystack_reference: string | null;
  customer_name: string | null;
  customer_email: string | null;
  delivery_method: 'pickup' | 'delivery' | null;
  delivery_zone: string | null;
  shipping_address: string | null;
  total_amount: number;
  delivery_fee: number | null;
}

export interface OrderItemForEmail {
  name: string;
  item_type: string;
  quantity: number;
  price_at_purchase: number;
}

const naira = (n: number) => `₦${Number(n).toLocaleString()}`;

function shell(title: string, body: string) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;">
    <div style="background:#312e81;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;">
      <div style="font-size:18px;font-weight:bold;">MEEDEX STORE</div>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 8px 8px;">
      <h2 style="margin:0 0 12px;font-size:18px;">${title}</h2>
      ${body}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
      <p style="font-size:12px;color:#6b7280;margin:0;">
        Questions? Call ${SUPPORT_PHONE} or email ${SUPPORT_EMAIL}.
      </p>
    </div>
  </div>`;
}

function orderDetails(order: OrderForEmail, items: OrderItemForEmail[]) {
  const rows = items
    .map(
      (i) => `
      <tr>
        <td style="padding:6px 0;border-bottom:1px solid #f3f4f6;">${i.name}${
        i.item_type !== 'Full Unit' ? ` (${i.item_type} only)` : ''
      } × ${i.quantity}</td>
        <td style="padding:6px 0;border-bottom:1px solid #f3f4f6;text-align:right;">${naira(
          i.price_at_purchase * i.quantity
        )}</td>
      </tr>`
    )
    .join('');

  const deliveryLine =
    order.delivery_fee && order.delivery_fee > 0
      ? `<tr><td style="padding:6px 0;">Delivery fee</td><td style="padding:6px 0;text-align:right;">${naira(order.delivery_fee)}</td></tr>`
      : '';
  const total = Number(order.total_amount) + Number(order.delivery_fee || 0);

  const fulfilment =
    order.delivery_method === 'pickup'
      ? `Store pickup — ${STORE_PICKUP_ADDRESS}`
      : `Delivery — ${order.delivery_zone || ''}${order.shipping_address ? `, ${order.shipping_address}` : ''}`;

  return `
    <p style="font-size:13px;margin:0 0 4px;"><strong>Order ID:</strong> ${order.id}</p>
    ${
      order.paystack_reference
        ? `<p style="font-size:13px;margin:0 0 4px;"><strong>Transaction reference:</strong> ${order.paystack_reference}</p>`
        : ''
    }
    <p style="font-size:13px;margin:0 0 12px;"><strong>Fulfilment:</strong> ${fulfilment}</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      ${rows}
      ${deliveryLine}
      <tr>
        <td style="padding:8px 0;font-weight:bold;">Total paid</td>
        <td style="padding:8px 0;text-align:right;font-weight:bold;">${naira(total)}</td>
      </tr>
    </table>`;
}

export function buildOrderEmail(stage: OrderEmailStage, order: OrderForEmail, items: OrderItemForEmail[]) {
  const name = order.customer_name || 'there';
  const isPickup = order.delivery_method === 'pickup';
  const details = orderDetails(order, items);
  const timeframe =
    DELIVERY_TIMEFRAMES[order.delivery_zone as DeliveryZone] || DEFAULT_DELIVERY_TIMEFRAME_NOTE;

  switch (stage) {
    case 'processing':
      return {
        subject: 'We received your order — Meedex Store',
        html: shell(
          'Your order is being processed',
          `<p style="font-size:14px;">Hi ${name}, thanks for your order! Payment was successful and we\u2019re now processing it. You\u2019ll get another email once it\u2019s confirmed.</p>${details}`
        ),
      };

    case 'confirmed':
      return {
        subject: 'Your order is confirmed — Meedex Store',
        html: shell(
          'Your order is confirmed',
          isPickup
            ? `<p style="font-size:14px;">Hi ${name}, your order is confirmed and ready for pickup. Please collect it ${PICKUP_WINDOW_NOTE} at <strong>${STORE_PICKUP_ADDRESS}</strong>.</p>${details}`
            : `<p style="font-size:14px;">Hi ${name}, your order is confirmed. One of our delivery agents will reach out to you shortly to arrange your delivery schedule. Expected delivery: ${timeframe}.</p>${details}`
        ),
      };

    case 'refunded':
      return {
        subject: 'Your order has been refunded — Meedex Store',
        html: shell(
          'Your order has been refunded',
          `<p style="font-size:14px;">Hi ${name}, we\u2019re sorry we couldn\u2019t fulfil your order. A refund has been issued for the amount below. If you have any questions, please get in touch.</p>${details}`
        ),
      };

    case 'out_for_delivery':
      return {
        subject: 'Your order is out for delivery — Meedex Store',
        html: shell(
          'Your order is on its way',
          `<p style="font-size:14px;">Hi ${name}, your order is out for delivery. Please keep your phone close so our agent can reach you.</p>${details}`
        ),
      };

    case 'delivered':
      return {
        subject: isPickup ? 'Order picked up — thank you!' : 'Order delivered — thank you!',
        html: shell(
          isPickup ? 'Your order has been picked up' : 'Your order has been delivered',
          `<p style="font-size:14px;">Hi ${name}, thank you for shopping with Meedex Store! We hope you enjoy your purchase.</p>${details}`
        ),
      };
  }
}

export async function sendOrderEmail(stage: OrderEmailStage, order: OrderForEmail, items: OrderItemForEmail[]) {
  if (!order.customer_email) return { success: false, error: 'No customer email on order' };
  const { subject, html } = buildOrderEmail(stage, order, items);
  return sendEmail({ to: order.customer_email, subject, html });
}