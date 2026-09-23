'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import FinanceContent from '../../components/FinanceContent';
import type { CurrentUser } from '../../types';

export default function FinancePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data: profile, error } = await supabase
        .from('staff')
        .select('id, name, role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error || !profile) {
        await supabase.auth.signOut();
        router.push('/login');
        return;
      }

      // Both Admin and Cashier can reach this page — the actual edit/delete
      // restriction on old records is enforced per-role inside FinanceContent
      // (and for real, at the database level via RLS).
      setCurrentUser(profile);
    };

    init();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push('/login');
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">
        Loading...
      </div>
    );
  }

  return <FinanceContent role={currentUser.role} />;
}