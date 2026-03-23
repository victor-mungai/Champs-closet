import { AnimatePresence, motion } from 'motion/react';
import { ShoppingBag, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from './Button';
import { useCart } from '../context/CartContext';

const getImage = (url?: string | null, urls?: string[]) => {
  if (urls && urls.length > 0) return urls[0];
  return url || 'https://picsum.photos/seed/cart/200/260';
};

const CartDrawer = () => {
  const { items, isCartOpen, setIsCartOpen, updateQuantity, removeFromCart, cartTotal } = useCart();
  const navigate = useNavigate();

  return (
    <AnimatePresence>
      {isCartOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[80]"
            onClick={() => setIsCartOpen(false)}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
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
                  <Button
                    variant="ghost"
                    className="mt-4"
                    onClick={() => {
                      setIsCartOpen(false);
                      navigate('/catalog/all');
                    }}
                  >
                    Continue Shopping
                  </Button>
                </div>
              ) : (
                items.map((item, i) => (
                  <div key={`${item.product.id}-${item.size}-${i}`} className="flex gap-4">
                    <img src={getImage(item.product.image_url, item.product.image_urls)} alt={item.product.name} className="w-20 h-24 object-cover rounded-xl" referrerPolicy="no-referrer" />
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
                <Button
                  className="w-full"
                  onClick={() => {
                    setIsCartOpen(false);
                    navigate('/checkout');
                  }}
                >
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

export default CartDrawer;
