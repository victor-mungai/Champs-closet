import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  CreditCard,
  RefreshCcw,
  ShoppingBag,
  TrendingUp,
  User,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import Button from '../../components/Button';
import { fetchOrderMetrics, fetchOrders } from '../../services/api';
import type { Order, OrderMetrics, OrderTrendPoint } from '../../types';
import type { AdminOutletContext } from './AdminLayout';

type ActivePanel = 'revenue' | 'payments' | 'channels' | 'staff' | 'products';
type RangePreset = 7 | 14 | 30 | 60;

const PAGE_SIZE = 200;
const MAX_ORDER_PAGES = 5;

const formatCurrency = (value: number) => `${new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(value)} Ksh`;

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-KE', {
    month: 'short',
    day: 'numeric',
  });

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

const getStatusLabel = (status: string) => {
  if (status === 'PAID') return 'Paid';
  if (status === 'STK_SENT') return 'Pending Payment';
  if (status === 'FAILED') return 'Failed';
  return 'Pending';
};

const Analytics = () => {
  const { user } = useOutletContext<AdminOutletContext>();
  const navigate = useNavigate();

  const [presetDays, setPresetDays] = useState<RangePreset>(30);
  const [channel, setChannel] = useState<'all' | 'online' | 'admin'>('all');
  const [activePanel, setActivePanel] = useState<ActivePanel>('revenue');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const [metrics, setMetrics] = useState<OrderMetrics | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const filterChannel = channel === 'all' ? undefined : channel;

      const metricsPromise = fetchOrderMetrics(presetDays, { channel: filterChannel }, token);

      const allOrders: Order[] = [];
      let offset = 0;

      for (let page = 0; page < MAX_ORDER_PAGES; page += 1) {
        const batch = await fetchOrders(
          {
            channel: filterChannel,
            limit: PAGE_SIZE,
            offset,
          },
          token,
        );
        allOrders.push(...batch);
        if (batch.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }

      const metricsData = await metricsPromise;
      setMetrics(metricsData);
      setOrders(allOrders);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.trim().length > 0) {
        setError(err.message);
      } else {
        setError('Failed to load analytics data.');
      }
    } finally {
      setLoading(false);
    }
  }, [user, presetDays, channel]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const trend = useMemo(() => metrics?.revenue_trend ?? [], [metrics]);
  const trendValues = trend.map((point) => point.revenue);
  const trendPath = buildTrendPath(trendValues);

  const hoveredPoint: OrderTrendPoint | null = hoverIndex !== null ? trend[hoverIndex] ?? null : null;

  const paidOrders = metrics?.paid_orders ?? 0;
  const failedOrders = metrics?.failed_orders ?? 0;
  const pendingOrders = metrics?.pending_orders ?? 0;
  const totalOrders = metrics?.total_orders ?? 0;
  const successRate = metrics?.success_rate ?? 0;
  const avgTicket = paidOrders > 0 && metrics ? metrics.revenue_total / paidOrders : 0;

  const paymentStateRows = useMemo(
    () => [
      { key: 'PAID', label: 'Paid', value: paidOrders, color: 'bg-[#1f9d55]' },
      { key: 'STK_SENT', label: 'Pending', value: pendingOrders, color: 'bg-[#2563eb]' },
      { key: 'FAILED', label: 'Failed', value: failedOrders, color: 'bg-[#dc2626]' },
    ],
    [paidOrders, pendingOrders, failedOrders],
  );

  const recentPaymentTimeline = useMemo(() => {
    return [...orders]
      .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())
      .slice(0, 12);
  }, [orders]);

  const jumpToTransactions = (params: Record<string, string>) => {
    const query = new URLSearchParams(params);
    navigate(`/admin/transactions?${query.toString()}`);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 md:p-8 max-w-7xl mx-auto w-full overflow-x-hidden space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold">Analytics</h1>
          <p className="text-on-surface-variant mt-1">Deep performance view across all orders and payment outcomes.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[7, 14, 30, 60].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setPresetDays(days as RangePreset)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${presetDays === days ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface'}`}
            >
              {days}d
            </button>
          ))}

          <select
            value={channel}
            onChange={(event) => setChannel(event.target.value as 'all' | 'online' | 'admin')}
            className="bg-surface-container-low px-3 py-2 rounded-xl text-xs font-semibold"
          >
            <option value="all">All Channels</option>
            <option value="online">Online</option>
            <option value="admin">Admin</option>
          </select>

          <Button type="button" variant="ghost" className="gap-2" onClick={loadAnalytics}>
            <RefreshCcw className="w-4 h-4" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <button type="button" onClick={() => setActivePanel('revenue')} className={`text-left p-5 rounded-2xl border transition ${activePanel === 'revenue' ? 'border-primary bg-primary/5' : 'border-outline-variant/10 bg-surface-container-lowest'}`}>
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <span className="text-xs text-on-surface-variant">Revenue</span>
          </div>
          <p className="text-xs text-on-surface-variant">Total</p>
          <p className="text-xl font-bold">{loading ? '...' : formatCurrency(metrics?.revenue_total ?? 0)}</p>
        </button>

        <button type="button" onClick={() => setActivePanel('payments')} className={`text-left p-5 rounded-2xl border transition ${activePanel === 'payments' ? 'border-primary bg-primary/5' : 'border-outline-variant/10 bg-surface-container-lowest'}`}>
          <div className="flex items-center justify-between mb-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <span className="text-xs text-on-surface-variant">Success Rate</span>
          </div>
          <p className="text-xs text-on-surface-variant">Payments</p>
          <p className="text-xl font-bold">{loading ? '...' : `${successRate.toFixed(1)}%`}</p>
        </button>

        <button type="button" onClick={() => setActivePanel('channels')} className={`text-left p-5 rounded-2xl border transition ${activePanel === 'channels' ? 'border-primary bg-primary/5' : 'border-outline-variant/10 bg-surface-container-lowest'}`}>
          <div className="flex items-center justify-between mb-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <span className="text-xs text-on-surface-variant">Channels</span>
          </div>
          <p className="text-xs text-on-surface-variant">Tracked</p>
          <p className="text-xl font-bold">{loading ? '...' : (metrics?.channel_breakdown.length ?? 0)}</p>
        </button>

        <button type="button" onClick={() => setActivePanel('staff')} className={`text-left p-5 rounded-2xl border transition ${activePanel === 'staff' ? 'border-primary bg-primary/5' : 'border-outline-variant/10 bg-surface-container-lowest'}`}>
          <div className="flex items-center justify-between mb-2">
            <User className="w-5 h-5 text-primary" />
            <span className="text-xs text-on-surface-variant">Staff</span>
          </div>
          <p className="text-xs text-on-surface-variant">Contributors</p>
          <p className="text-xl font-bold">{loading ? '...' : (metrics?.sales_per_staff.length ?? 0)}</p>
        </button>

        <button type="button" onClick={() => setActivePanel('products')} className={`text-left p-5 rounded-2xl border transition ${activePanel === 'products' ? 'border-primary bg-primary/5' : 'border-outline-variant/10 bg-surface-container-lowest'}`}>
          <div className="flex items-center justify-between mb-2">
            <ShoppingBag className="w-5 h-5 text-primary" />
            <span className="text-xs text-on-surface-variant">Avg Ticket</span>
          </div>
          <p className="text-xs text-on-surface-variant">Paid Orders</p>
          <p className="text-xl font-bold">{loading ? '...' : formatCurrency(avgTicket)}</p>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3 rounded-3xl border border-outline-variant/10 bg-surface-container-lowest p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg">Revenue Trend</h2>
            <button type="button" onClick={() => jumpToTransactions({ status: 'Completed' })} className="text-xs text-primary inline-flex items-center gap-1">
              Open Paid Transactions <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-72 relative rounded-2xl border border-outline-variant/20 bg-surface p-3" onMouseLeave={() => setHoverIndex(null)}>
            <div className="absolute inset-3 grid grid-rows-4">
              {[0, 1, 2, 3].map((line) => (
                <div key={line} className="border-b border-outline-variant/20" />
              ))}
            </div>

            <div className="absolute inset-3 flex gap-2">
              {trend.map((point, index) => (
                <button key={`${point.date}-${index}`} type="button" className="flex-1 min-w-0 h-full" onMouseEnter={() => setHoverIndex(index)} onFocus={() => setHoverIndex(index)} />
              ))}
            </div>

            <svg viewBox="0 0 100 100" className="absolute inset-3 w-[calc(100%-1.5rem)] h-[calc(100%-1.5rem)] overflow-visible pointer-events-none">
              <path d={trendPath} fill="none" stroke="currentColor" className="text-on-surface" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {hoverIndex !== null && trend.length > 0 && (
                <line
                  x1={(hoverIndex / Math.max(trend.length - 1, 1)) * 100}
                  x2={(hoverIndex / Math.max(trend.length - 1, 1)) * 100}
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
              <div className="absolute right-4 top-4 w-56 rounded-xl border border-outline-variant/20 bg-surface-container-low p-3 text-xs">
                <p className="font-semibold">{formatDate(hoveredPoint.date)}</p>
                <p className="mt-2 text-on-surface-variant">Revenue: <span className="text-on-surface font-medium">{formatCurrency(hoveredPoint.revenue)}</span></p>
                <p className="mt-1 text-on-surface-variant">Orders: <span className="text-on-surface font-medium">{hoveredPoint.count}</span></p>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-error mt-3">{error}</p>}
        </div>

        <div className="xl:col-span-2 rounded-3xl border border-outline-variant/10 bg-surface-container-lowest p-5">
          <h2 className="font-semibold text-lg mb-4">Payment Timeline</h2>
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {loading ? (
              <p className="text-sm text-on-surface-variant">Loading timeline...</p>
            ) : recentPaymentTimeline.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No payment events found.</p>
            ) : (
              recentPaymentTimeline.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => navigate(`/admin/transactions/${order.id}`)}
                  className="w-full text-left rounded-xl border border-outline-variant/15 p-3 hover:bg-surface transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Order #{order.id}</p>
                      <p className="text-xs text-on-surface-variant mt-1">{order.phone}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      {order.status === 'PAID' && <CheckCircle2 className="w-3.5 h-3.5 text-[#1f9d55]" />}
                      {order.status === 'FAILED' && <XCircle className="w-3.5 h-3.5 text-[#dc2626]" />}
                      {order.status === 'STK_SENT' && <Wallet className="w-3.5 h-3.5 text-[#2563eb]" />}
                      <span>{getStatusLabel(order.status)}</span>
                    </div>
                  </div>
                  <p className="text-xs mt-2 text-on-surface-variant">
                    {(order.created_at && new Date(order.created_at).toLocaleString('en-KE')) || 'Unknown time'} - {formatCurrency(order.amount)}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-outline-variant/10 bg-surface-container-lowest p-5">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <p className="text-sm font-semibold">Detailed Panels</p>
          {(['payments', 'channels', 'staff', 'products'] as ActivePanel[]).map((panel) => (
            <button
              key={panel}
              type="button"
              onClick={() => setActivePanel(panel)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${activePanel === panel ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface'}`}
            >
              {panel.charAt(0).toUpperCase() + panel.slice(1)}
            </button>
          ))}
        </div>

        {activePanel === 'revenue' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(trend.slice(-8) || []).map((point) => (
              <button
                key={point.date}
                type="button"
                onClick={() => jumpToTransactions({ date: point.date })}
                className="rounded-xl border border-outline-variant/15 p-4 text-left hover:bg-surface"
              >
                <p className="text-xs text-on-surface-variant">{formatDate(point.date)}</p>
                <p className="text-lg font-bold mt-1">{formatCurrency(point.revenue)}</p>
                <p className="text-xs text-on-surface-variant mt-1">{point.count} orders</p>
              </button>
            ))}
          </div>
        )}

        {activePanel === 'payments' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {paymentStateRows.map((row) => {
              const percentage = totalOrders > 0 ? (row.value / totalOrders) * 100 : 0;
              const mapStatus: Record<string, string> = { Paid: 'Completed', Pending: 'Processing', Failed: 'Failed' };
              return (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => jumpToTransactions({ status: mapStatus[row.label] || 'All Statuses' })}
                  className="rounded-xl border border-outline-variant/15 p-4 text-left hover:bg-surface"
                >
                  <p className="text-xs text-on-surface-variant">{row.label}</p>
                  <p className="text-2xl font-bold mt-1">{row.value}</p>
                  <div className="h-2 rounded-full bg-surface-container-low mt-3 overflow-hidden">
                    <div className={`${row.color} h-2`} style={{ width: `${Math.min(100, percentage)}%` }} />
                  </div>
                  <p className="text-xs text-on-surface-variant mt-2">{percentage.toFixed(1)}% of all orders</p>
                </button>
              );
            })}
          </div>
        )}

        {activePanel === 'channels' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(metrics?.channel_breakdown || []).map((row) => (
              <button
                key={row.channel}
                type="button"
                onClick={() => jumpToTransactions({ channel: row.channel === 'online' ? 'Online' : 'Admin' })}
                className="rounded-xl border border-outline-variant/15 p-4 text-left hover:bg-surface"
              >
                <p className="text-sm font-semibold uppercase">{row.channel}</p>
                <p className="text-xs text-on-surface-variant mt-1">{row.sales_count} transactions</p>
                <p className="text-lg font-bold mt-2">{formatCurrency(row.revenue)}</p>
              </button>
            ))}
          </div>
        )}

        {activePanel === 'staff' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {(metrics?.sales_per_staff || []).map((row) => (
              <button
                key={row.staff}
                type="button"
                onClick={() => jumpToTransactions({ staff: row.staff })}
                className="rounded-xl border border-outline-variant/15 p-4 text-left hover:bg-surface"
              >
                <p className="font-semibold truncate">{row.staff}</p>
                <p className="text-xs text-on-surface-variant mt-1">{row.sales_count} sales</p>
                <p className="text-lg font-bold mt-2">{formatCurrency(row.revenue)}</p>
              </button>
            ))}
          </div>
        )}

        {activePanel === 'products' && (
          <div className="space-y-2">
            {(metrics?.top_products || []).map((row) => (
              <button
                key={row.product_name}
                type="button"
                onClick={() => jumpToTransactions({ q: row.product_name })}
                className="w-full rounded-xl border border-outline-variant/15 p-4 text-left hover:bg-surface flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div>
                  <p className="font-medium">{row.product_name}</p>
                  <p className="text-xs text-on-surface-variant mt-1">{row.quantity} sold</p>
                </div>
                <p className="text-sm font-semibold">{formatCurrency(row.revenue)}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default Analytics;
