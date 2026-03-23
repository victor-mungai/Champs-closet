import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Lock, MapPin, Package, Smartphone } from 'lucide-react';
import { motion } from 'motion/react';
import { Map, Marker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import { useCart } from '../context/CartContext';
import { createOrder } from '../services/api';

const SHOP_LOCATION = { lat: -1.49315, lng: 36.955124 };

type DeliveryAddress = {
  location: google.maps.LatLng;
  label: string;
};

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

const Checkout = () => {
  const navigate = useNavigate();
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress | null>(null);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [phone, setPhone] = useState('0712 345 678');
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  const checkoutMap = useMap('CHECKOUT_MAP');
  const pickupMap = useMap('PICKUP_MAP');
  const map = deliveryMethod === 'delivery' ? checkoutMap : pickupMap;
  const placesLib = useMapsLibrary('places');
  const routesLib = useMapsLibrary('routes');
  const autocompleteInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  const mapRef = useRef<google.maps.Map | null>(null);
  useEffect(() => {
    mapRef.current = map;
  }, [map]);

  useEffect(() => {
    if (!placesLib || !autocompleteInputRef.current) return;

    const autocomplete = new (placesLib as any).Autocomplete(autocompleteInputRef.current, {
      fields: ['formatted_address', 'geometry', 'name'],
      types: ['geocode'],
    });

    autocompleteRef.current = autocomplete;

    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      const location = place.geometry?.location;
      if (!location) return;

      setDeliveryAddress({
        location,
        label: place.formatted_address || place.name || 'Selected location',
      });

      if (mapRef.current) {
        mapRef.current.panTo(location);
        mapRef.current.setZoom(14);
      }
    });

    return () => {
      if (listener) listener.remove();
    };
  }, [placesLib, deliveryMethod]);

  useEffect(() => {
    if (deliveryMethod === 'pickup') {
      setDeliveryFee(0);
      setRouteInfo(null);
      polylinesRef.current.forEach(p => p.setMap(null));
      if (map) {
        map.panTo(SHOP_LOCATION);
        map.setZoom(15);
      }
      return;
    }

    if (deliveryMethod === 'delivery' && deliveryAddress?.location && routesLib) {
      polylinesRef.current.forEach(p => p.setMap(null));

      (routesLib as any).Route.computeRoutes({
        origin: SHOP_LOCATION,
        destination: deliveryAddress.location,
        travelMode: 'DRIVING',
        fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
      }).then(({ routes }: any) => {
        if (routes?.[0]) {
          const km = routes[0].distanceMeters / 1000;
          const mins = Math.round(routes[0].durationMillis / 60000);
          setRouteInfo({ distance: `${km.toFixed(1)} km`, duration: `${mins} min` });
          setDeliveryFee(Math.round(km * 40));

          if (mapRef.current) {
            const newPolylines = routes[0].createPolylines();
            newPolylines.forEach((p: any) => p.setMap(mapRef.current));
            polylinesRef.current = newPolylines;
            if (routes[0].viewport) mapRef.current.fitBounds(routes[0].viewport);
          }
        }
      });
    }
  }, [deliveryMethod, deliveryAddress, map, routesLib]);

  const { items } = useCart();
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const total = subtotal + deliveryFee;

  const handlePayment = async () => {
    setPaymentError(null);
    setPaymentSuccess(null);

    if (items.length === 0) {
      setPaymentError('Your cart is empty.');
      return;
    }

    if (deliveryMethod === 'delivery' && !deliveryAddress) {
      setPaymentError('Please select a delivery location.');
      return;
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone || normalizedPhone.length < 12) {
      setPaymentError('Enter a valid M-Pesa number (e.g. 0712 345 678).');
      return;
    }

    setIsPaying(true);
    try {
      const orderItems = items.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price,
      }));

      const response = await createOrder({
        phone: normalizedPhone,
        items: orderItems,
        amount: total,
      });
      setPaymentSuccess(response.message || 'STK push sent.');
    } catch (err: any) {
      setPaymentError(err?.message || 'Failed to initiate payment.');
    } finally {
      setIsPaying(false);
    }
  };

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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">First Name</label>
                    <input type="text" className="w-full bg-surface-container-low px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" defaultValue="David" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Last Name</label>
                    <input type="text" className="w-full bg-surface-container-low px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" defaultValue="Kamau" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">M-Pesa Phone Number</label>
                  <input
                    type="tel"
                    className="w-full bg-surface-container-low px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0712 345 678"
                  />
                </div>

                {deliveryMethod === 'delivery' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Delivery Address</label>
                      <input
                        ref={autocompleteInputRef}
                        type="text"
                        placeholder="Search delivery location"
                        className="w-full bg-surface-container-low px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      {deliveryAddress?.label && (
                        <p className="text-xs text-on-surface-variant mt-2">Selected: {deliveryAddress.label}</p>
                      )}
                    </div>

                    <div className="h-64 w-full rounded-2xl overflow-hidden border border-outline-variant/20 relative">
                      <Map
                        defaultCenter={SHOP_LOCATION}
                        defaultZoom={15}
                        mapId="CHECKOUT_MAP"
                        disableDefaultUI={true}
                      >
                        <Marker position={SHOP_LOCATION} title="Champs Closet Store" label="C" />

                        {deliveryAddress?.location && (
                          <Marker position={deliveryAddress.location} title="Delivery Location" label="D" />
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
                        defaultCenter={SHOP_LOCATION}
                        defaultZoom={15}
                        mapId="PICKUP_MAP"
                        disableDefaultUI={true}
                      >
                        <Marker position={SHOP_LOCATION} title="Champs Closet Store" label="C" />
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
              {paymentSuccess && (
                <div className="mb-4 bg-success-container text-on-success-container p-3 rounded-xl text-sm">{paymentSuccess}</div>
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
                  <span>{deliveryFee === 0 ? 'Free' : `${deliveryFee} Ksh`}</span>
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
