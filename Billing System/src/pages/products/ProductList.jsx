import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Eye, Pencil, Trash2, RefreshCw, Download, Printer,
  ToggleLeft, ToggleRight, ArrowUpDown,
} from 'lucide-react';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import SearchBar from '../../components/ui/SearchBar';
import DataTable from '../../components/ui/DataTable';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Pagination from '../../components/ui/Pagination';
import Can from '../../components/auth/Can';
import { usePermission } from '../../hooks/usePermission';
import { useServerList } from '../../hooks/useServerList';
import { useResourceList } from '../../hooks/useResourceList';
import { productsApi, categoriesApi, suppliersApi } from '../../api/masters';
import { settingsApi } from '../../api/ops';
import { getErrorMessage } from '../../api/client';
import { formatCurrency } from '../../utils/helpers';
import { downloadBlob, exportProductsCsv, exportProductsExcel } from '../../utils/productExport';
import ProductFormModal from './ProductFormModal';
import ProductPrintView from './ProductPrintView';

const SORT_OPTIONS = [
  { value: 'name', label: 'Inventory Name' },
  { value: 'code', label: 'Inventory Code' },
  { value: 'purchasePrice', label: 'Purchase Price' },
  { value: 'defaultSellingPrice', label: 'Selling Price' },
  { value: 'currentStock', label: 'Current Stock' },
  { value: 'createdAt', label: 'Created Date' },
];

export default function ProductList() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const { items: categories } = useResourceList(categoriesApi);
  const { items: suppliers } = useResourceList(suppliersApi);

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stockAvailability, setStockAvailability] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [priceField, setPriceField] = useState('selling');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [settings, setSettings] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [printProducts, setPrintProducts] = useState([]);
  const [printing, setPrinting] = useState(false);

  const queryParams = useMemo(() => ({
    search: search || undefined,
    categoryId: categoryId || undefined,
    supplierId: supplierId || undefined,
    isActive: statusFilter || undefined,
    stockAvailability: stockAvailability || undefined,
    minPrice: minPrice !== '' ? minPrice : undefined,
    maxPrice: maxPrice !== '' ? maxPrice : undefined,
    priceField,
    sortBy,
    sortOrder,
  }), [search, categoryId, supplierId, statusFilter, stockAvailability, minPrice, maxPrice, priceField, sortBy, sortOrder]);

  const {
    items: products,
    total,
    page,
    pageSize,
    totalPages,
    loading,
    reload,
    goToPage,
    changePageSize,
    setPage,
  } = useServerList(productsApi, queryParams, [
    search, categoryId, supplierId, statusFilter, stockAvailability,
    minPrice, maxPrice, priceField, sortBy, sortOrder,
  ]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryId, supplierId, statusFilter, stockAvailability, minPrice, maxPrice, priceField, sortBy, sortOrder, setPage]);

  useEffect(() => {
    settingsApi.get().then(setSettings).catch(() => {});
  }, []);

  const handleToggleStatus = async (product) => {
    try {
      await productsApi.updateStatus(product.id, !product.isActive);
      toast.success(product.isActive ? 'Inventory item deactivated' : 'Inventory item activated');
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update status'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await productsApi.remove(deleteTarget.id);
      toast.success('Inventory item deactivated');
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to deactivate inventory item'));
    }
  };

  const fetchAllForExport = async () => {
    const result = await productsApi.list({ ...queryParams, page: 1, pageSize: 10000 });
    return result.items || [];
  };

  const handleExport = async (format) => {
    try {
      const rows = await fetchAllForExport();
      if (!rows.length) {
        toast.warning('No inventory items to export');
        return;
      }
      if (format === 'excel') {
        await exportProductsExcel(rows);
      } else if (format === 'csv') {
        exportProductsCsv(rows);
      } else if (format === 'pdf') {
        setPrintProducts(rows);
        setPrinting(true);
        setTimeout(() => {
          window.print();
          setPrinting(false);
        }, 200);
      } else {
        const blob = await productsApi.exportFile({ ...queryParams, format: 'csv' });
        downloadBlob(blob, 'products.csv');
      }
      toast.success('Export ready');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Export failed'));
    }
  };

  const showActions = can('products.edit') || can('products.delete') || can('products.create');

  const columns = [
    { key: 'code', label: 'Inventory Code', render: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { key: 'barcode', label: 'Barcode', render: (r) => <span className="font-mono text-xs">{r.barcode || '—'}</span> },
    { key: 'name', label: 'Inventory Name', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'category', label: 'Category', render: (r) => r.category?.name || '—' },
    { key: 'brand', label: 'Brand', render: (r) => r.brand || '—' },
    { key: 'supplier', label: 'Supplier', render: (r) => r.supplier?.name || '—' },
    { key: 'purchasePrice', label: 'Purchase Price', render: (r) => formatCurrency(Number(r.purchasePrice ?? 0)) },
    { key: 'sellingPrice', label: 'Selling Price', render: (r) => formatCurrency(Number(r.sellingPrice ?? r.defaultSellingPrice ?? 0)) },
    { key: 'profit', label: 'Profit', render: (r) => <span className="font-medium text-emerald-600">{formatCurrency(Number(r.profit ?? 0))}</span> },
    { key: 'vat', label: 'VAT', render: (r) => `${Number(r.vatPercentage ?? 0)}%` },
    {
      key: 'stock',
      label: 'Stock',
      render: (r) => {
        const stock = r.currentStock ?? 0;
        const low = stock > 0 && stock <= (r.reorderLevel ?? 10);
        const out = stock <= 0;
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            out ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
              : low ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
          }`}
          >
            {out ? 'Out' : low ? `Low (${stock})` : stock}
          </span>
        );
      },
    },
    { key: 'reorderLevel', label: 'Reorder', render: (r) => r.reorderLevel },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
          r.isActive
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400'
            : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
        }`}
        >
          {r.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  if (showActions) {
    columns.push({
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => navigate(`/products/${r.id}`)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800" title="View">
            <Eye className="h-4 w-4" />
          </button>
          <Can permission="products.edit">
            <button onClick={() => { setEditing(r); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800" title="Edit">
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={() => handleToggleStatus(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-amber-600 dark:hover:bg-slate-800" title={r.isActive ? 'Deactivate' : 'Activate'}>
              {r.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
            </button>
          </Can>
          <Can permission="products.delete">
            <button onClick={() => setDeleteTarget(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950" title="Delete">
              <Trash2 className="h-4 w-4" />
            </button>
          </Can>
        </div>
      ),
    });
  }

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="View catalog — stock increases only via GRN (PO → Invoice → GRN)"
        actions={
          <div className="flex flex-wrap gap-2">
            <button onClick={reload} className="btn-secondary" title="Refresh"><RefreshCw className="h-4 w-4" /></button>
            <Can permission="products.view">
              <button onClick={() => handleExport('csv')} className="btn-secondary"><Download className="h-4 w-4" /> Export CSV</button>
              <button onClick={() => handleExport('excel')} className="btn-secondary"><Download className="h-4 w-4" /> Export Excel</button>
              <button onClick={() => handleExport('pdf')} className="btn-secondary"><Printer className="h-4 w-4" /> Print</button>
            </Can>
          </div>
        }
      />

      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
        Inventory stock is updated <strong>only from GRN</strong> after Purchase Order → Purchase Invoice. Use this page to view and edit inventory details — not to add stock.
      </div>

      <div className="glass-card mb-6 space-y-4 p-4">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by inventory code, barcode, or name…"
          className="w-full"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="select-field">
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="select-field">
            <option value="">All Suppliers</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select-field">
            <option value="">All Statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <select value={stockAvailability} onChange={(e) => setStockAvailability(e.target.value)} className="select-field">
            <option value="">All Stock</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
          <div className="flex gap-2">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="select-field flex-1">
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button
              type="button"
              onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
              className="btn-secondary !px-3"
              title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
            >
              <ArrowUpDown className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <select value={priceField} onChange={(e) => setPriceField(e.target.value)} className="select-field">
            <option value="selling">Selling Price Range</option>
            <option value="purchase">Purchase Price Range</option>
          </select>
          <input type="number" min="0" placeholder="Min price" className="input-field" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
          <input type="number" min="0" placeholder="Max price" className="input-field" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
        </div>
      </div>

      <div className="glass-card p-4">
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading inventory…</p>
        ) : (
          <>
            <DataTable columns={columns} data={products} />
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={goToPage}
                totalItems={total}
                itemsPerPage={pageSize}
                pageSize={pageSize}
                onPageSizeChange={changePageSize}
              />
            </div>
          </>
        )}
      </div>

      <ProductFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        categories={categories}
        suppliers={suppliers}
        onSaved={reload}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Deactivate Inventory Item"
        message={`Deactivate "${deleteTarget?.name}"? It will be hidden from active lists but kept for history.`}
        confirmText="Deactivate"
      />

      {printing && <ProductPrintView products={printProducts} settings={settings} forPrint />}
    </div>
  );
}
