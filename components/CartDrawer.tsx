'use client';

import { useState } from 'react';
import { useCart } from '../contexts/CartContext';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { cart, updateQuantity, removeFromCart, totalAmount } = useCart();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          email,
          customerName: name,
          customerPhone: phone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start payment');
      }

      window.location.href = data.authorization_url;
    } catch (err: any) {
      setErrorMessage(err.message || 'Something went wrong.');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-md bg-white h-full flex flex-col justify-between shadow-2xl p-6 overflow-y-auto">
        <div>
          <div className="flex justify-between items-center pb-4 border-b">
            <h2 className="text-xl font-bold text-gray-800">Your Shopping Cart</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-semibold">
              &times;
            </button>
          </div>

          {cart.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-lg">Your cart is empty.</p>
            </div>
          ) : (
            <div className="divide-y max-h-[40vh] overflow-y-auto pr-2 mt-4">
              {cart.map((item) => {
                const itemPrice = item.price ?? item.unit_price ?? 0;
                return (
                  <div key={item.id} className="py-3 flex justify-between items-center">
                    <div className="flex-1 pr-4">
                      <h4 className="font-semibold text-gray-800 text-sm line-clamp-1">{item.name}</h4>
                      <p className="text-indigo-600 font-bold text-sm mt-1">
                        ₦{itemPrice.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-7 h-7 rounded border bg-gray-50 hover:bg-gray-100 text-gray-700 flex items-center justify-center font-bold"
                      >
                        -
                      </button>
                      <span className="text-sm font-semibold w-5 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-7 h-7 rounded border bg-gray-50 hover:bg-gray-100 text-gray-700 flex items-center justify-center font-bold"
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="ml-3 text-red-500 hover:text-red-700 text-xs font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <form onSubmit={handleCheckout} className="border-t pt-4 mt-4 space-y-3">
            <h3 className="font-bold text-sm text-gray-700">Customer Details</h3>

            {errorMessage && (
              <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{errorMessage}</p>
            )}

            <input
              type="text"
              required
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <input
              type="email"
              required
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <input
              type="tel"
              required
              placeholder="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />

            <div className="flex justify-between text-base font-bold text-gray-900 pt-2">
              <span>Total:</span>
              <span className="text-indigo-600">₦{totalAmount.toLocaleString()}</span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold rounded-lg shadow-md transition disabled:bg-gray-300 text-sm"
            >
              {loading ? 'Processing...' : 'Pay Now with Paystack'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}