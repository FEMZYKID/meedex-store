import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ReturnedItem } from '../types';

export function useReturnedItems() {
  const [returnedItems, setReturnedItems] = useState<ReturnedItem[]>([]);
  const [loadingReturned, setLoadingReturned] = useState(true);

  const fetchReturnedItems = useCallback(async () => {
    setLoadingReturned(true);
    const { data } = await supabase.from('returned_items').select('*').order('created_at', { ascending: false });
    if (data) setReturnedItems(data as ReturnedItem[]);
    setLoadingReturned(false);
  }, []);

  return { returnedItems, setReturnedItems, loadingReturned, fetchReturnedItems };
}