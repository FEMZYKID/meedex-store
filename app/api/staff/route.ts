// app/api/staff/route.ts
//
// This is the one place this app needs a real server: creating or deleting a
// Supabase Auth login can only be done with the service_role key, and that key
// must never reach the browser. This route holds it server-side only and
// double-checks the caller is a logged-in Admin before doing anything.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USERNAME_RE = /^[a-z0-9._-]{2,30}$/;
const MIN_PIN_LENGTH = 6; // Supabase's own minimum

async function requireAdmin(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;

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
    return null;
  }

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

  const cleanName = String(name ?? '').trim().slice(0, 100);
  const cleanUsername = String(username ?? '').trim().toLowerCase();
  const cleanPin = String(pin ?? '');

  if (
    !cleanName ||
    !USERNAME_RE.test(cleanUsername) ||
    cleanPin.length < MIN_PIN_LENGTH ||
    !['Admin', 'Cashier'].includes(role)
  ) {
    return NextResponse.json(
      {
        error: `Missing or invalid fields. Username: 2-30 letters, numbers, dots, dashes or underscores. PIN: at least ${MIN_PIN_LENGTH} characters.`,
      },
      { status: 400 }
    );
  }

  const email = `${cleanUsername}@deprince.pos`;

  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: cleanPin,
    email_confirm: true,
    user_metadata: { name: cleanName, role },
  });

  if (createErr || !created?.user) {
    return NextResponse.json({ error: createErr?.message || 'Could not create login.' }, { status: 400 });
  }

  const { error: staffErr } = await supabaseAdmin.from('staff').insert([
    {
      id: created.user.id,
      name: cleanName,
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

// Reset a staff member's lockout and failed-attempt counters (Admins only)
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden — Admins only.' }, { status: 403 });
  }

  const { id, action } = await req.json();
  if (action !== 'unlock' || !UUID_RE.test(String(id ?? ''))) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from('staff')
    .update({ failed_attempts: 0, lockout_until: null, is_locked: false, last_failed_at: null })
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('[staff unlock] failed:', error.message);
    return NextResponse.json({ error: 'Could not reset this account.' }, { status: 400 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
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

  // Deleting the auth user cascades to the staff row (FK ON DELETE CASCADE).
  // Some staff rows may have been created without a matching auth login
  // (e.g. seeded directly into the table), so for those, fall back to
  // removing the staff row itself instead of failing outright.
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) {
    const notFound = /not.*found/i.test(error.message);
    if (!notFound) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const { error: staffDeleteErr } = await supabaseAdmin.from('staff').delete().eq('id', id);
    if (staffDeleteErr) {
      return NextResponse.json({ error: staffDeleteErr.message }, { status: 400 });
    }
  }

  return NextResponse.json({ success: true });
}