'use client';

import type { Sale, SaleItem } from '../types';

interface ReturnItemModalProps {
  show: boolean;
  onClose: () => void;
  onSearchSale: (e: React.FormEvent) => void;
  searchSaleId: string;
  onSearchSaleIdChange: (value: string) => void;
  searchingSale: boolean;
  sale: Sale | null;
  onProcessReturn: (e: React.FormEvent) => void;
  saleItems: SaleItem[];
  selectedReturnItemId: string;
  onSelectReturnItem: (id: string) => void;
  selectedReturnItem: SaleItem | undefined;
  returnQty: number;
  onReturnQtyChange: (qty: number) => void;
  restockInventory: boolean;
  onRestockChange: (checked: boolean) => void;
  returnReason: string;
  onReturnReasonChange: (value: string) => void;
  calculatedRefund: number;
  processingReturn: boolean;
}

export default function ReturnItemModal({
  show,
  onClose,
  onSearchSale,
  searchSaleId,
  onSearchSaleIdChange,
  searchingSale,
  sale,
  onProcessReturn,
  saleItems,
  selectedReturnItemId,
  onSelectReturnItem,
  selectedReturnItem,
  returnQty,
  onReturnQtyChange,
  restockInventory,
  onRestockChange,
  returnReason,
  onReturnReasonChange,
  calculatedRefund,
  processingReturn,
}: ReturnItemModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-lg text-white shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white font-bold text-sm cursor-pointer"
        >
          ✕
        </button>

        <div className="pb-3 mb-4 border-b border-slate-800">
          <h2 className="font-bold text-sm flex items-center gap-2 text-cyan-400">
            🔄 Item Return & Refund Processing
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Search previous transactions to return items and update inventory levels.
          </p>
        </div>

        <form onSubmit={onSearchSale} className="flex gap-2 mb-4">
          <input
            type="text"
            required
            placeholder="Enter Sale ID / Receipt UUID..."
            value={searchSaleId}
            onChange={(e) => onSearchSaleIdChange(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={searchingSale}
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs transition cursor-pointer"
          >
            {searchingSale ? 'Searching...' : 'Find Sale'}
          </button>
        </form>

        {sale && (
          <form onSubmit={onProcessReturn} className="space-y-4 border-t border-slate-800 pt-4">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Sale Date: {new Date(sale.created_at).toLocaleString()}</span>
                <span>Cashier: {sale.cashier_name}</span>
              </div>
              <div className="flex justify-between font-semibold text-slate-200">
                <span>Payment: {sale.payment_method}</span>
                <span className="text-emerald-400 font-mono">
                  Total Paid: ₦{Number(sale.total_amount).toLocaleString()}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Select Item to Return *</label>
              <select
                required
                value={selectedReturnItemId}
                onChange={(e) => {
                  onSelectReturnItem(e.target.value);
                  onReturnQtyChange(1);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="">-- Choose Item from Receipt --</option>
                {saleItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.item_name} ({item.item_type}) — Qty: {item.quantity} — ₦{item.unit_price} each
                  </option>
                ))}
              </select>
            </div>

            {selectedReturnItemId && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Return Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    max={selectedReturnItem?.quantity || 1}
                    required
                    value={returnQty}
                    onChange={(e) => onReturnQtyChange(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-slate-300 text-[11px] bg-slate-950 p-2.5 border border-slate-800 rounded-xl w-full cursor-pointer">
                    <input
                      type="checkbox"
                      checked={restockInventory}
                      onChange={(e) => onRestockChange(e.target.checked)}
                      className="accent-cyan-500 rounded"
                    />
                    <span>Restock to Inventory?</span>
                  </label>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-amber-400 mb-1">
                Compulsory Return Reason *
              </label>
              <textarea
                required
                rows={2}
                value={returnReason}
                onChange={(e) => onReturnReasonChange(e.target.value)}
                placeholder="e.g., Wrong model purchased, customer changed mind, factory defect..."
                className="w-full bg-slate-950 border border-amber-500/40 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
              <span className="text-xs text-slate-400 font-medium">Refund Amount to Customer:</span>
              <span className="text-lg font-black font-mono text-cyan-400">
                ₦{calculatedRefund.toLocaleString()}
              </span>
            </div>

            <button
              type="submit"
              disabled={processingReturn}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl text-xs transition shadow-lg shadow-amber-950/40 cursor-pointer"
            >
              {processingReturn ? 'Completing...' : 'Complete'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}