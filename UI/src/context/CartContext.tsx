import React, { useMemo, useState } from 'react';
import type { Product } from '../types';

export type CartItem = {
  product: Product;
  quantity: number;
  size: string;
};

export type CartContextType = {
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

  const cartTotal = useMemo(() => items.reduce((total, item) => total + item.product.price * item.quantity, 0), [items]);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, isCartOpen, setIsCartOpen, cartTotal }}>
      {children}
    </CartContext.Provider>
  );
};
