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
  reserved_stock?: number;
  available_stock?: number;
  is_unique?: boolean;
  image_url?: string | null;
  image_urls?: string[];
  sizes?: string[];
  colors?: string[];
  description?: string | null;
  tags?: ProductTag[];
};

export type ProductCreate = {
  name: string;
  category: string;
  price?: number;
  stock: number;
  sku?: string | null;
  is_unique?: boolean;
  image_url?: string | null;
  image_urls?: string[];
  sizes?: string[];
  colors?: string[];
  description?: string | null;
  tags?: string[];
};

export type OrderStatus = 'PENDING' | 'STK_SENT' | 'PAID' | 'FAILED';

export type OrderItem = {
  product_id: number;
  quantity: number;
  unit_price: number;
  item_name?: string | null;
  size?: string | null;
};

export type DeliveryPayload = {
  type: 'pickup' | 'delivery';
  lat?: number;
  lng?: number;
  label?: string;
};

export type Order = {
  id: number;
  amount: number;
  phone: string;
  status: OrderStatus;
  channel?: string | null;
  payment_method?: string | null;
  created_by?: string | null;
  external_tx_id?: string | null;
  receipt?: string | null;
  receipt_url?: string | null;
  invoice_number?: string | null;
  created_at?: string | null;
  delivery_type?: string | null;
  delivery_fee?: number | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  delivery_address?: string | null;
  inventory_lock_id?: string | null;
  inventory_lock_expires_at?: string | null;
  inventory_synced?: boolean | null;
  items?: OrderItem[];
};

export type OrderTrendPoint = {
  date: string;
  revenue: number;
  count: number;
};

export type StaffSalesPoint = {
  staff: string;
  sales_count: number;
  revenue: number;
};

export type ChannelBreakdownPoint = {
  channel: string;
  sales_count: number;
  revenue: number;
};

export type TopProductPoint = {
  product_name: string;
  quantity: number;
  revenue: number;
};

export type OrderMetrics = {
  total_orders: number;
  paid_orders: number;
  failed_orders: number;
  pending_orders: number;
  revenue_total: number;
  success_rate: number;
  revenue_trend: OrderTrendPoint[];
  sales_per_staff: StaffSalesPoint[];
  channel_breakdown: ChannelBreakdownPoint[];
  top_products: TopProductPoint[];
};
