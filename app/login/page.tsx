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
  const [idleNotice, setIdleNotice] = useState(false);

  // Shown after the inactivity logout redirects here
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reason') === 'idle') setIdleNotice(true);
  }, []);

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

    let res: Response;
    let data: any = {};
    try {
      res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, pin: pin.trim() }),
      });
      data = await res.json().catch(() => ({}));
    } catch {
      setLoading(false);
      setErrorMsg('Could not reach the server. Check your connection and try again.');
      return;
    }

    // Success: the server verified the PIN and returned a session
    if (res.ok && data.session) {
      const { error: sessionErr } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      if (sessionErr) {
        setLoading(false);
        setErrorMsg('Could not start your session. Please try again.');
        return;
      }
      setLoading(false);
      router.push(data.role === 'Admin' ? '/admin' : '/pos');
      return;
    }

    setLoading(false);
    setPin('');

    // Total lockdown
    if (res.status === 423) {
      setErrorMsg(data.error || '🔒 Account is in TOTAL LOCKDOWN. Contact Admin to reset.');
      return;
    }

    // Cool-off timer on the account
    if (res.status === 429 && data.cooldownSeconds) {
      setCooldownRemaining(data.cooldownSeconds);
      setErrorMsg(`⏳ Cool off active. Please wait ${formatTime(data.cooldownSeconds)}.`);
      return;
    }

    // Too many wrong PINs from this network, or the sign-in service is busy
    if (res.status === 429 || res.status === 503) {
      setErrorMsg(data.error || 'Too many attempts. Please wait a while and try again.');
      return;
    }

    // Wrong username or PIN
    if (res.status === 401) {
      let msg = 'Invalid Username or PIN';
      const attempts: number | null = data.attempts ?? null;

      if (data.isTotalLock) {
        msg = '🔒 6 Failed attempts! Contact Admin to reset.';
      } else if (attempts === 3) {
        msg = '⚠️ 3 Failed attempts!';
        setCooldownRemaining(data.lockoutSeconds || 0);
      } else if (attempts === 4) {
        msg = '⚠️ 4 Failed attempts!';
        setCooldownRemaining(data.lockoutSeconds || 0);
      } else if (attempts === 5) {
        msg = '🚨 5 Failed attempts!';
        setCooldownRemaining(data.lockoutSeconds || 0);
      } else if (attempts && attempts > 0) {
        msg = `❌ Incorrect PIN (${6 - attempts} attempts remaining before Total Lockdown)`;
      }

      setErrorMsg(msg);
      return;
    }

    setErrorMsg(data.error || 'Something went wrong. Please try again.');
  };

  // Enable button once user types at least 2 characters in both fields
  const isInputReady = username.trim().length >= 2 && pin.length >= 2;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-black text-white uppercase tracking-wider">
            MEEDEX GADGETS <span className="text-cyan-400">POS</span>
          </h1>
          <p className="text-xs text-slate-400">Enter your credentials to unlock register</p>
        </div>

        {idleNotice && (
          <p className="text-xs text-amber-300 text-center bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/30">
            You were logged out because of inactivity. Please sign in again.
          </p>
        )}

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