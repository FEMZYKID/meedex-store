'use client';

import type { Sale } from '../types';

interface ReceiptFlowProps {
  showCustomerInputModal: boolean;
  onCloseCustomerInput: () => void;
  customerNameInput: string;
  onCustomerNameChange: (value: string) => void;
  onSubmitCustomerName: (e: React.FormEvent) => void;

  showReceiptModal: boolean;
  onCloseReceipt: () => void;
  selectedReceiptSale: Sale | null;
  currentReceiptCustomerName: string;
}

export default function ReceiptFlow({
  showCustomerInputModal,
  onCloseCustomerInput,
  customerNameInput,
  onCustomerNameChange,
  onSubmitCustomerName,
  showReceiptModal,
  onCloseReceipt,
  selectedReceiptSale,
  currentReceiptCustomerName,
}: ReceiptFlowProps) {
  return (
    <>
      {showCustomerInputModal && selectedReceiptSale && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-md text-white shadow-2xl relative">
            <button
              onClick={onCloseCustomerInput}
              className="absolute top-4 right-4 text-slate-400 hover:text-white font-bold text-sm cursor-pointer"
            >
              ✕
            </button>

            <h2 className="font-bold text-sm text-cyan-400 mb-1 flex items-center gap-2">
              🧾 Customer Details for Receipt
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Enter the customer&apos;s name before generating the printable thermal receipt.
            </p>

            <form onSubmit={onSubmitCustomerName} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Customer Full Name</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. John Doe (Leave empty for 'Valued Customer')"
                  value={customerNameInput}
                  onChange={(e) => onCustomerNameChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer shadow-lg shadow-cyan-950"
              >
                Generate Small Receipt →
              </button>
            </form>
          </div>
        </div>
      )}

      {showReceiptModal && selectedReceiptSale && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl w-full max-w-xs text-white shadow-2xl relative">
            <button
              onClick={onCloseReceipt}
              className="absolute top-3 right-3 text-slate-400 hover:text-white font-bold text-sm cursor-pointer"
            >
              ✕
            </button>

            <div id="thermal-receipt" className="bg-white text-black p-4 rounded-lg font-mono text-[11px] leading-tight shadow-inner space-y-3">
              <div className="text-center pb-2 border-b border-dashed border-black">
                <h2 className="font-black text-sm uppercase tracking-wider">DEPRINCE TECHNOLOGIES</h2>
                <p className="text-[9px] italic">Gadgets. Innovation. Solutions</p>
                <p className="text-[9px] mt-1">Official Sales Receipt</p>
              </div>

              <div className="space-y-0.5 text-[10px]">
                <p><strong>Date:</strong> {new Date(selectedReceiptSale.created_at).toLocaleString()}</p>
                <p><strong>Receipt/Sale ID:</strong></p>
                <p className="text-[9px] font-bold break-all">{selectedReceiptSale.id}</p>
                <p><strong>Cashier:</strong> {selectedReceiptSale.cashier_name}</p>
                <p><strong>Customer:</strong> {currentReceiptCustomerName}</p>
                <p><strong>Payment Method:</strong> {selectedReceiptSale.payment_method}</p>
              </div>

              <table className="w-full text-left border-t border-b border-dashed border-black py-2 my-2">
                <thead>
                  <tr className="border-b border-slate-300 text-[10px]">
                    <th className="py-1">Item</th>
                    <th className="text-center py-1">Qty</th>
                    <th className="text-right py-1">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReceiptSale.sale_items && selectedReceiptSale.sale_items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="py-1 max-w-[120px] truncate">{item.item_name}</td>
                      <td className="text-center py-1">{item.quantity}</td>
                      <td className="text-right py-1">₦{Number(item.subtotal).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-center font-bold text-xs pt-1">
                <span>TOTAL PAID:</span>
                <span>₦{Number(selectedReceiptSale.total_amount).toLocaleString()}</span>
              </div>

              <div className="text-center pt-2 border-t border-dashed border-black text-[9px] space-y-1">
                <p>Thank you for shopping with us!</p>
                <p>Keep receipt for items return/warranty.</p>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2 rounded-xl text-xs transition cursor-pointer"
              >
                🖨️ Print Receipt
              </button>
              <button
                onClick={onCloseReceipt}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}