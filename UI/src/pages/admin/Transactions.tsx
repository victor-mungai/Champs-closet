import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, ExternalLink, Plus, Search, X } from 'lucide-react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import Button from '../../components/Button';
import { createAdminOrder, fetchOrders, fetchProducts } from '../../services/api';
import type { Order, Product } from '../../types';
import type { AdminOutletContext } from './AdminLayout';

type SaleLine = {
  productId: number;
  quantity: number;
  size: string;
};

type SaleLineDetail = {
  line: SaleLine;
  product: Product | null;
  maxQty: number;
  lineTotal: number;
};

type TransactionsProps = {
  forceOpenCreateSale?: boolean;
};

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  shirts: 'Shirts',
  shoe_hub: 'Shoe Hub',
  shoes: 'Shoes',
  vests: 'Vests',
  trousers: 'Trousers',
  sweaters: 'Sweaters',
  jeans: 'Jeans',
};

const getProductImage = (product: Product) => {
  if (product.image_urls && product.image_urls.length > 0) return product.image_urls[0];
  return product.image_url || undefined;
};

const getAvailableStock = (product: Product) => {
  if (typeof product.available_stock === 'number') return product.available_stock;
  const stock = product.stock ?? 0;
  const reserved = product.reserved_stock ?? 0;
  return Math.max(0, stock - reserved);
};

const normalizePhone = (value: string) => {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('0')) {
    digits = `254${digits.slice(1)}`;
  } else if (digits.startsWith('7') || digits.startsWith('1')) {
    digits = `254${digits}`;
  }
  return digits;
};

const normalizeCategoryToken = (value: string) => value.trim().toLowerCase().replace(/[\s-]+/g, '_');

const formatCategoryLabel = (value: string) => {
  if (CATEGORY_LABELS[value]) return CATEGORY_LABELS[value];
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const normalizeStatusFilter = (value: string | null) => {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'completed' || normalized === 'paid') return 'Completed';
  if (normalized === 'processing' || normalized === 'stk_sent') return 'Processing';
  if (normalized === 'failed') return 'Failed';
  if (normalized === 'pending') return 'Pending';
  return 'All Statuses';
};

const normalizeChannelFilter = (value: string | null) => {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'online') return 'Online';
  if (normalized === 'admin') return 'Admin';
  return 'All Channels';
};

const extractErrorMessage = (value: unknown, fallback: string) => {
  if (!(value instanceof Error)) return fallback;
  const raw = value.message?.trim();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.detail === 'string' && parsed.detail.length > 0) {
      return parsed.detail;
    }
  } catch {
    // keep original error text
  }
  return raw;
};

const Transactions = ({ forceOpenCreateSale = false }: TransactionsProps) => {
  const { user } = useOutletContext<AdminOutletContext>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState(() => normalizeStatusFilter(searchParams.get('status')));
  const [channelFilter, setChannelFilter] = useState(() => normalizeChannelFilter(searchParams.get('channel')));
  const [staffFilter, setStaffFilter] = useState(() => searchParams.get('staff') || '');
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  const [dateFilter, setDateFilter] = useState(() => searchParams.get('date') || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [catalog, setCatalog] = useState<Product[]>([]);
  const [facetProducts, setFacetProducts] = useState<Product[]>([]);
  const [saleCatalogLoading, setSaleCatalogLoading] = useState(false);
  const [saleCatalogError, setSaleCatalogError] = useState<string | null>(null);
  const [saleSearch, setSaleSearch] = useState('');
  const [saleCategory, setSaleCategory] = useState('all');
  const [saleTags, setSaleTags] = useState<string[]>([]);
  const [saleLines, setSaleLines] = useState<SaleLine[]>([]);
  const [salePhone, setSalePhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'stk'>('cash');
  const [submittingSale, setSubmittingSale] = useState(false);
  const [saleMessage, setSaleMessage] = useState<string | null>(null);

  useEffect(() => {
    if (forceOpenCreateSale) {
      setShowSaleModal(true);
    }
  }, [forceOpenCreateSale]);

  useEffect(() => {
    setStatusFilter(normalizeStatusFilter(searchParams.get('status')));
    setChannelFilter(normalizeChannelFilter(searchParams.get('channel')));
    setStaffFilter(searchParams.get('staff') || '');
    setSearchQuery(searchParams.get('q') || '');
    setDateFilter(searchParams.get('date') || '');
  }, [searchParams]);

  const statusLabel = (status: Order['status']) => {
    switch (status) {
      case 'PAID':
        return 'Completed';
      case 'STK_SENT':
        return 'Processing';
      case 'FAILED':
        return 'Failed';
      default:
        return 'Pending';
    }
  };

  const statusBadge = (status: Order['status']) => {
    const label = statusLabel(status);
    if (label === 'Completed') return 'bg-[#4CAF50]/10 text-[#4CAF50]';
    if (label === 'Processing') return 'bg-[#2196F3]/10 text-[#2196F3]';
    if (label === 'Failed') return 'bg-[#E53935]/10 text-[#E53935]';
    return 'bg-[#FF9800]/10 text-[#FF9800]';
  };

  const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('en-KE', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const formatAmount = (value: number) => new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(value);

  const apiStatusFilter = useMemo(() => {
    if (statusFilter === 'Completed') return 'PAID';
    if (statusFilter === 'Processing') return 'STK_SENT';
    if (statusFilter === 'Failed') return 'FAILED';
    if (statusFilter === 'Pending') return 'PENDING';
    return undefined;
  }, [statusFilter]);

  const apiChannelFilter = useMemo(() => {
    if (channelFilter === 'Online') return 'online';
    if (channelFilter === 'Admin') return 'admin';
    return undefined;
  }, [channelFilter]);

  const getAdminToken = useCallback(async () => {
    if (!user) return undefined;
    return user.getIdToken();
  }, [user]);

  const loadOrders = useCallback(async () => {
    const token = await getAdminToken();
    const data = await fetchOrders({
      limit: 100,
      status: apiStatusFilter,
      channel: apiChannelFilter,
      created_by: staffFilter.trim() || undefined,
      from: dateFilter || undefined,
      to: dateFilter || undefined,
      q: searchQuery.trim() || undefined,
    }, token);
    setOrders(data);
  }, [apiStatusFilter, apiChannelFilter, staffFilter, dateFilter, searchQuery, getAdminToken]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        await loadOrders();
      } catch (err: unknown) {
        if (active) setError(extractErrorMessage(err, 'Failed to load transactions.'));
      } finally {
        if (active) setLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadOrders]);

  useEffect(() => {
    if (!showSaleModal) return;
    let active = true;

    const loadFacetProducts = async () => {
      try {
        const rows = await fetchProducts();
        if (!active) return;
        setFacetProducts(rows);
      } catch {
        if (!active) return;
        setFacetProducts([]);
      }
    };

    loadFacetProducts();

    return () => {
      active = false;
    };
  }, [showSaleModal]);

  useEffect(() => {
    if (!showSaleModal) return;
    let active = true;

    const timer = window.setTimeout(async () => {
      try {
        setSaleCatalogLoading(true);
        setSaleCatalogError(null);
        const rows = await fetchProducts({
          category: saleCategory === 'all' ? undefined : saleCategory,
          tags: saleTags.length > 0 ? saleTags : undefined,
          search: saleSearch.trim() || undefined,
        });
        if (active) setCatalog(rows);
      } catch (err: unknown) {
        if (active) {
          setCatalog([]);
          setSaleCatalogError(extractErrorMessage(err, 'Unable to load products for this filter.'));
        }
      } finally {
        if (active) setSaleCatalogLoading(false);
      }
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [showSaleModal, saleCategory, saleTags, saleSearch]);

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return orders;
    return orders.filter((order) => {
      const productNames = (order.items || []).map((item) => item.item_name || '').join(' ').toLowerCase();
      return (
        order.phone.toLowerCase().includes(query) ||
        productNames.includes(query) ||
        (order.receipt || '').toLowerCase().includes(query) ||
        String(order.id).includes(query) ||
        (order.created_by || '').toLowerCase().includes(query)
      );
    });
  }, [orders, searchQuery]);

  const categoryOptions = useMemo(() => {
    const discovered = new Set<string>(['all']);
    facetProducts.forEach((product) => discovered.add(normalizeCategoryToken(product.category || '')));

    const preferred = ['all', 'shirts', 'shoe_hub', 'shoes', 'vests', 'trousers', 'sweaters', 'jeans'];
    const ordered = preferred.filter((item) => discovered.has(item));
    const extra = [...discovered].filter((item) => !ordered.includes(item)).sort((a, b) => a.localeCompare(b));
    return [...ordered, ...extra];
  }, [facetProducts]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    facetProducts.forEach((product) => {
      (product.tags || []).forEach((tag) => {
        const value = tag.name?.trim().toLowerCase();
        if (value) tags.add(value);
      });
    });
    return [...tags].sort((a, b) => a.localeCompare(b)).slice(0, 30);
  }, [facetProducts]);

  const productLookup = useMemo(() => {
    const map = new Map<number, Product>();
    [...facetProducts, ...catalog].forEach((product) => map.set(product.id, product));
    return map;
  }, [facetProducts, catalog]);

  const selectedProductIds = useMemo(() => new Set(saleLines.map((line) => line.productId)), [saleLines]);

  const saleLineDetails = useMemo<SaleLineDetail[]>(() => {
    return saleLines.map((line) => {
      const product = productLookup.get(line.productId) || null;
      const available = product ? Math.max(1, getAvailableStock(product)) : 1;
      const maxQty = product?.is_unique ? 1 : available;
      const quantity = Math.max(1, Math.min(line.quantity, maxQty));
      const lineTotal = quantity * (product?.price || 0);
      return { line: { ...line, quantity }, product, maxQty, lineTotal };
    });
  }, [saleLines, productLookup]);

  const saleTotals = useMemo(() => {
    const subtotal = saleLineDetails.reduce((sum, detail) => sum + detail.lineTotal, 0);
    const items = saleLineDetails.reduce((sum, detail) => sum + detail.line.quantity, 0);
    return { subtotal, items };
  }, [saleLineDetails]);

  const closeSaleModal = () => {
    if (submittingSale) return;
    setShowSaleModal(false);
    setSaleSearch('');
    setSaleCategory('all');
    setSaleTags([]);
    setSaleLines([]);
    setSalePhone('');
    setPaymentMethod('cash');
    setSaleCatalogError(null);
  };

  const addToSale = (product: Product) => {
    const maxQty = product.is_unique ? 1 : Math.max(1, getAvailableStock(product));
    setSaleLines((prev) => {
      const idx = prev.findIndex((line) => line.productId === product.id);
      if (idx >= 0) {
        const existing = prev[idx];
        const nextQty = Math.min(existing.quantity + 1, maxQty);
        if (nextQty === existing.quantity) return prev;
        return prev.map((line, i) => (i === idx ? { ...line, quantity: nextQty } : line));
      }
      return [...prev, { productId: product.id, quantity: 1, size: product.sizes?.[0] || '' }];
    });
  };

  const updateSaleLine = (productId: number, patch: Partial<SaleLine>) => {
    setSaleLines((prev) => prev.map((line) => (line.productId === productId ? { ...line, ...patch } : line)));
  };

  const removeSaleLine = (productId: number) => {
    setSaleLines((prev) => prev.filter((line) => line.productId !== productId));
  };

  const toggleSaleTag = (tag: string) => {
    setSaleTags((prev) => (prev.includes(tag) ? prev.filter((value) => value !== tag) : [...prev, tag]));
  };

  const handleCreateSale = async () => {
    if (!user) {
      setError('Please sign in as admin to create a sale.');
      return;
    }

    const validLines = saleLineDetails.filter((detail) => detail.product && detail.line.quantity > 0);
    if (validLines.length === 0) {
      setError('Select at least one product to create a sale.');
      return;
    }

    const normalizedPhone = normalizePhone(salePhone);
    if (!normalizedPhone || normalizedPhone.length < 12) {
      setError('Enter a valid customer phone number (e.g. 0712345678).');
      return;
    }

    try {
      setSubmittingSale(true);
      setError(null);
      setSaleMessage(null);

      const items = validLines.map((detail) => ({
        product_id: detail.line.productId,
        quantity: detail.line.quantity,
        unit_price: detail.product?.price || 0,
        name: detail.product?.name,
        size: detail.line.size || undefined,
      }));

      const createdBy = user.email || user.displayName || 'admin';
      const token = await user.getIdToken();
      const res = await createAdminOrder({
        phone: normalizedPhone,
        items,
        payment_method: paymentMethod,
        created_by: createdBy,
      }, token);

      if (paymentMethod === 'stk') {
        if (res.test) {
          setSaleMessage(`STK simulated in test mode for order #${res.order_id}.`);
        } else {
          setSaleMessage(`STK push initiated for order #${res.order_id}.`);
        }
      } else {
        setSaleMessage(`Cash sale recorded for order #${res.order_id}.`);
      }

      closeSaleModal();
      await loadOrders();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Failed to create sale.'));
    } finally {
      setSubmittingSale(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 md:p-8 max-w-7xl mx-auto w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold mb-2">Transactions</h1>
          <p className="text-on-surface-variant">Monitor payments, receipts, and customer purchases.</p>
        </div>
        <Button className="gap-2 w-full sm:w-auto" onClick={() => setShowSaleModal(true)}>
          <Plus className="w-4 h-4" /> Create Sale
        </Button>
      </div>

      {saleMessage && (
        <div className="mb-6 bg-success-container text-on-success-container p-4 rounded-2xl text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {saleMessage}
        </div>
      )}

      <div className="bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/10 overflow-hidden mb-8">
        <div className="p-4 border-b border-outline-variant/10 grid grid-cols-1 md:grid-cols-5 gap-4">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-surface-container-low px-4 py-2 rounded-lg text-sm focus:outline-none"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-surface-container-low px-4 py-2 rounded-lg text-sm focus:outline-none appearance-none"
          >
            <option>All Statuses</option>
            <option>Completed</option>
            <option>Processing</option>
            <option>Pending</option>
            <option>Failed</option>
          </select>
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="bg-surface-container-low px-4 py-2 rounded-lg text-sm focus:outline-none appearance-none"
          >
            <option>All Channels</option>
            <option>Online</option>
            <option>Admin</option>
          </select>
          <input
            type="text"
            placeholder="Filter by staff"
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="bg-surface-container-low px-4 py-2 rounded-lg text-sm focus:outline-none"
          />
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Search phone or name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-container-low pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none"
            />
          </div>
        </div>

        <div className="md:hidden p-4 space-y-3">
          {loading ? (
            <div className="text-sm text-on-surface-variant">Loading transactions...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-sm text-on-surface-variant">No transactions found.</div>
          ) : (
            filteredOrders.map((order) => (
              <div key={order.id} className="rounded-2xl border border-outline-variant/15 p-4 bg-surface space-y-2 cursor-pointer" onClick={() => navigate(`/admin/transactions/${order.id}`)}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{order.receipt || order.invoice_number || `ORD-${order.id}`}</p>
                  <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${statusBadge(order.status)}`}>
                    {statusLabel(order.status)}
                  </span>
                </div>
                <p className="text-sm text-on-surface-variant">{order.phone}</p>
                <p className="text-sm">{formatAmount(order.amount)} Ksh</p>
                <p className="text-xs text-on-surface-variant">
                  {formatDate(order.created_at)} - {order.channel || 'online'} - {order.created_by || 'system'}
                </p>
                {order.receipt_url && (
                  <a href={order.receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary text-sm" onClick={(event) => event.stopPropagation()}>
                    View receipt <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))
          )}
        </div>

        <div className="hidden md:block w-full overflow-x-auto">
          <table className="min-w-[1080px] w-full table-fixed text-left text-sm">
            <thead className="bg-surface-container-low/50 text-on-surface-variant">
              <tr>
                <th className="px-6 py-4 font-medium w-[190px]">Receipt No.</th>
                <th className="px-6 py-4 font-medium w-[150px]">Date & Time</th>
                <th className="px-6 py-4 font-medium w-[150px]">Customer</th>
                <th className="px-6 py-4 font-medium w-[100px]">Channel</th>
                <th className="px-6 py-4 font-medium w-[130px]">Staff</th>
                <th className="px-6 py-4 font-medium w-[120px]">Amount</th>
                <th className="px-6 py-4 font-medium w-[120px]">Status</th>
                <th className="px-6 py-4 font-medium w-[120px]">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {loading ? (
                <tr>
                  <td className="px-6 py-8 text-on-surface-variant" colSpan={8}>
                    Loading transactions...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-on-surface-variant" colSpan={8}>
                    No transactions found.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-surface-container-low/50 transition-colors cursor-pointer" onClick={() => navigate(`/admin/transactions/${order.id}`)}>
                    <td className="px-6 py-4 font-medium text-primary truncate" title={order.receipt || order.invoice_number || order.external_tx_id || `ORD-${order.id}`}>
                      {order.receipt || order.invoice_number || order.external_tx_id || `ORD-${order.id}`}
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant truncate">{formatDate(order.created_at)}</td>
                    <td className="px-6 py-4 truncate" title={order.phone}>{order.phone}</td>
                    <td className="px-6 py-4 truncate">{order.channel || 'online'}</td>
                    <td className="px-6 py-4 truncate" title={order.created_by || 'system'}>{order.created_by || 'system'}</td>
                    <td className="px-6 py-4 font-medium truncate">{formatAmount(order.amount)} Ksh</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-medium inline-flex items-center gap-1 w-max ${statusBadge(order.status)}`}>
                        {order.status === 'PAID' && <CheckCircle2 className="w-3 h-3" />}
                        {statusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {order.receipt_url ? (
                        <a href={order.receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline" onClick={(event) => event.stopPropagation()}>
                          View <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-on-surface-variant text-xs">Pending</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-error-container text-on-error-container p-4 rounded-2xl text-sm">
          {error}
        </div>
      )}

      <AnimatePresence>
        {showSaleModal && (
          <div
            className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
            onClick={closeSaleModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl w-full max-w-6xl my-3 sm:my-6 max-h-[calc(100vh-1.5rem)] sm:max-h-[92vh] overflow-y-auto overscroll-contain"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6 gap-3">
                <div>
                  <h2 className="text-xl font-bold font-headline">Create Admin Sale</h2>
                  <p className="text-sm text-on-surface-variant">Search products, filter quickly, then complete with cash or STK.</p>
                </div>
                <button onClick={closeSaleModal} className="p-2 hover:bg-surface-container-low rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                      <input
                        type="text"
                        placeholder="Search by product name"
                        value={saleSearch}
                        onChange={(e) => setSaleSearch(e.target.value)}
                        className="w-full bg-surface-container-low pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none"
                      />
                    </div>
                    <Button type="button" variant="ghost" className="rounded-xl px-4 py-2 text-sm" onClick={() => { setSaleCategory('all'); setSaleTags([]); setSaleSearch(''); }}>
                      Clear Filters
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-on-surface-variant">Category</p>
                    <div className="flex flex-wrap gap-2">
                      {categoryOptions.map((category) => (
                        <button
                          key={category}
                          type="button"
                          onClick={() => setSaleCategory(category)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${saleCategory === category ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'}`}
                        >
                          {formatCategoryLabel(category)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-on-surface-variant">Tags</p>
                    {availableTags.length === 0 ? (
                      <p className="text-sm text-on-surface-variant">No tags available yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto pr-1">
                        {availableTags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleSaleTag(tag)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${saleTags.includes(tag) ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'}`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-outline-variant/15 p-3 min-h-[320px]">
                    {saleCatalogLoading ? (
                      <div className="h-full min-h-[280px] flex items-center justify-center text-sm text-on-surface-variant">
                        Loading products...
                      </div>
                    ) : saleCatalogError ? (
                      <div className="h-full min-h-[280px] flex items-center justify-center text-sm text-error">
                        {saleCatalogError}
                      </div>
                    ) : catalog.length === 0 ? (
                      <div className="h-full min-h-[280px] flex items-center justify-center text-sm text-on-surface-variant">
                        No products found for the current filters.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto pr-1">
                        {catalog.map((product) => {
                          const available = getAvailableStock(product);
                          const outOfStock = available <= 0;
                          const selected = selectedProductIds.has(product.id);
                          return (
                            <button
                              key={product.id}
                              type="button"
                              disabled={outOfStock}
                              onClick={() => addToSale(product)}
                              className={`text-left rounded-xl border p-2 transition-colors ${selected ? 'border-primary bg-primary/5' : 'border-outline-variant/15'} ${outOfStock ? 'opacity-50 cursor-not-allowed' : 'hover:bg-surface-container-low'}`}
                            >
                              <div className="aspect-square rounded-lg overflow-hidden bg-surface-container-low mb-2">
                                <img
                                  src={getProductImage(product) || 'https://picsum.photos/seed/admin-sale/200/200'}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <p className="text-xs font-medium line-clamp-2">{product.name}</p>
                              <p className="text-xs text-on-surface-variant mt-1">{formatAmount(product.price)} Ksh</p>
                              <p className={`text-[11px] mt-1 ${outOfStock ? 'text-error' : 'text-on-surface-variant'}`}>
                                {outOfStock ? 'Out of stock' : `Stock: ${available}`}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-outline-variant/15 p-4 space-y-4 h-fit">
                  <h3 className="font-semibold">Selected Items</h3>

                  <div className="grid grid-cols-1 gap-3">
                    <input
                      type="tel"
                      placeholder="Customer phone (0712345678)"
                      value={salePhone}
                      onChange={(e) => setSalePhone(e.target.value)}
                      className="bg-surface-container-low px-4 py-2 rounded-lg text-sm focus:outline-none"
                    />
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'stk')}
                      className="bg-surface-container-low px-4 py-2 rounded-lg text-sm focus:outline-none"
                    >
                      <option value="cash">Cash (mark paid)</option>
                      <option value="stk">M-Pesa STK Push</option>
                    </select>
                  </div>

                  <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                    {saleLineDetails.length === 0 ? (
                      <p className="text-sm text-on-surface-variant">No items selected yet. Tap products to add them.</p>
                    ) : (
                      saleLineDetails.map((detail) => (
                        <div key={detail.line.productId} className="rounded-xl border border-outline-variant/15 p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{detail.product?.name || `Product #${detail.line.productId}`}</p>
                              <p className="text-xs text-on-surface-variant">
                                {detail.product ? `${formatAmount(detail.product.price)} Ksh` : 'Price unavailable'}
                              </p>
                            </div>
                            <button type="button" onClick={() => removeSaleLine(detail.line.productId)} className="text-xs text-error">
                              Remove
                            </button>
                          </div>

                          <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="w-7 h-7 rounded-full bg-surface-container-low"
                                onClick={() => updateSaleLine(detail.line.productId, { quantity: Math.max(1, detail.line.quantity - 1) })}
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min={1}
                                max={detail.maxQty}
                                value={detail.line.quantity}
                                onChange={(e) => {
                                  const next = Number(e.target.value) || 1;
                                  const capped = Math.max(1, Math.min(next, detail.maxQty));
                                  updateSaleLine(detail.line.productId, { quantity: capped });
                                }}
                                className="w-16 bg-surface-container-low px-2 py-1 rounded-lg text-sm text-center focus:outline-none"
                              />
                              <button
                                type="button"
                                className="w-7 h-7 rounded-full bg-surface-container-low"
                                onClick={() => updateSaleLine(detail.line.productId, { quantity: Math.min(detail.maxQty, detail.line.quantity + 1) })}
                              >
                                +
                              </button>
                            </div>
                            <p className="text-xs text-on-surface-variant text-right">Max {detail.maxQty}</p>
                          </div>

                          {detail.product?.sizes && detail.product.sizes.length > 0 ? (
                            <select
                              value={detail.line.size}
                              onChange={(e) => updateSaleLine(detail.line.productId, { size: e.target.value })}
                              className="w-full bg-surface-container-low px-3 py-2 rounded-lg text-xs focus:outline-none"
                            >
                              <option value="">Select size</option>
                              {detail.product.sizes.map((size) => (
                                <option key={size} value={size}>
                                  {size}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={detail.line.size}
                              onChange={(e) => updateSaleLine(detail.line.productId, { size: e.target.value })}
                              placeholder="Size (optional)"
                              className="w-full bg-surface-container-low px-3 py-2 rounded-lg text-xs focus:outline-none"
                            />
                          )}

                          <div className="flex justify-between text-xs">
                            <span className="text-on-surface-variant">Line total</span>
                            <span className="font-medium">{formatAmount(detail.lineTotal)} Ksh</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="pt-2 border-t border-outline-variant/15 text-sm space-y-1">
                    <div className="flex justify-between text-on-surface-variant">
                      <span>Items</span>
                      <span>{saleTotals.items}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Subtotal</span>
                      <span>{formatAmount(saleTotals.subtotal)} Ksh</span>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row gap-3">
                    <Button type="button" variant="ghost" className="w-full sm:flex-1" onClick={closeSaleModal}>
                      Cancel
                    </Button>
                    <Button type="button" className="w-full sm:flex-1" onClick={handleCreateSale}>
                      {submittingSale ? 'Creating...' : paymentMethod === 'stk' ? 'Send STK Push' : 'Record Cash Sale'}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Transactions;


