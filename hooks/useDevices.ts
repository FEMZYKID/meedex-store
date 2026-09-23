import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { AllowedDevice } from '../types';

export function useDevices() {
  const [devices, setDevices] = useState<AllowedDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);

  const fetchDevices = useCallback(async () => {
    setLoadingDevices(true);
    const { data } = await supabase.from('allowed_devices').select('*').order('created_at', { ascending: false });
    if (data) setDevices(data as AllowedDevice[]);
    setLoadingDevices(false);
  }, []);

  return { devices, setDevices, loadingDevices, fetchDevices };
}