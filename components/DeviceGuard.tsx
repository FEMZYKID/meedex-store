/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '../lib/supabase';

export default function DeviceGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // The public storefront (customer-facing shopping site) must be reachable
  // by anyone, instantly — device approval is a POS/admin-only concept for
  // staff hardware, not something a shopper should ever hit.
  const isPublicStorefront = pathname?.startsWith('/store');

  const [deviceStatus, setDeviceStatus] = useState<'checking' | 'approved' | 'pending' | 'blocked'>('checking');
  const [deviceId, setDeviceId] = useState<string>('');
  const [deviceName, setDeviceName] = useState<string>('');

  useEffect(() => {
    if (isPublicStorefront) return;
    checkDevice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPublicStorefront]);

  const getDeviceName = () => {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return 'Android Device';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS Device (iPhone/iPad)';
    if (/Win/i.test(ua)) return 'Windows PC';
    if (/Mac/i.test(ua)) return 'Mac Computer';
    if (/Linux/i.test(ua)) return 'Linux Device';
    return 'Unknown Device';
  };

  // crypto.randomUUID() doesn't exist on older browsers (e.g. Safari on iOS < 15.4,
  // like an iPhone 6 stuck on iOS 12). Fall back to a manual UUID v4 generator
  // so device registration still works there.
  const generateDeviceId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return 'dev-' + crypto.randomUUID();
    }
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    return 'dev-' + uuid;
  };

  // Wraps a promise so it can never hang forever — if it doesn't resolve
  // within `ms`, we treat it as failed and move on. This protects against
  // devices/networks where the request to Supabase stalls instead of
  // cleanly erroring (which a plain try/catch can't catch on its own).
  const withTimeout = <T,>(promise: PromiseLike<T>, ms: number): Promise<T> => {
    return Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Device check timed out')), ms)
      ),
    ]);
  };

  const checkDevice = async () => {
    try {
      let storedId = localStorage.getItem('deprince_device_id');

      if (!storedId) {
        storedId = generateDeviceId();
        localStorage.setItem('deprince_device_id', storedId);
      }

      setDeviceId(storedId);
      const detectedName = getDeviceName();
      setDeviceName(detectedName);

      // Ask only for THIS device's status via a narrow RPC — anon can no longer
      // list/browse the full allowed_devices table, only check one known ID.
      // Wrapped in an 8-second timeout so a stalled network request can never
      // freeze this screen forever.
      const { data: status, error } = await withTimeout(
        supabase.rpc('get_device_status', { p_device_id: storedId }),
        8000
      );

      if (error) {
        console.error('Error checking device:', error.message);
        // Fallback: allow access if database fetch fails to avoid lockout
        setDeviceStatus('approved');
        return;
      }

      if (!status) {
        // Not registered yet — register it as pending (RLS forces status='pending'
        // on insert regardless of what's sent here, so this can't self-approve)
        const { error: insertErr } = await withTimeout(
          supabase.from('allowed_devices').insert([
            {
              id: storedId,
              device_name: detectedName,
              status: 'pending',
            },
          ]),
          8000
        );
        if (insertErr) console.error('Error registering device:', insertErr.message);
        setDeviceStatus('pending');
      } else {
        setDeviceStatus(status as 'approved' | 'pending' | 'blocked');
      }
    } catch (err) {
      // Any unexpected error OR a timeout should fail OPEN, not freeze the
      // screen forever on "checking".
      console.error('Device check failed unexpectedly:', err);
      setDeviceStatus('approved');
    }
  };

  if (isPublicStorefront) {
    return <>{children}</>;
  }

  if (deviceStatus === 'checking') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center font-sans text-xs">
        Verifying device hardware authorization...
      </div>
    );
  }

  if (deviceStatus === 'pending' || deviceStatus === 'blocked') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-rose-500/30 rounded-2xl p-6 shadow-2xl text-center space-y-4">
          <div className="text-4xl">🔒</div>
          <h1 className="text-lg font-black text-rose-400 tracking-wider uppercase">
            Device Access Restricted
          </h1>
          <p className="text-xs text-slate-300 leading-relaxed">
            This device <strong className="text-white">({deviceName})</strong> is currently{' '}
            <span className="text-amber-400 font-bold uppercase">{deviceStatus}</span> for DEPRINCE POS.
          </p>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-left text-[11px] space-y-1 font-mono">
            <p className="text-slate-400">Your Device Identifier:</p>
            <p className="text-cyan-400 font-bold break-all select-all">{deviceId}</p>
          </div>

          <p className="text-[11px] text-slate-400">
            Please ask the Store Admin to approve your device from the Admin Dashboard.
          </p>

          <button
            onClick={() => checkDevice()}
            className="w-full bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 font-bold py-2 rounded-lg text-xs transition"
          >
            ↻ Re-check Approval Status
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}