import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { APIProvider } from '@vis.gl/react-google-maps';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import CartDrawer from '../components/CartDrawer';
import { CartProvider } from '../context/CartContext';
import Home from '../pages/Home';
import Catalog from '../pages/Catalog';
import ProductDetail from '../pages/ProductDetail';
import Checkout from '../pages/Checkout';
import Faq from '../pages/Faq';
import AdminLayout from '../pages/admin/AdminLayout';
import AdminDashboard from '../pages/admin/Dashboard';
import AdminProducts from '../pages/admin/Products';
import AdminTransactions from '../pages/admin/Transactions';
import AdminTransactionDetail from '../pages/admin/TransactionDetail';
import AdminAnalytics from '../pages/admin/Analytics';
import AdminCreateSale from '../pages/admin/CreateSale';
import AdminLogin from '../pages/admin/Login';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY || '';

const ScrollToTop = () => {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, search]);

  return null;
};

const StoreLayout = () => (
  <>
    <Navbar />
    <main className="flex-1">
      <Outlet />
    </main>
    <Footer />
    <CartDrawer />
  </>
);

const App = () => {
  return (
    <CartProvider>
      <APIProvider apiKey={API_KEY} version="weekly" libraries={['marker', 'geocoding']}>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route element={<StoreLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/catalog/:category" element={<Catalog />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/faq" element={<Faq />} />
            </Route>
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="transactions" element={<AdminTransactions />} />
              <Route path="transactions/:id" element={<AdminTransactionDetail />} />
              <Route path="orders" element={<Navigate to="/admin/transactions" replace />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="create-sale" element={<AdminCreateSale />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </APIProvider>
    </CartProvider>
  );
};

export default App;
