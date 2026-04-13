import type { DeliveryPayload, Order, OrderMetrics, Product } from '../types';

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

const withAuthHeader = (token?: string) => {
  if (!token) return undefined;
  return { Authorization: `Bearer ${token}` };
};

export const fetchProducts = async (filters: { category?: string; tag?: string; tags?: string[]; search?: string; limit?: number; offset?: number } = {}) => {
  const query = buildQuery({
    category: filters.category,
    tag: filters.tag,
    tags: filters.tags && filters.tags.length > 0 ? filters.tags.join(',') : undefined,
    search: filters.search,
    limit: filters.limit,
    offset: filters.offset,
  });
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

export const updateProduct = async (id: number, formData: FormData, token: string) => {
  const res = await fetch(`${API_URL}/products/${id}`, {
    method: 'PATCH',
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
  name?: string;
  size?: string;
};

export const createOrder = async (payload: { phone: string; items: OrderItemPayload[]; amount?: number; delivery?: DeliveryPayload }) => {
  const res = await fetch(`${ORDER_API_URL}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleJson<{ message: string; order_id: number; invoice?: string; amount?: number; delivery_fee?: number; delivery_type?: string; test?: boolean }>(res);
};

export const createAdminOrder = async (payload: {
  phone: string;
  items: OrderItemPayload[];
  amount?: number;
  delivery?: DeliveryPayload;
  payment_method: 'stk' | 'cash';
  created_by: string;
}, token: string) => {
  const res = await fetch(`${ORDER_API_URL}/admin/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  return handleJson<{ message: string; order_id: number; invoice?: string; amount?: number; delivery_fee?: number; delivery_type?: string; test?: boolean; status?: string; receipt?: string }>(res);
};

export const fetchDeliveryQuote = async (lat: number, lng: number) => {
  const res = await fetch(`${ORDER_API_URL}/orders/delivery-quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng }),
  });
  return handleJson<{ fee: number; currency: string }>(res);
};

export const fetchOrders = async (
  filters: { status?: string; channel?: string; created_by?: string; from?: string; to?: string; q?: string; limit?: number; offset?: number } = {},
  token?: string,
) => {
  const query = buildQuery(filters);
  const res = await fetch(`${ORDER_API_URL}/orders${query}`, {
    headers: withAuthHeader(token),
  });
  return handleJson<Order[]>(res);
};

export const fetchOrder = async (orderId: number | string, token?: string) => {
  const res = await fetch(`${ORDER_API_URL}/orders/${orderId}`, {
    headers: withAuthHeader(token),
  });
  return handleJson<Order>(res);
};

export const fetchOrderStatus = async (orderId: number | string, phone: string) => {
  const query = buildQuery({ phone });
  const res = await fetch(`${ORDER_API_URL}/orders/${orderId}/status${query}`);
  return handleJson<{
    order_id: number;
    status: 'PENDING' | 'STK_SENT' | 'PAID' | 'FAILED';
    amount: number;
    payment_method?: string | null;
    invoice_number?: string | null;
    receipt?: string | null;
    receipt_url?: string | null;
  }>(res);
};

export const fetchOrderMetrics = async (
  days = 7,
  filters: { channel?: string; created_by?: string; from?: string; to?: string } = {},
  token?: string,
) => {
  const query = buildQuery({ days, ...filters });
  const res = await fetch(`${ORDER_API_URL}/orders/metrics${query}`, {
    headers: withAuthHeader(token),
  });
  return handleJson<OrderMetrics>(res);
};
