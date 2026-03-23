import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, ShoppingBag, TrendingUp, User } from 'lucide-react';
import { useProducts } from '../../hooks/useProducts';
import { fetchOrderMetrics, fetchOrders } from '../../services/api';
import type { Order, OrderMetrics } from '../../types';

const formatCurrency = (value: number) => new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(value);

const buildTrendPath = (values: number[]) => {
  if (!values.length) return 'M0,40 L100,40';
  const max = Math.max(...values, 1);
  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = 40 - (value / max) * 35;
      return `${index === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');
};

const Dashboard = () => {
  const { products } = useProducts();
  const totalProducts = products.length;
  const lowStock = products.filter(p => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 50).length;
  const [metrics, setMetrics] = useState<OrderMetrics | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [orderError, setOrderError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadMetrics = async () => {
      try {
        setLoadingMetrics(true);
        const data = await fetchOrderMetrics(7);
        if (active) setMetrics(data);
      } catch (err: any) {
        if (active) setOrderError(err?.message || 'Failed to load order metrics.');
      } finally {
        if (active) setLoadingMetrics(false);
      }
    };

    const loadOrders = async () => {
      try {
        setLoadingOrders(true);
        const data = await fetchOrders({ limit: 5 });
        if (active) setRecentOrders(data);
      } catch (err: any) {
        if (active) setOrderError(err?.message || 'Failed to load orders.');
      } finally {
        if (active) setLoadingOrders(false);
      }
    };

    loadMetrics();
    loadOrders();
    return () => {
      active = false;
    };
  }, []);

  const revenueTrend = useMemo(() => metrics?.revenue_trend ?? [], [metrics]);
  const revenueValues = revenueTrend.map(point => point.revenue);
  const trendPath = buildTrendPath(revenueValues);
  const totalOrders = metrics?.total_orders ?? 0;
  const successRate = metrics ? `${metrics.success_rate.toFixed(1)}%` : '--';
  const totalRevenue = metrics ? `${formatCurrency(metrics.revenue_total)} Ksh` : '--';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 md:p-8 max-w-6xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="font-headline text-3xl font-bold mb-2">Welcome back, Admin</h1>
        <p className="text-on-surface-variant">Here's what's happening with your store today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-outline-variant/10">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary"><TrendingUp className="w-6 h-6" /></div>
            <span className="text-sm font-medium text-[#4CAF50] bg-[#4CAF50]/10 px-2 py-1 rounded-lg">Live</span>
          </div>
          <p className="text-on-surface-variant text-sm font-medium mb-1">Revenue (7 days)</p>
          <h3 className="font-headline text-3xl font-bold">{loadingMetrics ? '...' : totalRevenue}</h3>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-outline-variant/10">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary"><ShoppingBag className="w-6 h-6" /></div>
            <span className="text-sm font-medium text-[#4CAF50] bg-[#4CAF50]/10 px-2 py-1 rounded-lg">{totalOrders} Orders</span>
          </div>
          <p className="text-on-surface-variant text-sm font-medium mb-1">Transactions (7 days)</p>
          <h3 className="font-headline text-3xl font-bold">{loadingMetrics ? '...' : totalOrders}</h3>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-outline-variant/10">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-[#4CAF50]/10 rounded-2xl text-[#4CAF50]"><CheckCircle2 className="w-6 h-6" /></div>
          </div>
          <p className="text-on-surface-variant text-sm font-medium mb-1">M-Pesa Success Rate</p>
          <h3 className="font-headline text-3xl font-bold">{loadingMetrics ? '...' : successRate}</h3>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-outline-variant/10">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary"><TrendingUp className="w-6 h-6" /></div>
            <span className="text-sm font-medium text-[#4CAF50] bg-[#4CAF50]/10 px-2 py-1 rounded-lg">{lowStock} Low</span>
          </div>
          <p className="text-on-surface-variant text-sm font-medium mb-1">Total Products</p>
          <h3 className="font-headline text-3xl font-bold">{totalProducts}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-outline-variant/10">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-headline font-bold text-lg">Revenue Trend</h3>
            <select className="bg-surface-container-low text-sm px-3 py-1.5 rounded-lg border-none outline-none">
              <option>Last 7 Days</option>
              <option>This Month</option>
            </select>
          </div>
          <div className="h-64 w-full relative flex items-end">
            <svg viewBox="0 0 100 40" className="w-full h-full preserve-aspect-ratio-none overflow-visible">
              <path d={`${trendPath} L100,40 L0,40 Z`} fill="url(#gradient)" opacity="0.2" />
              <path d={trendPath} fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          {orderError && <p className="text-sm text-error mt-4">{orderError}</p>}
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-outline-variant/10">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-headline font-bold text-lg">Recent Orders</h3>
            <button className="text-primary text-sm font-medium" onClick={() => alert('Navigate to Transactions for full list.')}>View All</button>
          </div>
          <div className="space-y-4">
            {loadingOrders ? (
              <div className="text-sm text-on-surface-variant">Loading recent orders...</div>
            ) : recentOrders.length === 0 ? (
              <div className="text-sm text-on-surface-variant">No recent orders yet.</div>
            ) : (
              recentOrders.map(order => (
                <div key={order.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Order #{order.id}</p>
                    <p className="text-xs text-on-surface-variant">{order.phone} • {order.amount} Ksh</p>
                  </div>
                  <span className="text-xs font-medium text-on-surface-variant">{order.status}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Dashboard;
