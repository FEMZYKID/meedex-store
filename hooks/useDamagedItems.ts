import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { DamagedItem } from '../types';

export function useDamagedItems() {
  const [damagedItems, setDamagedItems] = useState<DamagedItem[]>([]);
  const [loadingDamaged, setLoadingDamaged] = useState(true);

  const fetchDamagedItems = useCallback(async () => {
    setLoadingDamaged(true);
    const { data } = await supabase.from('damaged_items').select('*').order('created_at', { ascending: false });
    if (data) setDamagedItems(data as DamagedItem[]);
    setLoadingDamaged(false);
  }, []);

  return { damagedItems, setDamagedItems, loadingDamaged, fetchDamagedItems };
}