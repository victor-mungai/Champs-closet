import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { APIProvider } from '@vis.gl/react-google-maps';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import CartDrawer from '../components/CartDrawer';
import { CartProvider } from '../context/CartContext';
import Home from '../pages/Home';
import Catalog from '../pages/Catalog';
import ProductDetail from '../pages/ProductDetail';
import Checkout from '../pages/Checkout';
import AdminLayout from '../pages/admin/AdminLayout';
import AdminDashboard from '../pages/admin/Dashboard';
import AdminProducts from '../pages/admin/Products';
import AdminTransactions from '../pages/admin/Transactions';
import AdminLogin from '../pages/admin/Login';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

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
  if (!hasValidKey) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center', maxWidth: 520 }}>
          <h2>Google Maps API Key Required</h2>
          <p><strong>Step 1:</strong> <a href="https://console.cloud.google.com/google/maps-apis/credentials" target="_blank" rel="noopener">Get an API Key</a></p>
          <p><strong>Step 2:</strong> Add your key as a secret in AI Studio:</p>
          <ul style={{ textAlign: 'left', lineHeight: '1.8' }}>
            <li>Open <strong>Settings</strong> (gear icon, <strong>top-right corner</strong>)</li>
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
        <BrowserRouter>
          <Routes>
            <Route element={<StoreLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/catalog/:category" element={<Catalog />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/checkout" element={<Checkout />} />
            </Route>
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="transactions" element={<AdminTransactions />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </APIProvider>
    </CartProvider>
  );
};

export default App;
