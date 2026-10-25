// lib/email.ts
// Sends transactional email through Brevo's API.
// Env var (Vercel, Sensitive): BREVO_API_KEY
// The sender address must be verified in Brevo on an authenticated domain.
import { SUPPORT_EMAIL } from './storeConfig';

const SENDER_NAME = 'MEEDEX GADGETS';

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error('[email] BREVO_API_KEY is not configured, skipping send.');
    return { success: false, error: 'Email not configured' };
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SUPPORT_EMAIL },
        replyTo: { email: SUPPORT_EMAIL, name: SENDER_NAME },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const errText = await res.text();
      let hint = '';
      if (res.status === 401) hint = ' (API key invalid, revoked, or expired from 90 days unused)';
      else if (res.status === 400) hint = ' (check the sender address is verified in Brevo)';
      console.error(`[email] Brevo API error ${res.status}${hint}:`, errText);
      return { success: false, error: errText };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[email] send failed:', message);
    return { success: false, error: message };
  }
}