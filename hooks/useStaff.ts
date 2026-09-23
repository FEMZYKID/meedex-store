import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { StaffMember } from '../types';

export function useStaff() {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);

  const fetchStaff = useCallback(async () => {
    setLoadingStaff(true);
    const { data } = await supabase.from('staff').select('*').order('created_at', { ascending: false });
    if (data) setStaffList(data as StaffMember[]);
    setLoadingStaff(false);
  }, []);

  return { staffList, setStaffList, loadingStaff, fetchStaff };
}