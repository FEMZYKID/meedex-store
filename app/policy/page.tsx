import Link from 'next/link';
import {
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
  SUPPORT_WHATSAPP,
} from '../../lib/storeConfig';

export const metadata = {
  title: 'Refund & Replacement Policy | MEEDEX GADGETS',
  description: 'How refunds, replacements and cancellations work at MEEDEX GADGETS.',
};

// ---- EDIT THESE ----
const REPORT_WINDOW_HOURS = 24; // how long customers have to report a defect
// Set to true to add a line promising a refund when a defective item cannot be replaced.
// Ask a Nigerian lawyer before deciding: the consumer law may require it.
const REFUND_IF_NO_REPLACEMENT = false;
const LAST_UPDATED = '28 October 2026';
// --------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border rounded-xl p-5 mb-4">
      <h2 className="text-base font-bold text-gray-900 mb-2">{title}</h2>
      <div className="text-sm text-gray-700 space-y-2 leading-relaxed">{children}</div>
    </section>
  );
}

export default function PolicyPage() {
  return (
    <main className="min-h-screen bg-gray-100 text-gray-800">
      <header className="bg-indigo-900 text-white">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="font-extrabold tracking-wide">MEEDEX GADGETS</span>
          <Link href="/store" className="text-xs font-semibold text-amber-300 hover:text-amber-200">
            ← Back to store
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Refund &amp; Replacement Policy</h1>
        <p className="text-xs text-gray-500 mb-5">Last updated: {LAST_UPDATED}</p>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm text-amber-900">
          <p className="font-bold mb-1">At a glance</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Items that have been delivered or picked up are not refundable.</li>
            <li>
              A defective item is replaced after we verify the defect, if you report it within{' '}
              {REPORT_WINDOW_HOURS} hours of purchase.
            </li>
            <li>If we cancel your order before you receive it, you get a full refund.</li>
          </ul>
        </div>

        <Section title="1. Delivered and picked-up items">
          <p>
            Once an item has been delivered to you or picked up, we do not give refunds. Please check your item
            carefully when you receive it, and make sure it is what you ordered.
          </p>
        </Section>

        <Section title="2. Defective items: replacement">
          <p>
            If your item is defective and the defect comes from us (the seller), we will replace it after
            verification. We do not give a refund in place of a replacement.
          </p>
          <p className="font-semibold text-gray-900">To qualify:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              The defect must be reported to us, and the item returned or shown to us, within{' '}
              <strong>{REPORT_WINDOW_HOURS} hours of purchase</strong>.
            </li>
            <li>We must be able to verify the defect, and it must be one that comes from us as the seller.</li>
            <li>
              Damage caused after the item reached you does not qualify. For example: drops or physical damage,
              liquid damage, misuse, or tampering.
            </li>
          </ul>
          <p>If the defect is verified, we will replace the item with the same item.</p>
          {REFUND_IF_NO_REPLACEMENT && (
            <p>If we are unable to replace the item, we will refund the price you paid for it.</p>
          )}
        </Section>

        <Section title="3. How to report a defect">
          <p>Contact us as soon as you notice the problem, and have your order ID ready. Photos or a short video help.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              WhatsApp:{' '}
              <a
                className="text-indigo-700 font-semibold underline"
                href={`https://wa.me/${SUPPORT_WHATSAPP}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {SUPPORT_PHONE}
              </a>
            </li>
            <li>
              Email:{' '}
              <a className="text-indigo-700 font-semibold underline" href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>
            </li>
          </ul>
          <p>Please keep the item and its packaging until we have looked at it.</p>
        </Section>

        <Section title="4. Orders we cancel">
          <p>
            If we have to cancel your order before you receive it (for example, an item is no longer available),
            you will receive a full refund of the amount you paid, to your original payment method. We will email
            you the reason for the cancellation, and again when the refund has been issued. Depending on your bank,
            it can take some days to show in your account.
          </p>
        </Section>

        <Section title="5. Your legal rights">
          <p>This policy does not limit any rights you have under Nigerian consumer protection law.</p>
        </Section>

        <p className="text-xs text-gray-500 text-center mt-6">
          By placing an order on this website, you confirm that you have read this policy.
        </p>
      </div>
    </main>
  );
}