/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import CategoryFilterBar from '../components/CategoryFilterBar';
import ReturnItemModal from '../components/ReturnItemModal';
import ReceiptFlow from '../components/ReceiptFlow';
import { filterAndSortProducts, buildCategoryPillList } from '../lib/categories';
import { getAvailableStock } from '../lib/stock';
import { useProducts } from '../hooks/useProducts';
import { useCategories } from '../hooks/useCategories';
import type { Product, CartItem, SaleItem, Sale, CurrentUser } from '../types';

export default function PosPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const { products, setProducts, loadingProducts, fetchProducts } = useProducts();
  const { categoryList, fetchCategories } = useCategories();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Transfer' | 'POS Card'>('Cash');
  const [processingSale, setProcessingSale] = useState(false);

  // FEATURE: Recent Sales Transactions State
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [loadingSales, setLoadingSales] = useState(true);

  // FEATURE: Sales Duration Filter States
  const [durationMode, setDurationMode] = useState<'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('daily');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // FEATURE: Customer Name & Small Receipt Modal States
  const [showCustomerInputModal, setShowCustomerInputModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedReceiptSale, setSelectedReceiptSale] = useState<Sale | null>(null);
  const [customerNameInput, setCustomerNameInput] = useState('');
  const [currentReceiptCustomerName, setCurrentReceiptCustomerName] = useState('');

  // Damaged Item Write-Off States
  const [isDamaged, setIsDamaged] = useState(false);
  const [damageComment, setDamageComment] = useState('');

  // Return Item Modal States
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [searchSaleId, setSearchSaleId] = useState('');
  const [sale, setSale] = useState<any>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [searchingSale, setSearchingSale] = useState(false);
  const [selectedReturnItemId, setSelectedReturnItemId] = useState('');
  const [returnQty, setReturnQty] = useState(1);
  const [returnReason, setReturnReason] = useState('');
  const [restockInventory, setRestockInventory] = useState(true);
  const [processingReturn, setProcessingReturn] = useState(false);

  // FEATURE: Track which sales already have a return processed against them
  const [returnedSaleIds, setReturnedSaleIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data: profile, error } = await supabase
        .from('staff')
        .select('id, name, role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error || !profile) {
        await supabase.auth.signOut();
        router.push('/login');
        return;
      }

      setCurrentUser(profile);
      fetchProducts();
      fetchCategories();
      fetchReturnedSaleIds();
    };

    init();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push('/login');
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (currentUser) {
      fetchRecentSales();
    }
  }, [durationMode, selectedDate, customStartDate, customEndDate, currentUser]);

  const getDateRange = () => {
    let start: Date;
    let end: Date;

    const base = new Date(selectedDate);

    if (durationMode === 'daily') {
      start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
      end = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 23, 59, 59, 999);
    } else if (durationMode === 'weekly') {
      const day = base.getDay();
      const diff = base.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(base.setDate(diff));
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (durationMode === 'monthly') {
      start = new Date(base.getFullYear(), base.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (durationMode === 'yearly') {
      start = new Date(base.getFullYear(), 0, 1, 0, 0, 0, 0);
      end = new Date(base.getFullYear(), 11, 31, 23, 59, 59, 999);
    } else {
      start = customStartDate ? new Date(`${customStartDate}T00:00:00`) : new Date(0);
      end = customEndDate ? new Date(`${customEndDate}T23:59:59.999`) : new Date();
    }

    return { start, end };
  };

  const fetchRecentSales = async () => {
    setLoadingSales(true);
    const { start, end } = getDateRange();

    let query = supabase
      .from('sales')
      .select('*, sale_items(*, products(sku, image_url))')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false });

    const { data, error } = await query;

    if (!error && data) setRecentSales(data as unknown as Sale[]);
    setLoadingSales(false);
  };

  const handleNavigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    const step = direction === 'next' ? 1 : -1;

    if (durationMode === 'daily') {
      newDate.setDate(newDate.getDate() + step);
    } else if (durationMode === 'weekly') {
      newDate.setDate(newDate.getDate() + step * 7);
    } else if (durationMode === 'monthly') {
      newDate.setMonth(newDate.getMonth() + step);
    } else if (durationMode === 'yearly') {
      newDate.setFullYear(newDate.getFullYear() + step);
    }
    setSelectedDate(newDate);
  };

  const formatDurationLabel = () => {
    if (durationMode === 'daily') {
      return `Daily-${selectedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    }
    if (durationMode === 'weekly') {
      const { start, end } = getDateRange();
      return `${start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - ${end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    }
    if (durationMode === 'monthly') {
      return selectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    }
    if (durationMode === 'yearly') {
      return selectedDate.getFullYear().toString();
    }
    return 'Custom Range';
  };

  // FEATURE: Fetch which sale IDs already have a return recorded against them
  const fetchReturnedSaleIds = async () => {
    const { data, error } = await supabase.from('returned_items').select('sale_id');
    if (!error && data) {
      setReturnedSaleIds(new Set(data.map((r: any) => r.sale_id)));
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const categories = buildCategoryPillList(categoryList, products);

  const filteredProducts = filterAndSortProducts(products, categoryList, selectedCategory, searchQuery);

  const addToCart = (product: Product, type: 'Full Unit' | 'Adapter' | 'Cable') => {
    const available = getAvailableStock(product, type);
    const itemId = `${product.id}-${type}`;
    const existingIndex = cart.findIndex((item) => item.id === itemId);
    const currentQtyInCart = existingIndex > -1 ? cart[existingIndex].quantity : 0;

    if (currentQtyInCart + 1 > available) {
      alert('Out of stock! No more units available to add.');
      return;
    }

    let price = product.unit_price;
    if (type === 'Adapter') price = product.adapter_price || 0;
    if (type === 'Cable') price = product.cable_price || 0;

    if (existingIndex > -1) {
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += 1;
      updatedCart[existingIndex].subtotal = updatedCart[existingIndex].quantity * updatedCart[existingIndex].unit_price;
      setCart(updatedCart);
    } else {
      setCart([
        ...cart,
        {
          id: itemId,
          product_id: product.id,
          name: `${product.name} (${type})`,
          sku: product.sku || product.name,
          item_type: type,
          unit_price: price,
          quantity: 1,
          subtotal: price,
        },
      ]);
    }
  };

  const updateCartUnitPrice = (id: string, newPrice: number) => {
    const validPrice = Math.max(0, newPrice);
    const updated = cart.map((item) => {
      if (item.id === id) {
        return {
          ...item,
          unit_price: validPrice,
          subtotal: item.quantity * validPrice,
        };
      }
      return item;
    });
    setCart(updated);
  };

  const updateCartQuantity = (id: string, delta: number) => {
    const updated = cart
      .map((item) => {
        if (item.id === id) {
          if (delta > 0) {
            const product = products.find((p) => p.id === item.product_id);
            const available = product ? getAvailableStock(product, item.item_type) : Infinity;
            if (item.quantity + delta > available) {
              alert('Cannot add more — out of stock!');
              return item;
            }
          }
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          return { ...item, quantity: newQty, subtotal: newQty * item.unit_price };
        }
        return item;
      })
      .filter(Boolean) as CartItem[];

    setCart(updated);
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  const totalAmount = isDamaged
    ? 0
    : cart.reduce((sum, item) => sum + item.subtotal, 0);

  // Main Checkout Logic
  const handleCheckout = async () => {
    if (cart.length === 0) return alert('Cart is empty!');
    if (!currentUser) return;

    if (isDamaged && !damageComment.trim()) {
      alert('A comment explaining the damage is compulsory before completing write-off.');
      return;
    }

    for (const item of cart) {
      const prod = products.find((p) => p.id === item.product_id);
      const available = prod ? getAvailableStock(prod, item.item_type) : 0;
      if (item.quantity > available) {
        alert(`"${item.name}" is out of stock or has insufficient stock. Please adjust your cart.`);
        return;
      }
    }

    setProcessingSale(true);

    try {
      if (isDamaged) {
        const damagedItemsPayload = cart.map((item) => ({
          product_id: item.product_id,
          product_name: item.name,
          item_type: item.item_type,
          quantity: item.quantity,
        }));

        const { error: writeoffErr } = await supabase.rpc('process_damaged_writeoff', {
          p_comment: damageComment.trim(),
          p_items: damagedItemsPayload,
        });

        if (writeoffErr) throw writeoffErr;

        alert('Damaged stock logged and inventory updated successfully!');
      } else {
        const itemsPayload = cart.map((item) => ({
          product_id: item.product_id,
          item_name: item.name,
          item_type: item.item_type,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
        }));

        const { error: saleErr } = await supabase.rpc('process_sale', {
          p_payment_method: paymentMethod,
          p_total_amount: totalAmount,
          p_items: itemsPayload,
        });

        if (saleErr) throw saleErr;

        // AUTOMATICALLY LOG COMPLETED ITEMS INTO INCOME / EXPENSE REGISTER
        const financeEntries = cart.map((item) => ({
          type: 'Income',
          amount: item.subtotal,
          category: 'Sales',
          payment_method: paymentMethod,
          notes: item.sku || item.name, // SKU as Note
          account: 'DEPRINCE',
          created_at: new Date().toISOString(),
        }));

        const { error: financeErr } = await supabase
          .from('finance_transactions')
          .insert(financeEntries);

        if (financeErr) {
          console.error('Sale completed, but failed to record in Income register:', financeErr.message);
        }

        alert(`Sale completed successfully! Total: ₦${totalAmount.toLocaleString()}`);
      }

      setCart([]);
      setIsDamaged(false);
      setDamageComment('');
      fetchProducts();
      fetchRecentSales();
    } catch (error: any) {
      alert('Transaction failed: ' + error.message);
    } finally {
      setProcessingSale(false);
    }
  };

  const handleInitiateReceipt = (saleTransaction: Sale) => {
    setSelectedReceiptSale(saleTransaction);
    setCustomerNameInput('');
    setShowCustomerInputModal(true);
  };

  const handleGenerateReceiptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentReceiptCustomerName(customerNameInput.trim() || 'Valued Customer');
    setShowCustomerInputModal(false);
    setShowReceiptModal(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Sale ID copied to clipboard!');
  };

  const handleQuickReturn = (saleId: string) => {
    setSearchSaleId(saleId);
    setShowReturnModal(true);
  };

  const handleSearchSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchSaleId.trim()) return;

    setSearchingSale(true);
    setSale(null);
    setSaleItems([]);
    setSelectedReturnItemId('');

    try {
      const { data: saleData, error: saleErr } = await supabase
        .from('sales')
        .select('*')
        .eq('id', searchSaleId.trim())
        .single();

      if (saleErr || !saleData) {
        alert('Sale record not found. Please verify the Sale ID.');
        setSearchingSale(false);
        return;
      }

      const { data: itemsData, error: itemsErr } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', saleData.id);

      if (itemsErr) throw itemsErr;

      setSale(saleData);
      setSaleItems(itemsData || []);
    } catch (err: any) {
      alert('Error finding sale: ' + err.message);
    } finally {
      setSearchingSale(false);
    }
  };

  const handleProcessReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReturnItemId) return alert('Please select an item to return.');
    if (!returnReason.trim()) return alert('A comment explaining the return is compulsory.');

    const itemToReturn = saleItems.find((i) => i.id === selectedReturnItemId);
    if (!itemToReturn) return;

    if (returnQty > itemToReturn.quantity) {
      return alert(`Cannot return more than purchased (${itemToReturn.quantity}).`);
    }

    setProcessingReturn(true);

    try {
      const refundAmount = itemToReturn.unit_price * returnQty;

      const { error: returnErr } = await supabase.rpc('process_return', {
        p_sale_id: sale.id,
        p_item_name: itemToReturn.item_name,
        p_item_type: itemToReturn.item_type,
        p_quantity: Number(returnQty),
        p_refund_amount: refundAmount,
        p_reason: returnReason.trim(),
        p_restock: restockInventory,
      });

      if (returnErr) throw returnErr;

      alert(`Return processed successfully! Refund Amount: ₦${refundAmount.toLocaleString()}`);

      setShowReturnModal(false);
      setSale(null);
      setSaleItems([]);
      setSearchSaleId('');
      setReturnReason('');
      setSelectedReturnItemId('');
      setReturnQty(1);
      fetchProducts();
      fetchRecentSales();
      fetchReturnedSaleIds();
    } catch (err: any) {
      alert('Failed to process return: ' + err.message);
    } finally {
      setProcessingReturn(false);
    }
  };

  const selectedReturnItem = saleItems.find((i) => i.id === selectedReturnItemId);
  const calculatedRefund = selectedReturnItem ? selectedReturnItem.unit_price * returnQty : 0;

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col">
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="DEPRINCE Logo"
            className="w-10 h-10 object-contain rounded-xl bg-slate-900 border border-cyan-500/40 p-1"
          />
          <div>
            <h1 className="text-lg font-black text-white tracking-wider uppercase">
              DEPRINCE <span className="text-cyan-400">TECHNOLOGIES</span>
            </h1>
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-cyan-400/80 italic tracking-wide">Gadgets. Innovation. Solutions</p>
              <span className="text-[10px] text-slate-500">| Cashier: {currentUser.name}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/finance"
            className="bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/30 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-emerald-950/50"
          >
            📊 Income / Expense
          </Link>

          <button
            onClick={() => setShowReturnModal(true)}
            className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
          >
            🔄 Return Item
          </button>

          {currentUser.role === 'Admin' && (
            <Link
              href="/admin"
              className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-3.5 py-1.5 rounded-lg text-xs font-bold transition"
            >
              ⚙️ Admin Panel
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <CategoryFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />

          {loadingProducts ? (
            <div className="p-8 text-center text-slate-400 bg-slate-800 rounded-2xl">Loading items...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-slate-800/50 rounded-2xl border border-slate-800">
              No products found matching your search.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {filteredProducts.map((product) => {
                const fullAvailable = getAvailableStock(product, 'Full Unit');
                const adapterAvailable = getAvailableStock(product, 'Adapter');
                const cableAvailable = getAvailableStock(product, 'Cable');

                return (
                <div
                  key={product.id}
                  className="bg-slate-800 border border-slate-700/80 rounded-2xl p-3.5 flex flex-col justify-between hover:border-slate-600 transition shadow-lg"
                >
                  <div>
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-28 object-cover rounded-xl border border-slate-700 mb-2"
                      />
                    ) : (
                      <div className="w-full h-28 bg-slate-900 rounded-xl flex items-center justify-center text-slate-600 border border-slate-800 mb-2 text-2xl">
                        🔌
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] bg-slate-900 text-cyan-400 border border-slate-700 px-2 py-0.5 rounded font-medium truncate">
                        {product.category || 'General'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {product.is_splittable ? (
                          <>
                            A:<span className={(product.stock_adapter || 0) <= 5 ? "text-rose-400 font-bold" : ""}>{product.stock_adapter || 0}</span> | 
                            C:<span className={(product.stock_cable || 0) <= 5 ? "text-rose-400 font-bold" : ""}>{product.stock_cable || 0}</span>
                          </>
                        ) : (
                          <>Stock: <span className={(product.stock_qty || 0) <= 5 ? "text-rose-400 font-bold" : ""}>{product.stock_qty || 0}</span></>
                        )}
                      </span>
                    </div>
                    <h3 className="font-bold text-white text-xs mt-1 line-clamp-1">{product.name}</h3>
                    <p className="text-[10px] text-slate-400 font-mono">SKU: {product.sku || 'N/A'}</p>
                    <p className="text-sm font-black text-emerald-400 mt-1">
                      ₦{Number(product.unit_price).toLocaleString()}
                    </p>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    {fullAvailable > 0 ? (
                      <button
                        onClick={() => addToCart(product, 'Full Unit')}
                        className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-1.5 rounded-lg text-xs transition cursor-pointer"
                      >
                        + Add Full
                      </button>
                    ) : (
                      <div className="w-full bg-slate-900 text-rose-400 border border-rose-500/30 font-bold py-1.5 rounded-lg text-xs text-center">
                        Out of Stock
                      </div>
                    )}

                    {product.is_splittable && (
                      <div className="grid grid-cols-2 gap-1.5">
                        {adapterAvailable > 0 ? (
                          <button
                            onClick={() => addToCart(product, 'Adapter')}
                            className="bg-slate-900 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 py-1 rounded text-[10px] font-semibold transition cursor-pointer"
                          >
                            Adapter (₦{Number(product.adapter_price || 0).toLocaleString()})
                          </button>
                        ) : (
                          <div className="bg-slate-900 text-rose-400 border border-rose-500/30 py-1 rounded text-[10px] font-semibold text-center">
                            Out of Stock
                          </div>
                        )}
                        {cableAvailable > 0 ? (
                          <button
                            onClick={() => addToCart(product, 'Cable')}
                            className="bg-slate-900 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 py-1 rounded text-[10px] font-semibold transition cursor-pointer"
                          >
                            Cable (₦{Number(product.cable_price || 0).toLocaleString()})
                          </button>
                        ) : (
                          <div className="bg-slate-900 text-rose-400 border border-rose-500/30 py-1 rounded text-[10px] font-semibold text-center">
                            Out of Stock
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}

          <div className="bg-slate-800 border border-slate-700/80 p-5 rounded-2xl shadow-xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4 pb-3 border-b border-slate-700">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>📊</span> Recent Sales Transactions & Receipts
                </h2>
                <p className="text-[11px] text-slate-400">View recent sales IDs, generate small receipts, or initiate returns</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400 font-medium">Duration:</span>
                  <select
                    value={durationMode}
                    onChange={(e) => setDurationMode(e.target.value as any)}
                    className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                {durationMode !== 'custom' ? (
                  <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg overflow-hidden text-xs">
                    <button
                      onClick={() => handleNavigateDate('prev')}
                      className="px-2.5 py-1 text-cyan-400 hover:bg-slate-800 transition cursor-pointer"
                    >
                      ←
                    </button>
                    <span className="px-3 py-1 font-semibold text-cyan-400 border-x border-slate-700 whitespace-nowrap">
                      {formatDurationLabel()}
                    </span>
                    <button
                      onClick={() => handleNavigateDate('next')}
                      className="px-2.5 py-1 text-cyan-400 hover:bg-slate-800 transition cursor-pointer"
                    >
                      →
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-cyan-500"
                    />
                    <span className="text-slate-400">to</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                )}

                <button
                  onClick={fetchRecentSales}
                  className="text-xs bg-slate-900 border border-slate-700 hover:border-cyan-500 text-cyan-400 px-3 py-1 rounded-lg font-medium transition cursor-pointer"
                >
                  ↻ Refresh
                </button>
              </div>
            </div>

            {loadingSales ? (
              <div className="text-xs text-slate-500 py-4 text-center">Loading sales history...</div>
            ) : recentSales.length === 0 ? (
              <div className="text-xs text-slate-500 py-6 text-center">No sales recorded for this period.</div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {recentSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-3 text-xs"
                  >
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-sm">₦{Number(sale.total_amount).toLocaleString()}</span>
                          <span className="text-[10px] bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-cyan-400 font-semibold">
                            {sale.payment_method}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            by <strong className="text-slate-300">{sale.cashier_name}</strong> • {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] font-mono bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 w-fit flex-wrap">
                          <span className="text-slate-500 font-bold select-none">Sale ID:</span>
                          <span className="text-cyan-300 font-bold select-all">{sale.id}</span>
                          <button
                            onClick={() => copyToClipboard(sale.id)}
                            className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 transition cursor-pointer"
                            title="Copy Sale ID"
                          >
                            📋 Copy
                          </button>
                          {returnedSaleIds.has(sale.id) ? (
                            <button
                              disabled
                              className="text-[10px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded border border-slate-700 font-sans font-semibold cursor-not-allowed"
                              title="A return has already been processed for this sale"
                            >
                              ✓ Returned
                            </button>
                          ) : (
                            <button
                              onClick={() => handleQuickReturn(sale.id)}
                              className="text-[10px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30 transition cursor-pointer font-sans font-semibold"
                              title="Use this Sale ID to process a return"
                            >
                              🔄 Return
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleInitiateReceipt(sale)}
                          className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer flex items-center gap-1 shadow-md shadow-cyan-950"
                        >
                          🧾 Generate Receipt
                        </button>
                      </div>
                    </div>

                    {sale.sale_items && sale.sale_items.length > 0 && (
                      <div className="border-t border-slate-800 pt-2 space-y-2">
                        {sale.sale_items.map((item) => {
                          const imgUrl = item.image_url || item.products?.image_url;
                          const skuCode = item.sku || item.products?.sku || 'N/A';

                          return (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-3 bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 text-[11px]"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {imgUrl ? (
                                  <img
                                    src={imgUrl}
                                    alt={item.item_name}
                                    className="w-8 h-8 object-cover rounded-md border border-slate-700 shrink-0"
                                  />
                                ) : (
                                  <div className="w-8 h-8 bg-slate-900 rounded-md border border-slate-800 shrink-0 flex items-center justify-center text-slate-500 text-xs">
                                    🔌
                                  </div>
                                )}
                                <div className="truncate">
                                  <p className="font-semibold text-slate-200 truncate">{item.item_name}</p>
                                  <p className="text-[10px] text-slate-500 font-mono">SKU: {skuCode}</p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-slate-400 font-mono">{item.quantity} x ₦{Number(item.unit_price).toLocaleString()}</span>
                                <p className="font-bold text-emerald-400 font-mono">₦{Number(item.subtotal).toLocaleString()}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700/80 p-5 rounded-2xl flex flex-col justify-between shadow-xl h-fit sticky top-6">
          <div>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-700">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>🛒 Current Order</span>
                <span className="text-xs text-slate-400 font-normal">({cart.length})</span>
              </h2>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
                >
                  Clear Cart
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="text-center text-slate-500 py-12 text-xs">Cart is empty. Click items to add.</div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-900 p-3 rounded-xl border border-slate-700/60 flex flex-col gap-2 text-xs"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-white">{item.name}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px] text-amber-400 font-semibold">Price: ₦</span>
                          <input
                            type="number"
                            value={isDamaged ? 0 : item.unit_price}
                            disabled={isDamaged}
                            onChange={(e) => updateCartUnitPrice(item.id, Number(e.target.value))}
                            className="w-20 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-amber-300 font-mono font-bold focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center border border-slate-700 rounded-lg overflow-hidden bg-slate-950">
                          <button
                            onClick={() => updateCartQuantity(item.id, -1)}
                            className="px-2 py-0.5 text-slate-400 hover:text-white cursor-pointer"
                          >
                            -
                          </button>
                          <span className="px-2 font-bold text-xs">{item.quantity}</span>
                          <button
                            onClick={() => updateCartQuantity(item.id, 1)}
                            className="px-2 py-0.5 text-slate-400 hover:text-white cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-slate-500 hover:text-rose-400 text-sm px-1 cursor-pointer font-bold"
                          title="Remove item"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-1 border-t border-slate-800 text-[11px]">
                      <span className="text-slate-400">Subtotal:</span>
                      <span className={`font-mono font-bold ${isDamaged ? 'text-rose-400 line-through' : 'text-emerald-400'}`}>
                        ₦{(isDamaged ? 0 : item.subtotal).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-700/80 pt-4 mt-4 space-y-4">
            {cart.length > 0 && (
              <div className="bg-rose-950/30 border border-rose-500/30 p-2.5 rounded-xl flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="damaged-toggle"
                  checked={isDamaged}
                  onChange={(e) => setIsDamaged(e.target.checked)}
                  className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
                />
                <label htmlFor="damaged-toggle" className="text-xs text-rose-300 font-bold cursor-pointer select-none">
                  ⚠️ Mark as Damaged / Write-Off Item
                </label>
              </div>
            )}

            {isDamaged ? (
              <div>
                <label className="block text-xs font-semibold text-rose-400 mb-1.5">
                  Compulsory Damage Reason / Notes *
                </label>
                <textarea
                  required
                  rows={2}
                  value={damageComment}
                  onChange={(e) => setDamageComment(e.target.value)}
                  placeholder="Describe how or why the item was damaged..."
                  className="w-full bg-slate-950 border border-rose-500/40 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Cash', 'Transfer', 'POS Card'] as const).map((method) => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`py-2 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                        paymentMethod === method
                          ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50'
                          : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400">Total Amount:</span>
              <span className={`text-xl font-black font-mono ${isDamaged ? 'text-rose-400 line-through' : 'text-emerald-400'}`}>
                ₦{totalAmount.toLocaleString()}
              </span>
            </div>

            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || processingSale}
              className={`w-full font-black py-3 rounded-xl transition shadow-lg disabled:bg-slate-700 disabled:text-slate-500 cursor-pointer ${
                isDamaged
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-950'
              }`}
            >
              {processingSale ? 'Completing...' : 'Complete'}
            </button>
          </div>
        </div>
      </div>

      <ReceiptFlow
        showCustomerInputModal={showCustomerInputModal}
        onCloseCustomerInput={() => setShowCustomerInputModal(false)}
        customerNameInput={customerNameInput}
        onCustomerNameChange={setCustomerNameInput}
        onSubmitCustomerName={handleGenerateReceiptSubmit}
        showReceiptModal={showReceiptModal}
        onCloseReceipt={() => setShowReceiptModal(false)}
        selectedReceiptSale={selectedReceiptSale}
        currentReceiptCustomerName={currentReceiptCustomerName}
      />

      <ReturnItemModal
        show={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        onSearchSale={handleSearchSale}
        searchSaleId={searchSaleId}
        onSearchSaleIdChange={setSearchSaleId}
        searchingSale={searchingSale}
        sale={sale}
        onProcessReturn={handleProcessReturn}
        saleItems={saleItems}
        selectedReturnItemId={selectedReturnItemId}
        onSelectReturnItem={setSelectedReturnItemId}
        selectedReturnItem={selectedReturnItem}
        returnQty={returnQty}
        onReturnQtyChange={setReturnQty}
        restockInventory={restockInventory}
        onRestockChange={setRestockInventory}
        returnReason={returnReason}
        onReturnReasonChange={setReturnReason}
        calculatedRefund={calculatedRefund}
        processingReturn={processingReturn}
      />
    </div>
  );
}