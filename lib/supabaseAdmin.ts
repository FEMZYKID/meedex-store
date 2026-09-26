// lib/supabaseAdmin.ts
//
// Server-only client using the service role key. Never import this from a
// 'use client' component — the key must never reach the browser.
//
// Constructed lazily (not at module top-level) for the same reason as
// app/api/staff/route.ts: Next.js loads every API route module during
// `next build` to collect metadata, which runs top-level code at BUILD time.
// A machine building without SUPABASE_SERVICE_ROLE_KEY set would crash the
// build if this client were constructed eagerly.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let adminSingleton: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!adminSingleton) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    adminSingleton = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminSingleton;
}