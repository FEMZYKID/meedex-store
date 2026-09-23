/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { useProducts } from '../../../hooks/useProducts';
import { useDamagedItems } from '../../../hooks/useDamagedItems';
import { useReturnedItems } from '../../../hooks/useReturnedItems';
import { buildProductSkuMap, buildProductPriceMap, getItemSKU } from '../../../lib/productLookup';
import ReturnItemModal from '@/components/ReturnItemModal';
import type { Sale, SaleItem } from '../../../types';

export default function AdminInventoryIssuesPage() {
  const { products, fetchProducts } = useProducts();
  const { damagedItems, loadingDamaged, fetchDamagedItems } = useDamagedItems();
  const { returnedItems, loadingReturned, fetchReturnedItems } = useReturnedItems();

  useEffect(() => {
    fetchProducts();
    fetchDamagedItems();
    fetchReturnedItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [returnedSearchSKU, setReturnedSearchSKU] = useState('');
  const [returnedStartDate, setReturnedStartDate] = useState('');
  const [returnedEndDate, setReturnedEndDate] = useState('');

  const [damagedSearchSKU, setDamagedSearchSKU] = useState('');
  const [damagedStartDate, setDamagedStartDate] = useState('');
  const [damagedEndDate, setDamagedEndDate] = useState('');

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [searchSaleId, setSearchSaleId] = useState('');
  const [sale, setSale] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [searchingSale, setSearchingSale] = useState(false);
  const [selectedReturnItemId, setSelectedReturnItemId] = useState('');
  const [returnQty, setReturnQty] = useState(1);
  const [returnReason, setReturnReason] = useState('');
  const [restockInventory, setRestockInventory] = useState(true);
  const [processingReturn, setProcessingReturn] = useState(false);

  const productSkuMap = useMemo(() => buildProductSkuMap(products), [products]);
  const productPriceMap = useMemo(() => buildProductPriceMap(products), [products]);

  const getSKU = (item: { product_id?: string; product_name?: string; item_name?: string; sku?: string }) =>
    getItemSKU(item, productSkuMap);

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
        p_sale_id: sale!.id,
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
      fetchReturnedItems();
    } catch (err: any) {
      alert('Failed to process return: ' + err.message);
    } finally {
      setProcessingReturn(false);
    }
  };

  const selectedReturnItem = saleItems.find((i) => i.id === selectedReturnItemId);
  const calculatedRefund = selectedReturnItem ? selectedReturnItem.unit_price * returnQty : 0;

  const filteredReturnedItems = useMemo(() => {
    return returnedItems.filter((item) => {
      const itemSKU = getSKU(item).toLowerCase();
      const skuMatch = !returnedSearchSKU || itemSKU.includes(returnedSearchSKU.trim().toLowerCase());

      const itemDate = new Date(item.created_at).getTime();
      let startMatch = true;
      let endMatch = true;

      if (returnedStartDate) {
        startMatch = itemDate >= new Date(returnedStartDate).getTime();
      }
      if (returnedEndDate) {
        endMatch = itemDate <= new Date(returnedEndDate).setHours(23, 59, 59, 999);
      }

      return skuMatch && startMatch && endMatch;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnedItems, returnedSearchSKU, returnedStartDate, returnedEndDate, productSkuMap]);

  const filteredDamagedItems = useMemo(() => {
    return damagedItems.filter((item) => {
      const itemSKU = getSKU(item).toLowerCase();
      const skuMatch = !damagedSearchSKU || itemSKU.includes(damagedSearchSKU.trim().toLowerCase());

      const itemDate = new Date(item.created_at).getTime();
      let startMatch = true;
      let endMatch = true;

      if (damagedStartDate) {
        startMatch = itemDate >= new Date(damagedStartDate).getTime();
      }
      if (damagedEndDate) {
        endMatch = itemDate <= new Date(damagedEndDate).setHours(23, 59, 59, 999);
      }

      return skuMatch && startMatch && endMatch;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [damagedItems, damagedSearchSKU, damagedStartDate, damagedEndDate, productSkuMap]);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <section className="bg-slate-800 border border-slate-700/80 p-5 rounded-2xl shadow-xl">
          <div className="flex flex-col gap-3 mb-4 pb-3 border-b border-slate-700">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>🔄</span> Returned Items & Refunds Log ({filteredReturnedItems.length})
                </h2>
                <p className="text-xs text-slate-400">Audit trail of customer item returns and refund transactions</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setShowReturnModal(true)}
                  className="text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg transition cursor-pointer"
                >
                  🔄 Process a Return
                </button>
                <button
                  onClick={fetchReturnedItems}
                  className="text-xs bg-slate-900 border border-slate-700 hover:border-amber-500 text-amber-400 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer"
                >
                  ↻ Refresh
                </button>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-700/70 p-2.5 rounded-xl text-xs flex flex-wrap items-center gap-2.5 mt-1">
              <span className="font-bold text-slate-300 flex items-center gap-1 text-[11px]">🔍 Filter:</span>
              <input
                type="text"
                placeholder="SKU..."
                value={returnedSearchSKU}
                onChange={(e) => setReturnedSearchSKU(e.target.value)}
                className="flex-1 min-w-[110px] bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-white text-xs focus:outline-none focus:border-cyan-500"
              />
              <div className="flex items-center gap-1">
                <span className="text-slate-400 text-[11px]">From:</span>
                <input
                  type="date"
                  value={returnedStartDate}
                  onChange={(e) => setReturnedStartDate(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-white text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-400 text-[11px]">To:</span>
                <input
                  type="date"
                  value={returnedEndDate}
                  onChange={(e) => setReturnedEndDate(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-white text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>
              {(returnedSearchSKU || returnedStartDate || returnedEndDate) && (
                <button
                  onClick={() => {
                    setReturnedSearchSKU('');
                    setReturnedStartDate('');
                    setReturnedEndDate('');
                  }}
                  className="text-cyan-400 hover:underline text-[11px] ml-auto"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {loadingReturned ? (
            <div className="text-xs text-slate-500">Loading returned items...</div>
          ) : filteredReturnedItems.length === 0 ? (
            <div className="text-xs text-slate-500 py-6 text-center">No returned items recorded matching filter criteria.</div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {filteredReturnedItems.map((item) => (
                <div key={item.id} className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-white text-sm">{item.product_name}</p>
                      <p className="text-[10px] text-cyan-400 font-mono">SKU: {getSKU(item)}</p>
                    </div>
                    <span className="font-mono font-bold text-amber-400 text-xs">
                      -₦{Number(item.refund_amount).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>
                      Type: <strong className="text-slate-300">{item.item_type}</strong> | Qty:{' '}
                      <strong className="text-slate-300">{item.quantity}</strong>
                    </span>
                    <span>
                      Processed by: <strong className="text-cyan-400">{item.processed_by}</strong>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 bg-slate-950 p-2 rounded-lg border border-slate-800/80 mt-1">
                    <strong className="text-amber-400">Reason:</strong> {item.reason}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono text-right pt-1">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-slate-800 border border-slate-700/80 p-5 rounded-2xl shadow-xl">
          <div className="flex flex-col gap-3 mb-4 pb-3 border-b border-slate-700">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>⚠️</span> Damaged / Write-Off Items Log ({filteredDamagedItems.length})
                </h2>
                <p className="text-xs text-slate-400">Audit trail of items written off due to damages</p>
              </div>
              <button
                onClick={fetchDamagedItems}
                className="text-xs bg-slate-900 border border-slate-700 hover:border-rose-500 text-rose-400 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer shrink-0"
              >
                ↻ Refresh Damaged
              </button>
            </div>

            <div className="bg-slate-900/80 border border-slate-700/70 p-2.5 rounded-xl text-xs flex flex-wrap items-center gap-2.5 mt-1">
              <span className="font-bold text-slate-300 flex items-center gap-1 text-[11px]">🔍 Filter:</span>
              <input
                type="text"
                placeholder="SKU..."
                value={damagedSearchSKU}
                onChange={(e) => setDamagedSearchSKU(e.target.value)}
                className="flex-1 min-w-[110px] bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-white text-xs focus:outline-none focus:border-cyan-500"
              />
              <div className="flex items-center gap-1">
                <span className="text-slate-400 text-[11px]">From:</span>
                <input
                  type="date"
                  value={damagedStartDate}
                  onChange={(e) => setDamagedStartDate(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-white text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-400 text-[11px]">To:</span>
                <input
                  type="date"
                  value={damagedEndDate}
                  onChange={(e) => setDamagedEndDate(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-white text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>
              {(damagedSearchSKU || damagedStartDate || damagedEndDate) && (
                <button
                  onClick={() => {
                    setDamagedSearchSKU('');
                    setDamagedStartDate('');
                    setDamagedEndDate('');
                  }}
                  className="text-cyan-400 hover:underline text-[11px] ml-auto"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {loadingDamaged ? (
            <div className="text-xs text-slate-500">Loading damaged write-offs...</div>
          ) : filteredDamagedItems.length === 0 ? (
            <div className="text-xs text-slate-500 py-6 text-center">No damaged item write-offs recorded matching filter criteria.</div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {filteredDamagedItems.map((item) => {
                const itemPrice = productPriceMap.get(item.product_id) || productPriceMap.get(item.product_name.toLowerCase()) || 0;
                const totalItemValue = itemPrice * item.quantity;

                return (
                  <div key={item.id} className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-white text-sm">{item.product_name}</p>
                        <p className="text-[10px] text-cyan-400 font-mono">SKU: {getSKU(item)}</p>
                      </div>
                      <span className="text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded font-bold uppercase">
                        Written Off
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>
                        Type: <strong className="text-slate-300">{item.item_type}</strong> | Qty:{' '}
                        <strong className="text-rose-400 font-bold">{item.quantity}</strong>
                      </span>
                      <span>
                        Total Value: <strong className="text-rose-400 font-mono">₦{totalItemValue.toLocaleString()}</strong>
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 bg-slate-950 p-2 rounded-lg border border-slate-800/80 mt-1">
                      <strong className="text-rose-400">Damage Comment:</strong> {item.comment}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono text-right pt-1">
                      Reported by: <strong className="text-cyan-400">{item.reported_by}</strong> •{' '}
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

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
    </>
  );
}