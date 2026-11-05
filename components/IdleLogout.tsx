'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

// Change these two numbers to suit your shop.
const IDLE_LIMIT_MS = 10 * 60 * 1000; // log out after 15 minutes with no activity
const WARNING_MS = 60 * 1000; // show a warning for the last 60 seconds

const CHECK_EVERY_MS = 5000;
const STORAGE_KEY = 'meedex_last_activity';
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'] as const;

// The timeout is enforced ONLY on the staff pages (POS and admin side).
// It never applies to the shopping site, the login page or the coming-soon
// page. ("/" is the POS on localhost and preview addresses; on the customer
// domain this component isn't loaded at all.)
const STAFF_AREAS = ['/admin', '/pos', '/finance', '/online-orders'];
function isStaffArea(pathname: string | null) {
  if (!pathname) return false;
  if (pathname === '/') return true;
  return STAFF_AREAS.some((area) => pathname === area || pathname.startsWith(`${area}/`));
}

function readLast(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : Date.now();
  } catch {
    return Date.now();
  }
}

function writeLast(ts: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(ts));
  } catch {
    /* storage unavailable: the timer still works for this tab */
  }
}

export default function IdleLogout() {
  const router = useRouter();
  const pathname = usePathname();
  const inStaffArea = isStaffArea(pathname);

  const [signedIn, setSignedIn] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastWrite = useRef(0);
  const loggingOut = useRef(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const has = !!data.session;
      if (has) writeLast(Date.now());
      setSignedIn(has);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const has = !!session;
      if (has) writeLast(Date.now());
      setSignedIn(has);
      if (!has) setSecondsLeft(null);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const logout = useCallback(async () => {
    if (loggingOut.current) return;
    loggingOut.current = true;
    setSecondsLeft(null);
    try {
      await supabase.auth.signOut();
    } finally {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      loggingOut.current = false;
      router.replace('/login?reason=idle');
    }
  }, [router]);

  const check = useCallback(() => {
    if (!inStaffArea) {
      setSecondsLeft(null);
      return;
    }
    const idle = Date.now() - readLast();
    if (idle >= IDLE_LIMIT_MS) {
      void logout();
    } else if (idle >= IDLE_LIMIT_MS - WARNING_MS) {
      setSecondsLeft(Math.max(1, Math.ceil((IDLE_LIMIT_MS - idle) / 1000)));
    } else {
      setSecondsLeft(null);
    }
  }, [logout, inStaffArea]);

  useEffect(() => {
    if (!signedIn) return;

    // Activity is tracked everywhere, but the logout is only enforced on staff pages.
    const onActivity = () => {
      const now = Date.now();
      if (now - lastWrite.current > 2000) {
        lastWrite.current = now;
        writeLast(now);
        setSecondsLeft(null);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    check();

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity));
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [signedIn, check]);

  if (!signedIn || !inStaffArea || secondsLeft === null) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-5 text-center text-white">
        <h2 className="text-base font-bold mb-1">Still there?</h2>
        <p className="text-xs text-slate-300 mb-4">
          For security, you will be logged out in{' '}
          <span className="font-bold text-amber-400">{secondsLeft}</span> seconds because of inactivity.
        </p>
        <div className="flex justify-center gap-2">
          <button
            onClick={() => {
              writeLast(Date.now());
              setSecondsLeft(null);
            }}
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold px-4 py-2 rounded-lg"
          >
            Stay logged in
          </button>
          <button
            onClick={() => void logout()}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold px-4 py-2 rounded-lg"
          >
            Log out now
          </button>
        </div>
      </div>
    </div>
  );
}