'use client';

import { useState } from 'react';
import { useCart } from '../contexts/CartContext';

// ---------------------------------------------------------------------
// EDIT ME: the address shown to customers who choose "Store Pickup".
// ---------------------------------------------------------------------
const STORE_PICKUP_ADDRESS = 'Along PPL Street, LASU';

const DELIVERY_ZONES = ['LASU On-Campus', 'LASU Off-Campus', 'Others'] as const;

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { cart, updateQuantity, removeFromCart, totalAmount } = useCart();

  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryZone, setDeliveryZone] = useState<string>('');
  const [addressDetails, setAddressDetails] = useState('');

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage('');

    if (deliveryMethod === 'delivery' && (!deliveryZone || !addressDetails.trim())) {
      setErrorMessage('Please select a delivery zone and enter your address details.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          email,
          customerName: name,
          customerPhone: phone,
          deliveryMethod,
          deliveryZone: deliveryMethod === 'delivery' ? deliveryZone : null,
          address: deliveryMethod === 'pickup' ? STORE_PICKUP_ADDRESS : addressDetails.trim(),
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
            <>
              {/* Order Summary */}
              <h3 className="font-bold text-xs text-gray-500 uppercase tracking-wider mt-4 mb-2">Order Summary</h3>
              <div className="divide-y max-h-[32vh] overflow-y-auto pr-2">
                {cart.map((item) => {
                  const itemPrice = item.price ?? item.unit_price ?? 0;
                  return (
                    <div key={item.id} className="py-3 flex justify-between items-center">
                      <div className="flex-1 pr-4">
                        <h4 className="font-semibold text-gray-800 text-sm line-clamp-1">{item.name}</h4>
                        <p className="text-indigo-600 font-bold text-sm mt-1">₦{itemPrice.toLocaleString()}</p>
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

              <div className="flex justify-between text-base font-bold text-gray-900 pt-3 mt-2 border-t">
                <span>Total:</span>
                <span className="text-indigo-600">₦{totalAmount.toLocaleString()}</span>
              </div>

              {/* Delivery Method */}
              <h3 className="font-bold text-xs text-gray-500 uppercase tracking-wider mt-6 mb-2">Delivery Method</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDeliveryMethod('pickup')}
                  className={`py-2.5 rounded-lg text-xs font-bold border transition ${
                    deliveryMethod === 'pickup'
                      ? 'bg-indigo-900 text-white border-indigo-900'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  🏬 Store Pickup
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryMethod('delivery')}
                  className={`py-2.5 rounded-lg text-xs font-bold border transition ${
                    deliveryMethod === 'delivery'
                      ? 'bg-indigo-900 text-white border-indigo-900'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  🚚 Delivery
                </button>
              </div>

              {deliveryMethod === 'pickup' ? (
                <p className="text-xs text-gray-600 bg-gray-50 border rounded-lg p-3 mt-3">
                  Pick up your order at: <span className="font-semibold text-gray-800">{STORE_PICKUP_ADDRESS}</span>
                </p>
              ) : (
                <div className="space-y-2 mt-3">
                  <select
                    required
                    value={deliveryZone}
                    onChange={(e) => setDeliveryZone(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Select delivery zone...</option>
                    {DELIVERY_ZONES.map((zone) => (
                      <option key={zone} value={zone}>
                        {zone}
                      </option>
                    ))}
                  </select>
                  <textarea
                    required
                    rows={2}
                    placeholder="Detailed address / description (hostel name, room number, landmark, etc.)"
                    value={addressDetails}
                    onChange={(e) => setAddressDetails(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                  />
                </div>
              )}
            </>
          )}
        </div>

        {cart.length > 0 && (
          <form onSubmit={handleCheckout} className="border-t pt-4 mt-4 space-y-3">
            <h3 className="font-bold text-xs text-gray-500 uppercase tracking-wider">Contact Info</h3>

            {errorMessage && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{errorMessage}</p>}

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