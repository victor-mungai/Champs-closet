import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, ShoppingBag, TrendingUp, User, XCircle } from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useProducts } from '../../hooks/useProducts';
import { fetchOrderMetrics, fetchOrders } from '../../services/api';
import type { Order, OrderMetrics } from '../../types';
import type { AdminOutletContext } from './AdminLayout';

const formatCurrency = (value: number) => new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(value);

const buildTrendPath = (values: number[]) => {
  if (!values.length) return 'M0,90 L100,90';
  const max = Math.max(...values, 1);
  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = 90 - (value / max) * 70;
      return `${index === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');
};

const Dashboard = () => {
  const { user } = useOutletContext<AdminOutletContext>();
  const navigate = useNavigate();
  const { products } = useProducts();
  const totalProducts = products.length;
  const lowStock = products.filter((p) => (p.available_stock ?? p.stock ?? 0) > 0 && (p.available_stock ?? p.stock ?? 0) <= 10).length;
  const [metrics, setMetrics] = useState<OrderMetrics | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;

    const loadMetrics = async () => {
      try {
        setLoadingMetrics(true);
        const token = await user.getIdToken();
        const data = await fetchOrderMetrics(14, {}, token);
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
        const token = await user.getIdToken();
        const data = await fetchOrders({ limit: 5 }, token);
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
  }, [user]);

  const revenueTrend = useMemo(() => metrics?.revenue_trend ?? [], [metrics]);
  const revenueValues = revenueTrend.map((point) => point.revenue);
  const trendPath = buildTrendPath(revenueValues);
  const maxRevenue = Math.max(...revenueValues, 1);

  const totalOrders = metrics?.total_orders ?? 0;
  const successRate = metrics ? `${metrics.success_rate.toFixed(1)}%` : '--';
  const totalRevenue = metrics ? `${formatCurrency(metrics.revenue_total)} Ksh` : '--';
  const avgOrderValue = metrics && metrics.paid_orders > 0 ? metrics.revenue_total / metrics.paid_orders : 0;

  const hoveredPoint = hoverIndex !== null ? revenueTrend[hoverIndex] : null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 md:p-8 max-w-7xl mx-auto w-full overflow-x-hidden">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="font-headline text-3xl font-bold mb-2">Welcome back, Admin</h1>
          <p className="text-on-surface-variant">Here is what is happening with your store right now.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/admin/analytics')}
          className="px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-medium w-full sm:w-auto"
        >
          Open Full Analytics
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-outline-variant/10">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary"><TrendingUp className="w-6 h-6" /></div>
            <span className="text-sm font-medium text-[#4CAF50] bg-[#4CAF50]/10 px-2 py-1 rounded-lg">Live</span>
          </div>
          <p className="text-on-surface-variant text-sm font-medium mb-1">Revenue (14 days)</p>
          <h3 className="font-headline text-3xl font-bold break-words">{loadingMetrics ? '...' : totalRevenue}</h3>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-outline-variant/10">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary"><ShoppingBag className="w-6 h-6" /></div>
            <span className="text-sm font-medium text-[#4CAF50] bg-[#4CAF50]/10 px-2 py-1 rounded-lg">{totalOrders} Orders</span>
          </div>
          <p className="text-on-surface-variant text-sm font-medium mb-1">Transactions (14 days)</p>
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
            <span className="text-sm font-medium text-[#FF9800] bg-[#FF9800]/10 px-2 py-1 rounded-lg">{lowStock} Low</span>
          </div>
          <p className="text-on-surface-variant text-sm font-medium mb-1">Total Products</p>
          <h3 className="font-headline text-3xl font-bold">{totalProducts}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
        <div className="xl:col-span-3 bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-outline-variant/10 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
            <h3 className="font-headline font-bold text-lg">Revenue Trend</h3>
            <p className="text-xs text-on-surface-variant">Daily line graph (14 days)</p>
          </div>

          <div
            className="h-72 relative rounded-2xl border border-outline-variant/20 bg-surface p-3"
            onMouseLeave={() => setHoverIndex(null)}
          >
            <div className="absolute inset-3 grid grid-rows-4">
              {[0, 1, 2, 3].map((line) => (
                <div key={line} className="border-b border-outline-variant/20" />
              ))}
            </div>

            <div className="absolute inset-3 flex gap-2">
              {revenueTrend.map((point, index) => (
                <button
                  key={`${point.date}-${index}`}
                  type="button"
                  className="flex-1 min-w-0 h-full"
                  onMouseEnter={() => setHoverIndex(index)}
                  onFocus={() => setHoverIndex(index)}
                />
              ))}
            </div>

            <svg viewBox="0 0 100 100" className="absolute inset-3 w-[calc(100%-1.5rem)] h-[calc(100%-1.5rem)] overflow-visible pointer-events-none">
              <path d={trendPath} fill="none" stroke="currentColor" className="text-on-surface" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {hoverIndex !== null && revenueTrend.length > 0 && (
                <line
                  x1={(hoverIndex / Math.max(revenueTrend.length - 1, 1)) * 100}
                  x2={(hoverIndex / Math.max(revenueTrend.length - 1, 1)) * 100}
                  y1={0}
                  y2={100}
                  stroke="currentColor"
                  className="text-outline-variant"
                  strokeWidth="0.7"
                  strokeDasharray="2 2"
                />
              )}
            </svg>

            {hoveredPoint && (
              <div className="absolute right-4 top-4 w-56 rounded-xl border border-outline-variant/20 bg-surface-container-low backdrop-blur p-3 text-xs">
                <p className="font-semibold">{new Date(hoveredPoint.date).toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                <p className="mt-2 text-on-surface-variant">Revenue: <span className="text-on-surface font-medium">{formatCurrency(hoveredPoint.revenue)} Ksh</span></p>
                <p className="mt-1 text-on-surface-variant">Orders: <span className="text-on-surface font-medium">{hoveredPoint.count}</span></p>
                <p className="mt-1 text-on-surface-variant">Avg Ticket: <span className="text-on-surface font-medium">{hoveredPoint.count > 0 ? formatCurrency(hoveredPoint.revenue / hoveredPoint.count) : '0'} Ksh</span></p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
            <div className="rounded-xl bg-surface-container-low border border-outline-variant/15 p-3">
              <p className="text-on-surface-variant">Paid</p>
              <p className="font-semibold mt-1">{metrics?.paid_orders ?? 0}</p>
            </div>
            <div className="rounded-xl bg-surface-container-low border border-outline-variant/15 p-3">
              <p className="text-on-surface-variant">Failed</p>
              <p className="font-semibold mt-1">{metrics?.failed_orders ?? 0}</p>
            </div>
            <div className="rounded-xl bg-surface-container-low border border-outline-variant/15 p-3">
              <p className="text-on-surface-variant">Pending</p>
              <p className="font-semibold mt-1">{metrics?.pending_orders ?? 0}</p>
            </div>
            <div className="rounded-xl bg-surface-container-low border border-outline-variant/15 p-3">
              <p className="text-on-surface-variant">Avg Ticket</p>
              <p className="font-semibold mt-1">{formatCurrency(avgOrderValue)} Ksh</p>
            </div>
          </div>

          {orderError && <p className="text-sm text-error mt-4">{orderError}</p>}
        </div>

        <div className="xl:col-span-2 bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-outline-variant/10">
          <h3 className="font-headline font-bold text-lg mb-6">Recent Orders</h3>
          <div className="space-y-4">
            {loadingOrders ? (
              <div className="text-sm text-on-surface-variant">Loading recent orders...</div>
            ) : recentOrders.length === 0 ? (
              <div className="text-sm text-on-surface-variant">No recent orders yet.</div>
            ) : (
              recentOrders.map((order) => (
                <div key={order.id} className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0">
                    {order.status === 'FAILED' ? <XCircle className="w-5 h-5 text-[#E53935]" /> : <User className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">Order #{order.id}</p>
                    <p className="text-xs text-on-surface-variant truncate">{order.phone} - {order.amount} Ksh</p>
                  </div>
                  <span className="text-xs font-medium text-on-surface-variant shrink-0">{order.status}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mt-8">
        <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-outline-variant/10 min-w-0">
          <h3 className="font-headline font-bold text-lg mb-4">Sales Per Staff</h3>
          <div className="space-y-3 text-sm">
            {(metrics?.sales_per_staff || []).length === 0 ? (
              <p className="text-on-surface-variant">No staff sales in selected period.</p>
            ) : (
              (metrics?.sales_per_staff || []).map((row) => (
                <div key={row.staff} className="flex items-start justify-between gap-3 min-w-0">
                  <span className="truncate min-w-0">{row.staff}</span>
                  <span className="text-right shrink-0">{row.sales_count} sales - {formatCurrency(row.revenue)} Ksh</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-outline-variant/10 min-w-0">
          <h3 className="font-headline font-bold text-lg mb-4">Channel Breakdown</h3>
          <div className="space-y-3 text-sm">
            {(metrics?.channel_breakdown || []).map((row) => (
              <div key={row.channel} className="flex items-start justify-between gap-3 min-w-0">
                <span className="truncate min-w-0">{row.channel}</span>
                <span className="text-right shrink-0">{row.sales_count} - {formatCurrency(row.revenue)} Ksh</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-outline-variant/10 min-w-0">
          <h3 className="font-headline font-bold text-lg mb-4">Top Products</h3>
          <div className="space-y-3 text-sm">
            {(metrics?.top_products || []).map((row) => (
              <div key={row.product_name} className="flex items-start justify-between gap-3 min-w-0">
                <span className="truncate min-w-0">{row.product_name}</span>
                <span className="text-right shrink-0">{row.quantity} - {formatCurrency(row.revenue)} Ksh</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Dashboard;
