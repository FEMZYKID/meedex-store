/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useProducts } from '../../../hooks/useProducts';
import { useStaff } from '../../../hooks/useStaff';
import { useSales } from '../../../hooks/useSales';
import { useDamagedItems } from '../../../hooks/useDamagedItems';
import { useReturnedItems } from '../../../hooks/useReturnedItems';
import { buildProductSkuMap, buildProductPriceMap, getItemSKU } from '../../../lib/productLookup';

export default function AdminSalesPage() {
  const { products, fetchProducts } = useProducts();
  const { staffList, fetchStaff } = useStaff();
  const { sales, loadingSales, fetchSales } = useSales();
  const { damagedItems, fetchDamagedItems } = useDamagedItems();
  const { returnedItems, fetchReturnedItems } = useReturnedItems();

  useEffect(() => {
    fetchProducts();
    fetchStaff();
    fetchSales();
    fetchDamagedItems();
    fetchReturnedItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filters
  const [cashierFilter, setCashierFilter] = useState('All');
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [durationFilter, setDurationFilter] = useState('all');
  const [durationAnchorDate, setDurationAnchorDate] = useState<Date>(new Date());
  const [durationCustomStartDate, setDurationCustomStartDate] = useState('');
  const [durationCustomEndDate, setDurationCustomEndDate] = useState('');
  const [transactionSKUFilter, setTransactionSKUFilter] = useState('');

  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDuration, setExportDuration] = useState('all');
  const [exportAnchorDate, setExportAnchorDate] = useState<Date>(new Date());
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel'>('pdf');
  const [exportCustomStartDate, setExportCustomStartDate] = useState('');
  const [exportCustomEndDate, setExportCustomEndDate] = useState('');

  const getDateRange = (type: string, anchor: Date) => {
    let start = new Date(anchor);
    let end = new Date(anchor);

    if (type === 'daily') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (type === 'weekly') {
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (type === 'monthly') {
      start = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    return { start, end };
  };

  const formatDateLabel = (type: string, anchor: Date, customStart?: string, customEnd?: string) => {
    if (type === 'all') return 'ALL';
    if (type === 'custom') {
      return customStart && customEnd ? `${customStart} to ${customEnd}` : 'Custom Range';
    }
    const { start, end } = getDateRange(type, anchor);
    if (type === 'daily') {
      return `Daily-${start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    }
    if (type === 'weekly') {
      const s = start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const e = end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      return `Weekly (${s} - ${e})`;
    }
    if (type === 'monthly') {
      return `Monthly - ${start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;
    }
    return 'ALL';
  };

  const handleShiftDate = (
    type: string,
    direction: 'prev' | 'next',
    setter: React.Dispatch<React.SetStateAction<Date>>
  ) => {
    setter((prev) => {
      const newDate = new Date(prev);
      if (type === 'daily') {
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
      } else if (type === 'weekly') {
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
      } else if (type === 'monthly') {
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
      }
      return newDate;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Sale ID copied to clipboard!');
  };

  const productSkuMap = useMemo(() => buildProductSkuMap(products), [products]);
  const productPriceMap = useMemo(() => buildProductPriceMap(products), [products]);

  const getSKU = (item: { product_id?: string; product_name?: string; item_name?: string; sku?: string }) =>
    getItemSKU(item, productSkuMap);

  // Single Export Function Logic (Exports Sales, Damaged, and Returned tables)
  const exportDataFlow = (durationChoice: string, format: 'pdf' | 'excel', customStart?: string, customEnd?: string) => {
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (durationChoice === 'custom') {
      if (!customStart || !customEnd) {
        alert('Please select both start and end dates.');
        return;
      }
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
      endDate.setHours(23, 59, 59, 999);
    } else if (durationChoice !== 'all') {
      const range = getDateRange(durationChoice, exportAnchorDate);
      startDate = range.start;
      endDate = range.end;
    }

    const durationLabel = formatDateLabel(durationChoice, exportAnchorDate, customStart, customEnd);

    const filterByDate = (items: any[]) => {
      return items.filter((item) => {
        const itemTime = new Date(item.created_at).getTime();
        if (startDate && itemTime < startDate.getTime()) return false;
        if (endDate && itemTime > endDate.getTime()) return false;
        return true;
      });
    };

    const filteredExportSales = filterByDate(sales);
    const filteredExportDamaged = filterByDate(damagedItems);
    const filteredExportReturned = filterByDate(returnedItems);

    const returnsBySaleAndProduct = new Map<string, number>();
    filteredExportReturned.forEach((r) => {
      const key = `${r.sale_id}_${r.product_name.toLowerCase()}`;
      returnsBySaleAndProduct.set(key, (returnsBySaleAndProduct.get(key) || 0) + r.quantity);
    });

    const salesExportItems: Array<{
      product_name: string;
      sku: string;
      unit: number;
      amount: number;
      created_at: string;
    }> = [];

    filteredExportSales.forEach((s) => {
      if (s.sale_items && s.sale_items.length > 0) {
        s.sale_items.forEach((item: any) => {
          const key = `${s.id}_${item.item_name.toLowerCase()}`;
          const returnedQty = returnsBySaleAndProduct.get(key) || 0;
          const netQty = item.quantity - returnedQty;

          if (netQty > 0) {
            salesExportItems.push({
              product_name: item.item_name,
              sku: getSKU(item),
              unit: netQty,
              amount: item.unit_price,
              created_at: new Date(s.created_at).toLocaleString(),
            });
          }
        });
      }
    });

    const totalSalesUnit = salesExportItems.reduce((acc, curr) => acc + curr.unit, 0);
    const totalSalesAmount = salesExportItems.reduce((acc, curr) => acc + (curr.amount * curr.unit), 0);

    const totalDamagedQty = filteredExportDamaged.reduce((acc, curr) => acc + curr.quantity, 0);
    const totalDamagedAmount = filteredExportDamaged.reduce((acc, curr) => {
      const price = productPriceMap.get(curr.product_id) || productPriceMap.get(curr.product_name.toLowerCase()) || 0;
      return acc + price * curr.quantity;
    }, 0);

    const totalRefundAmount = filteredExportReturned.reduce((acc, curr) => acc + Number(curr.refund_amount), 0);

    if (format === 'excel') {
      const csvRows: string[] = [];
      csvRows.push(`DEPRINCE TECHNOLOGIES`);
      csvRows.push(`Summary (${durationLabel})`);
      csvRows.push(`Duration: ${durationLabel}`);
      csvRows.push('');

      csvRows.push(`Sales Summary (${durationLabel})`);
      csvRows.push(['Product Name', 'SKU', 'Unit', 'Amount', 'Date'].join(','));
      salesExportItems.forEach((row) => {
        csvRows.push([
          `"${row.product_name.replace(/"/g, '""')}"`,
          `"${row.sku}"`,
          row.unit,
          row.amount,
          `"${row.created_at}"`,
        ].join(','));
      });
      csvRows.push(`,Total Unit:,${totalSalesUnit},Total Amount:,₦${totalSalesAmount.toLocaleString()}`);
      csvRows.push('');

      csvRows.push(`Damaged / Write-Off Items (${durationLabel})`);
      csvRows.push(['Product Name', 'SKU', 'Quantity', 'Reported By', 'Comment', 'Date'].join(','));
      filteredExportDamaged.forEach((row) => {
        csvRows.push([
          `"${row.product_name.replace(/"/g, '""')}"`,
          `"${getSKU(row)}"`,
          row.quantity,
          `"${row.reported_by}"`,
          `"${row.comment.replace(/"/g, '""')}"`,
          `"${new Date(row.created_at).toLocaleString()}"`,
        ].join(','));
      });
      csvRows.push(`,Total Quantity:,${totalDamagedQty},Total Amount:,₦${totalDamagedAmount.toLocaleString()}`);
      csvRows.push('');

      csvRows.push(`Returned Items & Refunds (${durationLabel})`);
      csvRows.push(['Product Name', 'SKU', 'Quantity', 'Refund Amount', 'Processed By', 'Reason', 'Date'].join(','));
      filteredExportReturned.forEach((row) => {
        csvRows.push([
          `"${row.product_name.replace(/"/g, '""')}"`,
          `"${getSKU(row)}"`,
          row.quantity,
          row.refund_amount,
          `"${row.processed_by}"`,
          `"${row.reason.replace(/"/g, '""')}"`,
          `"${new Date(row.created_at).toLocaleString()}"`,
        ].join(','));
      });
      csvRows.push(`,,Total Refund Amount:,₦${totalRefundAmount.toLocaleString()},,,`);

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `summary_${durationChoice}_${Date.now()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } else {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return alert('Popup blocked. Please allow popups.');

      const salesTableRows = salesExportItems.map(item => `
        <tr>
          <td style="border:1px solid #ccc;padding:6px;">${item.product_name}</td>
          <td style="border:1px solid #ccc;padding:6px;">${item.sku}</td>
          <td style="border:1px solid #ccc;padding:6px;">${item.unit}</td>
          <td style="border:1px solid #ccc;padding:6px;">₦${item.amount.toLocaleString()}</td>
          <td style="border:1px solid #ccc;padding:6px;">${item.created_at}</td>
        </tr>
      `).join('');

      const damagedTableRows = filteredExportDamaged.map(item => `
        <tr>
          <td style="border:1px solid #ccc;padding:6px;">${item.product_name}</td>
          <td style="border:1px solid #ccc;padding:6px;">${getSKU(item)}</td>
          <td style="border:1px solid #ccc;padding:6px;">${item.quantity}</td>
          <td style="border:1px solid #ccc;padding:6px;">${item.reported_by}</td>
          <td style="border:1px solid #ccc;padding:6px;">${item.comment}</td>
          <td style="border:1px solid #ccc;padding:6px;">${new Date(item.created_at).toLocaleString()}</td>
        </tr>
      `).join('');

      const returnedTableRows = filteredExportReturned.map(item => `
        <tr>
          <td style="border:1px solid #ccc;padding:6px;">${item.product_name}</td>
          <td style="border:1px solid #ccc;padding:6px;">${getSKU(item)}</td>
          <td style="border:1px solid #ccc;padding:6px;">${item.quantity}</td>
          <td style="border:1px solid #ccc;padding:6px;">₦${Number(item.refund_amount).toLocaleString()}</td>
          <td style="border:1px solid #ccc;padding:6px;">${item.processed_by}</td>
          <td style="border:1px solid #ccc;padding:6px;">${item.reason}</td>
          <td style="border:1px solid #ccc;padding:6px;">${new Date(item.created_at).toLocaleString()}</td>
        </tr>
      `).join('');

      printWindow.document.write(`
        <html>
          <head>
            <title>Summary (${durationLabel})</title>
            <style>
              body { font-family: sans-serif; padding: 20px; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; }
              th { background: #1e293b; color: white; border: 1px solid #ccc; padding: 8px; text-align: left; }
              .header-section { display: flex; align-items: center; gap: 15px; margin-bottom: 20px; }
              .header-section img { height: 50px; }
              h1 { margin: 0; font-size: 20px; }
              h2 { font-size: 16px; margin-top: 25px; margin-bottom: 5px; color: #0284c7; }
              .total-row { font-weight: bold; background: #f1f5f9; }
            </style>
          </head>
          <body>
            <div class="header-section">
              <img src="/logo.png" alt="Company Logo" />
              <div>
                <h1>DEPRINCE TECHNOLOGIES</h1>
                <h3 style="margin:2px 0;">Summary (${durationLabel})</h3>
                <p style="margin:0; font-size: 12px; color: #666;">Duration: ${durationLabel}</p>
              </div>
            </div>

            <h2>Sales Summary (${durationLabel})</h2>
            <table>
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>SKU</th>
                  <th>Unit</th>
                  <th>Amount</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                ${salesTableRows}
                <tr class="total-row">
                  <td style="border:1px solid #ccc;padding:6px;text-align:right;">Total Unit:</td>
                  <td style="border:1px solid #ccc;padding:6px;">${totalSalesUnit}</td>
                  <td style="border:1px solid #ccc;padding:6px;text-align:right;">Total Amount:</td>
                  <td colspan="2" style="border:1px solid #ccc;padding:6px;">₦${totalSalesAmount.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            <h2>Damaged / Write-Off Items (${durationLabel})</h2>
            <table>
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>SKU</th>
                  <th>Quantity</th>
                  <th>Reported By</th>
                  <th>Comment</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                ${damagedTableRows}
                <tr class="total-row">
                  <td colspan="2" style="border:1px solid #ccc;padding:6px;text-align:right;">Total Quantity:</td>
                  <td style="border:1px solid #ccc;padding:6px;">${totalDamagedQty}</td>
                  <td style="border:1px solid #ccc;padding:6px;text-align:right;">Total Amount:</td>
                  <td colspan="2" style="border:1px solid #ccc;padding:6px;">₦${totalDamagedAmount.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            <h2>Returned Items & Refunds (${durationLabel})</h2>
            <table>
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>SKU</th>
                  <th>Quantity</th>
                  <th>Refund Amount</th>
                  <th>Processed By</th>
                  <th>Reason</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                ${returnedTableRows}
                <tr class="total-row">
                  <td colspan="3" style="border:1px solid #ccc;padding:6px;text-align:right;">Total Refund Amount:</td>
                  <td colspan="4" style="border:1px solid #ccc;padding:6px;">₦${totalRefundAmount.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            <script>window.print();</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const filteredSales = sales.filter((s) => {
    const matchesCashier = cashierFilter === 'All' || s.cashier_name === cashierFilter;
    const matchesPayment = paymentFilter === 'All' || s.payment_method === paymentFilter;

    let matchesDuration = true;
    const saleTime = new Date(s.created_at).getTime();

    if (durationFilter === 'daily' || durationFilter === 'weekly' || durationFilter === 'monthly') {
      const { start, end } = getDateRange(durationFilter, durationAnchorDate);
      matchesDuration = saleTime >= start.getTime() && saleTime <= end.getTime();
    } else if (durationFilter === 'custom') {
      if (durationCustomStartDate) {
        const start = new Date(durationCustomStartDate).getTime();
        if (saleTime < start) matchesDuration = false;
      }
      if (durationCustomEndDate) {
        const end = new Date(durationCustomEndDate).setHours(23, 59, 59, 999);
        if (saleTime > end) matchesDuration = false;
      }
    }

    let matchesSKU = true;
    if (transactionSKUFilter.trim()) {
      const searchSKU = transactionSKUFilter.trim().toLowerCase();
      matchesSKU = s.sale_items?.some((item) => {
        const sku = getSKU(item).toLowerCase();
        return sku.includes(searchSKU);
      });
    }

    return matchesCashier && matchesPayment && matchesDuration && matchesSKU;
  });

  const salesById: Record<string, any> = {};
  sales.forEach((s) => {
    salesById[s.id] = s;
  });

  const filteredSaleIds = new Set(filteredSales.map((s) => s.id));
  const relevantReturns = returnedItems.filter((r) => filteredSaleIds.has(r.sale_id));

  const grossRevenue = filteredSales.reduce((sum, s) => sum + Number(s.total_amount), 0);
  const totalOrders = filteredSales.length;
  const totalRefunds = relevantReturns.reduce((sum, r) => sum + Number(r.refund_amount), 0);
  const totalRevenue = grossRevenue - totalRefunds;

  const grossCashRevenue = filteredSales
    .filter((s) => s.payment_method === 'Cash')
    .reduce((sum, s) => sum + Number(s.total_amount), 0);
  const grossTransferRevenue = filteredSales
    .filter((s) => s.payment_method === 'Transfer')
    .reduce((sum, s) => sum + Number(s.total_amount), 0);
  const grossPosRevenue = filteredSales
    .filter((s) => s.payment_method === 'POS Card')
    .reduce((sum, s) => sum + Number(s.total_amount), 0);

  const cashRefunds = relevantReturns
    .filter((r) => salesById[r.sale_id]?.payment_method === 'Cash')
    .reduce((sum, r) => sum + Number(r.refund_amount), 0);
  const transferRefunds = relevantReturns
    .filter((r) => salesById[r.sale_id]?.payment_method === 'Transfer')
    .reduce((sum, r) => sum + Number(r.refund_amount), 0);
  const posRefunds = relevantReturns
    .filter((r) => salesById[r.sale_id]?.payment_method === 'POS Card')
    .reduce((sum, r) => sum + Number(r.refund_amount), 0);

  const cashRevenue = grossCashRevenue - cashRefunds;
  const transferRevenue = grossTransferRevenue - transferRefunds;
  const posRevenue = grossPosRevenue - posRefunds;

  const returnedSaleIds = new Set(returnedItems.map((r) => r.sale_id));

  return (
    <>
      <section className="bg-slate-800 border border-slate-700/80 p-5 rounded-2xl mb-8 shadow-xl">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6 pb-4 border-b border-slate-700">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>📊</span> Sales Reports & Analytics
            </h2>
            <p className="text-xs text-slate-400">Monitor store revenue and individual cashier activity</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div>
              <label className="text-slate-400 mr-2">Cashier:</label>
              <select
                value={cashierFilter}
                onChange={(e) => setCashierFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="All">All Staff</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-400 mr-2">Payment:</label>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="All">All Methods</option>
                <option value="Cash">Cash</option>
                <option value="Transfer">Transfer</option>
                <option value="POS Card">POS Card</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-slate-900 p-4 rounded-xl border border-emerald-500/30">
            <p className="text-xs text-slate-400">Total Revenue (Net of Returns)</p>
            <p className="text-2xl font-black text-emerald-400 font-mono mt-1">₦{totalRevenue.toLocaleString()}</p>
            <p className="text-[10px] text-slate-500 mt-1">{totalOrders} completed sales</p>
          </div>

          <div className="bg-slate-900 p-4 rounded-xl border border-amber-500/30">
            <p className="text-xs text-slate-400">Cash Collected (Net)</p>
            <p className="text-2xl font-black text-amber-400 font-mono mt-1">₦{cashRevenue.toLocaleString()}</p>
          </div>

          <div className="bg-slate-900 p-4 rounded-xl border border-cyan-500/30">
            <p className="text-xs text-slate-400">Bank Transfers (Net)</p>
            <p className="text-2xl font-black text-cyan-400 font-mono mt-1">₦{transferRevenue.toLocaleString()}</p>
          </div>

          <div className="bg-slate-900 p-4 rounded-xl border border-indigo-500/30">
            <p className="text-xs text-slate-400">POS Card Terminal (Net)</p>
            <p className="text-2xl font-black text-indigo-400 font-mono mt-1">₦{posRevenue.toLocaleString()}</p>
          </div>

          <div className="bg-slate-900 p-4 rounded-xl border border-rose-500/30">
            <p className="text-xs text-slate-400">Total Refunded</p>
            <p className="text-2xl font-black text-rose-400 font-mono mt-1">₦{totalRefunds.toLocaleString()}</p>
            <p className="text-[10px] text-slate-500 mt-1">{relevantReturns.length} returned item(s)</p>
          </div>
        </div>

        <div className="border-t border-slate-700/60 pt-4">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-3 mb-4">
            <h3 className="text-xs font-semibold text-slate-400">Recent Sales Transactions ({filteredSales.length})</h3>

            <div className="flex flex-wrap items-center gap-2 text-xs bg-slate-900 p-2 rounded-xl border border-slate-700">
              <button
                onClick={() => setShowExportModal(true)}
                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-3 py-1.5 rounded text-xs transition cursor-pointer shadow"
              >
                📥 Export
              </button>

              <div className="flex items-center gap-1.5 ml-2 border-l border-slate-700 pl-2">
                <span className="text-slate-400 font-medium">Duration:</span>
                <select
                  value={durationFilter}
                  onChange={(e) => {
                    setDurationFilter(e.target.value);
                    setDurationAnchorDate(new Date());
                  }}
                  className="bg-slate-800 border border-slate-700 rounded p-1 text-white text-xs focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">All Time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="custom">Custom Range</option>
                </select>

                {['daily', 'weekly', 'monthly'].includes(durationFilter) && (
                  <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 px-2 py-1 rounded">
                    <button
                      onClick={() => handleShiftDate(durationFilter, 'prev', setDurationAnchorDate)}
                      className="text-cyan-400 font-bold hover:text-white transition px-1"
                      title="Previous Period"
                    >
                      ←
                    </button>
                    <span className="text-cyan-300 font-mono text-xs px-1">
                      {formatDateLabel(durationFilter, durationAnchorDate)}
                    </span>
                    <button
                      onClick={() => handleShiftDate(durationFilter, 'next', setDurationAnchorDate)}
                      className="text-cyan-400 font-bold hover:text-white transition px-1"
                      title="Next Period"
                    >
                      →
                    </button>
                  </div>
                )}

                {durationFilter === 'custom' && (
                  <div className="flex items-center gap-1">
                    <input
                      type="date"
                      value={durationCustomStartDate}
                      onChange={(e) => setDurationCustomStartDate(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded p-1 text-white text-xs"
                    />
                    <span className="text-slate-500">to</span>
                    <input
                      type="date"
                      value={durationCustomEndDate}
                      onChange={(e) => setDurationCustomEndDate(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded p-1 text-white text-xs"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 ml-2 border-l border-slate-700 pl-2">
                <span className="text-slate-400 font-medium">Filter SKU:</span>
                <input
                  type="text"
                  placeholder="Search SKU..."
                  value={transactionSKUFilter}
                  onChange={(e) => setTransactionSKUFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded p-1 text-white text-xs w-28 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {loadingSales ? (
            <div className="text-xs text-slate-500">Loading sales history...</div>
          ) : filteredSales.length === 0 ? (
            <div className="text-xs text-slate-500 py-6 text-center">No sales recorded matching current filters.</div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {filteredSales.map((sale) => (
                <div
                  key={sale.id}
                  className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row justify-between sm:items-center gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-sm">₦{Number(sale.total_amount).toLocaleString()}</span>
                      <span className="text-[10px] bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-cyan-400 font-semibold">
                        {sale.payment_method}
                      </span>
                      {returnedSaleIds.has(sale.id) && (
                        <span className="text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded font-bold uppercase">
                          Returned
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono bg-slate-950 px-2 py-1 rounded border border-slate-800 w-fit">
                      <span className="text-slate-500 font-bold select-none">Sale ID:</span>
                      <span className="text-cyan-300 font-bold select-all">{sale.id}</span>
                      <button
                        onClick={() => copyToClipboard(sale.id)}
                        className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 ml-1 transition cursor-pointer"
                        title="Copy Sale ID"
                      >
                        📋 Copy
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-400">
                      Sold by: <span className="text-cyan-300 font-medium">{sale.cashier_name || 'Unknown'}</span> •{' '}
                      {new Date(sale.created_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 min-w-[220px]">
                    <p className="font-semibold text-slate-300 mb-0.5">Items Purchased:</p>
                    {sale.sale_items && sale.sale_items.length > 0 ? (
                      sale.sale_items.map((item) => {
                        const sku = getSKU(item);
                        return (
                          <div key={item.id} className="text-slate-400">
                            • {item.quantity}x {item.item_name} <span className="text-cyan-400 font-mono text-[10px]">({sku})</span> @ ₦{Number(item.unit_price).toLocaleString()}
                          </div>
                        );
                      })
                    ) : (
                      <span className="italic text-slate-500">No item details</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {showExportModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-md text-white shadow-2xl relative space-y-4">
            <button
              onClick={() => setShowExportModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white font-bold text-sm cursor-pointer"
            >
              ✕
            </button>

            <div className="pb-2 border-b border-slate-800">
              <h2 className="font-bold text-sm flex items-center gap-2 text-cyan-400">
                📥 Export Summary Data
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Select your preferred duration range and file format for exporting records.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Duration Range</label>
                <div className="flex gap-2 items-center">
                  <select
                    value={exportDuration}
                    onChange={(e) => {
                      setExportDuration(e.target.value);
                      setExportAnchorDate(new Date());
                    }}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="all">All Time</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="custom">Custom Date Range</option>
                  </select>

                  {['daily', 'weekly', 'monthly'].includes(exportDuration) && (
                    <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 px-2 py-2 rounded-xl text-xs">
                      <button
                        onClick={() => handleShiftDate(exportDuration, 'prev', setExportAnchorDate)}
                        className="text-cyan-400 font-bold hover:text-white px-1"
                        title="Previous"
                      >
                        ←
                      </button>
                      <span className="text-cyan-300 font-mono text-[11px] whitespace-nowrap">
                        {formatDateLabel(exportDuration, exportAnchorDate)}
                      </span>
                      <button
                        onClick={() => handleShiftDate(exportDuration, 'next', setExportAnchorDate)}
                        className="text-cyan-400 font-bold hover:text-white px-1"
                        title="Next"
                      >
                        →
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {exportDuration === 'custom' && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-slate-400 mb-1 text-[11px]">Start Date</label>
                    <input
                      type="date"
                      value={exportCustomStartDate}
                      onChange={(e) => setExportCustomStartDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 text-[11px]">End Date</label>
                    <input
                      type="date"
                      value={exportCustomEndDate}
                      onChange={(e) => setExportCustomEndDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Export Format</label>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as 'pdf' | 'excel')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="pdf">PDF (Print / Print View)</option>
                  <option value="excel">Excel / CSV File</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowExportModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  exportDataFlow(exportDuration, exportFormat, exportCustomStartDate, exportCustomEndDate);
                  setShowExportModal(false);
                }}
                className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition shadow-lg shadow-cyan-950/40 cursor-pointer"
              >
                Confirm Export
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}