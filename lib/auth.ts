// lib/auth.ts
import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from './supabaseAdmin';

// Any logged-in staff member (Admin or Cashier) — used for routes any
// staff should be able to use, like managing online orders.
export async function requireStaff(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabaseAdmin.from('staff').select('role, name').eq('id', user.id).maybeSingle();
  if (!profile) return null;

  return { ...user, staffRole: profile.role, staffName: profile.name };
}