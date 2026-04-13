import { useEffect, useMemo, useState } from 'react';
import { fetchProducts } from '../services/api';
import type { Product } from '../types';

export type ProductFilters = {
  category?: string;
  tag?: string;
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
};

export const useProducts = (filters: ProductFilters = {}, refreshKey = 0) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const stableFilters = useMemo(
    () => ({
      category: filters.category,
      tag: filters.tag,
      tags: filters.tags,
      search: filters.search,
      limit: filters.limit,
      offset: filters.offset,
    }),
    [filters.category, filters.tag, filters.tags, filters.search, filters.limit, filters.offset],
  );

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);
    fetchProducts(stableFilters)
      .then((data) => {
        if (!isMounted) return;
        setProducts(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!isMounted) return;
        setError('Unable to load products right now.');
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [stableFilters, refreshKey]);

  return { products, isLoading, error };
};
