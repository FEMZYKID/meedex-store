'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useStaff } from '../../../hooks/useStaff';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';

export default function AdminStaffPage() {
  const currentUser = useAdminAuth();
  const { staffList, loadingStaff, fetchStaff } = useStaff();

  useEffect(() => {
    fetchStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [addingStaff, setAddingStaff] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffUsername, setNewStaffUsername] = useState('');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'Admin' | 'Cashier'>('Cashier');

  const handleUnlockStaff = async (id: string, name: string) => {
    const { error } = await supabase
      .from('staff')
      .update({
        failed_attempts: 0,
        lockout_until: null,
        is_locked: false,
      })
      .eq('id', id);

    if (error) alert('Error unlocking staff: ' + error.message);
    else {
      alert(`Lockout reset for ${name}!`);
      await fetchStaff();
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newStaffPin.length < 6) {
      alert('PIN must be at least 6 characters long (Supabase requires a minimum of 6).');
      return;
    }

    setAddingStaff(true);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/staff', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        name: newStaffName.trim(),
        username: newStaffUsername.trim().toLowerCase(),
        pin: newStaffPin.trim(),
        role: newStaffRole,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      alert('Error adding staff: ' + (result.error || 'Unknown error'));
    } else {
      alert(`Staff member "${newStaffName}" onboarded!`);
      setNewStaffName('');
      setNewStaffUsername('');
      setNewStaffPin('');
      setNewStaffRole('Cashier');
      await fetchStaff();
    }
    setAddingStaff(false);
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (id === currentUser?.id) {
      alert('You cannot delete your own logged-in account!');
      return;
    }
    if (!confirm(`Are you sure you want to remove ${name}?`)) return;

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/staff', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ id }),
    });

    const result = await res.json();
    if (!res.ok) alert('Error removing staff: ' + (result.error || 'Unknown error'));
    else await fetchStaff();
  };

  return (
    <section className="bg-slate-800 border border-slate-700/80 p-5 rounded-2xl mb-8 shadow-xl">
      <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
        <span>👥</span> Staff Onboarding & Security Accounts
      </h2>

      <form onSubmit={handleAddStaff} className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs mb-6">
        <div>
          <label className="block text-slate-400 mb-1">Staff Full Name</label>
          <input
            type="text"
            required
            value={newStaffName}
            onChange={(e) => setNewStaffName(e.target.value)}
            placeholder="e.g. Samuel Okon"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div>
          <label className="block text-slate-400 mb-1">Username</label>
          <input
            type="text"
            required
            value={newStaffUsername}
            onChange={(e) => setNewStaffUsername(e.target.value)}
            placeholder="e.g. samuel"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div>
          <label className="block text-slate-400 mb-1">PIN / Password (min. 6 digits)</label>
          <input
            type="password"
            required
            minLength={6}
            value={newStaffPin}
            onChange={(e) => setNewStaffPin(e.target.value)}
            placeholder="••••••"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-cyan-400 font-mono tracking-widest text-center focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div>
          <label className="block text-slate-400 mb-1">Role / Permissions</label>
          <select
            value={newStaffRole}
            onChange={(e) => setNewStaffRole(e.target.value as 'Admin' | 'Cashier')}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="Cashier">Cashier (POS Only)</option>
            <option value="Admin">Admin (Full Control)</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={addingStaff}
            className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-2.5 rounded-lg transition shadow-md shadow-cyan-950 cursor-pointer"
          >
            {addingStaff ? 'Onboarding...' : '+ Onboard Staff'}
          </button>
        </div>
      </form>

      <div className="border-t border-slate-700/60 pt-4">
        <h3 className="text-xs font-semibold text-slate-400 mb-3">Active Staff Accounts ({staffList.length})</h3>
        {loadingStaff ? (
          <div className="text-xs text-slate-500">Loading staff...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {staffList.map((member) => (
              <div
                key={member.id}
                className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-700/60 flex flex-col justify-between gap-2"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-white">{member.name}</p>
                    <p className="text-[11px] text-cyan-400">
                      @{member.username || 'N/A'} • {member.role}
                    </p>
                  </div>

                  {member.is_locked ? (
                    <span className="text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded font-bold uppercase">
                      🔒 LOCKED
                    </span>
                  ) : member.failed_attempts > 0 ? (
                    <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded font-bold">
                      ⚠️ {member.failed_attempts}/6 Fails
                    </span>
                  ) : (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">
                      ✓ Active
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                  {(member.is_locked || member.failed_attempts > 0 || member.lockout_until) && (
                    <button
                      onClick={() => handleUnlockStaff(member.id, member.name)}
                      className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer"
                    >
                      🔓 Reset Security / Unlock
                    </button>
                  )}

                  {member.id !== currentUser.id && (
                    <button
                      onClick={() => handleDeleteStaff(member.id, member.name)}
                      className="text-[11px] text-rose-400 hover:underline ml-auto cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}