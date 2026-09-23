// app/api/login/route.ts
//
// The pre-auth lockout check and failed-attempt recording used to be
// callable directly from the browser (as anon). That meant 6 raw HTTP
// requests — no valid credentials needed — could permanently lock the
// Admin account. This route is now the ONLY way to reach those two
// functions: anon's direct execute permission on them has been revoked
// in the database, and this route rate-limits by IP before calling them
// with the service role key.
//
// NOTE on the rate limiter: this is an in-memory Map, which is
// best-effort on Vercel's serverless platform — it resets on cold starts
// and isn't shared across parallel instances, so it won't stop a
// sophisticated, distributed attacker. It DOES stop the common case: a
// simple script hammering this endpoint from one machine. For airtight
// protection, move this to Vercel KV / Upstash Redis, and/or enable
// CAPTCHA on Supabase's Email provider (Dashboard → Authentication).

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazily constructed — NOT at module top-level. Next.js briefly loads every
// API route module during `next build` to collect its metadata, which means
// top-level code runs at BUILD time, not just at request time. On a local
// machine (or any CI) without SUPABASE_SERVICE_ROLE_KEY set, constructing
// the client eagerly here crashed the build with "supabaseUrl is required."
// Deferring construction until a real request comes in avoids that entirely.
let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return supabaseAdmin;
}

const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS = 8; // generous enough for real mistyped-PIN attempts, tight for scripted abuse

function isRateLimited(ip: string) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return false;
  }

  entry.count += 1;
  return entry.count > MAX_REQUESTS;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many attempts from this network. Please wait a while and try again.' },
      { status: 429 }
    );
  }

  const { action, username } = await req.json();

  if (!username || typeof username !== 'string') {
    return NextResponse.json({ error: 'Username is required.' }, { status: 400 });
  }

  const cleanUsername = username.trim().toLowerCase();
  const supabaseAdminClient = getSupabaseAdmin();

  if (action === 'status') {
    const { data, error } = await supabaseAdminClient.rpc('get_staff_lockout_status', {
      p_username: cleanUsername,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ status: data?.[0] || null });
  }

  if (action === 'fail') {
    const { data, error } = await supabaseAdminClient.rpc('record_failed_login', {
      p_username: cleanUsername,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ result: data?.[0] || null });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}