export type ProductTag = {
  id: number;
  name: string;
};

export type Product = {
  id: number;
  sku?: string | null;
  name: string;
  category: string;
  price: number;
  stock?: number;
  image_url?: string | null;
  image_urls?: string[];
  sizes?: string[];
  description?: string | null;
  tags?: ProductTag[];
};

export type ProductCreate = {
  name: string;
  category: string;
  price?: number;
  stock: number;
  sku?: string | null;
  image_url?: string | null;
  image_urls?: string[];
  sizes?: string[];
  description?: string | null;
  tags?: string[];
};

export type OrderStatus = 'PENDING' | 'STK_SENT' | 'PAID' | 'FAILED';

export type OrderItem = {
  product_id: number;
  quantity: number;
  unit_price: number;
};

export type Order = {
  id: number;
  amount: number;
  phone: string;
  status: OrderStatus;
  external_tx_id?: string | null;
  receipt?: string | null;
  invoice_number?: string | null;
  created_at?: string | null;
  items?: OrderItem[];
};

export type OrderTrendPoint = {
  date: string;
  revenue: number;
  count: number;
};

export type OrderMetrics = {
  total_orders: number;
  paid_orders: number;
  failed_orders: number;
  pending_orders: number;
  revenue_total: number;
  success_rate: number;
  revenue_trend: OrderTrendPoint[];
};
