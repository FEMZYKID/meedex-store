'use client';

import { useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useDevices } from '../../../hooks/useDevices';

export default function AdminDevicesPage() {
  const { devices, loadingDevices, fetchDevices } = useDevices();

  useEffect(() => {
    fetchDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpdateDeviceStatus = async (id: string, status: 'approved' | 'blocked') => {
    const { error } = await supabase.from('allowed_devices').update({ status }).eq('id', id);
    if (error) alert('Error updating device: ' + error.message);
    else await fetchDevices();
  };

  const handleDeleteDevice = async (id: string) => {
    if (!confirm('Remove this device authorization record?')) return;
    const { error } = await supabase.from('allowed_devices').delete().eq('id', id);
    if (error) alert('Error deleting device: ' + error.message);
    else await fetchDevices();
  };

  return (
    <section className="bg-slate-800 border border-slate-700/80 p-5 rounded-2xl mb-8 shadow-xl">
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-700">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>🛡️</span> Hardware Whitelist & Device Security
          </h2>
          <p className="text-xs text-slate-400">Authorize or block devices trying to access the store system</p>
        </div>
        <button
          onClick={fetchDevices}
          className="text-xs bg-slate-900 border border-slate-700 hover:border-cyan-500 text-cyan-400 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer"
        >
          ↻ Refresh Devices
        </button>
      </div>

      {loadingDevices ? (
        <div className="text-xs text-slate-500">Loading device registry...</div>
      ) : devices.length === 0 ? (
        <div className="text-xs text-slate-500 py-4 text-center">No devices registered yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((dev) => (
            <div
              key={dev.id}
              className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col justify-between gap-3 text-xs"
            >
              <div>
                <div className="flex justify-between items-start gap-2">
                  <p className="font-bold text-white text-sm">{dev.device_name}</p>
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                      dev.status === 'approved'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : dev.status === 'pending'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    {dev.status}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-mono mt-1 break-all">ID: {dev.id}</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  First seen: {new Date(dev.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                {dev.status !== 'approved' && (
                  <button
                    onClick={() => handleUpdateDeviceStatus(dev.id, 'approved')}
                    className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 py-1.5 rounded font-semibold text-[11px] transition cursor-pointer"
                  >
                    ✓ Approve Device
                  </button>
                )}
                {dev.status !== 'blocked' && (
                  <button
                    onClick={() => handleUpdateDeviceStatus(dev.id, 'blocked')}
                    className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 py-1.5 rounded font-semibold text-[11px] transition cursor-pointer"
                  >
                    ⛔ Block Device
                  </button>
                )}
                <button
                  onClick={() => handleDeleteDevice(dev.id)}
                  className="text-rose-400 hover:text-rose-300 px-2 py-1 text-xs cursor-pointer"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}