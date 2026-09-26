import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Category } from '../types';

export function useCategories() {
  const [categoryList, setCategoryList] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const fetchCategories = useCallback(async () => {
    setLoadingCategories(true);
    const { data } = await supabase
      .from('categories')
      .select('id, name, sort_order, parent_id')
      .order('sort_order', { ascending: true });
    if (data) setCategoryList(data);
    setLoadingCategories(false);
  }, []);

  return { categoryList, setCategoryList, loadingCategories, fetchCategories };
}