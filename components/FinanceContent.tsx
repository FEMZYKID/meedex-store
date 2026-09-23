/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

interface FinanceTransaction {
  id: string;
  type: 'Income' | 'Expense';
  amount: number;
  category: string;
  payment_method: string;
  notes?: string;
  account?: string;
  created_at: string;
  running_balance?: number;
}

interface CategoryItem {
  id?: string;
  name: string;
  icon: string;
  type?: 'Income' | 'Expense' | 'Both';
  isCustom?: boolean;
}

interface FinanceContentProps {
  role: string;
}

type ViewFilter = 'All' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';

const INITIAL_CATEGORIES: CategoryItem[] = [
  // Income Specific Categories
  { name: 'POS', icon: '💸', type: 'Income' },
  { name: 'Sales', icon: '🛒', type: 'Income' },
  { name: 'Other Income', icon: 'ℹ️', type: 'Income' },
  { name: 'Allowance', icon: '🪙', type: 'Income' },
  { name: 'Balance b/d', icon: 'ℹ️', type: 'Income' },
  { name: 'Bonus', icon: '💰', type: 'Income' },
  { name: 'Business', icon: '💼', type: 'Income' },
  { name: 'ComputeInstallation', icon: '🖥️', type: 'Income' },
  { name: 'Deposit', icon: '🏛️', type: 'Income' },
  { name: 'Investment Income', icon: '🌱', type: 'Income' },
  { name: 'Loan Receivable', icon: '💵', type: 'Income' },
  { name: 'Loan Taken', icon: '💵', type: 'Income' },

  // Expense Specific Categories
  { name: 'Air Tickets', icon: '✈️', type: 'Expense' },
  { name: 'Bad Debt', icon: '❗', type: 'Expense' },
  { name: 'BANK FEES', icon: '🏛️', type: 'Expense' },
  { name: 'Banner', icon: '📰', type: 'Expense' },
  { name: 'Bike', icon: '🏍️', type: 'Expense' },
  { name: 'Bills', icon: '📄', type: 'Expense' },
  { name: 'Car', icon: '🚗', type: 'Expense' },
  { name: 'Car Insurance', icon: '🚘', type: 'Expense' },
  { name: 'Card Fee', icon: '💳', type: 'Expense' },
  { name: 'Communications', icon: '📶', type: 'Expense' },
  { name: 'Drinks', icon: '🍷', type: 'Expense' },
  { name: 'Driver', icon: '👮', type: 'Expense' },
  { name: 'Durables', icon: '🧊', type: 'Expense' },
  { name: 'Education', icon: '🎓', type: 'Expense' },
  { name: 'Electricity', icon: '💡', type: 'Expense' },
  { name: 'Entertainment', icon: '🍿', type: 'Expense' },
  { name: 'Fast Food', icon: '🍔', type: 'Expense' },
  { name: 'Fuel', icon: '⛽', type: 'Expense' },
  { name: 'Groceries', icon: '🛒', type: 'Expense' },
  { name: 'Health', icon: '🏥', type: 'Expense' },
  { name: 'Other Expense', icon: 'ℹ️', type: 'Expense' },
];

const AVAILABLE_ICONS = ['💸', '🛒', 'ℹ️', '🪙', '💰', '💼', '🖥️', '🏛️', '🌱', '💵', '✈️', '🚗', '💳', '📶', '🍷', '🎓', '💡', '🍿', '🍔', '⛽', '🏥'];

export default function FinanceContent({ role }: FinanceContentProps) {
  const router = useRouter();
  const isAdmin = role === 'Admin';
  const [viewFilter, setViewFilter] = useState<ViewFilter>('Weekly');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<FinanceTransaction[]>([]);
  const [previousBalance, setPreviousBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  // Menu Dropdown State
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);

  // Form View State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<FinanceTransaction | null>(null);

  // Form Inputs
  const [formType, setFormType] = useState<'Income' | 'Expense'>('Expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Other Expense');
  const [categoryIcon, setCategoryIcon] = useState('ℹ️');
  const [paymentMethod, setPaymentMethod] = useState('Bank');
  const [notes, setNotes] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');

  // Lists & Recently Used Tracker
  const [categories, setCategories] = useState<CategoryItem[]>(INITIAL_CATEGORIES);
  const [recentCategoryNames, setRecentCategoryNames] = useState<string[]>(['POS', 'Sales', 'Other Income', 'Allowance']);
  const [paymentMethods, setPaymentMethods] = useState<string[]>(['Bank', 'Cash', 'POS Card', 'Transfer']);

  // Sub-Modals
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showCategoryManage, setShowCategoryManage] = useState(false);
  const [showCategoryCreate, setShowCategoryCreate] = useState(false);
  
  // Selectable Payment Method Picker (Top Field)
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  // Add/Edit Payment Method Manager (Bottom Footer Button)
  const [showPaymentManage, setShowPaymentManage] = useState(false);
  
  // Category & Payment Edit State
  const [categorySearch, setCategorySearch] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [selectedCatIcon, setSelectedCatIcon] = useState('💸');
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);

  const [newPaymentName, setNewPaymentName] = useState('');
  const [editingPaymentName, setEditingPaymentName] = useState<string | null>(null);

  useEffect(() => {
    fetchTransactions();
  }, []);

  useEffect(() => {
    filterAndCalculateBalance();
  }, [transactions, viewFilter, currentDate]);

  const fetchTransactions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('finance_transactions')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && data) {
      let currentBalance = 0;
      const computedWithBalance = data.map((tx: any) => {
        if (tx.type === 'Income') currentBalance += Number(tx.amount);
        else currentBalance -= Number(tx.amount);
        return { ...tx, running_balance: currentBalance };
      });

      setTransactions(computedWithBalance.reverse());
    }
    setLoading(false);
  };

  const getPeriodRange = () => {
    if (viewFilter === 'All') return { start: null, end: null };

    let start = new Date(currentDate);
    let end = new Date(currentDate);

    if (viewFilter === 'Daily') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (viewFilter === 'Weekly') {
      start.setDate(currentDate.getDate() - currentDate.getDay());
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (viewFilter === 'Monthly') {
      start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (viewFilter === 'Yearly') {
      start = new Date(currentDate.getFullYear(), 0, 1, 0, 0, 0, 0);
      end = new Date(currentDate.getFullYear(), 11, 31, 23, 59, 59, 999);
    }

    return { start, end };
  };

  const filterAndCalculateBalance = () => {
    const { start, end } = getPeriodRange();

    if (!start || !end) {
      setFilteredTransactions(transactions);
      setPreviousBalance(0);
      return;
    }

    const filtered = transactions.filter((tx) => {
      const txDate = new Date(tx.created_at);
      return txDate >= start && txDate <= end;
    });

    const priorTransactions = transactions.filter((tx) => new Date(tx.created_at) < start);
    const prevBal = priorTransactions.reduce((acc, tx) => {
      return tx.type === 'Income' ? acc + Number(tx.amount) : acc - Number(tx.amount);
    }, 0);

    setFilteredTransactions(filtered);
    setPreviousBalance(prevBal);
  };

  const handleNavigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    const step = direction === 'next' ? 1 : -1;

    if (viewFilter === 'Daily') newDate.setDate(newDate.getDate() + step);
    if (viewFilter === 'Weekly') newDate.setDate(newDate.getDate() + step * 7);
    if (viewFilter === 'Monthly') newDate.setMonth(newDate.getMonth() + step);
    if (viewFilter === 'Yearly') newDate.setFullYear(newDate.getFullYear() + step);

    setCurrentDate(newDate);
  };

  const handleFormDateStep = (days: number) => {
    const current = dateStr ? new Date(dateStr) : new Date();
    const next = new Date(current);
    next.setDate(next.getDate() + days);

    if (!isAdmin && days < 0) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      if (next < yesterday) return; // cashiers can't step back past yesterday
    }

    setDateStr(next.toISOString().split('T')[0]);
  };

  const getFilterLabel = () => {
    if (viewFilter === 'All') return 'All';
    if (viewFilter === 'Daily') return currentDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    if (viewFilter === 'Weekly') {
      const start = new Date(currentDate);
      start.setDate(currentDate.getDate() - currentDate.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} - ${end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    }
    if (viewFilter === 'Monthly') return currentDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    if (viewFilter === 'Yearly') return currentDate.getFullYear().toString();
    return 'All';
  };

  const totalIncome = filteredTransactions.filter((t) => t.type === 'Income').reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpense = filteredTransactions.filter((t) => t.type === 'Expense').reduce((sum, t) => sum + Number(t.amount), 0);
  const currentPeriodNet = totalIncome - totalExpense;
  const finalCalculatedBalance = viewFilter === 'All' ? currentPeriodNet : previousBalance + currentPeriodNet;

  const handleOpenAddForm = (type: 'Income' | 'Expense') => {
    setEditingTransaction(null);
    setFormType(type);
    setAmount('');
    const defaultCat = type === 'Income' ? 'Other Income' : 'Other Expense';
    setCategory(defaultCat);
    const catItem = categories.find((c) => c.name === defaultCat);
    setCategoryIcon(catItem ? catItem.icon : 'ℹ️');
    setPaymentMethod('Bank');
    setNotes('');
    const now = new Date();
    setDateStr(now.toISOString().split('T')[0]);
    setTimeStr(now.toTimeString().slice(0, 5));
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (tx: FinanceTransaction) => {
    setEditingTransaction(tx);
    setFormType(tx.type);
    setAmount(tx.amount.toString());
    setCategory(tx.category);
    const catItem = categories.find((c) => c.name === tx.category);
    setCategoryIcon(catItem ? catItem.icon : 'ℹ️');
    setPaymentMethod(tx.payment_method);
    setNotes(tx.notes || '');

    const txDate = new Date(tx.created_at);
    setDateStr(txDate.toISOString().split('T')[0]);
    setTimeStr(txDate.toTimeString().slice(0, 5));
    setIsFormOpen(true);
  };

  const handleSaveTransaction = async () => {
    if (!amount || isNaN(Number(amount))) return alert('Please enter a valid amount');

    const datetime = new Date(`${dateStr}T${timeStr}:00`).toISOString();
    const payload = {
      type: formType,
      amount: Number(amount),
      category,
      payment_method: paymentMethod,
      notes,
      account: 'DEPRINCE',
      created_at: datetime,
    };

    if (editingTransaction) {
      const { error } = await supabase.from('finance_transactions').update(payload).eq('id', editingTransaction.id);
      if (error) return alert('Failed to update: ' + error.message);
    } else {
      const { error } = await supabase.from('finance_transactions').insert([payload]);
      if (error) return alert('Failed to add: ' + error.message);
    }

    setIsFormOpen(false);
    fetchTransactions();
  };

  const handleDeleteTransaction = async () => {
    if (!editingTransaction) return;
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    const { error } = await supabase.from('finance_transactions').delete().eq('id', editingTransaction.id);
    if (error) return alert('Failed to delete: ' + error.message);

    setIsFormOpen(false);
    fetchTransactions();
  };

  const handleSelectCategory = (cat: CategoryItem) => {
    setCategory(cat.name);
    setCategoryIcon(cat.icon);
    setRecentCategoryNames((prev) => [cat.name, ...prev.filter((n) => n !== cat.name)].slice(0, 4));
    setShowCategoryPicker(false);
  };

  const handleSaveNewCategory = () => {
    if (!newCatName.trim()) return alert('Category name is required');

    if (editingCategory) {
      setCategories(categories.map((c) => (c.name === editingCategory.name ? { ...c, name: newCatName, icon: selectedCatIcon } : c)));
      if (category === editingCategory.name) {
        setCategory(newCatName);
        setCategoryIcon(selectedCatIcon);
      }
    } else {
      const newCat: CategoryItem = { name: newCatName, icon: selectedCatIcon, type: formType, isCustom: true };
      setCategories([...categories, newCat]);
      setCategory(newCat.name);
      setCategoryIcon(newCat.icon);
    }

    setNewCatName('');
    setEditingCategory(null);
    setShowCategoryCreate(false);
  };

  const handleSavePaymentMethod = () => {
    if (!newPaymentName.trim()) return;

    if (editingPaymentName) {
      setPaymentMethods(paymentMethods.map((pm) => (pm === editingPaymentName ? newPaymentName.trim() : pm)));
      if (paymentMethod === editingPaymentName) setPaymentMethod(newPaymentName.trim());
    } else {
      setPaymentMethods([...paymentMethods, newPaymentName.trim()]);
      setPaymentMethod(newPaymentName.trim());
    }

    setNewPaymentName('');
    setEditingPaymentName(null);
  };

  const availableCategories = categories.filter((c) => !c.type || c.type === formType);
  const recentCategories = availableCategories.filter((c) => recentCategoryNames.includes(c.name));
  const mainCategories = availableCategories.filter((c) =>
    c.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  // Cashiers can only edit/delete transactions dated today or yesterday —
  // enforced for real by RLS on the database; this just gives a clear,
  // friendly UI instead of a raw failed-save error when it's not allowed.
  const isEditableByRole = (tx: FinanceTransaction) => {
    if (isAdmin) return true;
    const txDate = new Date(tx.created_at);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    return txDate >= yesterday;
  };

  const handleRowClick = (tx: FinanceTransaction) => {
    if (!isEditableByRole(tx)) return; // silently unresponsive — no message, no lock icon
    handleOpenEditForm(tx);
  };

  // Same today/yesterday boundary as the date picker's floor for cashiers,
  // so they can't even attempt to backdate a new/edited entry past what
  // the database will actually allow.
  const minSelectableDateStr = (() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  })();

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-2 sm:p-4">
      <div className="bg-[#121212] text-white rounded-2xl w-full max-w-lg h-[92vh] flex flex-col overflow-hidden border border-neutral-800 shadow-2xl relative">
        
        {/* ==================== TRANSACTIONS LIST ==================== */}
        {!isFormOpen ? (
          <>
            <div className="flex justify-between items-center px-4 py-3 border-b border-neutral-800 bg-[#181818] relative">
              <button onClick={() => router.push('/')} className="text-xl font-bold p-1 hover:text-neutral-400">←</button>
              <h2 className="text-lg font-bold">Transactions</h2>
              <div className="flex items-center gap-3 text-neutral-400 relative">
                <button onClick={() => setShowMenuDropdown(!showMenuDropdown)} className="hover:text-white transition p-1">
                  ☰
                </button>
                <button className="hover:text-white transition p-1">⋮</button>

                {/* DROPDOWN MENU FOR THREE HORIZONTAL BARS */}
                {showMenuDropdown && (
                  <div className="absolute right-0 top-8 w-48 bg-[#1e1e1e] border border-neutral-700 rounded-xl shadow-xl z-50 py-1 text-xs">
                    <button
                      onClick={() => { setShowMenuDropdown(false); alert('Account summary'); }}
                      className="w-full text-left px-3 py-2 text-neutral-200 hover:bg-neutral-800 transition"
                    >
                      Account summary
                    </button>
                    <button
                      onClick={() => { setShowMenuDropdown(false); alert('Summary'); }}
                      className="w-full text-left px-3 py-2 text-neutral-200 hover:bg-neutral-800 transition border-t border-neutral-800"
                    >
                      Summary
                    </button>
                    <button
                      onClick={() => { setShowMenuDropdown(false); alert('Category summary'); }}
                      className="w-full text-left px-3 py-2 text-neutral-200 hover:bg-neutral-800 transition border-t border-neutral-800"
                    >
                      Category summary
                    </button>
                    <button
                      onClick={() => { setShowMenuDropdown(false); alert('Category chart'); }}
                      className="w-full text-left px-3 py-2 text-neutral-200 hover:bg-neutral-800 transition border-t border-neutral-800"
                    >
                      Category chart
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="px-4 py-2 bg-[#1a1a1a] border-b border-neutral-800 flex justify-between items-center text-xs">
              <span className="text-neutral-400 font-medium">Account:</span>
              <span className="font-bold text-white bg-neutral-800 px-2.5 py-0.5 rounded border border-neutral-700">DEPRINCE</span>
            </div>

            <div className="flex items-center justify-between px-3 py-2 bg-[#181818] border-b border-neutral-800 text-xs">
              {(['All', 'Daily', 'Weekly', 'Monthly', 'Yearly'] as ViewFilter[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setViewFilter(filter)}
                  className={`px-3 py-1 rounded-full font-medium transition ${viewFilter === filter ? 'bg-neutral-200 text-black font-bold' : 'bg-neutral-800 text-neutral-400'}`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between px-4 py-2 bg-[#222222] text-xs font-bold text-neutral-300 border-b border-neutral-800">
              {viewFilter !== 'All' ? <button onClick={() => handleNavigatePeriod('prev')} className="px-2">‹</button> : <div />}
              <span>{getFilterLabel()}</span>
              {viewFilter !== 'All' ? <button onClick={() => handleNavigatePeriod('next')} className="px-2">›</button> : <div />}
            </div>

            <div className="grid grid-cols-[1fr_90px_90px] px-4 py-2 bg-[#181818] text-xs font-semibold text-neutral-400 border-b border-neutral-800">
              <div>Category</div>
              <div className="text-right text-emerald-500 font-bold">Income</div>
              <div className="text-right text-rose-500 font-bold">Expense</div>
            </div>

            {viewFilter !== 'All' && (
              <div className="flex justify-between px-4 py-1.5 bg-[#161616] border-b border-neutral-800/60 text-xs font-medium italic text-neutral-400">
                <span>Previous Balance</span>
                <span className={`font-mono font-semibold ${previousBalance < 0 ? 'text-rose-400' : 'text-neutral-200'}`}>
                  {previousBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-2.5 space-y-2 bg-[#121212]">
              {loading ? (
                <div className="text-center py-10 text-xs text-neutral-500">Loading...</div>
              ) : filteredTransactions.length === 0 ? (
                <div className="text-center py-10 text-xs text-neutral-500">No transactions recorded.</div>
              ) : (
                filteredTransactions.map((tx) => {
                  const isExpense = tx.type === 'Expense';
                  const txDate = new Date(tx.created_at);
                  const locked = !isEditableByRole(tx);
                  return (
                    <div
                      key={tx.id}
                      onClick={() => handleRowClick(tx)}
                      className={`bg-[#1e1e1e] border border-neutral-800 rounded-lg p-2 transition ${
                        locked
                          ? 'opacity-60 cursor-not-allowed'
                          : 'cursor-pointer hover:border-neutral-700'
                      }`}
                    >
                      <div className="grid grid-cols-[1fr_90px_90px] items-center">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <span className="w-5 h-5 rounded-full bg-cyan-900/50 text-cyan-400 flex items-center justify-center text-[10px] shrink-0">
                            {categories.find((c) => c.name === tx.category)?.icon || 'ℹ️'}
                          </span>
                          <span className="font-semibold text-xs text-neutral-200 truncate">{tx.category}</span>
                        </div>
                        
                        <div className="text-right">
                          {!isExpense && (
                            <span className="font-mono text-xs font-bold text-emerald-400">
                              {Number(tx.amount).toLocaleString()}
                            </span>
                          )}
                        </div>

                        <div className="text-right">
                          {isExpense && (
                            <span className="font-mono text-xs font-bold text-rose-400">
                              {Number(tx.amount).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {tx.notes && (
                        <div className="mt-1 text-[11px] text-neutral-300 italic truncate">
                          {tx.notes}
                        </div>
                      )}

                      <div className="flex justify-between items-center mt-1 pt-1 border-t border-neutral-800/40 text-[10px]">
                        <div className="flex items-center gap-2">
                          <span className="bg-neutral-800 border border-neutral-700 text-neutral-300 px-1.5 py-0.2 rounded font-medium">
                            {tx.payment_method}
                          </span>
                          <span className="text-neutral-500">
                            {txDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} {txDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <span className="font-mono text-neutral-400">
                          Balance {Math.abs(tx.running_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-[#181818] border-t border-neutral-800">
              <button onClick={() => handleOpenAddForm('Income')} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs">Income</button>
              <button onClick={() => handleOpenAddForm('Expense')} className="bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl text-xs">Expense</button>
            </div>

            <div className="bg-[#0a0a0a] border-t border-neutral-800 text-xs">
              <div className="grid grid-cols-3 p-2.5 text-center font-semibold border-b border-neutral-800/60">
                <div className="border-r border-neutral-800">
                  <span className="block text-[10px] text-emerald-500">Total Income</span>
                  <span className="font-mono text-emerald-400 font-bold">{totalIncome.toLocaleString()}</span>
                </div>
                <div className="border-r border-neutral-800">
                  <span className="block text-[10px] text-rose-500">Total Expense</span>
                  <span className="font-mono text-rose-400 font-bold">{totalExpense.toLocaleString()}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-neutral-400">Period Net</span>
                  <span className={`font-mono font-bold ${currentPeriodNet < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {currentPeriodNet.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="px-4 py-2 space-y-1 bg-[#141414]">
                {viewFilter !== 'All' && (
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-neutral-400 font-medium">Previous Balance</span>
                    <span className={`font-mono font-bold ${previousBalance < 0 ? 'text-rose-400' : 'text-neutral-200'}`}>
                      {previousBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs font-bold pt-0.5">
                  <span className="text-neutral-300">Balance</span>
                  <span className={`font-mono ${finalCalculatedBalance < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {finalCalculatedBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* ==================== FORM VIEW ==================== */
          <div className="flex flex-col h-full bg-[#121212]">
            <div className="flex justify-between items-center px-4 py-3 border-b border-neutral-800 bg-[#181818]">
              <button onClick={() => setIsFormOpen(false)} className="text-xl font-bold p-1 hover:text-neutral-400">←</button>
              <h2 className="text-base font-bold">{editingTransaction ? 'Edit Transaction' : `Add ${formType}`}</h2>
              <div className="w-5" />
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              <div className="border border-neutral-700 rounded-lg p-2.5 relative bg-[#181818]">
                <label className="absolute -top-2.5 left-2 bg-[#121212] px-1 text-[10px] text-neutral-400">{formType}</label>
                <div className="flex justify-between items-center">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-transparent font-mono text-base font-bold text-white focus:outline-none"
                  />
                  <span className="text-amber-400">📊</span>
                </div>
              </div>

              <div
                onClick={() => setShowCategoryPicker(true)}
                className="border border-neutral-700 rounded-lg p-2.5 relative bg-[#181818] cursor-pointer hover:border-neutral-500 transition"
              >
                <label className="absolute -top-2.5 left-2 bg-[#121212] px-1 text-[10px] text-neutral-400">Category</label>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{categoryIcon}</span>
                    <span className="font-medium text-white">{category}</span>
                  </div>
                  <span className="text-amber-400">⚖️</span>
                </div>
              </div>

              <div
                onClick={() => setShowPaymentPicker(true)}
                className="border border-neutral-700 rounded-lg p-2.5 relative bg-[#181818] cursor-pointer hover:border-neutral-500 transition"
              >
                <label className="absolute -top-2.5 left-2 bg-[#121212] px-1 text-[10px] text-neutral-400">Payment Method</label>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-white">{paymentMethod}</span>
                  <span className="text-rose-400">👛</span>
                </div>
              </div>

              <div className="border border-neutral-700 rounded-lg p-2.5 bg-[#181818]">
                <div className="flex items-start gap-2">
                  <span className="text-neutral-400 mt-0.5">🎙️</span>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes"
                    className="w-full bg-transparent text-white focus:outline-none resize-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 border border-neutral-700 rounded-lg p-2 bg-[#181818] items-center">
                <div className="flex items-center justify-between px-1">
                  <button onClick={() => handleFormDateStep(-1)} className="px-1 font-bold">‹</button>
                  <input
                    type="date"
                    value={dateStr}
                    min={isAdmin ? undefined : minSelectableDateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    className="bg-transparent text-white focus:outline-none text-[11px]"
                  />
                  <button onClick={() => handleFormDateStep(1)} className="px-1 font-bold">›</button>
                </div>
                <div className="flex items-center justify-end gap-1 px-2 border-l border-neutral-700">
                  <input type="time" value={timeStr} onChange={(e) => setTimeStr(e.target.value)} className="bg-transparent text-white focus:outline-none text-[11px]" />
                  <span>🕒</span>
                </div>
              </div>
            </div>

            <div className={`grid ${editingTransaction ? 'grid-cols-4' : 'grid-cols-3'} border-t border-neutral-800 bg-[#181818]`}>
              <button
                type="button"
                onClick={() => setShowPaymentManage(true)}
                className="py-3 text-center border-r border-neutral-800 text-neutral-300 font-semibold hover:bg-neutral-800 text-xs"
              >
                Payment Method
              </button>
              <button
                type="button"
                onClick={() => setShowCategoryManage(true)}
                className="py-3 text-center border-r border-neutral-800 text-neutral-300 font-semibold hover:bg-neutral-800 text-xs"
              >
                Category
              </button>
              {editingTransaction && (
                <button
                  type="button"
                  onClick={handleDeleteTransaction}
                  className="py-3 bg-rose-700 hover:bg-rose-600 border-r border-neutral-800 text-white font-bold text-center text-xs"
                >
                  Delete
                </button>
              )}
              <button onClick={handleSaveTransaction} className="py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold text-center text-xs">
                Save
              </button>
            </div>
          </div>
        )}

        {/* ==================== SUB-MODAL 1: CATEGORY SELECTION ==================== */}
        {showCategoryPicker && (
          <div className="absolute inset-0 bg-[#121212] z-50 flex flex-col p-4 overflow-hidden">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <span className="text-cyan-400">❖</span>
                <h3 className="font-bold text-base">Category</h3>
              </div>
              <button
                onClick={() => {
                  setEditingCategory(null);
                  setNewCatName('');
                  setShowCategoryCreate(true);
                }}
                className="bg-sky-600 hover:bg-sky-500 text-white text-xs px-3 py-1.5 rounded-lg font-semibold"
              >
                Add New
              </button>
            </div>

            <div className="mb-3 relative">
              <input
                type="text"
                placeholder="Search..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                className="w-full bg-[#1e1e1e] border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
              />
              <span className="absolute right-3 top-2 text-neutral-400">🔍</span>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {recentCategories.length > 0 && !categorySearch && (
                <div className="mb-3">
                  <div className="grid grid-cols-4 gap-3 mb-3">
                    {recentCategories.map((cat, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSelectCategory(cat)}
                        className="flex flex-col items-center justify-center p-1.5 rounded-xl hover:bg-neutral-800 cursor-pointer"
                      >
                        <div className="w-11 h-11 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-lg mb-1">
                          {cat.icon}
                        </div>
                        <span className="text-[10px] text-center font-medium text-neutral-300 truncate w-full">
                          {cat.name}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="border-b border-neutral-700/80 my-2" />
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                {mainCategories.map((cat, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectCategory(cat)}
                    className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-neutral-800 cursor-pointer group"
                  >
                    <div className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xl mb-1 group-hover:scale-105 transition">
                      {cat.icon}
                    </div>
                    <span className="text-[11px] text-center font-medium text-neutral-300 truncate w-full">
                      {cat.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowCategoryPicker(false)}
              className="mt-2 py-2 text-center text-sky-400 font-semibold text-xs border-t border-neutral-800"
            >
              Cancel
            </button>
          </div>
        )}

        {/* ==================== SUB-MODAL 2: CATEGORY MANAGEMENT ==================== */}
        {showCategoryManage && (
          <div className="absolute inset-0 bg-[#121212] z-50 flex flex-col p-4 overflow-hidden">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <span className="text-cyan-400">❖</span>
                <h3 className="font-bold text-base">Manage Categories</h3>
              </div>
              <button
                onClick={() => {
                  setEditingCategory(null);
                  setNewCatName('');
                  setShowCategoryCreate(true);
                }}
                className="bg-sky-600 hover:bg-sky-500 text-white text-xs px-3 py-1.5 rounded-lg font-semibold"
              >
                Add New
              </button>
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-3 p-1">
              {availableCategories.map((cat, idx) => (
                <div
                  key={idx}
                  className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#1e1e1e] border border-neutral-800"
                >
                  <div className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xl mb-1">
                    {cat.icon}
                  </div>
                  <span className="text-[11px] text-center font-medium text-neutral-300 truncate w-full mb-1">
                    {cat.name}
                  </span>
                  <button
                    onClick={() => {
                      setEditingCategory(cat);
                      setNewCatName(cat.name);
                      setSelectedCatIcon(cat.icon);
                      setShowCategoryCreate(true);
                    }}
                    className="text-[10px] bg-neutral-800 text-sky-400 px-2 py-0.5 rounded border border-neutral-700"
                  >
                    Edit ✏️
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowCategoryManage(false)}
              className="mt-3 py-2.5 text-center text-sky-400 font-semibold text-xs border-t border-neutral-800"
            >
              Close
            </button>
          </div>
        )}

        {/* ==================== SUB-MODAL 3: CATEGORY EDIT / CREATE ==================== */}
        {showCategoryCreate && (
          <div className="absolute inset-0 bg-[#121212] z-50 flex flex-col p-4 overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base">{editingCategory ? 'Edit Category' : 'New Category'}</h3>
              <span className="text-cyan-400 text-xs">ℹ️</span>
            </div>

            <div className="mb-4">
              <label className="block text-[10px] text-neutral-400 mb-1">Name (Max 20 chars)</label>
              <input
                type="text"
                maxLength={20}
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Category Name"
                className="w-full bg-[#1e1e1e] border border-neutral-700 rounded-lg p-2.5 text-xs text-white focus:outline-none"
              />
            </div>

            <label className="block text-[10px] text-neutral-400 mb-2">Select Icon</label>
            <div className="flex-1 overflow-y-auto grid grid-cols-4 gap-3 p-2 border border-neutral-800 rounded-xl bg-[#181818]">
              {AVAILABLE_ICONS.map((iconSymbol, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedCatIcon(iconSymbol)}
                  className={`w-11 h-11 rounded-full mx-auto flex items-center justify-center text-lg transition ${
                    selectedCatIcon === iconSymbol ? 'bg-sky-600 ring-2 ring-sky-400' : 'bg-neutral-800'
                  }`}
                >
                  {iconSymbol}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between mt-4">
              <button onClick={() => setShowCategoryCreate(false)} className="text-sky-400 text-xs font-semibold px-4 py-2">
                Cancel
              </button>
              <button onClick={handleSaveNewCategory} className="w-10 h-10 bg-sky-500 rounded-full flex items-center justify-center text-white text-base shadow-lg">
                ✓
              </button>
            </div>
          </div>
        )}

        {/* ==================== SUB-MODAL 4: TOP FIELD SELECT-ONLY PAYMENT METHOD ==================== */}
        {showPaymentPicker && (
          <div className="absolute inset-0 bg-[#121212] z-50 flex flex-col p-4 overflow-hidden">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-base">Select Payment Method</h3>
              <button onClick={() => setShowPaymentPicker(false)} className="text-neutral-400 hover:text-white">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pt-2">
              {paymentMethods.map((pm, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setPaymentMethod(pm);
                    setShowPaymentPicker(false);
                  }}
                  className={`flex justify-between items-center p-3 rounded-xl border cursor-pointer transition ${
                    paymentMethod === pm ? 'border-sky-500 bg-sky-950/20' : 'border-neutral-800 bg-[#1e1e1e] hover:border-neutral-700'
                  }`}
                >
                  <span className="text-xs font-semibold text-neutral-200">{pm}</span>
                  {paymentMethod === pm && <span className="text-sky-400 text-xs font-bold">✓</span>}
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowPaymentPicker(false)}
              className="mt-3 py-2 text-center text-sky-400 font-semibold text-xs border-t border-neutral-800"
            >
              Cancel
            </button>
          </div>
        )}

        {/* ==================== SUB-MODAL 5: FOOTER PAYMENT METHOD ADD/EDIT MANAGER ==================== */}
        {showPaymentManage && (
          <div className="absolute inset-0 bg-[#121212] z-50 flex flex-col p-4 overflow-hidden">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-base">Manage Payment Methods</h3>
              <button onClick={() => setShowPaymentManage(false)} className="text-neutral-400 hover:text-white">✕</button>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder={editingPaymentName ? 'Edit method...' : 'Add payment method...'}
                value={newPaymentName}
                onChange={(e) => setNewPaymentName(e.target.value)}
                className="flex-1 bg-[#1e1e1e] border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
              />
              <button
                onClick={handleSavePaymentMethod}
                className="bg-sky-600 hover:bg-sky-500 text-white px-3 py-2 rounded-lg text-xs font-semibold"
              >
                {editingPaymentName ? 'Update' : 'Add'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {paymentMethods.map((pm, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-[#1e1e1e] border border-neutral-800 text-xs">
                  <span className="font-medium text-neutral-200">{pm}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingPaymentName(pm);
                        setNewPaymentName(pm);
                      }}
                      className="text-sky-400 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setPaymentMethods(paymentMethods.filter((item) => item !== pm))}
                      className="text-rose-400 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowPaymentManage(false)}
              className="mt-3 py-2 text-center text-sky-400 font-semibold text-xs border-t border-neutral-800"
            >
              Done
            </button>
          </div>
        )}

      </div>
    </div>
  );
}