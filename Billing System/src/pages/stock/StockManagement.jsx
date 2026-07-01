import { useState, useEffect, useCallback } from 'react';
import { History, Package, AlertTriangle } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import SearchBar from '../../components/ui/SearchBar';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Drawer from '../../components/ui/Drawer';
import Pagination from '../../components/ui/Pagination';
import { stockApi } from '../../api/ops';
import { getErrorMessage } from '../../api/client';
import { usePermission } from '../../hooks/usePermission';
import { usePagination } from '../../hooks/usePagination';
import { formatCurrency, formatDateTime } from '../../utils/helpers';
import { PO_COMPANY, PO_COMPANY_LABEL } from '../../utils/poConstants';
import { toast } from 'react-toastify';

export default function StockManagement() {
  const { can } = usePermission();
  const canAdjust = can('stock.adjust');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productUnits, setProductUnits] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [movements, setMovements] = useState([]);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const data = await stockApi.summary({
        search: searchQuery || undefined,
        status: statusFilter !== 'All' ? statusFilter : undefined,
        company: PO_COMPANY,
      });
      setItems(data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    const t = setTimeout(loadSummary, 300);
    return () => clearTimeout(t);
  }, [loadSummary]);

  const loadUnits = async (productId) => {
    try {
      const result = await stockApi.listUnits({ productId, status: 'IN_STOCK', pageSize: 100 });
      setProductUnits(result.items || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const loadMovements = async () => {
    try {
      const result = await stockApi.movements({ pageSize: 50 });
      setMovements(result.items || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleRowClick = (row) => {
    setSelectedProduct(row);
    loadUnits(row.productId);
  };

  const handleAdjust = async (unitId) => {
    if (!window.confirm('Void this unit from stock? This cannot be undone.')) return;
    try {
      await stockApi.adjust(unitId, 'Manual stock adjustment');
      toast.success('Unit voided');
      if (selectedProduct) loadUnits(selectedProduct.productId);
      loadSummary();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const { currentPage, totalPages, paginatedItems, goToPage, totalItems, itemsPerPage } = usePagination(items);

  const columns = [
    { key: 'code', label: 'Code', render: (row) => <span className="font-mono text-xs">{row.code}</span> },
    { key: 'name', label: 'Product Name', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'category', label: 'Category' },
    { key: 'quantity', label: 'Units In Stock', render: (row) => <span className="font-semibold">{row.quantity}</span> },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Stock Management"
        subtitle="Serialized inventory — quantities are in-stock unit counts"
        actions={
          <button
            type="button"
            onClick={() => { setShowHistory(true); loadMovements(); }}
            className="btn-secondary"
          >
            <History className="h-4 w-4" /> Movement History
          </button>
        }
      />

      <div className="glass-card mb-6 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search stock..." className="flex-1" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select-field !w-auto">
            <option value="All">All Statuses</option>
            <option value="In Stock">In Stock</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>
          <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
            {PO_COMPANY_LABEL}
          </span>
        </div>
      </div>

      <div className="glass-card p-4">
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-400">Loading stock…</p>
        ) : (
          <>
            <DataTable columns={columns} data={paginatedItems} onRowClick={handleRowClick} />
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} totalItems={totalItems} itemsPerPage={itemsPerPage} />
            </div>
          </>
        )}
      </div>

      <Drawer isOpen={Boolean(selectedProduct)} onClose={() => setSelectedProduct(null)} title="Serialized Units">
        {selectedProduct && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary-50 p-3 dark:bg-primary-950"><Package className="h-6 w-6 text-primary-600" /></div>
              <div>
                <h3 className="font-semibold">{selectedProduct.name}</h3>
                <p className="text-xs text-slate-500">{selectedProduct.code} • {selectedProduct.quantity} in stock</p>
              </div>
            </div>
            {productUnits.length === 0 ? (
              <p className="text-sm text-slate-500">No in-stock units for this product.</p>
            ) : (
              <div className="space-y-2">
                {productUnits.map((u) => (
                  <div key={u.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                    <div>
                      <p className="font-mono text-xs">{u.barcode}</p>
                      <p className="text-xs text-slate-500">Sell: {formatCurrency(Number(u.sellingPrice))}</p>
                    </div>
                    {canAdjust && (
                      <button type="button" onClick={() => handleAdjust(u.id)} className="btn-secondary !px-2 !py-1 !text-xs text-red-600">
                        <AlertTriangle className="h-3 w-3" /> Void
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Drawer>

      <Drawer isOpen={showHistory} onClose={() => setShowHistory(false)} title="Stock Movement History">
        <div className="space-y-3">
          {movements.length === 0 ? (
            <p className="text-sm text-slate-500">No movements recorded yet.</p>
          ) : (
            movements.map((t) => (
              <div key={t.id} className="rounded-xl border border-slate-100 p-4 dark:border-slate-800">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">{t.product?.name}</p>
                    <p className="text-xs text-slate-500">{t.type} • {t.reference || '—'}</p>
                    {t.productUnit?.barcode && <p className="font-mono text-[10px] text-slate-400">{t.productUnit.barcode}</p>}
                  </div>
                  <span className={`text-sm font-bold ${t.quantity > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {t.quantity > 0 ? '+' : ''}{t.quantity}
                  </span>
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                  <span>{t.user?.name || 'System'}</span>
                  <span>{formatDateTime(t.createdAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Drawer>
    </div>
  );
}
