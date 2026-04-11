import { AnimatePresence, motion } from 'motion/react';
import { Lock, Menu, Search, ShoppingBag, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useCart } from '../context/CartContext';

const categories = [
  { label: 'Shirts', slug: 'shirts' },
  { label: 'Shoes', slug: 'shoes' },
  { label: 'Vests', slug: 'vests' },
  { label: 'Trousers', slug: 'trousers' },
  { label: 'Sweaters', slug: 'sweaters' },
];

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { items, setIsCartOpen } = useCart();
  const navigate = useNavigate();
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      <nav className="fixed top-0 inset-x-0 z-50 bg-surface/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="p-2 -ml-2 hover:bg-surface-container-low rounded-full lg:hidden" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <Link to="/" className="font-headline font-bold text-xl tracking-tight">CHAMPS CLOSET.</Link>
          </div>
          <div className="hidden lg:flex items-center gap-8">
            {categories.map((cat) => (
              <Link key={cat.slug} to={`/catalog/${cat.slug}`} className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors">
                {cat.label}
              </Link>
            ))}
            <Link to="/faq" className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors">
              FAQ
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-surface-container-low rounded-full" onClick={() => navigate('/catalog/all')}>
              <Search className="w-5 h-5" />
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[60] lg:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
              className="fixed inset-y-0 left-0 w-64 bg-surface z-[70] lg:hidden flex flex-col"
            >
              <div className="h-20 flex items-center px-6 border-b border-outline-variant/10 justify-between">
                <span className="font-headline font-bold text-xl tracking-tight">MENU</span>
                <button className="p-2 hover:bg-surface-container-low rounded-full" onClick={() => setIsMobileMenuOpen(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 py-8 px-6 space-y-6">
                {categories.map((cat) => (
                  <Link
                    key={cat.slug}
                    to={`/catalog/${cat.slug}`}
                    className="block text-lg font-medium hover:text-primary transition-colors w-full text-left"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {cat.label}
                  </Link>
                ))}
                <Link
                  to="/faq"
                  className="block text-lg font-medium hover:text-primary transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  FAQ
                </Link>
              </div>
              <div className="p-6 border-t border-outline-variant/10">
                <Link
                  to="/admin/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-surface-container-low rounded-xl text-sm font-medium hover:bg-surface-container-high transition-colors"
                >
                  <Lock className="w-4 h-4" /> Admin Login
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
