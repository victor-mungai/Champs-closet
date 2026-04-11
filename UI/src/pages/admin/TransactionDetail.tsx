import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ExternalLink, ReceiptText } from 'lucide-react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { fetchOrder } from '../../services/api';
import type { Order } from '../../types';
import type { AdminOutletContext } from './AdminLayout';

const formatAmount = (value: number) => new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(value);

const statusBadge = (status: Order['status']) => {
  if (status === 'PAID') return 'bg-[#4CAF50]/10 text-[#4CAF50]';
  if (status === 'STK_SENT') return 'bg-[#2196F3]/10 text-[#2196F3]';
  if (status === 'FAILED') return 'bg-[#E53935]/10 text-[#E53935]';
  return 'bg-[#FF9800]/10 text-[#FF9800]';
};

type TimelineState = 'done' | 'active' | 'failed' | 'pending';

type TimelineStep = {
  label: string;
  detail: string;
  state: TimelineState;
};

const dotClass = (state: TimelineState) => {
  if (state === 'done') return 'bg-[#4CAF50]';
  if (state === 'active') return 'bg-[#2196F3]';
  if (state === 'failed') return 'bg-[#E53935]';
  return 'bg-outline-variant/40';
};

const buildTimeline = (order: Order): TimelineStep[] => {
  const paymentMethod = (order.payment_method || 'stk').toLowerCase();
  const status = order.status;
  const isPaid = status === 'PAID';
  const isFailed = status === 'FAILED';
  const hasReceipt = Boolean(order.receipt_url || order.receipt);

  if (paymentMethod === 'cash') {
    return [
      { label: 'Order created', detail: 'Sale captured by admin', state: 'done' },
      {
        label: 'Cash marked paid',
        detail: isPaid ? 'Payment recorded successfully' : 'Awaiting payment mark',
        state: isPaid ? 'done' : isFailed ? 'failed' : 'active',
      },
      {
        label: 'Receipt generated',
        detail: hasReceipt ? 'Receipt is available' : 'Receipt generation in progress',
        state: hasReceipt ? 'done' : isPaid ? 'active' : 'pending',
      },
    ];
  }

  return [
    { label: 'Order created', detail: 'Order saved and inventory reserved', state: 'done' },
    {
      label: 'STK request sent',
      detail: 'M-Pesa prompt sent to customer phone',
      state: status === 'PENDING' ? 'active' : 'done',
    },
    {
      label: 'Customer confirmation',
      detail: isPaid ? 'M-Pesa callback confirmed payment' : isFailed ? 'Payment failed or was cancelled' : 'Waiting for callback',
      state: isPaid ? 'done' : isFailed ? 'failed' : 'active',
    },
    {
      label: 'Receipt generated',
      detail: hasReceipt ? 'Receipt ready for viewing' : 'Waiting for receipt generation',
      state: hasReceipt ? 'done' : isPaid ? 'active' : 'pending',
    },
  ];
};

const TransactionDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useOutletContext<AdminOutletContext>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !user) return;
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = await user.getIdToken();
        const data = await fetchOrder(id, token);
        if (active) setOrder(data);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || 'Failed to load transaction details.');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [id, user]);

  const totals = useMemo(() => {
    const subtotal = (order?.items || []).reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const delivery = order?.delivery_fee || 0;
    return { subtotal, delivery, total: order?.amount || 0 };
  }, [order]);

  const timeline = useMemo(() => (order ? buildTimeline(order) : []), [order]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 md:p-8 max-w-6xl mx-auto w-full">
      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={() => navigate('/admin/transactions')}
          className="inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface"
        >
          <ArrowLeft className="w-4 h-4" /> Back to transactions
        </button>
        {order?.receipt_url && (
          <a href={order.receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
            Open Receipt <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>

      {loading ? (
        <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 text-on-surface-variant">Loading transaction details...</div>
      ) : error || !order ? (
        <div className="bg-error-container text-on-error-container p-6 rounded-3xl">{error || 'Transaction not found.'}</div>
      ) : (
        <>
          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 mb-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <h1 className="font-headline text-3xl font-bold">Transaction #{order.id}</h1>
                <p className="text-on-surface-variant text-sm mt-1">{order.receipt || order.invoice_number || order.external_tx_id || 'Pending receipt reference'}</p>
              </div>
              <span className={`px-3 py-1.5 rounded-full text-xs font-medium w-max ${statusBadge(order.status)}`}>{order.status}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 text-sm">
              <div className="bg-surface-container-low p-4 rounded-2xl">
                <p className="text-on-surface-variant">Customer Phone</p>
                <p className="font-semibold mt-1">{order.phone}</p>
              </div>
              <div className="bg-surface-container-low p-4 rounded-2xl">
                <p className="text-on-surface-variant">Payment Method</p>
                <p className="font-semibold mt-1">{order.payment_method || 'stk'}</p>
              </div>
              <div className="bg-surface-container-low p-4 rounded-2xl">
                <p className="text-on-surface-variant">Channel</p>
                <p className="font-semibold mt-1">{order.channel || 'online'}</p>
              </div>
              <div className="bg-surface-container-low p-4 rounded-2xl">
                <p className="text-on-surface-variant">Created By</p>
                <p className="font-semibold mt-1">{order.created_by || 'system'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm">
              <div className="bg-surface-container-low p-4 rounded-2xl">
                <p className="text-on-surface-variant">Delivery</p>
                <p className="font-semibold mt-1">{order.delivery_type || 'pickup'}</p>
                <p className="text-on-surface-variant mt-1">{order.delivery_address || 'No delivery address'}</p>
              </div>
              <div className="bg-surface-container-low p-4 rounded-2xl">
                <p className="text-on-surface-variant">Receipt</p>
                <p className="font-semibold mt-1">{order.receipt || 'Pending'}</p>
                <p className="text-on-surface-variant mt-1">Invoice: {order.invoice_number || '-'}</p>
              </div>
            </div>

            <div className="mt-4 bg-surface-container-low p-4 rounded-2xl">
              <p className="text-xs uppercase tracking-[0.12em] text-on-surface-variant mb-3">Payment Timeline</p>
              <div className="space-y-3">
                {timeline.map((step) => (
                  <div key={step.label} className="flex items-start gap-3">
                    <span className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${dotClass(step.state)}`} />
                    <div>
                      <p className="text-sm font-semibold">{step.label}</p>
                      <p className="text-xs text-on-surface-variant mt-0.5">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-6">
            <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10">
              <h2 className="font-headline text-xl font-bold mb-4 flex items-center gap-2"><ReceiptText className="w-5 h-5" /> Products Bought</h2>

              {(order.items || []).length === 0 ? (
                <p className="text-sm text-on-surface-variant">No line items captured.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-on-surface-variant">
                      <tr>
                        <th className="text-left py-2 pr-4">Product</th>
                        <th className="text-left py-2 pr-4">Size</th>
                        <th className="text-left py-2 pr-4">Qty</th>
                        <th className="text-left py-2 pr-4">Unit Price</th>
                        <th className="text-left py-2">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10">
                      {(order.items || []).map((item, index) => (
                        <tr key={`${item.product_id}-${index}`}>
                          <td className="py-3 pr-4">{item.item_name || `Product #${item.product_id}`}</td>
                          <td className="py-3 pr-4">{item.size || '-'}</td>
                          <td className="py-3 pr-4">{item.quantity}</td>
                          <td className="py-3 pr-4">{formatAmount(item.unit_price)} Ksh</td>
                          <td className="py-3">{formatAmount(item.unit_price * item.quantity)} Ksh</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 h-fit">
              <h2 className="font-headline text-xl font-bold mb-4">Totals</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Subtotal</span>
                  <span className="font-medium">{formatAmount(totals.subtotal)} Ksh</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Delivery</span>
                  <span className="font-medium">{formatAmount(totals.delivery)} Ksh</span>
                </div>
                <div className="h-px bg-outline-variant/20" />
                <div className="flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span>{formatAmount(totals.total)} Ksh</span>
                </div>
              </div>

              {order.receipt_url ? (
                <a href={order.receipt_url} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-primary text-sm hover:underline">
                  View receipt PDF <ExternalLink className="w-4 h-4" />
                </a>
              ) : (
                <p className="mt-5 text-sm text-on-surface-variant">Receipt link is not ready yet.</p>
              )}

              <Link to="/admin/transactions" className="mt-6 inline-flex text-sm text-on-surface-variant hover:text-on-surface">Back to all transactions</Link>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
};

export default TransactionDetail;
