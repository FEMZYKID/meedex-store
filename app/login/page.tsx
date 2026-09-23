/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  // Handle live cooldown countdown
  useEffect(() => {
    if (cooldownRemaining <= 0) return;

    const interval = setInterval(() => {
      setCooldownRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldownRemaining]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldownRemaining > 0) return;

    setErrorMsg('');
    setLoading(true);

    const cleanUsername = username.trim().toLowerCase();

    // 1. Pre-check lockout status via the rate-limited server route (no PIN is
    //    exposed by this call — it only ever returns lock state)
    const statusRes = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'status', username: cleanUsername }),
    });
    const statusJson = await statusRes.json();

    if (statusRes.status === 429) {
      setLoading(false);
      setErrorMsg(statusJson.error);
      return;
    }

    const status = statusRes.ok ? statusJson.status : null;

    if (!statusRes.ok || !status) {
      setLoading(false);
      setErrorMsg('Invalid Username or PIN');
      return;
    }

    // 2. Check if account is in Total Lockdown
    if (status.is_locked) {
      setLoading(false);
      setErrorMsg('🔒 Account is in TOTAL LOCKDOWN. Contact Admin to reset.');
      return;
    }

    // 3. Check if active lockout timer exists
    if (status.lockout_until) {
      const lockTime = new Date(status.lockout_until).getTime();
      const diff = Math.ceil((lockTime - Date.now()) / 1000);
      if (diff > 0) {
        setCooldownRemaining(diff);
        setLoading(false);
        setErrorMsg(`⏳ Cool off active. Please wait ${formatTime(diff)}.`);
        return;
      }
    }

    // 4. Verify credentials via real Supabase Auth (server-verified, not client-trusted)
    const email = `${cleanUsername}@deprince.pos`;
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: pin.trim(),
    });

    if (signInError || !signInData.session) {
      // 5. Record the failed attempt via the same rate-limited server route
      const failRes = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fail', username: cleanUsername }),
      });
      const failJson = await failRes.json();

      if (failRes.status === 429) {
        setLoading(false);
        setPin('');
        setErrorMsg(failJson.error);
        return;
      }

      const fail = failRes.ok ? failJson.result : null;

      let msg = 'Invalid Username or PIN';

      if (fail) {
        const attempts = fail.new_attempts;
        if (fail.is_total_lock) {
          msg = '🔒 6 Failed attempts! Contact Admin to reset.';
        } else if (attempts === 3) {
          msg = '⚠️ 3 Failed attempts!';
          setCooldownRemaining(fail.lockout_seconds);
        } else if (attempts === 4) {
          msg = '⚠️ 4 Failed attempts!';
          setCooldownRemaining(fail.lockout_seconds);
        } else if (attempts === 5) {
          msg = '🚨 5 Failed attempts!';
          setCooldownRemaining(fail.lockout_seconds);
        } else if (attempts > 0) {
          msg = `❌ Incorrect PIN (${6 - attempts} attempts remaining before Total Lockdown)`;
        }
      }

      setLoading(false);
      setPin('');
      setErrorMsg(msg);
      return;
    }

    // 6. Successful login -> reset lockout counters (runs as the now-authenticated user)
    await supabase.rpc('record_successful_login');

    // 7. Load profile to know where to route
    const { data: profile } = await supabase
      .from('staff')
      .select('id, name, role')
      .eq('id', signInData.session.user.id)
      .maybeSingle();

    setLoading(false);

    router.push(profile?.role === 'Admin' ? '/admin' : '/');
  };

  // Enable button once user types at least 2 characters in both fields
  const isInputReady = username.trim().length >= 2 && pin.length >= 2;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-black text-white uppercase tracking-wider">
            DEPRINCE <span className="text-cyan-400">POS</span>
          </h1>
          <p className="text-xs text-slate-400">Enter your credentials to unlock register</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Username</label>
            <input
              type="text"
              required
              disabled={loading || cooldownRemaining > 0}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-40"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Enter PIN</label>
            <input
              type="password"
              required
              disabled={loading || cooldownRemaining > 0}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-center text-xl font-mono text-cyan-400 tracking-widest focus:outline-none focus:border-cyan-500 disabled:opacity-40"
            />
          </div>

          {cooldownRemaining > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs p-3 rounded-xl text-center font-bold font-mono">
              ⏳ COOL OFF ACTIVE
              <p className="text-sm text-amber-300 mt-1">{formatTime(cooldownRemaining)}</p>
            </div>
          )}

          {errorMsg && cooldownRemaining === 0 && (
            <p className="text-xs text-rose-400 text-center font-medium bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !isInputReady || cooldownRemaining > 0}
            className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold py-3 rounded-xl transition text-xs uppercase tracking-wider shadow-lg shadow-cyan-950 cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying...' : 'Unlock Register'}
          </button>
        </form>
      </div>
    </div>
  );
}