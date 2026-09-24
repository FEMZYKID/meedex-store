'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { CartItem } from '../types';

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: any) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalAmount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    const savedCart = localStorage.getItem('meedex_cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error('Failed to parse cart', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('meedex_cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product: any) => {
    const itemPrice = Number(product.price ?? product.unit_price ?? 0);
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) => {
          if (item.id === product.id) {
            const nextQty = item.quantity + 1;
            return {
              ...item,
              quantity: nextQty,
              subtotal: (item.unit_price ?? item.price ?? 0) * nextQty,
            };
          }
          return item;
        });
      }

      const newItem: CartItem = {
        id: product.id,
        product_id: product.id,
        name: product.name,
        sku: product.sku || '',
        item_type: 'Full Unit',
        unit_price: itemPrice,
        price: itemPrice,
        quantity: 1,
        subtotal: itemPrice,
        image_url: product.image_url,
      };

      return [...prev, newItem];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const unitP = item.unit_price ?? item.price ?? 0;
          return {
            ...item,
            quantity,
            subtotal: unitP * quantity,
          };
        }
        return item;
      })
    );
  };

  const clearCart = () => setCart([]);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cart.reduce(
    (sum, item) => sum + Number(item.price ?? item.unit_price ?? 0) * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        totalAmount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}