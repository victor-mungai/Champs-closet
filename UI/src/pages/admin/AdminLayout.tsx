import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, LogOut, Menu, Package, Receipt, LayoutDashboard, BarChart3, PlusSquare, X } from 'lucide-react';
import { Outlet, useLocation, useNavigate, NavLink } from 'react-router-dom';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../../firebase';
import { fetchOrders } from '../../services/api';
import type { Order } from '../../types';

export type AdminOutletContext = {
  user: FirebaseUser | null;
};

type AdminNotification = {
  id: string;
  title: string;
  detail: string;
  status: 'FAILED' | 'STK_SENT' | 'PAID';
};

const AdminLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [notificationReadIds, setNotificationReadIds] = useState<Record<string, boolean>>({});
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

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

  useEffect(() => {
    setNotificationsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!notificationsOpen) return;

    const handlePointer = (event: Event) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (notificationsRef.current?.contains(target)) return;
      setNotificationsOpen(false);
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('focusin', handlePointer);
    document.addEventListener('keydown', handleEsc);

    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('focusin', handlePointer);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [notificationsOpen]);

  useEffect(() => {
    if (!user) return;
    let active = true;

    const mapOrderToNotification = (order: Order): AdminNotification => {
      if (order.status === 'FAILED') {
        return {
          id: `failed-${order.id}`,
          title: `Payment failed for order #${order.id}`,
          detail: `${order.phone} - ${order.amount} Ksh`,
          status: 'FAILED',
        };
      }
      if (order.status === 'STK_SENT') {
        return {
          id: `stk-${order.id}`,
          title: `STK sent for order #${order.id}`,
          detail: `${order.phone} - awaiting confirmation`,
          status: 'STK_SENT',
        };
      }
      return {
        id: `paid-${order.id}`,
        title: `Order #${order.id} paid`,
        detail: `${order.phone} - ${order.amount} Ksh`,
        status: 'PAID',
      };
    };

    const loadNotifications = async () => {
      try {
        const token = await user.getIdToken();
        const rows = await fetchOrders({ limit: 8 }, token);
        if (!active) return;
        const important = rows
          .filter((order) => order.status === 'FAILED' || order.status === 'STK_SENT' || order.status === 'PAID')
          .slice(0, 6)
          .map(mapOrderToNotification);
        setNotifications(important);
        setNotificationReadIds((previous) => {
          const next: Record<string, boolean> = {};
          for (const note of important) {
            next[note.id] = previous[note.id] ?? false;
          }
          return next;
        });
      } catch {
        if (!active) return;
        setNotifications([]);
      }
    };

    loadNotifications();
    const interval = window.setInterval(loadNotifications, 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [user]);

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/');
  };

  const navItems = useMemo(
    () => [
      { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/admin/products', label: 'Products', icon: Package },
      { to: '/admin/transactions', label: 'Transactions', icon: Receipt },
      { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/admin/create-sale', label: 'Create Sale', icon: PlusSquare },
    ],
    [],
  );

  const unreadCount = notifications.filter((note) => !notificationReadIds[note.id]).length;

  return (
    <div className="flex h-screen overflow-hidden bg-surface-container-low/30 w-full">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setIsSidebarOpen(false)} />}

      <aside className={`w-72 fixed inset-y-0 left-0 bg-surface border-r border-outline-variant/10 flex flex-col z-40 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="h-20 flex items-center px-6 border-b border-outline-variant/10 justify-between">
          <span className="font-headline font-bold text-lg tracking-tight">CHAMPS ADMIN</span>
          <button className="md:hidden p-2 hover:bg-surface-container-low rounded-full" onClick={() => setIsSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 py-6 px-3 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setIsSidebarOpen(false)}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${isActive ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-low'}`
              }
            >
              <item.icon className="w-5 h-5" /> {item.label}
            </NavLink>
          ))}
        </div>

        <div className="p-4 border-t border-outline-variant/10 space-y-2">
          <button onClick={() => navigate('/')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-on-surface-variant hover:bg-surface-container-low transition-colors">
            <LogOut className="w-5 h-5" /> Storefront
          </button>
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-on-surface-variant hover:bg-surface-container-low transition-colors">
            <LogOut className="w-5 h-5" /> Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col md:ml-72 relative w-full">
        <header className="h-20 fixed top-0 right-0 left-0 md:left-72 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/10 flex items-center justify-between px-4 md:px-8 z-30">
          <div className="flex items-center gap-4 flex-1">
            <button className="md:hidden p-2 hover:bg-surface-container-low rounded-full" onClick={() => setIsSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-headline text-lg sm:text-xl font-semibold">Admin Console</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen((prev) => {
                    const nextOpen = !prev;
                    if (nextOpen) {
                      setNotificationReadIds((current) => {
                        const next = { ...current };
                        for (const note of notifications) {
                          next[note.id] = true;
                        }
                        return next;
                      });
                    }
                    return nextOpen;
                  });
                }}
                className="w-10 h-10 rounded-full hover:bg-surface-container-low flex items-center justify-center relative"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-error text-white text-[10px] flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-[20rem] max-w-[90vw] bg-surface border border-outline-variant/20 rounded-2xl shadow-xl p-3 z-50">
                  <p className="text-xs uppercase tracking-[0.12em] text-on-surface-variant px-2 pb-2">Notifications</p>
                  <div className="max-h-72 overflow-y-auto space-y-2">
                    {notifications.length === 0 ? (
                      <p className="text-sm text-on-surface-variant px-2 py-4">No recent notifications.</p>
                    ) : (
                      notifications.map((note) => (
                        <div key={note.id} className="rounded-xl border border-outline-variant/15 p-3">
                          <p className="text-sm font-medium">{note.title}</p>
                          <p className="text-xs text-on-surface-variant mt-1">{note.detail}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold">
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
