import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Menu, Search, ShoppingBag, User, ChevronRight, Lock, ArrowRight,
  Filter, CheckCircle2, TrendingUp, Package, LayoutDashboard,
  Receipt, Settings, Bell, LogOut, Plus, MoreHorizontal,
  ChevronLeft, Smartphone, Trash2, X, MapPin
} from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth } from './firebase';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL ||
  'http://localhost:8000';

// --- Types ---
type ViewState = 'STORE_HOME' | 'STORE_CATALOG' | 'STORE_PRODUCT' | 'STORE_CHECKOUT' | 'ADMIN_LOGIN' | 'ADMIN_OVERVIEW' | 'ADMIN_PRODUCTS' | 'ADMIN_TRANSACTIONS';

type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  image?: string;
  image_url?: string | null;
  description?: string | null;
  stock?: number;
  tags?: { id: number; name: string }[];
};

type AdminProduct = {
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  status: string;
  image?: string;
  image_url?: string | null;
};

type Transaction = {
  id: string;
  date: string;
  customer: string;
  area: string;
  items: number;
  total: number;
  status: string;
  createdAt?: string;
};

type CartItem = {
  product: Product;
  quantity: number;
  size: string;
};

type CartContextType = {
  items: CartItem[];
  addToCart: (product: Product, size: string) => void;
  removeFromCart: (productId: number, size: string) => void;
  updateQuantity: (productId: number, size: string, quantity: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
  cartTotal: number;
};

const CartContext = React.createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = React.useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const addToCart = (product: Product, size: string) => {
    setItems(prev => {
      const existing = prev.find(item => item.product.id === product.id && item.size === size);
      if (existing) {
        return prev.map(item => item.product.id === product.id && item.size === size ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1, size }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (productId: number, size: string) => {
    setItems(prev => prev.filter(item => !(item.product.id === productId && item.size === size)));
  };

  const updateQuantity = (productId: number, size: string, quantity: number) => {
    if (quantity < 1) return removeFromCart(productId, size);
    setItems(prev => prev.map(item => item.product.id === productId && item.size === size ? { ...item, quantity } : item));
  };

  const clearCart = () => setItems([]);

  const cartTotal = items.reduce((total, item) => total + item.product.price * item.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, isCartOpen, setIsCartOpen, cartTotal }}>
      {children}
    </CartContext.Provider>
  );
};

// --- Visual Assets ---
const IMAGES = {
  hero: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD1GtuFuQo0xQiQaRV_3PO0NnIk4_v5d7XQSReWVH-SQUf6mYaap-YdXIlVfEsIQ4YkwAyXtJhP5Vo4lp9wqIw0na1Ac0ZzT4CJk8BolI-tq09MDWJIE4k1ZpbsHLY7CbiX6yExYYsN9ifaj5OKCoKtZKujL6pODifY3UETl9eJOzj38D8ZeqnNrs4gJDUFFs7ewsb7dGtJtOOQ2Zp13J81oR5_3KM_yTWg21uaWEO-Yjk132kD_7nXsHHD1aJIp7WY64j2vxFPkvI',
  sweaters: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBZ0qP8wUto2QR2A9TJpRWbBjvzv_wbqypqJIYYVL7XtyMwWlqPWbGzN-21-CCeTFBDL38KUdDGp87HB0plqQ_wS_3G9vWdQzBGVBU_Tzth-Sulp4i2iGiDSGO91Jzr9BKk23zGNTByU8YjJDFgew4B7LtO5EHLcKJJ1PIQtXAD6fTtFarHNr-0pV93MtSlv_zKgBob3Y8Y9KE-7fSieWKCCSTWDsshheLLvVGADBaw6hg77BsVc-w98pQJZk2rIH6c_ThJCYOe6aU',
  jeans: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBcJC7odeB6EhrjLab_c_aOgG5JppD-e8DF_DTq89cliZn-YbHzfzQoKuBr9kPrbpxSIS7FLhMst-hV-c4tsAjUV9VMRBPFfR-Fkcj3QrtqsOR5pAc1HsbC1U0ZOI_lqBjDMARHlztQCZz10xe5fNZczaIS3XK6VsqmFn_Hcm8uawZX7Vh35Xfu87nVJFGNsg_PykDGVUQ2hacvHfXZraLlWJ20awB_wsgEYIbvw-hLRsAMGRv-IiJiRcg5vJJEcUiZ92IBsMA-s00',
  shoes: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBtY-2INflxJbw736OIXle8btvS0emYoArzX5LH0hLWGtIW9OP654nHWKuSsF8QcFucSamSBdLa5ZZQRFDi9gDN4VfaJiQg_jtMvbMDYuBo1W1jXwMjGqyuxnRzOuM_d6bwH3L7NpJm1gFZMy17gB3EuvJi82SuiB9xCgDn3Z38i_OiczeEzVaKi0rvUNpiy0m8TIwvfReRIAY-mxoPR0WHk2_z8LUPn-OQ-miGxlc6A8HbjtbqgGgpUw2YE0dzaf-v0SdMNOP3dV8',
  oxford: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAd4NjtmLgxBxOIj4BQ5_3GZWkc-7ZnOoSE8Ho4wngh9z1kKrJVOtcwUHhW3SsNvHfzSoBUglUFXfDlARQ8sw-FKtqV75aqL1widWrX_26ux3YBSQYNRvPz248mOhUdGLcaT3DF2hefJh5orOzlMKAeF7lebFdo0Xob_1ZpFyTtJyAMv_ZSJ2E7B8_3zNaTe_ififK-QWq0kOwUiVVlgpKVqKHlBWB2e4dLBkMxvynP86dsOyL_aD-YCcYilCXCqn9fJSRO8nDENRM',
  productHero: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCiM2pU1zZRrJnvZROMiAf_-iMTdJZHfHdLTuujpToaTVBbTrMUqwdQGODR-4n9dGsR_jYQVsI6Qh9jU1GkcdXeJOtdAho4EzMEROy1vq1YuijaQb09q_0TKV4VsXxs4aRV1EjM3TGvKyGvhTPwBrIMcETrFd5ewo4sT5MpM5OpeXwDDo6_AFCwhLSckj_zsuORuf3UPdVX_oO7f8842yAZf1yrfe0wJ9FwZEA_IuiLHtWZfhQeax62Ca_caaiGRu6A2X-iLC-Ddak'
};

const TRANSACTIONS: Transaction[] = [];

const getProductImage = (product?: Product | AdminProduct | null) =>
  product?.image_url || product?.image || IMAGES.productHero;

// --- Shared Components ---

const Button = ({ children, variant = 'primary', className = '', ...props }: any) => {
  const baseStyle = "inline-flex items-center justify-center px-6 py-3 rounded-full font-medium transition-all duration-300 ease-out";
  const variants = {
    primary: "bg-gradient-to-br from-primary to-primary-container text-on-primary hover:shadow-lg hover:shadow-primary/20",
    secondary: "bg-surface-container-high text-on-surface hover:bg-surface-container-highest",
    ghost: "bg-transparent text-on-surface hover:bg-surface-container-low",
    outline: "border border-outline-variant text-on-surface hover:bg-surface-container-lowest"
  };
  return (
    <button className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const ProductCard = ({ product, onClick }: { product: Product, onClick: () => void }) => {
  const { addToCart } = useCart();

  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className="group cursor-pointer flex flex-col gap-4"
      onClick={onClick}
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-surface-container-low">
        <img src={getProductImage(product)} alt={product.name} className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-105" referrerPolicy="no-referrer" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />
        <div className="absolute bottom-4 left-4 right-4 opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
          <Button variant="secondary" className="w-full py-2 text-sm shadow-sm" onClick={(e: any) => { e.stopPropagation(); addToCart(product, 'M'); }}>Quick Buy</Button>
        </div>
      </div>
      <div>
        <h3 className="font-medium text-on-surface">{product.name}</h3>
        <p className="text-on-surface-variant mt-1">{product.price} Ksh</p>
      </div>
    </motion.div>
  );
};

const MpesaButton = ({ onClick, className = '' }: { onClick?: () => void, className?: string }) => (
  <button 
    onClick={onClick}
    className={`w-full bg-[#4CAF50] hover:bg-[#45a049] text-white rounded-full py-4 px-6 font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#4CAF50]/20 ${className}`}
  >
    <Smartphone className="w-5 h-5" />
    Pay with M-Pesa
  </button>
);

const CartDrawer = ({ setView }: { setView: (v: ViewState) => void }) => {
  const { items, isCartOpen, setIsCartOpen, updateQuantity, removeFromCart, cartTotal } = useCart();

  return (
    <AnimatePresence>
      {isCartOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[80]" onClick={() => setIsCartOpen(false)} 
          />
          <motion.div 
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            className="fixed inset-y-0 right-0 w-full max-w-md bg-surface z-[90] flex flex-col shadow-2xl"
          >
            <div className="h-20 flex items-center px-6 border-b border-outline-variant/10 justify-between shrink-0">
              <span className="font-headline font-bold text-xl tracking-tight">Your Cart ({items.length})</span>
              <button className="p-2 hover:bg-surface-container-low rounded-full" onClick={() => setIsCartOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-on-surface-variant">
                  <ShoppingBag className="w-12 h-12 mb-4 opacity-20" />
                  <p>Your cart is empty.</p>
                  <Button variant="ghost" className="mt-4" onClick={() => { setIsCartOpen(false); setView('STORE_CATALOG'); }}>Continue Shopping</Button>
                </div>
              ) : (
                items.map((item, i) => (
                  <div key={`${item.product.id}-${item.size}-${i}`} className="flex gap-4">
                    <img src={getProductImage(item.product)} alt={item.product.name} className="w-20 h-24 object-cover rounded-xl" referrerPolicy="no-referrer" />
                    <div className="flex-1 flex flex-col">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-sm">{item.product.name}</h4>
                          <p className="text-xs text-on-surface-variant mt-1">Size: {item.size}</p>
                        </div>
                        <button onClick={() => removeFromCart(item.product.id, item.size)} className="p-1 text-on-surface-variant hover:text-error transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="mt-auto flex justify-between items-end">
                        <div className="flex items-center gap-3 bg-surface-container-low rounded-full px-2 py-1">
                          <button onClick={() => updateQuantity(item.product.id, item.size, item.quantity - 1)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-surface-container-high">-</button>
                          <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.product.id, item.size, item.quantity + 1)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-surface-container-high">+</button>
                        </div>
                        <span className="font-medium">{item.product.price * item.quantity} Ksh</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {items.length > 0 && (
              <div className="p-6 border-t border-outline-variant/10 shrink-0 bg-surface">
                <div className="flex justify-between items-center mb-6">
                  <span className="font-medium">Subtotal</span>
                  <span className="font-bold text-xl">{cartTotal} Ksh</span>
                </div>
                <Button className="w-full" onClick={() => { setIsCartOpen(false); setView('STORE_CHECKOUT'); }}>
                  Proceed to Checkout
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// --- Storefront Views ---

const StoreNavbar = ({ setView }: { setView: (v: ViewState) => void }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { items, setIsCartOpen } = useCart();

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      <nav className="fixed top-0 inset-x-0 z-50 bg-surface/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
           <div className="flex items-center gap-4">
            <button className="p-2 -ml-2 hover:bg-surface-container-low rounded-full lg:hidden" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <div className="font-headline font-bold text-xl tracking-tight cursor-pointer" onClick={() => setView('STORE_HOME')}>
              CHAMPS CLOSET.
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-8">
            <button onClick={() => setView('STORE_CATALOG')} className="text-sm font-medium hover:text-primary transition-colors">Shirts</button>
            <button onClick={() => setView('STORE_CATALOG')} className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors">Shoe Hub</button>
            <button onClick={() => setView('STORE_CATALOG')} className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors">Vests</button>
            <button onClick={() => setView('STORE_CATALOG')} className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors">Trousers</button>
            <button onClick={() => setView('STORE_CATALOG')} className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors">Sweaters</button>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-surface-container-low rounded-full" onClick={() => setView('STORE_CATALOG')}>
              <Search className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-surface-container-low rounded-full" onClick={() => alert('Customer accounts coming soon.')}>
              <User className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-surface-container-low rounded-full relative" onClick={() => setIsCartOpen(true)}>
              <ShoppingBag className="w-5 h-5" />
              {totalItems > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-error text-white text-[10px] font-bold flex items-center justify-center rounded-full">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[60] lg:hidden" onClick={() => setIsMobileMenuOpen(false)} 
            />
            <motion.div 
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
              className="fixed inset-y-0 left-0 w-64 bg-surface z-[70] lg:hidden flex flex-col"
            >
              <div className="h-20 flex items-center px-6 border-b border-outline-variant/10 justify-between">
                <span className="font-headline font-bold text-xl tracking-tight">MENU</span>
                <button className="p-2 hover:bg-surface-container-low rounded-full" onClick={() => setIsMobileMenuOpen(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 py-8 px-6 space-y-6">
                <button onClick={() => { setView('STORE_CATALOG'); setIsMobileMenuOpen(false); }} className="block text-lg font-medium hover:text-primary transition-colors w-full text-left">Shirts</button>
                <button onClick={() => { setView('STORE_CATALOG'); setIsMobileMenuOpen(false); }} className="block text-lg font-medium text-on-surface-variant hover:text-primary transition-colors w-full text-left">Shoe Hub</button>
                <button onClick={() => { setView('STORE_CATALOG'); setIsMobileMenuOpen(false); }} className="block text-lg font-medium text-on-surface-variant hover:text-primary transition-colors w-full text-left">Vests</button>
                <button onClick={() => { setView('STORE_CATALOG'); setIsMobileMenuOpen(false); }} className="block text-lg font-medium text-on-surface-variant hover:text-primary transition-colors w-full text-left">Trousers</button>
                <button onClick={() => { setView('STORE_CATALOG'); setIsMobileMenuOpen(false); }} className="block text-lg font-medium text-on-surface-variant hover:text-primary transition-colors w-full text-left">Sweaters</button>
              </div>
              <div className="p-6 border-t border-outline-variant/10">
                <button onClick={() => { setView('ADMIN_LOGIN'); setIsMobileMenuOpen(false); }} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-surface-container-low rounded-xl text-sm font-medium hover:bg-surface-container-high transition-colors">
                  <Lock className="w-4 h-4" /> Admin Login
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

const StoreFooter = ({ setView }: { setView: (v: ViewState) => void }) => (
  <footer className="bg-surface-container-low pt-24 pb-12 px-6 mt-24">
    <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
      <div className="col-span-1 md:col-span-2">
        <h2 className="font-headline font-bold text-2xl mb-6">CHAMPS CLOSET.</h2>
        <p className="text-on-surface-variant max-w-sm mb-8">Premium men's essentials delivered across Nairobi. Quality guaranteed, every single time.</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <input type="email" placeholder="Enter your email" className="bg-surface px-4 py-3 rounded-full flex-1 focus:outline-none focus:ring-2 focus:ring-primary/20 w-full" />
          <Button className="w-full sm:w-auto" onClick={() => alert('Thanks for subscribing!')}>Subscribe</Button>
        </div>
      </div>
      <div>
        <h4 className="font-medium mb-6">Shop</h4>
        <ul className="space-y-4 text-on-surface-variant text-sm">
          <li><button onClick={() => setView('STORE_CATALOG')} className="hover:text-primary">All Shirts</button></li>
          <li><button className="hover:text-primary" onClick={() => setView('STORE_CATALOG')}>New Arrivals</button></li>
          <li><button className="hover:text-primary" onClick={() => setView('STORE_CATALOG')}>Best Sellers</button></li>
        </ul>
      </div>
      <div>
        <h4 className="font-medium mb-6">Support</h4>
        <ul className="space-y-4 text-on-surface-variant text-sm">
          <li><button className="hover:text-primary" onClick={() => alert('FAQ coming soon.')}>FAQ</button></li>
          <li><button className="hover:text-primary" onClick={() => alert('Shipping & Returns details coming soon.')}>Shipping & Returns</button></li>
          <li><button onClick={() => setView('ADMIN_LOGIN')} className="hover:text-primary flex items-center gap-1">Admin Login <Lock className="w-3 h-3"/></button></li>
        </ul>
      </div>
    </div>
    <div className="max-w-7xl mx-auto mt-24 pt-12 border-t border-outline-variant/20 flex flex-col items-center">
      {/* Enlarged Logo Section */}
      <img src="https://res.cloudinary.com/dxmbodsmj/image/upload/v1773990059/champs-closet-logo_o3rtck.png" alt="Champs Closet Logo" className="w-64 md:w-96 lg:w-[32rem] h-auto object-contain mb-8 opacity-90 hover:opacity-100 transition-opacity drop-shadow-sm" referrerPolicy="no-referrer" />
      <p className="text-sm text-on-surface-variant text-center">© 2026 Champs Closet. All rights reserved.</p>
    </div>
  </footer>
);

const StoreHome = ({
  setView,
  products,
  onSelectProduct,
  isLoading,
  error,
}: {
  setView: (v: ViewState) => void;
  products: Product[];
  onSelectProduct: (product: Product) => void;
  isLoading: boolean;
  error: string | null;
}) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-20">
    {/* Hero Section */}
    <section className="max-w-7xl mx-auto px-6 py-12 lg:py-24 flex flex-col lg:flex-row items-center gap-12">
      <div className="flex-1 z-10">
        <h1 className="font-headline text-5xl lg:text-7xl font-extrabold tracking-tighter leading-[1.1] mb-6">
          Premium Men's<br/>Essentials.
        </h1>
        <p className="text-xl text-on-surface-variant mb-8 max-w-md">
          Every Shirt, Only 500 Ksh. Uncompromising quality for the modern gentleman.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button onClick={() => setView('STORE_CATALOG')} className="w-full sm:w-auto">Shop Collection</Button>
          <Button variant="ghost" className="w-full sm:w-auto gap-2" onClick={() => setView('STORE_CATALOG')}>
            View Lookbook <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 relative w-full aspect-square lg:aspect-[4/5] rounded-[2rem] overflow-hidden">
        <img src={IMAGES.hero} alt="Hero" className="absolute inset-0 w-full h-full object-cover" referrerPolicy="no-referrer" />
      </div>
    </section>

    {/* Curated Selection (Bento) */}
    <section className="max-w-7xl mx-auto px-6 py-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-12">
        <h2 className="font-headline text-3xl font-bold tracking-tight">Curated Selection</h2>
        <button className="text-sm font-medium flex items-center gap-1 hover:text-primary" onClick={() => setView('STORE_CATALOG')}>
          View All <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[250px]">
        <div className="md:col-span-2 md:row-span-2 rounded-3xl overflow-hidden relative group cursor-pointer bg-surface-container-low" onClick={() => setView('STORE_CATALOG')}>
          <img src={IMAGES.hero} alt="Shirts" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-8 left-8 text-white">
            <h3 className="font-headline text-2xl font-bold mb-2">The Shirt Collection</h3>
            <p className="text-white/80 text-sm">Starting at 500 Ksh</p>
          </div>
        </div>
        <div className="md:col-span-2 rounded-3xl overflow-hidden relative group cursor-pointer bg-surface-container-low">
          <img src={IMAGES.sweaters} alt="Sweaters" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute bottom-6 left-6 text-white">
            <h3 className="font-headline text-xl font-bold">Knitwear</h3>
          </div>
        </div>
        <div className="rounded-3xl overflow-hidden relative group cursor-pointer bg-surface-container-low">
          <img src={IMAGES.jeans} alt="Denim" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute bottom-6 left-6 text-white">
            <h3 className="font-headline text-xl font-bold">Denim</h3>
          </div>
        </div>
        <div className="rounded-3xl overflow-hidden relative group cursor-pointer bg-surface-container-low">
          <img src={IMAGES.shoes} alt="Shoes" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute bottom-6 left-6 text-white">
            <h3 className="font-headline text-xl font-bold">Footwear</h3>
          </div>
        </div>
      </div>
    </section>

    {/* Essential Shirts */}
    <section className="bg-surface-container-low py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-12">
          <div>
            <h2 className="font-headline text-3xl font-bold tracking-tight mb-2">Essential Shirts</h2>
            <p className="text-on-surface-variant">Our signature 500 Ksh collection.</p>
          </div>
          <Button variant="outline" onClick={() => setView('STORE_CATALOG')} className="w-full sm:w-auto">Shop All</Button>
        </div>
        {isLoading ? (
          <div className="py-12 text-on-surface-variant">Loading products...</div>
        ) : error ? (
          <div className="py-12 text-on-surface-variant">{error}</div>
        ) : products.length === 0 ? (
          <div className="py-12 text-on-surface-variant">No products available yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
            {products.slice(0, 4).map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onClick={() => {
                  onSelectProduct(product);
                  setView('STORE_PRODUCT');
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  </motion.div>
);

const StoreCatalog = ({
  setView,
  products,
  onSelectProduct,
  isLoading,
  error,
}: {
  setView: (v: ViewState) => void;
  products: Product[];
  onSelectProduct: (product: Product) => void;
  isLoading: boolean;
  error: string | null;
}) => {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  const toggleStyle = (style: string) => {
    setSelectedStyles(prev => 
      prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style]
    );
  };

  const filteredProducts = products.filter(product => {
    const categoryMatch = selectedCategories.length === 0 || selectedCategories.includes(product.category);
    const searchMatch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const tagNames = product.tags?.map(tag => tag.name.toLowerCase()) || [];
    const styleMatch = selectedStyles.length === 0 || selectedStyles.some(s => tagNames.includes(s.toLowerCase()));
    return categoryMatch && searchMatch && styleMatch;
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-20 max-w-7xl mx-auto px-6 py-12">
      <div className="mb-12">
        <h1 className="font-headline text-4xl lg:text-5xl font-bold tracking-tight mb-4">The New Standard.</h1>
        <p className="text-on-surface-variant max-w-2xl">Explore our complete collection of premium shirts. Designed in Nairobi, crafted for the world. Every piece is 500 Ksh.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-12">
        {/* Sidebar Filters */}
        <aside className="w-full lg:w-64 shrink-0 space-y-8">
          <div>
            <div className="relative mb-6">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input 
                type="text" 
                placeholder="Search products..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface-container-low pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" 
              />
            </div>
            <h3 className="font-medium mb-4 flex items-center gap-2"><Filter className="w-4 h-4"/> Categories</h3>
            <ul className="space-y-3 text-sm text-on-surface-variant">
              <li><label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" className="rounded border-outline-variant text-primary focus:ring-primary" checked={selectedCategories.length === 0} onChange={() => setSelectedCategories([])}/> All Categories</label></li>
              {['Shirts', 'Shoe Hub', 'Vests', 'Trousers', 'Sweaters'].map(cat => (
                <li key={cat}><label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" className="rounded border-outline-variant text-primary focus:ring-primary" checked={selectedCategories.includes(cat)} onChange={() => toggleCategory(cat)}/> {cat}</label></li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-4">Style Profile</h3>
            <div className="flex flex-wrap gap-2">
              {['Casual', 'Formal', 'Summer', 'Evening', 'Minimal'].map(tag => (
                <span key={tag} onClick={() => toggleStyle(tag)} className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${selectedStyles.includes(tag) ? 'bg-primary text-on-primary' : 'bg-surface-container-low hover:bg-surface-container-high'}`}>{tag}</span>
              ))}
            </div>
          </div>
        </aside>

        {/* Product Grid */}
        <div className="flex-1">
          {isLoading ? (
            <div className="text-center py-24 text-on-surface-variant">Loading products...</div>
          ) : error ? (
            <div className="text-center py-24 text-on-surface-variant">{error}</div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12">
              {filteredProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onClick={() => {
                    onSelectProduct(product);
                    setView('STORE_PRODUCT');
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-24 text-on-surface-variant">
              <p>No products found matching your filters.</p>
              <Button variant="ghost" onClick={() => { setSelectedCategories([]); setSelectedStyles([]); }} className="mt-4">Clear Filters</Button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const StoreProductDetail = ({
  setView,
  product,
}: {
  setView: (v: ViewState) => void;
  product: Product | null;
}) => {
  const { addToCart } = useCart();
  const [selectedSize, setSelectedSize] = useState('M');
  const [selectedColor, setSelectedColor] = useState('light');
  if (!product) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-20">
        <div className="max-w-7xl mx-auto px-6 py-24 text-center text-on-surface-variant">
          <p>Product not found.</p>
          <Button variant="ghost" className="mt-6" onClick={() => setView('STORE_CATALOG')}>
            Back to Catalog
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-20">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="text-sm text-on-surface-variant mb-8 flex items-center gap-2">
          <button onClick={() => setView('STORE_HOME')} className="hover:text-primary">Home</button>
          <ChevronRight className="w-3 h-3" />
          <button onClick={() => setView('STORE_CATALOG')} className="hover:text-primary">{product.category}</button>
          <ChevronRight className="w-3 h-3" />
          <span className="text-on-surface">{product.name}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Asymmetric Image Gallery */}
          <div className="space-y-4">
            <div className="aspect-[4/5] rounded-3xl overflow-hidden bg-surface-container-low">
              <img src={getProductImage(product)} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="aspect-square rounded-2xl overflow-hidden bg-surface-container-low">
                <img src={getProductImage(product)} alt={`${product.name} detail`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="aspect-square rounded-2xl overflow-hidden bg-surface-container-low">
                <img src="https://picsum.photos/seed/detail2/400/400" alt="Detail 2" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            </div>
          </div>

          {/* Product Info */}
          <div className="lg:py-12 flex flex-col">
            <h1 className="font-headline text-4xl lg:text-5xl font-bold tracking-tight mb-4">{product.name}</h1>
            <div className="flex items-end gap-4 mb-8">
              <span className="text-3xl font-medium">{product.price} Ksh</span>
              <span className="text-on-surface-variant line-through mb-1">1,200 Ksh</span>
              <span className="bg-error-container text-on-error-container px-2 py-1 rounded text-xs font-bold mb-1">SALE</span>
            </div>

            <p className="text-on-surface-variant mb-8 leading-relaxed">
              {product.description || 'A wardrobe staple redefined. Crafted for comfort and everyday versatility.'}
            </p>

            <div className="space-y-6 mb-12">
              <div>
                <div className="flex justify-between mb-3">
                  <span className="font-medium">Size</span>
                  <button className="text-sm text-on-surface-variant underline" onClick={() => alert('Size guide coming soon.')}>Size Guide</button>
                </div>
                <div className="flex gap-3">
                  {['S', 'M', 'L', 'XL'].map(size => (
                    <button 
                      key={size} 
                      onClick={() => setSelectedSize(size)}
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-medium border transition-colors ${selectedSize === size ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant hover:border-primary'}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="font-medium block mb-3">Color</span>
                <div className="flex gap-3">
                  <button
                    className={`w-10 h-10 rounded-full bg-[#f0f0f0] border-2 ${selectedColor === 'light' ? 'border-primary ring-2 ring-primary/20' : 'border-outline-variant'}`}
                    onClick={() => setSelectedColor('light')}
                    aria-label="Light color"
                  ></button>
                  <button
                    className={`w-10 h-10 rounded-full bg-[#2a3b4c] border-2 ${selectedColor === 'navy' ? 'border-primary ring-2 ring-primary/20' : 'border-outline-variant'}`}
                    onClick={() => setSelectedColor('navy')}
                    aria-label="Navy color"
                  ></button>
                  <button
                    className={`w-10 h-10 rounded-full bg-[#8b9dc3] border-2 ${selectedColor === 'steel' ? 'border-primary ring-2 ring-primary/20' : 'border-outline-variant'}`}
                    onClick={() => setSelectedColor('steel')}
                    aria-label="Steel color"
                  ></button>
                </div>
              </div>
            </div>

            <div className="mt-auto space-y-4">
              <MpesaButton onClick={() => { addToCart(product, selectedSize); setView('STORE_CHECKOUT'); }} />
              <Button variant="outline" className="w-full" onClick={() => addToCart(product, selectedSize)}>Add to Cart</Button>
            </div>

            <div className="mt-12 pt-8 border-t border-outline-variant/20 grid grid-cols-2 gap-8 text-sm">
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary"/> Material</h4>
                <p className="text-on-surface-variant">100% Organic Cotton</p>
              </div>
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2"><Package className="w-4 h-4 text-primary"/> Delivery</h4>
                <p className="text-on-surface-variant">Same day in Nairobi</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const SHOP_LOCATION = { lat: -1.49315, lng: 36.955124 };

const StoreCheckout = ({ setView }: { setView: (v: ViewState) => void }) => {
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState<google.maps.places.Place | null>(null);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);

  const checkoutMap = useMap('CHECKOUT_MAP');
  const pickupMap = useMap('PICKUP_MAP');
  const map = deliveryMethod === 'delivery' ? checkoutMap : pickupMap;
  const placesLib = useMapsLibrary('places');
  const routesLib = useMapsLibrary('routes');
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  const mapRef = useRef<google.maps.Map | null>(null);
  useEffect(() => {
    mapRef.current = map;
  }, [map]);

  useEffect(() => {
    if (!placesLib || !autocompleteRef.current) return;
    
    // Clear previous autocomplete element if it exists
    autocompleteRef.current.innerHTML = '';
    
    const el = new (placesLib as any).PlaceAutocompleteElement();
    autocompleteRef.current.appendChild(el);

    el.addEventListener('gmp-select', async (e: any) => {
      const place = e.placePrediction.toPlace();
      await place.fetchFields({ fields: ['displayName', 'location', 'formattedAddress'] });
      setDeliveryAddress(place);
      if (place.location && mapRef.current) {
        mapRef.current.panTo(place.location);
        mapRef.current.setZoom(14);
      }
    });

    return () => {
      if (autocompleteRef.current) {
        autocompleteRef.current.innerHTML = '';
      }
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

    if (deliveryMethod === 'delivery' && deliveryAddress?.location && map && routesLib) {
      polylinesRef.current.forEach(p => p.setMap(null));

      (routesLib as any).Route.computeRoutes({
        origin: SHOP_LOCATION,
        destination: deliveryAddress.location,
        travelMode: 'DRIVING',
        fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
      }).then(({ routes }: any) => {
        if (routes?.[0]) {
          const newPolylines = routes[0].createPolylines();
          newPolylines.forEach((p: any) => p.setMap(map));
          polylinesRef.current = newPolylines;
          if (routes[0].viewport) map.fitBounds(routes[0].viewport);
          
          const km = routes[0].distanceMeters / 1000;
          const mins = Math.round(routes[0].durationMillis / 60000);
          setRouteInfo({ distance: `${km.toFixed(1)} km`, duration: `${mins} min` });
          
          // Calculate delivery fee: 40 Ksh per km
          setDeliveryFee(Math.round(km * 40));
        }
      });
    }
  }, [deliveryMethod, deliveryAddress, map, routesLib]);

  const { items } = useCart();
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const total = subtotal + deliveryFee;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-20 bg-surface-container-low min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <button onClick={() => setView('STORE_PRODUCT')} className="flex items-center gap-2 text-sm font-medium text-on-surface-variant hover:text-primary mb-8">
          <ChevronLeft className="w-4 h-4" /> Back to Product
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-surface p-8 rounded-3xl shadow-sm">
              <h2 className="font-headline text-2xl font-bold mb-6">Delivery Details</h2>
              
              <div className="flex gap-4 mb-8">
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
                <div className="grid grid-cols-2 gap-6">
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
                  <input type="tel" className="w-full bg-surface-container-low px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" defaultValue="0712 345 678" />
                </div>
                
                {deliveryMethod === 'delivery' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Delivery Address</label>
                      <div ref={autocompleteRef} className="w-full" />
                    </div>
                    
                    <div className="h-64 w-full rounded-2xl overflow-hidden border border-outline-variant/20 relative">
                      <Map
                        defaultCenter={SHOP_LOCATION}
                        defaultZoom={15}
                        mapId="CHECKOUT_MAP"
                        disableDefaultUI={true}
                      >
                        <AdvancedMarker position={SHOP_LOCATION} title="Champs Closet Store">
                          <Pin background="#000" glyphColor="#fff" />
                        </AdvancedMarker>
                        
                        {deliveryAddress?.location && (
                          <AdvancedMarker position={deliveryAddress.location} title="Delivery Location">
                            <Pin background="#4CAF50" glyphColor="#fff" />
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
                        defaultCenter={SHOP_LOCATION}
                        defaultZoom={15}
                        mapId="PICKUP_MAP"
                        disableDefaultUI={true}
                      >
                        <AdvancedMarker position={SHOP_LOCATION} title="Champs Closet Store">
                          <Pin background="#000" glyphColor="#fff" />
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
              <div className="space-y-4 mb-6 pb-6 border-b border-outline-variant/20 max-h-64 overflow-y-auto">
                {items.map(item => (
                  <div key={`${item.product.id}-${item.size}`} className="flex gap-4">
                    <img src={getProductImage(item.product)} alt={item.product.name} className="w-16 h-20 object-cover rounded-lg" referrerPolicy="no-referrer" />
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
              <MpesaButton onClick={() => alert('M-Pesa prompt initiated')} />
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

// --- Admin Views ---

const AdminSidebar = ({ currentView, setView, isOpen, setIsOpen }: { currentView: ViewState, setView: (v: ViewState) => void, isOpen: boolean, setIsOpen: (v: boolean) => void }) => (
  <>
    {isOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setIsOpen(false)} />}
    <aside className={`w-64 fixed inset-y-0 left-0 bg-surface border-r border-outline-variant/10 flex flex-col z-40 transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
      <div className="h-20 flex items-center px-8 border-b border-outline-variant/10 justify-between">
        <span className="font-headline font-bold text-xl tracking-tight">CHAMPS ADMIN</span>
        <button className="md:hidden p-2 hover:bg-surface-container-low rounded-full" onClick={() => setIsOpen(false)}>
          <X className="w-5 h-5" />
        </button>
      </div>
    <div className="flex-1 py-8 px-4 space-y-2">
      <button 
        onClick={() => setView('ADMIN_OVERVIEW')}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${currentView === 'ADMIN_OVERVIEW' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
      >
        <LayoutDashboard className="w-5 h-5" /> Overview
      </button>
      <button 
        onClick={() => setView('ADMIN_TRANSACTIONS')}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${currentView === 'ADMIN_TRANSACTIONS' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
      >
        <Receipt className="w-5 h-5" /> Transactions
      </button>
      <button 
        onClick={() => setView('ADMIN_PRODUCTS')}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${currentView === 'ADMIN_PRODUCTS' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
      >
        <Package className="w-5 h-5" /> Products
      </button>
      <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-on-surface-variant hover:bg-surface-container-low transition-colors" onClick={() => alert('Settings coming soon.')}>
        <Settings className="w-5 h-5" /> Settings
      </button>
    </div>
    <div className="p-4 border-t border-outline-variant/10">
      <button onClick={() => setView('STORE_HOME')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-on-surface-variant hover:bg-surface-container-low transition-colors">
        <LogOut className="w-5 h-5" /> Storefront
      </button>
    </div>
  </aside>
  </>
);

const AdminTopbar = ({
  setIsSidebarOpen,
  userEmail,
  onSignOut,
}: {
  setIsSidebarOpen: (v: boolean) => void;
  userEmail?: string | null;
  onSignOut: () => void;
}) => (
  <header className="h-20 fixed top-0 right-0 left-0 md:left-64 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/10 flex items-center justify-between px-4 md:px-8 z-30">
    <div className="flex items-center gap-4 flex-1">
      <button className="md:hidden p-2 hover:bg-surface-container-low rounded-full" onClick={() => setIsSidebarOpen(true)}>
        <Menu className="w-5 h-5" />
      </button>
      <div className="relative w-full max-w-md hidden sm:block">
        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <input type="text" placeholder="Search orders, products..." className="w-full bg-surface-container-low pl-10 pr-4 py-2.5 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
      </div>
    </div>
    <div className="flex items-center gap-4">
      <button className="p-2 hover:bg-surface-container-low rounded-full relative" onClick={() => alert('Notifications coming soon.')}>
        <Bell className="w-5 h-5 text-on-surface-variant" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full"></span>
      </button>
      <button className="p-2 hover:bg-surface-container-low rounded-full" onClick={onSignOut} title="Sign out">
        <LogOut className="w-5 h-5 text-on-surface-variant" />
      </button>
      <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold">
        {userEmail?.charAt(0).toUpperCase() || 'A'}
      </div>
    </div>
  </header>
);

const AdminOverview = ({ onViewTransactions }: { onViewTransactions: () => void }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 md:p-8 max-w-6xl mx-auto w-full">
    <div className="mb-8">
      <h1 className="font-headline text-3xl font-bold mb-2">Welcome back, Admin</h1>
      <p className="text-on-surface-variant">Here's what's happening with your store today.</p>
    </div>

    {/* Stats Bento */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-outline-variant/10">
        <div className="flex justify-between items-start mb-4">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary"><TrendingUp className="w-6 h-6" /></div>
          <span className="text-sm font-medium text-[#4CAF50] bg-[#4CAF50]/10 px-2 py-1 rounded-lg">+12.5%</span>
        </div>
        <p className="text-on-surface-variant text-sm font-medium mb-1">Total Revenue</p>
        <h3 className="font-headline text-3xl font-bold">45,500 Ksh</h3>
      </div>
      <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-outline-variant/10">
        <div className="flex justify-between items-start mb-4">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary"><ShoppingBag className="w-6 h-6" /></div>
          <span className="text-sm font-medium text-[#4CAF50] bg-[#4CAF50]/10 px-2 py-1 rounded-lg">+8.2%</span>
        </div>
        <p className="text-on-surface-variant text-sm font-medium mb-1">Orders Today</p>
        <h3 className="font-headline text-3xl font-bold">91</h3>
      </div>
      <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-outline-variant/10">
        <div className="flex justify-between items-start mb-4">
          <div className="p-3 bg-[#4CAF50]/10 rounded-2xl text-[#4CAF50]"><CheckCircle2 className="w-6 h-6" /></div>
        </div>
        <p className="text-on-surface-variant text-sm font-medium mb-1">M-Pesa Success Rate</p>
        <h3 className="font-headline text-3xl font-bold">98.4%</h3>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Chart Area */}
      <div className="lg:col-span-2 bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-outline-variant/10">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-headline font-bold text-lg">Revenue Trend</h3>
          <select className="bg-surface-container-low text-sm px-3 py-1.5 rounded-lg border-none outline-none">
            <option>Last 7 Days</option>
            <option>This Month</option>
          </select>
        </div>
        <div className="h-64 w-full relative flex items-end">
          {/* Simulated SVG Chart */}
          <svg viewBox="0 0 100 40" className="w-full h-full preserve-aspect-ratio-none overflow-visible">
            <path d="M0,40 L0,30 C10,30 20,10 30,15 C40,20 50,5 60,10 C70,15 80,0 90,5 L100,2 L100,40 Z" fill="url(#gradient)" opacity="0.2" />
            <path d="M0,30 C10,30 20,10 30,15 C40,20 50,5 60,10 C70,15 80,0 90,5 L100,2" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-outline-variant/10">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-headline font-bold text-lg">Recent Orders</h3>
          <button className="text-primary text-sm font-medium" onClick={onViewTransactions}>View All</button>
        </div>
        <div className="space-y-4">
          {TRANSACTIONS.length === 0 ? (
            <div className="text-sm text-on-surface-variant">No recent orders yet.</div>
          ) : (
            TRANSACTIONS.slice(0, 4).map(trx => (
              <div key={trx.id} className="flex items-center justify-between p-3 hover:bg-surface-container-low rounded-xl transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{trx.customer}</p>
                    <p className="text-xs text-on-surface-variant">{trx.area}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-sm">{trx.total} Ksh</p>
                  <p className={`text-xs font-medium ${trx.status === 'Completed' ? 'text-[#4CAF50]' : 'text-[#FF9800]'}`}>{trx.status}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  </motion.div>
);

const AddProductModal = ({
  onClose,
  onAdd,
  isSubmitting,
}: {
  onClose: () => void;
  onAdd: (formData: FormData) => Promise<void>;
  isSubmitting: boolean;
}) => {
  const [category, setCategory] = useState('Shirts');
  const [price, setPrice] = useState(500);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCat = e.target.value;
    setCategory(newCat);
    if (newCat === 'Shirts') {
      setPrice(500);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const finalPrice = category === 'Shirts' ? 500 : Number(formData.get('price'));
    formData.set('price', String(finalPrice));
    if (imageFile) {
      formData.set('image', imageFile);
    }

    await onAdd(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-surface p-4 sm:p-6 rounded-3xl shadow-xl w-full max-w-lg my-4 sm:my-8 max-h-[95vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold font-headline">Add New Product</h2>
          <button onClick={onClose} className="p-2 hover:bg-surface-container-low rounded-full"><X className="w-5 h-5" /></button>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
            <div className="w-20 h-20 rounded-xl bg-surface-container-high flex items-center justify-center overflow-hidden shrink-0">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-on-surface-variant text-center px-2">No Image</span>
              )}
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Product Image</label>
              <input name="image" type="file" accept="image/*" onChange={handleImageChange} className="w-full text-sm text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Product Name</label>
            <input name="name" required type="text" className="w-full bg-surface-container-low px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea name="description" required rows={3} className="w-full bg-surface-container-low px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"></textarea>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">SKU</label>
              <input name="sku" required type="text" className="w-full bg-surface-container-low px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select name="category" value={category} onChange={handleCategoryChange} className="w-full bg-surface-container-low px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none">
                <option value="Shirts">Shirts</option>
                <option value="Shoe Hub">Shoe Hub</option>
                <option value="Vests">Vests</option>
                <option value="Trousers">Trousers</option>
                <option value="Sweaters">Sweaters</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Price (Ksh)</label>
              <input 
                name="price" 
                required 
                type="number" 
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                disabled={category === 'Shirts'}
                className="w-full bg-surface-container-low px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50" 
              />
              {category === 'Shirts' && <p className="text-xs text-on-surface-variant mt-1">Shirts have a fixed price of 500 Ksh</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Original Price (Ksh)</label>
              <input 
                type="number" 
                value={Math.round(price * 1.2)} 
                disabled 
                className="w-full bg-surface-container-low px-4 py-2 rounded-xl focus:outline-none opacity-50" 
              />
              <p className="text-xs text-on-surface-variant mt-1">Automatically calculated (+20%)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tags (comma separated)</label>
              <input name="tags" placeholder="e.g. Cotton, Casual" required type="text" className="w-full bg-surface-container-low px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Initial Stock</label>
              <input name="stock" required type="number" className="w-full bg-surface-container-low px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-3">
            <Button type="button" variant="ghost" className="w-full sm:flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="w-full sm:flex-1">{isSubmitting ? 'Adding...' : 'Add Product'}</Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const AdminProducts = ({
  products,
  onRefresh,
  firebaseUser,
}: {
  products: Product[];
  onRefresh: () => void;
  firebaseUser: FirebaseUser | null;
}) => {
  const [showModal, setShowModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  const handleDelete = async () => {
    if (!productToDelete) return;
    if (!firebaseUser) {
      setActionError('Please sign in to delete products.');
      return;
    }
    setIsSubmitting(true);
    setActionError(null);
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch(`${API_BASE_URL}/admin/products/${productToDelete}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error('Delete failed');
      }
      setProductToDelete(null);
      onRefresh();
    } catch (err) {
      setActionError('Unable to delete product right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdd = async (formData: FormData) => {
    if (!firebaseUser) {
      setActionError('Please sign in to add products.');
      return;
    }
    setIsSubmitting(true);
    setActionError(null);
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch(`${API_BASE_URL}/admin/products`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) {
        throw new Error('Create failed');
      }
      onRefresh();
    } catch (err) {
      setActionError('Unable to add product right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = products.filter((prod) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery =
      query.length === 0 ||
      prod.name.toLowerCase().includes(query) ||
      prod.category.toLowerCase().includes(query) ||
      String(prod.id).includes(query);
    const stock = prod.stock ?? 0;
    const matchesStock = !showLowStockOnly || (stock > 0 && stock <= 50);
    return matchesQuery && matchesStock;
  });

  return (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 md:p-8 max-w-6xl mx-auto w-full">
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
      <div>
        <h1 className="font-headline text-3xl font-bold mb-2">Inventory</h1>
        <p className="text-on-surface-variant">Manage your product catalog.</p>
      </div>
      <Button className="gap-2 w-full sm:w-auto" onClick={() => setShowModal(true)}><Plus className="w-4 h-4" /> New Product</Button>
    </div>

    {actionError && (
      <div className="mb-6 bg-error-container text-on-error-container p-4 rounded-xl text-sm">
        {actionError}
      </div>
    )}

    <div className="bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/10 overflow-hidden">
      <div className="p-4 border-b border-outline-variant/10 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-container-low pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none"
          />
        </div>
        <button
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${showLowStockOnly ? 'bg-primary/10 text-primary' : 'bg-surface-container-low'}`}
          onClick={() => setShowLowStockOnly(prev => !prev)}
        >
          <Filter className="w-4 h-4"/> {showLowStockOnly ? 'Low Stock' : 'Filter'}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-container-low/50 text-on-surface-variant">
            <tr>
              <th className="px-6 py-4 font-medium">Product</th>
              <th className="px-6 py-4 font-medium">SKU</th>
              <th className="px-6 py-4 font-medium">Category</th>
              <th className="px-6 py-4 font-medium">Price</th>
              <th className="px-6 py-4 font-medium">Stock</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {filteredProducts.length === 0 ? (
              <tr>
                <td className="px-6 py-8 text-on-surface-variant" colSpan={7}>
                  No products found.
                </td>
              </tr>
            ) : (
              filteredProducts.map((prod) => {
                const stock = prod.stock ?? 0;
                const status = stock > 50 ? 'In Stock' : stock > 0 ? 'Low Stock' : 'Out of Stock';
                return (
                  <tr key={prod.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-6 py-4 flex items-center gap-3 min-w-[200px]">
                      <img src={getProductImage(prod)} alt={prod.name} className="w-10 h-10 rounded-lg object-cover" referrerPolicy="no-referrer" />
                      <span className="font-medium">{prod.name}</span>
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant">PRD-{prod.id}</td>
                    <td className="px-6 py-4 text-on-surface-variant">{prod.category}</td>
                    <td className="px-6 py-4 font-medium">{prod.price} Ksh</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="w-8">{stock}</span>
                        <div className="w-24 h-1.5 bg-surface-container rounded-full overflow-hidden">
                          <div className={`h-full ${stock > 50 ? 'bg-[#4CAF50]' : stock > 0 ? 'bg-[#FF9800]' : 'bg-error'}`} style={{ width: `${Math.min(100, (stock / 200) * 100)}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${status === 'In Stock' ? 'bg-[#4CAF50]/10 text-[#4CAF50]' : status === 'Low Stock' ? 'bg-[#FF9800]/10 text-[#FF9800]' : 'bg-error/10 text-error'}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-1 hover:bg-surface-container rounded text-on-surface-variant" onClick={() => alert('More actions coming soon.')}>
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        <button onClick={() => setProductToDelete(prod.id)} className="p-1 hover:bg-error/10 text-error rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>

    {/* Delete Confirmation Modal */}
    <AnimatePresence>
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-surface p-6 rounded-3xl shadow-xl w-full max-w-sm"
          >
            <h2 className="text-xl font-bold font-headline mb-4">Delete Product</h2>
            <p className="text-on-surface-variant mb-6">Are you sure you want to delete this product? This action cannot be undone.</p>
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setProductToDelete(null)}>Cancel</Button>
              <Button className="flex-1 bg-error hover:shadow-error/20 text-white" onClick={handleDelete}>
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* Add Product Modal */}
    <AnimatePresence>
      {showModal && (
        <AddProductModal 
          onClose={() => setShowModal(false)} 
          onAdd={handleAdd}
          isSubmitting={isSubmitting}
        />
      )}
    </AnimatePresence>
  </motion.div>
  );
};

const AdminTransactions = () => {
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [transactions, setTransactions] = useState(TRANSACTIONS);
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const filteredTransactions = transactions.filter((trx) => {
    const matchesStatus = statusFilter === 'All Statuses' || trx.status === statusFilter;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      query.length === 0 ||
      trx.id.toLowerCase().includes(query) ||
      trx.customer.toLowerCase().includes(query) ||
      trx.area.toLowerCase().includes(query);
    const matchesDate = !dateFilter || (trx.createdAt ? trx.createdAt.slice(0, 10) === dateFilter : false);
    return matchesStatus && matchesSearch && matchesDate;
  });

  return (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 md:p-8 max-w-6xl mx-auto w-full">
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
      <div>
        <h1 className="font-headline text-3xl font-bold mb-2">Transactions</h1>
        <p className="text-on-surface-variant">Monitor M-Pesa payments and orders.</p>
      </div>
      <Button className="gap-2 w-full sm:w-auto" onClick={() => setShowSaleModal(true)}><Plus className="w-4 h-4" /> Initiate Sale</Button>
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
          <option>Pending Delivery</option>
        </select>
        <div className="relative flex-1 max-w-md ml-auto">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            placeholder="Search receipt or customer..."
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
              <th className="px-6 py-4 font-medium">Area</th>
              <th className="px-6 py-4 font-medium">Amount</th>
              <th className="px-6 py-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {filteredTransactions.length === 0 ? (
              <tr>
                <td className="px-6 py-8 text-on-surface-variant" colSpan={6}>
                  No transactions found.
                </td>
              </tr>
            ) : (
              filteredTransactions.map((trx, i) => (
                <tr key={i} className="hover:bg-surface-container-low/50 transition-colors cursor-pointer">
                  <td className="px-6 py-4 font-medium text-primary">{trx.id}</td>
                  <td className="px-6 py-4 text-on-surface-variant">{trx.date}</td>
                  <td className="px-6 py-4">{trx.customer}</td>
                  <td className="px-6 py-4 text-on-surface-variant">{trx.area}</td>
                  <td className="px-6 py-4 font-medium">{trx.total} Ksh</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 w-max ${trx.status === 'Completed' ? 'bg-[#4CAF50]/10 text-[#4CAF50]' : trx.status === 'Processing' ? 'bg-[#2196F3]/10 text-[#2196F3]' : 'bg-[#FF9800]/10 text-[#FF9800]'}`}>
                      {trx.status === 'Completed' && <CheckCircle2 className="w-3 h-3" />}
                      {trx.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>

    {/* Floating M-Pesa Status */}
    <div className="fixed bottom-8 right-8 bg-surface-container-lowest p-4 rounded-2xl shadow-lg border border-outline-variant/10 hidden md:flex items-center gap-4 z-50">
      <div className="w-10 h-10 rounded-full bg-[#4CAF50]/10 flex items-center justify-center text-[#4CAF50]">
        <Smartphone className="w-5 h-5" />
      </div>
      <div>
        <p className="text-sm font-medium">M-Pesa API Status</p>
        <p className="text-xs text-[#4CAF50] font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#4CAF50]"></span> Operational</p>
      </div>
    </div>

    {/* Initiate Sale Modal */}
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
            <form className="space-y-4" onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const now = new Date();
              setTransactions([{
                id: formData.get('transactionCode') as string || `TRX-${Math.floor(Math.random() * 10000)}`,
                date: now.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }),
                createdAt: now.toISOString(),
                customer: formData.get('customer') as string || 'Walk-in Customer',
                area: 'In-Store',
                items: Number(formData.get('items')),
                total: Number(formData.get('amount')),
                status: 'Completed'
              }, ...transactions]);
              setShowSaleModal(false);
            }}>
              <div>
                <label className="block text-sm font-medium mb-1">Customer Name (Optional)</label>
                <input name="customer" type="text" className="w-full bg-surface-container-low px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="Walk-in" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Amount (Ksh)</label>
                  <input name="amount" required type="number" className="w-full bg-surface-container-low px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Items Count</label>
                  <input name="items" required type="number" defaultValue="1" className="w-full bg-surface-container-low px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">M-Pesa Transaction Code</label>
                <input name="transactionCode" required type="text" className="w-full bg-surface-container-low px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 uppercase" placeholder="e.g. QWE123RTY" />
              </div>
              <div className="pt-4 flex gap-3">
                <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowSaleModal(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 bg-[#4CAF50] hover:shadow-[#4CAF50]/20 text-white">Record Sale</Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  </motion.div>
  );
};

const AdminLogin = ({ setView }: { setView: (v: ViewState) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setView('ADMIN_OVERVIEW');
    } catch (err) {
      setError('Invalid email or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-center items-center px-6">
      <div className="w-full max-w-md bg-surface-container-low p-8 rounded-3xl shadow-sm">
        <div className="text-center mb-8">
          <h1 className="font-headline font-bold text-3xl tracking-tight mb-2">CHAMPS ADMIN</h1>
          <p className="text-on-surface-variant">Sign in to manage your store</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="bg-error-container text-on-error-container p-4 rounded-xl text-sm">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium mb-2">Email Address</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 border border-outline-variant/20" 
              placeholder="admin@champs.com"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 border border-outline-variant/20" 
              placeholder="••••••••"
              required
            />
          </div>

          <Button className="w-full py-3" type="submit">
            {isSubmitting ? 'Signing In...' : 'Sign In'}
          </Button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => setView('STORE_HOME')} 
            className="text-sm text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Store
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('STORE_HOME');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const isStoreView = currentView.startsWith('STORE_');
  const isAdminAuthed = Boolean(firebaseUser);

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    setProductsError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/products`);
      if (!response.ok) {
        throw new Error('Failed to load products');
      }
      const data = await response.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setProductsError('Unable to load products right now.');
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!isStoreView && currentView !== 'ADMIN_LOGIN' && !isAdminAuthed) {
      setCurrentView('ADMIN_LOGIN');
    }
  }, [authReady, currentView, isAdminAuthed, isStoreView]);

  useEffect(() => {
    if (currentView === 'ADMIN_LOGIN' && isAdminAuthed) {
      setCurrentView('ADMIN_OVERVIEW');
    }
  }, [currentView, isAdminAuthed]);

  const handleSignOut = useCallback(async () => {
    await signOut(auth);
    setCurrentView('STORE_HOME');
  }, []);

  if (!hasValidKey) {
    return (
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'sans-serif'}}>
        <div style={{textAlign:'center',maxWidth:520}}>
          <h2>Google Maps API Key Required</h2>
          <p><strong>Step 1:</strong> <a href="https://console.cloud.google.com/google/maps-apis/credentials" target="_blank" rel="noopener">Get an API Key</a></p>
          <p><strong>Step 2:</strong> Add your key as a secret in AI Studio:</p>
          <ul style={{textAlign:'left',lineHeight:'1.8'}}>
            <li>Open <strong>Settings</strong> (⚙️ gear icon, <strong>top-right corner</strong>)</li>
            <li>Select <strong>Secrets</strong></li>
            <li>Type <code>GOOGLE_MAPS_PLATFORM_KEY</code> as the secret name, press <strong>Enter</strong></li>
            <li>Paste your API key as the value, press <strong>Enter</strong></li>
          </ul>
          <p>The app rebuilds automatically after you add the secret.</p>
        </div>
      </div>
    );
  }

  return (
    <CartProvider>
      <APIProvider apiKey={API_KEY} version="weekly">
        <div className="min-h-screen flex flex-col">
          {isStoreView ? (
            <>
              <StoreNavbar setView={setCurrentView} />
              <main className="flex-1">
                <AnimatePresence mode="wait">
                  {currentView === 'STORE_HOME' && (
                    <StoreHome
                      key="home"
                      setView={setCurrentView}
                      products={products}
                      onSelectProduct={setSelectedProduct}
                      isLoading={productsLoading}
                      error={productsError}
                    />
                  )}
                  {currentView === 'STORE_CATALOG' && (
                    <StoreCatalog
                      key="catalog"
                      setView={setCurrentView}
                      products={products}
                      onSelectProduct={setSelectedProduct}
                      isLoading={productsLoading}
                      error={productsError}
                    />
                  )}
                  {currentView === 'STORE_PRODUCT' && (
                    <StoreProductDetail
                      key="product"
                      setView={setCurrentView}
                      product={selectedProduct}
                    />
                  )}
                  {currentView === 'STORE_CHECKOUT' && <StoreCheckout key="checkout" setView={setCurrentView} />}
                </AnimatePresence>
              </main>
              <StoreFooter setView={setCurrentView} />
            </>
          ) : currentView === 'ADMIN_LOGIN' ? (
            <AdminLogin setView={setCurrentView} />
          ) : (
            <div className="flex h-screen overflow-hidden bg-surface-container-low/30 w-full">
              <AdminSidebar currentView={currentView} setView={setCurrentView} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
              <div className="flex-1 flex flex-col md:ml-64 relative w-full">
                <AdminTopbar setIsSidebarOpen={setIsSidebarOpen} userEmail={firebaseUser?.email} onSignOut={handleSignOut} />
                <main className="flex-1 overflow-y-auto pt-20 w-full">
                  <AnimatePresence mode="wait">
                    {currentView === 'ADMIN_OVERVIEW' && (
                      <AdminOverview key="overview" onViewTransactions={() => setCurrentView('ADMIN_TRANSACTIONS')} />
                    )}
                    {currentView === 'ADMIN_PRODUCTS' && (
                      <AdminProducts
                        key="products"
                        products={products}
                        onRefresh={fetchProducts}
                        firebaseUser={firebaseUser}
                      />
                    )}
                    {currentView === 'ADMIN_TRANSACTIONS' && <AdminTransactions key="transactions" />}
                  </AnimatePresence>
                </main>
              </div>
            </div>
          )}

        </div>
      </APIProvider>
    </CartProvider>
  );
}
