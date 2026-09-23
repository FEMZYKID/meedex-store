import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Product } from '../types';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    const { data } = await supabase.from('products').select('*').order('name', { ascending: true });
    if (data) setProducts(data as Product[]);
    setLoadingProducts(false);
  }, []);

  return { products, setProducts, loadingProducts, fetchProducts };
}