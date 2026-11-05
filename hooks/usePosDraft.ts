/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CartItem } from '../types';

// Saves an unfinished POS order on this device so an automatic logout,
// refresh or closed tab doesn't lose it. One draft per staff member.

const MAX_AGE_MS = 12 * 60 * 60 * 1000; // drafts older than 12 hours are discarded
const VALID_TYPES = ['Full Unit', 'Adapter', 'Cable'];
const VALID_PAYMENT = ['Cash', 'Transfer', 'POS Card'] as const;

export interface PosDraft {
  cart: CartItem[];
  paymentMethod: (typeof VALID_PAYMENT)[number];
  isDamaged: boolean;
  damageComment: string;
  savedAt: number;
}

const keyFor = (userId: string) => `meedex_pos_draft_${userId}`;

export function savePosDraft(userId: string, draft: Omit<PosDraft, 'savedAt'>) {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    /* storage unavailable: nothing to do */
  }
}

export function clearPosDraft(userId: string) {
  try {
    localStorage.removeItem(keyFor(userId));
  } catch {
    /* ignore */
  }
}

export function loadPosDraft(userId: string): PosDraft | null {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return null;

    const parsed: any = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      clearPosDraft(userId);
      return null;
    }
    if (!Array.isArray(parsed.cart)) return null;

    const cart: CartItem[] = [];
    for (const item of parsed.cart.slice(0, 100)) {
      const qty = Number(item?.quantity);
      const price = Number(item?.unit_price);
      if (
        typeof item?.id !== 'string' ||
        typeof item?.product_id !== 'string' ||
        !VALID_TYPES.includes(item?.item_type) ||
        !Number.isInteger(qty) ||
        qty < 1 ||
        !Number.isFinite(price) ||
        price < 0
      ) {
        continue;
      }
      cart.push({
        id: item.id,
        product_id: item.product_id,
        name: String(item.name ?? '').slice(0, 200),
        sku: String(item.sku ?? '').slice(0, 100),
        item_type: item.item_type as CartItem['item_type'],
        unit_price: price,
        quantity: qty,
        subtotal: qty * price,
      });
    }

    const paymentMethod = VALID_PAYMENT.includes(parsed.paymentMethod) ? parsed.paymentMethod : 'Cash';

    return {
      cart,
      paymentMethod,
      isDamaged: !!parsed.isDamaged,
      damageComment: String(parsed.damageComment ?? '').slice(0, 500),
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}