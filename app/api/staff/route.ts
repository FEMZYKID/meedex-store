// app/api/staff/route.ts
//
// This is the one place this app needs a real server: creating or deleting a
// Supabase Auth login can only be done with the service_role key, and that key
// must never reach the browser. This route holds it server-side only and
// double-checks the caller is a logged-in Admin before doing anything.

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazily constructed — NOT at module top-level. Next.js briefly loads every
// API route module during `next build` to collect its metadata, which means
// top-level code runs at BUILD time, not just at request time. On a local
// machine (or any CI) without SUPABASE_SERVICE_ROLE_KEY set, constructing
// the client eagerly here crashed the build with "supabaseUrl is required."
// Deferring construction until a real request comes in avoids that entirely.
let supabaseAdminSingleton: SupabaseClient | null = null;

function getSupabaseAdmin() {
  if (!supabaseAdminSingleton) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    supabaseAdminSingleton = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return supabaseAdminSingleton;
}

async function requireAdmin(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    console.error('[requireAdmin] no bearer token on request');
    return null;
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    console.error('[requireAdmin] getUser failed:', error?.message, error?.status);
    return null;
  }

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('staff')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileErr) {
    console.error('[requireAdmin] staff lookup error:', profileErr.message);
  }
  console.error('[requireAdmin] user.id:', user.id, 'profile:', JSON.stringify(profile));

  if (profile?.role !== 'Admin') return null;
  return user;
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden — Admins only.' }, { status: 403 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { name, username, pin, role } = await req.json();

  if (!name?.trim() || !username?.trim() || !pin || pin.length < 2 || !['Admin', 'Cashier'].includes(role)) {
    return NextResponse.json({ error: 'Missing or invalid fields.' }, { status: 400 });
  }

  const cleanUsername = username.trim().toLowerCase();
  const email = `${cleanUsername}@deprince.pos`;

  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: pin,
    email_confirm: true,
    user_metadata: { name: name.trim(), role },
  });

  if (createErr || !created?.user) {
    return NextResponse.json({ error: createErr?.message || 'Could not create login.' }, { status: 400 });
  }

  const { error: staffErr } = await supabaseAdmin.from('staff').insert([
    {
      id: created.user.id,
      name: name.trim(),
      username: cleanUsername,
      role,
      failed_attempts: 0,
      is_locked: false,
    },
  ]);

  if (staffErr) {
    // Roll back the auth login so we don't leave an orphaned account with no profile
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: staffErr.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, id: created.user.id });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden — Admins only.' }, { status: 403 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing staff id.' }, { status: 400 });

  if (id === admin.id) {
    return NextResponse.json({ error: 'You cannot delete your own logged-in account.' }, { status: 400 });
  }

  // Deleting the auth user cascades to the staff row (FK ON DELETE CASCADE)
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}