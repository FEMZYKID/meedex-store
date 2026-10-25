// lib/storeConfig.ts
//
// Central place for the business details that change independently of the
// code — pickup address, delivery fees, contact info. Edit values here
// rather than hunting through components; every file that needs these
// imports from this one.

export const STORE_PICKUP_ADDRESS = '22, Jagun Street, PPL, Ojo, Lagos. (LASU)';

export const DELIVERY_ZONES = ['LASU On-Campus', 'LASU Off-Campus', 'Others'] as const;
export type DeliveryZone = (typeof DELIVERY_ZONES)[number];

// Flat fees for zones where it's known in advance. A zone with no entry
// here (e.g. "Others") has its fee confirmed with the customer after
// checkout instead of charged upfront — see CartDrawer's messaging.
export const DELIVERY_FEES: Partial<Record<DeliveryZone, number>> = {
  'LASU On-Campus': 400,
  'LASU Off-Campus': 800,
};

// Shown to the customer as an expectation-setter, counted from when staff
// click "Confirm" on the order (not from the moment of payment).
export const DELIVERY_TIMEFRAMES: Partial<Record<DeliveryZone, string>> = {
  'LASU On-Campus': '1–2 hours after your order is confirmed',
  'LASU Off-Campus': '1–4 hours after your order is confirmed',
};
export const DEFAULT_DELIVERY_TIMEFRAME_NOTE = 'We\u2019ll confirm the expected delivery time with you directly via Whatsapp or Mail.';

export const PICKUP_WINDOW_NOTE = 'within 3 working days, between 9:00 AM and 6:00 PM';

// EDIT ME: your real support contact details.
// SUPPORT_WHATSAPP must be digits only, country code first, no + or spaces
// (e.g. Nigeria number 0801 234 5678 becomes "2348012345678").
export const SUPPORT_PHONE = '+234 906 791 1723';
export const SUPPORT_WHATSAPP = '2349067911723';
export const SUPPORT_EMAIL = 'support@meedex.com.ng';