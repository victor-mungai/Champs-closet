import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Plus, Search, Smartphone, X } from 'lucide-react';
import Button from '../../components/Button';
import { fetchOrders } from '../../services/api';
import type { Order } from '../../types';

const Transactions = () => {
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    if (!value) return '—';
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

  useEffect(() => {
    let active = true;
    const loadOrders = async () => {
      try {
        setLoading(true);
        const data = await fetchOrders({ limit: 100 });
        if (active) setOrders(data);
      } catch (err: any) {
        if (active) setError(err?.message || 'Failed to load transactions.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadOrders();
    return () => {
      active = false;
    };
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const label = statusLabel(order.status);
      const matchesStatus = statusFilter === 'All Statuses' || label === statusFilter;
      const query = searchQuery.trim().toLowerCase();
      const reference = `${order.receipt || ''} ${order.invoice_number || ''} ${order.external_tx_id || ''} ${order.id}`.toLowerCase();
      const matchesSearch =
        query.length === 0 ||
        reference.includes(query) ||
        order.phone.toLowerCase().includes(query);
      const createdAt = order.created_at ? order.created_at.slice(0, 10) : '';
      const matchesDate = !dateFilter || createdAt === dateFilter;
      return matchesStatus && matchesSearch && matchesDate;
    });
  }, [orders, statusFilter, searchQuery, dateFilter]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 md:p-8 max-w-6xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold mb-2">Transactions</h1>
          <p className="text-on-surface-variant">Monitor M-Pesa payments and orders.</p>
        </div>
        <Button className="gap-2 w-full sm:w-auto" onClick={() => setShowSaleModal(true)} disabled><Plus className="w-4 h-4" /> Initiate Sale</Button>
      </div>

      <div className="bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/10 overflow-hidden mb-8">
        <div className="p-4 border-b border-outline-variant/10 flex flex-col sm:flex-row gap-4">
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
          <div className="relative flex-1 max-w-md ml-auto">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Search receipt or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-container-low pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-container-low/50 text-on-surface-variant">
              <tr>
                <th className="px-6 py-4 font-medium">Receipt No.</th>
                <th className="px-6 py-4 font-medium">Date & Time</th>
                <th className="px-6 py-4 font-medium">Customer</th>
                <th className="px-6 py-4 font-medium">Channel</th>
                <th className="px-6 py-4 font-medium">Amount</th>
                <th className="px-6 py-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {loading ? (
                <tr>
                  <td className="px-6 py-8 text-on-surface-variant" colSpan={6}>Loading transactions...</td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-on-surface-variant" colSpan={6}>No transactions found.</td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-surface-container-low/50 transition-colors cursor-pointer">
                    <td className="px-6 py-4 font-medium text-primary">{order.receipt || order.invoice_number || order.external_tx_id || `ORD-${order.id}`}</td>
                    <td className="px-6 py-4 text-on-surface-variant">{formatDate(order.created_at)}</td>
                    <td className="px-6 py-4">{order.phone}</td>
                    <td className="px-6 py-4 text-on-surface-variant">M-Pesa</td>
                    <td className="px-6 py-4 font-medium">{order.amount} Ksh</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 w-max ${statusBadge(order.status)}`}>
                        {order.status === 'PAID' && <CheckCircle2 className="w-3 h-3" />}
                        {statusLabel(order.status)}
                      </span>
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

      <div className="fixed bottom-8 right-8 bg-surface-container-lowest p-4 rounded-2xl shadow-lg border border-outline-variant/10 hidden md:flex items-center gap-4 z-50">
        <div className="w-10 h-10 rounded-full bg-[#4CAF50]/10 flex items-center justify-center text-[#4CAF50]">
          <Smartphone className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-medium">M-Pesa API Status</p>
          <p className="text-xs text-[#4CAF50] font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#4CAF50]"></span> Operational</p>
        </div>
      </div>

      <AnimatePresence>
        {showSaleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface p-6 rounded-3xl shadow-xl w-full max-w-md"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold font-headline">Initiate Offline Sale</h2>
                <button onClick={() => setShowSaleModal(false)} className="p-2 hover:bg-surface-container-low rounded-full"><X className="w-5 h-5" /></button>
              </div>
              <div className="text-sm text-on-surface-variant mb-6">
                Offline sales are not connected yet. This will be enabled once the POS workflow is added.
              </div>
              <div className="pt-4 flex gap-3">
                <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowSaleModal(false)}>Close</Button>
                <Button type="button" className="flex-1 bg-[#4CAF50] hover:shadow-[#4CAF50]/20 text-white" onClick={() => setShowSaleModal(false)}>Okay</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Transactions;
