"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartContextValue {
  orgSlug: string;
  items: CartItem[];
  addItem: (item: { id: string; name: string; price: number }) => void;
  removeItem: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  clear: () => void;
  total: number;
  count: number;
  isLoaded: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

/**
 * Client-side cart state isolated per restaurant (namespaced by orgSlug).
 * Items persist in localStorage under `tablecraft_cart_${orgSlug}` until checkout.
 */
export function CartProvider({
  children,
  orgSlug,
}: {
  children: React.ReactNode;
  orgSlug: string;
}) {
  const storageKey = `tablecraft_cart_${orgSlug}`;
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setItems(JSON.parse(stored));
      }
    } catch {
      // Ignore storage read errors
    }
    setIsLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // Ignore storage write errors
    }
  }, [items, storageKey, isLoaded]);

  const value = useMemo<CartContextValue>(() => {
    const addItem = (item: { id: string; name: string; price: number }) => {
      setItems((prev) => {
        const existing = prev.find((i) => i.id === item.id);
        if (existing) {
          return prev.map((i) =>
            i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i,
          );
        }
        return [...prev, { ...item, quantity: 1 }];
      });
    };

    const removeItem = (id: string) =>
      setItems((prev) => prev.filter((i) => i.id !== id));

    const setQuantity = (id: string, quantity: number) => {
      if (quantity < 1) {
        removeItem(id);
        return;
      }
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, quantity } : i)),
      );
    };

    const clear = () => {
      setItems([]);
      try {
        localStorage.removeItem(storageKey);
      } catch {}
    };

    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const count = items.reduce((sum, i) => sum + i.quantity, 0);

    return { orgSlug, items, addItem, removeItem, setQuantity, clear, total, count, isLoaded };
  }, [items, orgSlug, storageKey, isLoaded]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used inside a CartProvider");
  }
  return ctx;
}