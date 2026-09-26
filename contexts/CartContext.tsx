'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { CartItem } from '../types';

interface CartContextType {
  cart: CartItem[];
  addToCart: (
    product: any,
    options?: { itemType?: 'Full Unit' | 'Adapter' | 'Cable'; price?: number; maxQuantity?: number }
  ) => void;
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

  const addToCart = (
    product: any,
    options?: { itemType?: 'Full Unit' | 'Adapter' | 'Cable'; price?: number; maxQuantity?: number }
  ) => {
    const itemType = options?.itemType || 'Full Unit';
    const itemPrice = Number(options?.price ?? product.price ?? product.unit_price ?? 0);
    // Full Unit keeps the plain product id (so existing carts in localStorage
    // still match); Adapter/Cable get a distinct id so they're a separate
    // line from a Full Unit of the same product.
    const lineId = itemType === 'Full Unit' ? product.id : `${product.id}_${itemType}`;
    const cap = options?.maxQuantity;

    setCart((prev) => {
      const existing = prev.find((item) => item.id === lineId);
      if (existing) {
        const nextQty = cap ? Math.min(existing.quantity + 1, cap) : existing.quantity + 1;
        return prev.map((item) =>
          item.id === lineId ? { ...item, quantity: nextQty, subtotal: item.unit_price * nextQty } : item
        );
      }

      const newItem: CartItem = {
        id: lineId,
        product_id: product.id || product.product_id,
        name: itemType === 'Full Unit' ? product.name : `${product.name} (${itemType} only)`,
        sku: product.sku || '',
        item_type: itemType,
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
          return {
            ...item,
            quantity,
            subtotal: item.unit_price * quantity,
          };
        }
        return item;
      })
    );
  };

  const clearCart = () => setCart([]);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cart.reduce(
    (sum, item) => sum + (item.price ?? item.unit_price ?? 0) * item.quantity,
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