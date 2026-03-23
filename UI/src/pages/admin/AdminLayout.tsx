import { useEffect, useState } from 'react';
import { LogOut, Menu, Package, Receipt, LayoutDashboard, Settings, Bell } from 'lucide-react';
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../../firebase';

export type AdminOutletContext = {
  user: FirebaseUser | null;
};

const AdminLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      navigate('/admin/login');
    }
  }, [authReady, user, navigate]);

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface-container-low/30 w-full">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setIsSidebarOpen(false)} />}
      <aside className={`w-64 fixed inset-y-0 left-0 bg-surface border-r border-outline-variant/10 flex flex-col z-40 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="h-20 flex items-center px-8 border-b border-outline-variant/10 justify-between">
          <span className="font-headline font-bold text-xl tracking-tight">CHAMPS ADMIN</span>
          <button className="md:hidden p-2 hover:bg-surface-container-low rounded-full" onClick={() => setIsSidebarOpen(false)}>
            <Menu className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 py-8 px-4 space-y-2">
          <NavLink to="/admin" end className={({ isActive }) => `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${isActive ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-low'}`}>
            <LayoutDashboard className="w-5 h-5" /> Overview
          </NavLink>
          <NavLink to="/admin/transactions" className={({ isActive }) => `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${isActive ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-low'}`}>
            <Receipt className="w-5 h-5" /> Transactions
          </NavLink>
          <NavLink to="/admin/products" className={({ isActive }) => `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${isActive ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-low'}`}>
            <Package className="w-5 h-5" /> Products
          </NavLink>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-on-surface-variant hover:bg-surface-container-low transition-colors" onClick={() => alert('Settings coming soon.')}> 
            <Settings className="w-5 h-5" /> Settings
          </button>
        </div>
        <div className="p-4 border-t border-outline-variant/10">
          <button onClick={() => navigate('/')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-on-surface-variant hover:bg-surface-container-low transition-colors">
            <LogOut className="w-5 h-5" /> Storefront
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col md:ml-64 relative w-full">
        <header className="h-20 fixed top-0 right-0 left-0 md:left-64 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/10 flex items-center justify-between px-4 md:px-8 z-30">
          <div className="flex items-center gap-4 flex-1">
            <button className="md:hidden p-2 hover:bg-surface-container-low rounded-full" onClick={() => setIsSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <div className="relative w-full max-w-md hidden sm:block">
              <input type="text" placeholder="Search orders, products..." className="w-full bg-surface-container-low pl-4 pr-4 py-2.5 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-surface-container-low rounded-full relative" onClick={() => alert('Notifications coming soon.') }>
              <Bell className="w-5 h-5 text-on-surface-variant" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full"></span>
            </button>
            <button className="p-2 hover:bg-surface-container-low rounded-full" onClick={handleSignOut} title="Sign out">
              <LogOut className="w-5 h-5 text-on-surface-variant" />
            </button>
            <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold">
              {user?.email?.charAt(0).toUpperCase() || 'A'}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto pt-20 w-full">
          <Outlet context={{ user }} />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
