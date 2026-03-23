import type { Order, OrderMetrics, Product } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const ORDER_API_URL = import.meta.env.VITE_ORDER_API_URL || API_URL;

const buildQuery = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const text = String(value);
    if (text.length > 0) search.set(key, text);
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

const handleJson = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Request failed');
  }
  return res.json() as Promise<T>;
};

export const fetchProducts = async (filters: { category?: string; tag?: string; search?: string } = {}) => {
  const query = buildQuery(filters);
  const res = await fetch(`${API_URL}/products${query}`);
  return handleJson<Product[]>(res);
};

export const fetchProduct = async (id: string) => {
  const res = await fetch(`${API_URL}/products/${id}`);
  return handleJson<Product>(res);
};

export const createProduct = async (formData: FormData, token: string) => {
  const res = await fetch(`${API_URL}/products`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return handleJson<Product>(res);
};

export const deleteProduct = async (id: number, token: string) => {
  const res = await fetch(`${API_URL}/products/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleJson<Product>(res);
};

export type OrderItemPayload = {
  product_id: number;
  quantity: number;
  unit_price: number;
};

export const createOrder = async (payload: { phone: string; items: OrderItemPayload[]; amount?: number }) => {
  const res = await fetch(`${ORDER_API_URL}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleJson<{ message: string; order_id: number; invoice?: string; amount?: number }>(res);
};

export const fetchOrders = async (filters: { status?: string; from?: string; to?: string; limit?: number; offset?: number } = {}) => {
  const query = buildQuery(filters);
  const res = await fetch(`${ORDER_API_URL}/orders${query}`);
  return handleJson<Order[]>(res);
};

export const fetchOrderMetrics = async (days = 7) => {
  const query = buildQuery({ days });
  const res = await fetch(`${ORDER_API_URL}/orders/metrics${query}`);
  return handleJson<OrderMetrics>(res);
};
