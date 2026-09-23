import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Sale } from '../types';

export function useSales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loadingSales, setLoadingSales] = useState(true);

  const fetchSales = useCallback(async () => {
    setLoadingSales(true);
    const { data, error } = await supabase
      .from('sales')
      .select('*, sale_items(*)')
      .order('created_at', { ascending: false });

    if (!error && data) setSales(data as unknown as Sale[]);
    setLoadingSales(false);
  }, []);

  return { sales, setSales, loadingSales, fetchSales };
}