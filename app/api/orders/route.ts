// app/api/login/route.ts
//
// Server-side sign-in. The browser sends the username and PIN here. This
// route checks the account lockout, verifies the PIN with Supabase Auth,
// records failures itself, and only then hands back a session.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

const NETWORK_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_FAILS_PER_NETWORK = 20; // wrong PINs per network per window
const FAIL_DECAY_MS = 24 * 60 * 60 * 1000; // failed attempts expire after 24h of quiet

// Best-effort, in memory (resets on redeploys and cold starts). Only wrong
// PINs count, so normal logins never use up this budget.
const failMap = new Map<string, { count: number; windowStart: number }>();

function getIp(req: NextRequest) {
  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

function pruneExpired(now: number) {
  if (failMap.size < 500) return;
  for (const [key, value] of failMap) {
    if (now - value.windowStart > NETWORK_WINDOW_MS) failMap.delete(key);
  }
}

function networkWaitSeconds(ip: string): number {
  const entry = failMap.get(ip);
  if (!entry) return 0;
  const now = Date.now();
  if (now - entry.windowStart > NETWORK_WINDOW_MS) {
    failMap.delete(ip);
    return 0;
  }
  if (entry.count < MAX_FAILS_PER_NETWORK) return 0;
  return Math.max(1, Math.ceil((entry.windowStart + NETWORK_WINDOW_MS - now) / 1000));
}

function recordNetworkFail(ip: string) {
  const now = Date.now();
  pruneExpired(now);
  const entry = failMap.get(ip);
  if (!entry || now - entry.windowStart > NETWORK_WINDOW_MS) {
    failMap.set(ip, { count: 1, windowStart: now });
  } else {
    entry.count += 1;
  }
}

// A fresh, stateless client for checking the PIN (nothing is stored on the server).
function getAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface FailResult {
  new_attempts?: number;
  is_total_lock?: boolean;
  lockout_seconds?: number;
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);

  const wait = networkWaitSeconds(ip);
  if (wait > 0) {
    return NextResponse.json(
      {
        error: `Too many failed attempts from this network. Please try again in ${Math.ceil(wait / 60)} minute(s).`,
        retryAfterSeconds: wait,
      },
      { status: 429 }
    );
  }

  let body: { username?: unknown; pin?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const username = String(body?.username ?? '').trim().toLowerCase().slice(0, 50);
  const pin = String(body?.pin ?? '').trim().slice(0, 200);
  if (!username || !pin) {
    return NextResponse.json({ error: 'Username and PIN are required.' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { data: staff, error: staffErr } = await admin
    .from('staff')
    .select('id, role, is_locked, lockout_until, failed_attempts, last_failed_at')
    .eq('username', username)
    .maybeSingle();

  if (staffErr) {
    console.error('[login] staff lookup failed:', staffErr.message);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }

  if (!staff) {
    recordNetworkFail(ip);
    return NextResponse.json({ error: 'Invalid Username or PIN' }, { status: 401 });
  }

  if (staff.is_locked) {
    return NextResponse.json(
      { error: '🔒 Account is in TOTAL LOCKDOWN. Contact Admin to reset.', locked: true },
      { status: 423 }
    );
  }

  if (staff.lockout_until) {
    const secs = Math.ceil((new Date(staff.lockout_until).getTime() - Date.now()) / 1000);
    if (secs > 0) {
      return NextResponse.json(
        { error: 'Cool off active.', cooldownSeconds: secs },
        { status: 429 }
      );
    }
  }

  // Old failures expire after a quiet period, so occasional typos don't pile up forever.
  const priorFails = staff.failed_attempts ?? 0;
  if (
    priorFails > 0 &&
    (!staff.last_failed_at || Date.now() - new Date(staff.last_failed_at).getTime() > FAIL_DECAY_MS)
  ) {
    await admin.from('staff').update({ failed_attempts: 0, lockout_until: null }).eq('id', staff.id);
  }

  const authClient = getAuthClient();
  const { data: signIn, error: signInErr } = await authClient.auth.signInWithPassword({
    email: `${username}@deprince.pos`,
    password: pin,
  });

  if (signInErr || !signIn?.session) {
    // A busy or failing sign-in service is not the user's fault: don't count it.
    if (signInErr && signInErr.status && (signInErr.status === 429 || signInErr.status >= 500)) {
      console.error('[login] Supabase Auth unavailable:', signInErr.status, signInErr.message);
      return NextResponse.json(
        { error: 'The sign-in service is busy. Please try again in a moment.' },
        { status: 503 }
      );
    }

    recordNetworkFail(ip);

    const { data: failData, error: failErr } = await admin.rpc('record_failed_login', {
      p_username: username,
    });
    if (failErr) console.error('[login] record_failed_login failed:', failErr.message);

    await admin
      .from('staff')
      .update({ last_failed_at: new Date().toISOString() })
      .eq('id', staff.id);

    const fail: FailResult | null = Array.isArray(failData) ? failData[0] ?? null : failData ?? null;

    return NextResponse.json(
      {
        error: 'Invalid Username or PIN',
        attempts: fail?.new_attempts ?? null,
        isTotalLock: !!fail?.is_total_lock,
        lockoutSeconds: fail?.lockout_seconds ?? 0,
      },
      { status: 401 }
    );
  }

  if (signIn.user.id !== staff.id) {
    console.error('[login] auth user does not match staff profile for', username);
    return NextResponse.json({ error: 'This account has no staff profile.' }, { status: 403 });
  }

  await admin
    .from('staff')
    .update({ failed_attempts: 0, lockout_until: null, is_locked: false, last_failed_at: null })
    .eq('id', staff.id);

  return NextResponse.json({
    session: {
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
    },
    role: staff.role,
  });
}