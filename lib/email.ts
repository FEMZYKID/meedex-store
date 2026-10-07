// lib/email.ts
//
// Sends transactional email via Resend (https://resend.com) using a plain
// fetch call, so no new npm dependency is required.
//
// SETUP REQUIRED (env vars, e.g. in Vercel):
//   RESEND_API_KEY   - from your Resend dashboard (free tier is fine to start)
//   RESEND_FROM_EMAIL - e.g. "Meedex Store <orders@yourdomain.com>"
//
// IMPORTANT: Resend's shared sandbox address (onboarding@resend.dev) can
// only deliver to the email address you signed up to Resend with — it will
// silently fail (or bounce) for real customers. To actually email
// customers, verify your own sending domain in the Resend dashboard first,
// then use an address on that domain for RESEND_FROM_EMAIL.
//
// Email sending is treated as best-effort everywhere it's called: a failure
// here is logged but never blocks the underlying order/status update, since
// losing a notification email is far less costly than losing an order.

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
  
    if (!apiKey || !from) {
      console.error('[email] RESEND_API_KEY or RESEND_FROM_EMAIL is not configured — skipping send.');
      return { success: false, error: 'Email not configured' };
    }
  
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to, subject, html }),
      });
  
      if (!res.ok) {
        const errText = await res.text();
        console.error('[email] Resend API error:', res.status, errText);
        return { success: false, error: errText };
      }
  
      return { success: true };
    } catch (err: any) {
      console.error('[email] send failed:', err.message);
      return { success: false, error: err.message };
    }
  }