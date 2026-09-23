'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { AdminAuthContext } from '../../contexts/AdminAuthContext';
import type { CurrentUser } from '../../types';

// NOTE: only /admin/sales exists as a real route so far — the other four
// are being built one at a time in the following steps. Linking to them now
// is fine (Next.js just 404s until each page exists); nothing breaks by
// having the nav ready ahead of the pages themselves.
const NAV_LINKS = [
  { href: '/admin/sales', label: 'Sales & Reports' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/staff', label: 'Staff' },
  { href: '/admin/devices', label: 'Devices' },
  { href: '/admin/inventory-issues', label: 'Returns & Damage' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
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

      if (profile.role !== 'Admin') {
        alert('Access restricted to Admins only.');
        router.push('/');
        return;
      }

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (!currentUser) return null;

  return (
    <AdminAuthContext.Provider value={currentUser}>
      <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-sans">
        <header className="flex justify-between items-center border-b border-slate-800 pb-5 mb-6">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="DEPRINCE Logo"
              className="w-12 h-12 object-contain rounded-2xl bg-slate-950 border border-cyan-500/40 p-1 shadow-[0_0_15px_rgba(6,182,212,0.35)]"
            />
            <div>
              <h1 className="text-xl font-black text-white tracking-wider uppercase">
                DEPRINCE TECHNOLOGIES <span className="text-cyan-400">ADMIN</span>
              </h1>
              <p className="text-xs text-cyan-400/80 font-medium tracking-wide italic">
                Gadgets. Innovation. Solutions.
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Logged in as: <span className="text-cyan-400 font-semibold">{currentUser.name}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 px-4 py-2 rounded-lg text-xs font-semibold transition"
            >
              ← Back to POS Register
            </Link>
            <button
              onClick={handleLogout}
              className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              Logout
            </button>
          </div>
        </header>

        <nav className="flex items-center gap-2 mb-8 overflow-x-auto pb-1">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition border ${
                  isActive
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {children}
      </div>
    </AdminAuthContext.Provider>
  );
}