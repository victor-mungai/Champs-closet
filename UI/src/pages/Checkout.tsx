import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, Loader2, Lock, MapPin, Search, Smartphone, XCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { AdvancedMarker, Map, useApiIsLoaded, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import { useCart } from '../context/CartContext';
import { createOrder, fetchDeliveryQuote, fetchOrderStatus } from '../services/api';

const SHOP_LOCATION = { lat: -1.49315, lng: 36.955124 };
const MAP_ID =
  (import.meta as any).env?.VITE_GOOGLE_MAPS_MAP_ID ||
  (globalThis as any).GOOGLE_MAPS_MAP_ID ||
  undefined;

const JAGGED_TOP_BG =
  "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHBvbHlnb24gcG9pbnRzPSIwLDEwIDUsMCAxMCwxMCIgZmlsbD0iI2ZkZmJmNyIvPjwvc3ZnPg==')";
const JAGGED_BOTTOM_BG =
  "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHBvbHlnb24gcG9pbnRzPSIwLDAgNSwxMCAxMCwwIiBmaWxsPSIjZmRmYmY3Ii8+PC9zdmc+')";
const BARCODE_BG =
  "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjcGF0dGVybikiIC8+PGRlZnM+PHBhdHRlcm4gaWQ9InBhdHRlcm4iIHdpZHRoPSI4IiBoZWlnaHQ9IjgiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiPjxyZWN0IHdpZHRoPSIyIiBoZWlnaHQ9IjgiIGZpbGw9IiMwMDAiIC8+PHJlY3QgeD0iNCIgd2lkdGg9IjEiIGhlaWdodD0iOCIgZmlsbD0iIzAwMCIgLz48cmVjdCB4PSI2IiB3aWR0aD0iMSIgaGVpZ2h0PSI4IiBmaWxsPSIjMDAwIiAvPjwvcGF0dGVybj48L2RlZnM+PC9zdmc+')";

type DeliveryAddress = {
  location: google.maps.LatLng;
  label: string;
};

type ReceiptLineItem = {
  name: string;
  size: string;
  quantity: number;
  lineTotal: number;
};

type PaymentReceipt = {
  status: 'PENDING' | 'PAID' | 'FAILED';
  message: string;
  orderId: number;
  amount: number;
  subtotal: number;
  deliveryFee: number;
  deliveryType: string;
  invoice?: string;
  receipt?: string;
  receiptUrl?: string;
  phone: string;
  items: ReceiptLineItem[];
  createdAt: string;
};

const PAYMENT_POLL_INTERVAL_MS = 4000;
const PAYMENT_POLL_ATTEMPTS = 18;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type TimelineState = 'done' | 'active' | 'failed';

const MpesaButton = ({ onClick, className = '', disabled = false }: { onClick?: () => void; className?: string; disabled?: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`w-full bg-[#4CAF50] hover:bg-[#45a049] text-white rounded-full py-4 px-6 font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#4CAF50]/20 disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
  >
    <Smartphone className="w-5 h-5" />
    Pay with M-Pesa
  </button>
);

const normalizePhone = (value: string) => {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('0')) {
    digits = `254${digits.slice(1)}`;
  } else if (digits.startsWith('7')) {
    digits = `254${digits}`;
  } else if (digits.startsWith('1')) {
    digits = `254${digits}`;
  }
  return digits;
};

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const Checkout = () => {
  const navigate = useNavigate();
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress | null>(null);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [addressQuery, setAddressQuery] = useState('');
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [isCalculatingFee, setIsCalculatingFee] = useState(false);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [phone, setPhone] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentReceipt, setPaymentReceipt] = useState<PaymentReceipt | null>(null);
  const isMapsLoaded = useApiIsLoaded();

  const checkoutMap = useMap('CHECKOUT_MAP');
  const pickupMap = useMap('PICKUP_MAP');
  const map = deliveryMethod === 'delivery' ? checkoutMap : pickupMap;
  const geocodingLib = useMapsLibrary('geocoding');

  const mapRef = useRef<google.maps.Map | null>(null);
  useEffect(() => {
    mapRef.current = map;
  }, [map]);

  useEffect(() => {
    if (deliveryMethod === 'pickup') {
      setDeliveryFee(0);
      setRouteInfo(null);
      if (map) {
        map.panTo(SHOP_LOCATION);
        map.setZoom(15);
      }
      return;
    }

    if (deliveryMethod === 'delivery' && deliveryAddress?.location && mapRef.current) {
      const shop = SHOP_LOCATION;
      const destination = {
        lat: deliveryAddress.location.lat(),
        lng: deliveryAddress.location.lng(),
      };
      const km = haversineKm(shop.lat, shop.lng, destination.lat, destination.lng);
      const mins = Math.max(5, Math.round(km * 3));
      setRouteInfo({ distance: `Approx. ${km.toFixed(1)} km`, duration: `Approx. ${mins} min` });
      mapRef.current.panTo(destination);
      mapRef.current.setZoom(14);
    }
  }, [deliveryMethod, deliveryAddress, map]);

  useEffect(() => {
    if (deliveryMethod !== 'delivery' || !deliveryAddress?.location) {
      return;
    }

    let active = true;
    const location = deliveryAddress.location;

    const loadQuote = async () => {
      try {
        setIsCalculatingFee(true);
        setPaymentError(null);
        const quote = await fetchDeliveryQuote(location.lat(), location.lng());
        if (active) {
          setDeliveryFee(quote.fee);
        }
      } catch (err: any) {
        if (active) {
          setPaymentError(err?.message || 'Failed to calculate delivery fee.');
        }
      } finally {
        if (active) {
          setIsCalculatingFee(false);
        }
      }
    };

    loadQuote();
    return () => {
      active = false;
    };
  }, [deliveryMethod, deliveryAddress]);

  const handleAddressSearch = async () => {
    const query = addressQuery.trim();
    if (!query) {
      setPaymentError('Enter a delivery address to search.');
      return;
    }

    if (!isMapsLoaded || !geocodingLib) {
      setPaymentError('Google Maps is still loading. Try again in a moment.');
      return;
    }

    try {
      setIsSearchingAddress(true);
      setPaymentError(null);
      const geocoder = new geocodingLib.Geocoder();
      const result = await geocoder.geocode({ address: query });
      const first = result.results?.[0];
      const location = first?.geometry?.location;
      if (!location) {
        setPaymentError('No matching delivery location found.');
        return;
      }

      setDeliveryAddress({
        location,
        label: first.formatted_address || query,
      });
    } catch (err: any) {
      setPaymentError(err?.message || 'Failed to search for that address.');
    } finally {
      setIsSearchingAddress(false);
    }
  };

  const { items, clearCart } = useCart();
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const total = subtotal + deliveryFee;

  const refreshPaymentStatus = async (orderId: number, normalizedPhone: string) => {
    const current = await fetchOrderStatus(orderId, normalizedPhone);
    const status = current.status;

    if (status === 'PAID') {
      clearCart();
      setPaymentReceipt((previous) =>
        previous
          ? {
              ...previous,
              status: 'PAID',
              message: 'Payment confirmed. Your receipt is ready.',
              amount: current.amount ?? previous.amount,
              invoice: current.invoice_number ?? previous.invoice,
              receipt: current.receipt ?? previous.receipt,
              receiptUrl: current.receipt_url ?? previous.receiptUrl,
            }
          : previous,
      );
      return status;
    }

    if (status === 'FAILED') {
      setPaymentReceipt((previous) =>
        previous
          ? {
              ...previous,
              status: 'FAILED',
              message: 'Payment failed or was cancelled. You can try again.',
              invoice: current.invoice_number ?? previous.invoice,
            }
          : previous,
      );
      return status;
    }

    setPaymentReceipt((previous) =>
      previous
        ? {
            ...previous,
            status: 'PENDING',
            message: 'Awaiting M-Pesa confirmation. Complete the prompt on your phone.',
            invoice: current.invoice_number ?? previous.invoice,
          }
        : previous,
    );
    return status;
  };

  const pollPaymentStatus = async (orderId: number, normalizedPhone: string) => {
    for (let attempt = 0; attempt < PAYMENT_POLL_ATTEMPTS; attempt += 1) {
      try {
        const status = await refreshPaymentStatus(orderId, normalizedPhone);
        if (status === 'PAID' || status === 'FAILED') {
          return;
        }
      } catch {
        // Keep polling, network failures can be transient.
      }

      await wait(PAYMENT_POLL_INTERVAL_MS);
    }

    setPaymentReceipt((previous) =>
      previous
        ? {
            ...previous,
            status: 'PENDING',
            message: 'Still waiting for confirmation. Tap "Check Status" after approving M-Pesa.',
          }
        : previous,
    );
  };

  const handlePayment = async () => {
    setPaymentError(null);
    setPaymentReceipt(null);

    if (items.length === 0) {
      setPaymentError('Your cart is empty.');
      return;
    }

    if (deliveryMethod === 'delivery' && !deliveryAddress) {
      setPaymentError('Please select a delivery location.');
      return;
    }

    if (deliveryMethod === 'delivery' && isCalculatingFee) {
      setPaymentError('Delivery fee is still being calculated. Please wait a moment.');
      return;
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone || normalizedPhone.length < 12) {
      setPaymentError('Enter a valid M-Pesa number (e.g. 0712 345 678).');
      return;
    }

    setIsPaying(true);
    try {
      const receiptItems = items.map(item => ({
        name: item.product.name,
        quantity: item.quantity,
        size: item.size,
        lineTotal: item.product.price * item.quantity,
      }));

      const orderItems = items.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price,
        name: item.product.name,
        size: item.size,
      }));

      const response = await createOrder({
        phone: normalizedPhone,
        items: orderItems,
        delivery: deliveryMethod === 'delivery' && deliveryAddress
          ? {
              type: 'delivery',
              lat: deliveryAddress.location.lat(),
              lng: deliveryAddress.location.lng(),
              label: deliveryAddress.label,
            }
          : { type: 'pickup' },
      });
      const resolvedDeliveryFee = response.delivery_fee ?? deliveryFee;
      const resolvedAmount = response.amount ?? total;
      setDeliveryFee(resolvedDeliveryFee);
      setPaymentReceipt({
        status: 'PENDING',
        message: response.message || 'STK prompt sent. Complete payment on your phone.',
        orderId: response.order_id,
        amount: resolvedAmount,
        subtotal,
        deliveryFee: resolvedDeliveryFee,
        deliveryType: response.delivery_type || deliveryMethod,
        invoice: response.invoice,
        receipt: undefined,
        receiptUrl: undefined,
        phone: normalizedPhone,
        items: receiptItems,
        createdAt: new Date().toISOString(),
      });
      await pollPaymentStatus(response.order_id, normalizedPhone);
    } catch (err: any) {
      setPaymentError(err?.message || 'Failed to initiate payment.');
    } finally {
      setIsPaying(false);
    }
  };

  if (paymentReceipt) {
    const receiptDate = new Date(paymentReceipt.createdAt);
    const orderNumber = String(paymentReceipt.orderId).padStart(5, '0');
    const isPaid = paymentReceipt.status === 'PAID';
    const isFailed = paymentReceipt.status === 'FAILED';
    const headline = isPaid ? 'Payment Successful' : isFailed ? 'Payment Failed' : 'Waiting for Payment';
    const badgeClass = isPaid
      ? 'bg-[#4CAF50]/10 text-[#4CAF50]'
      : isFailed
        ? 'bg-[#ef4444]/10 text-[#ef4444]'
        : 'bg-[#f59e0b]/10 text-[#f59e0b]';
    const timeline: { label: string; state: TimelineState }[] = [
      { label: 'Order created', state: 'done' },
      { label: 'STK prompt sent', state: 'done' },
      {
        label: 'Payment confirmation',
        state: isPaid ? 'done' : isFailed ? 'failed' : 'active',
      },
    ];

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="pt-20 bg-surface-container-low min-h-screen flex flex-col items-center justify-center p-4 sm:p-6"
      >
        <div className="text-center mb-8">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${badgeClass}`}>
            {isPaid && <Check className="w-8 h-8" />}
            {isFailed && <XCircle className="w-8 h-8" />}
            {!isPaid && !isFailed && <Loader2 className="w-8 h-8 animate-spin" />}
          </div>
          <h2 className="text-2xl font-bold text-on-surface">{headline}</h2>
          <p className="text-on-surface-variant">{paymentReceipt.message}</p>
        </div>

        <div className="relative w-full max-w-md bg-[#fdfbf7] text-[#1f2937] shadow-xl font-mono text-sm pb-8 rounded-xl overflow-visible">
          <div
            className="absolute -top-2 left-0 right-0 h-2 bg-repeat-x"
            style={{ backgroundImage: JAGGED_TOP_BG }}
          />

          <div className="p-6 sm:p-8">
            <div className="text-center mb-6">
              <h3 className="font-bold text-xl uppercase tracking-widest mb-1">Champs Closet</h3>
              <p className="text-xs text-[#4b5563]">Champs closet,Club Enkare</p>
              <p className="text-xs text-[#4b5563]">Kitengela, Kenya</p>
              <p className="text-xs text-[#4b5563]">Tel: +254 722606526</p>
            </div>

            <div className="border-b-2 border-dashed border-[#d1d5db] pb-4 mb-4 text-xs space-y-1">
              <div className="flex justify-between"><span>Date:</span><span>{receiptDate.toLocaleDateString()}</span></div>
              <div className="flex justify-between"><span>Time:</span><span>{receiptDate.toLocaleTimeString()}</span></div>
              <div className="flex justify-between"><span>Order No:</span><span>CH-{orderNumber}</span></div>
              <div className="flex justify-between"><span>Phone:</span><span>{paymentReceipt.phone}</span></div>
            </div>

            <div className="mb-4">
              <div className="flex justify-between font-bold border-b-2 border-dashed border-[#d1d5db] pb-2 mb-2">
                <span>QTY ITEM</span>
                <span>AMT</span>
              </div>
              {paymentReceipt.items.map((item, idx) => (
                <div key={`${item.name}-${idx}`} className="flex justify-between mb-2 gap-3">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="truncate">{item.quantity}x {item.name}</p>
                    <p className="text-xs text-[#6b7280]">Size: {item.size}</p>
                  </div>
                  <span className="whitespace-nowrap">{item.lineTotal} Ksh</span>
                </div>
              ))}
            </div>

            <div className="border-t-2 border-dashed border-[#d1d5db] pt-4 space-y-2 mb-6">
              <div className="flex justify-between"><span>SUBTOTAL</span><span>{paymentReceipt.subtotal} Ksh</span></div>
              <div className="flex justify-between">
                <span>DELIVERY</span>
                <span>{paymentReceipt.deliveryFee === 0 ? 'FREE' : `${paymentReceipt.deliveryFee} Ksh`}</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-2"><span>TOTAL</span><span>{paymentReceipt.amount} Ksh</span></div>
              <div className="flex justify-between text-xs pt-2"><span>PAYMENT METHOD</span><span>M-PESA</span></div>
              <div className="flex justify-between text-xs"><span>STATUS</span><span>{paymentReceipt.status}</span></div>
              {paymentReceipt.invoice && (
                <div className="flex justify-between text-xs"><span>REFERENCE</span><span>{paymentReceipt.invoice}</span></div>
              )}
              {paymentReceipt.receipt && (
                <div className="flex justify-between text-xs"><span>M-PESA RECEIPT</span><span>{paymentReceipt.receipt}</span></div>
              )}
            </div>

            <div className="rounded-xl border border-[#d1d5db] p-3 mb-6">
              <p className="text-xs font-bold tracking-wide mb-2">PAYMENT TIMELINE</p>
              <div className="space-y-2">
                {timeline.map((step) => {
                  const dotClass =
                    step.state === 'done'
                      ? 'bg-[#4CAF50]'
                      : step.state === 'failed'
                        ? 'bg-[#ef4444]'
                        : 'bg-[#f59e0b]';
                  return (
                    <div key={step.label} className="flex items-center gap-2 text-xs">
                      <span className={`inline-flex h-2.5 w-2.5 rounded-full ${dotClass}`} />
                      <span>{step.label}</span>
                      {step.state === 'active' && <Loader2 className="w-3 h-3 animate-spin text-[#f59e0b]" />}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="text-center mt-8">
              <p className="mb-4 text-xs">*** THANK YOU ***</p>
              <div className="flex justify-center mb-2 opacity-80">
                <div className="w-48 h-12 mix-blend-multiply" style={{ backgroundImage: BARCODE_BG }} />
              </div>
              <p className="text-xs tracking-[0.2em]">{orderNumber}0001234</p>
            </div>
          </div>

          <div
            className="absolute -bottom-2 left-0 right-0 h-2 bg-repeat-x"
            style={{ backgroundImage: JAGGED_BOTTOM_BG }}
          />
        </div>

        <div className="mt-10 w-full max-w-md flex flex-col sm:flex-row gap-3">
          <Button className="w-full rounded-full py-4" onClick={() => navigate('/')}>Continue Shopping</Button>
          {!isPaid && (
            <Button
              variant="ghost"
              className="w-full rounded-full py-4"
              onClick={async () => {
                setIsPaying(true);
                try {
                  await pollPaymentStatus(paymentReceipt.orderId, paymentReceipt.phone);
                } finally {
                  setIsPaying(false);
                }
              }}
              disabled={isPaying}
            >
              {isPaying ? 'Checking...' : 'Check Status'}
            </Button>
          )}
          {isPaid && (
            <Button variant="ghost" className="w-full rounded-full py-4" onClick={() => setPaymentReceipt(null)}>New Checkout</Button>
          )}
        </div>
      </motion.div>
    );
  }


  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-20 bg-surface-container-low min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-medium text-on-surface-variant hover:text-primary mb-8">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-surface p-8 rounded-3xl shadow-sm">
              <h2 className="font-headline text-2xl font-bold mb-6">Delivery Details</h2>

              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <button
                  onClick={() => setDeliveryMethod('pickup')}
                  className={`flex-1 py-4 px-6 rounded-2xl border-2 transition-all ${deliveryMethod === 'pickup' ? 'border-primary bg-primary/5' : 'border-outline-variant/20 hover:border-primary/50'}`}
                >
                  <div className="font-bold mb-1">Store Pickup</div>
                  <div className="text-sm text-on-surface-variant">Free</div>
                </button>
                <button
                  onClick={() => setDeliveryMethod('delivery')}
                  className={`flex-1 py-4 px-6 rounded-2xl border-2 transition-all ${deliveryMethod === 'delivery' ? 'border-primary bg-primary/5' : 'border-outline-variant/20 hover:border-primary/50'}`}
                >
                  <div className="font-bold mb-1">Delivery</div>
                  <div className="text-sm text-on-surface-variant">Calculated at checkout</div>
                </button>
              </div>

              <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                <div>
                  <label className="block text-sm font-medium mb-2">M-Pesa Phone Number</label>
                  <input
                    type="tel"
                    className="w-full bg-surface-container-low px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone number"
                  />
                </div>

                {deliveryMethod === 'delivery' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Delivery Address</label>
                      <div className="flex gap-3">
                        <input
                          type="text"
                          placeholder="Search delivery location"
                          value={addressQuery}
                          onChange={(e) => setAddressQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddressSearch();
                            }
                          }}
                          className="w-full bg-surface-container-low px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <Button type="button" onClick={handleAddressSearch} disabled={isSearchingAddress}>
                          <Search className="w-4 h-4" />
                        </Button>
                      </div>
                      {deliveryAddress?.label && (
                        <p className="text-xs text-on-surface-variant mt-2">Selected: {deliveryAddress.label}</p>
                      )}
                    </div>

                    <div className="h-64 w-full rounded-2xl overflow-hidden border border-outline-variant/20 relative">
                      <Map
                        id="CHECKOUT_MAP"
                        defaultCenter={SHOP_LOCATION}
                        defaultZoom={15}
                        mapId={MAP_ID}
                        disableDefaultUI={true}
                      >
                        <AdvancedMarker position={SHOP_LOCATION} title="Champs Closet Store">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-black text-white text-xs font-bold border-2 border-white shadow">
                            C
                          </div>
                        </AdvancedMarker>

                        {deliveryAddress?.location && (
                          <AdvancedMarker position={deliveryAddress.location} title="Delivery Location">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#4CAF50] text-white text-xs font-bold border-2 border-white shadow">
                              D
                            </div>
                          </AdvancedMarker>
                        )}
                      </Map>
                    </div>

                    {routeInfo && (
                      <div className="bg-surface-container-low p-4 rounded-xl flex justify-between items-center text-sm">
                        <span className="text-on-surface-variant">Distance from store:</span>
                        <span className="font-medium">{routeInfo.distance} ({routeInfo.duration})</span>
                      </div>
                    )}
                  </div>
                )}

                {deliveryMethod === 'pickup' && (
                  <div className="bg-surface-container-low p-6 rounded-2xl">
                    <h4 className="font-medium mb-2 flex items-center gap-2"><MapPin className="w-4 h-4 text-primary"/> Pickup Location</h4>
                    <p className="text-sm text-on-surface-variant mb-4">Champs Closet Store, Nairobi</p>
                    <div className="h-48 w-full rounded-xl overflow-hidden border border-outline-variant/20">
                      <Map
                        id="PICKUP_MAP"
                        defaultCenter={SHOP_LOCATION}
                        defaultZoom={15}
                        mapId={MAP_ID}
                        disableDefaultUI={true}
                      >
                        <AdvancedMarker position={SHOP_LOCATION} title="Champs Closet Store">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-black text-white text-xs font-bold border-2 border-white shadow">
                            C
                          </div>
                        </AdvancedMarker>
                      </Map>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-surface p-8 rounded-3xl shadow-sm sticky top-28">
              <h3 className="font-headline text-xl font-bold mb-6">Order Summary</h3>

              {paymentError && (
                <div className="mb-4 bg-error-container text-on-error-container p-3 rounded-xl text-sm">{paymentError}</div>
              )}
              <div className="space-y-4 mb-6 pb-6 border-b border-outline-variant/20 max-h-64 overflow-y-auto">
                {items.map(item => (
                  <div key={`${item.product.id}-${item.size}`} className="flex gap-4">
                    <img src={item.product.image_url || 'https://picsum.photos/seed/order/200/240'} alt={item.product.name} className="w-16 h-20 object-cover rounded-lg" referrerPolicy="no-referrer" />
                    <div>
                      <h4 className="font-medium text-sm">{item.product.name}</h4>
                      <p className="text-xs text-on-surface-variant mt-1">Size: {item.size} | Qty: {item.quantity}</p>
                      <p className="font-medium mt-2">{item.product.price} Ksh</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-3 text-sm mb-6">
                <div className="flex justify-between text-on-surface-variant">
                  <span>Subtotal</span>
                  <span>{subtotal} Ksh</span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>Delivery {deliveryMethod === 'pickup' ? '(Pickup)' : ''}</span>
                  <span>{isCalculatingFee ? 'Calculating...' : deliveryFee === 0 ? 'Free' : `${deliveryFee} Ksh`}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-3 border-t border-outline-variant/20">
                  <span>Total</span>
                  <span>{total} Ksh</span>
                </div>
              </div>
              <MpesaButton onClick={handlePayment} disabled={isPaying} />
              <p className="text-xs text-center text-on-surface-variant mt-4 flex items-center justify-center gap-1">
                <Lock className="w-3 h-3" /> Secure checkout
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Checkout;
