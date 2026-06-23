import { useState } from 'react';
import { History, Package } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import SearchBar from '../../components/ui/SearchBar';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Drawer from '../../components/ui/Drawer';
import Pagination from '../../components/ui/Pagination';
import { useApp } from '../../context/AppContext';
import { usePagination, useSearch } from '../../hooks/usePagination';
import { formatCurrency, getStockStatus } from '../../utils/helpers';

export default function StockManagement() {
  const { products, stockTransfers } = useApp();
  const [statusFilter, setStatusFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const { searchQuery, setSearchQuery, filteredItems: searched } = useSearch(products, ['name', 'code', 'barcode', 'category', 'source']);

  const enriched = searched.map((p) => ({ ...p, status: getStockStatus(p.quantity, p.reorderLevel) }));
  const filtered = enriched.filter((p) => {
    if (statusFilter !== 'All' && p.status !== statusFilter) return false;
    if (sourceFilter !== 'All' && p.source !== sourceFilter) return false;
    return true;
  });

  const { currentPage, totalPages, paginatedItems, goToPage, totalItems, itemsPerPage } = usePagination(filtered);

  const columns = [
    { key: 'code', label: 'Code', render: (row) => <span className="font-mono text-xs">{row.code}</span> },
    { key: 'barcode', label: 'Barcode', render: (row) => <span className="font-mono text-xs text-slate-500">{row.barcode}</span> },
    { key: 'name', label: 'Product Name', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'category', label: 'Category' },
    { key: 'quantity', label: 'Qty', render: (row) => <span className="font-semibold">{row.quantity}</span> },
    { key: 'costPrice', label: 'Cost', render: (row) => formatCurrency(row.costPrice) },
    { key: 'sellingPrice', label: 'Sell', render: (row) => formatCurrency(row.sellingPrice) },
    { key: 'source', label: 'Source', render: (row) => (
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${row.source === 'Genius' ? 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-400' : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400'}`}>{row.source}</span>
    )},
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <div>
      <PageHeader title="Stock Management" subtitle="Monitor inventory levels and stock movements" actions={
        <button onClick={() => setShowHistory(true)} className="btn-secondary"><History className="h-4 w-4" /> Transfer History</button>
      } />

      <div className="glass-card mb-6 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search stock..." className="flex-1" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select-field !w-auto">
            <option value="All">All Statuses</option>
            <option value="In Stock">In Stock</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="select-field !w-auto">
            <option value="All">All Sources</option>
            <option value="Genius">Genius</option>
            <option value="Active24">Active24</option>
          </select>
        </div>
      </div>

      <div className="glass-card p-4">
        <DataTable columns={columns} data={paginatedItems} onRowClick={setSelectedProduct} />
        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} totalItems={totalItems} itemsPerPage={itemsPerPage} />
        </div>
      </div>

      <Drawer isOpen={Boolean(selectedProduct)} onClose={() => setSelectedProduct(null)} title="Product Details">
        {selectedProduct && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary-50 p-3 dark:bg-primary-950"><Package className="h-6 w-6 text-primary-600" /></div>
              <div>
                <h3 className="font-semibold">{selectedProduct.name}</h3>
                <p className="text-xs text-slate-500">{selectedProduct.code}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Barcode', selectedProduct.barcode],
                ['Category', selectedProduct.category],
                ['Quantity', selectedProduct.quantity],
                ['Cost Price', formatCurrency(selectedProduct.costPrice)],
                ['Selling Price', formatCurrency(selectedProduct.sellingPrice)],
                ['Source', selectedProduct.source],
                ['Reorder Level', selectedProduct.reorderLevel],
                ['Status', selectedProduct.status || getStockStatus(selectedProduct.quantity, selectedProduct.reorderLevel)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="font-medium">{typeof value === 'string' && value.includes('Stock') ? <StatusBadge status={value} /> : value}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-500">{selectedProduct.description}</p>
          </div>
        )}
      </Drawer>

      <Drawer isOpen={showHistory} onClose={() => setShowHistory(false)} title="Stock Transfer History">
        <div className="space-y-3">
          {stockTransfers.map((t) => (
            <div key={t.id} className="rounded-xl border border-slate-100 p-4 dark:border-slate-800">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium">{t.productName}</p>
                  <p className="text-xs text-slate-500">{t.type} • {t.reference}</p>
                </div>
                <span className={`text-sm font-bold ${t.quantity > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {t.quantity > 0 ? '+' : ''}{t.quantity}
                </span>
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                <span>{t.from} → {t.to}</span>
                <span>{new Date(t.date).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </Drawer>
    </div>
  );
}
