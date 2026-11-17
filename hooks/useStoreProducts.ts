import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { StoreProduct } from '../types';

// The public store asks for these columns ONLY. Real stock numbers are never requested.
const STORE_COLUMNS =
  'id, name, sku, category, image_url, unit_price, adapter_price, cable_price, is_splittable, show_on_website, web_ok_full, web_ok_adapter, web_ok_cable, rating_avg, rating_count';

export function useStoreProducts() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    const { data } = await supabase
      .from('products')
      .select(STORE_COLUMNS)
      .eq('show_on_website', true)
      .order('name', { ascending: true });

    if (data) {
      const visible = (data as unknown as StoreProduct[]).filter(
        (p) => p.web_ok_full || p.web_ok_adapter || p.web_ok_cable
      );
      setProducts(visible);
    }
    setLoadingProducts(false);
  }, []);

  return { products, loadingProducts, fetchProducts };
}