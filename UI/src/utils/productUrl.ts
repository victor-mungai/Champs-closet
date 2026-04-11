import type { Product } from '../types';

export const slugify = (value: string) => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const buildProductPath = (product: Pick<Product, 'id' | 'name'>) => {
  return `/product/${slugify(product.name)}-${product.id}`;
};

export const parseProductIdFromSlug = (value?: string | null) => {
  if (!value) return null;
  const match = value.match(/(\d+)(?:\/?$)/);
  if (!match) return null;
  return match[1];
};
