import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Ping Supabase to keep the project active
    const { count, error } = await supabase
      .from('products') // Use any existing table in your DB
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    return NextResponse.json({ status: 'ok', database: 'connected' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}