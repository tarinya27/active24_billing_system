import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import SearchBar from '../../components/ui/SearchBar';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Pagination from '../../components/ui/Pagination';
import Can from '../../components/auth/Can';
import { usePermission } from '../../hooks/usePermission';
import { usePagination, useSearch } from '../../hooks/usePagination';
import { useResourceList } from '../../hooks/useResourceList';
import { productsApi, categoriesApi, suppliersApi } from '../../api/masters';
import { getErrorMessage } from '../../api/client';
import { formatCurrency } from '../../utils/helpers';

const COMPANIES = ['ACTIVE24', 'GENIUS', 'BOTH'];

const emptyForm = {
  code: '',
  name: '',
  description: '',
  categoryId: '',
  company: 'ACTIVE24',
  defaultSellingPrice: 0,
  reorderLevel: 10,
  supplierId: '',
  isActive: true,
};

export default function ProductList() {
  const { can } = usePermission();
  const { items: products, loading, reload } = useResourceList(productsApi);
  const { items: categories } = useResourceList(categoriesApi);
  const { items: suppliers } = useResourceList(suppliersApi);

  const [categoryFilter, setCategoryFilter] = useState('All');
  const [companyFilter, setCompanyFilter] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { searchQuery, setSearchQuery, filteredItems } = useSearch(products, ['name', 'code', 'description']);
  const filtered = useMemo(
    () =>
      filteredItems.filter((p) => {
        if (categoryFilter !== 'All' && p.category?.id !== categoryFilter) return false;
        if (companyFilter !== 'All' && p.company !== companyFilter) return false;
        return true;
      }),
    [filteredItems, categoryFilter, companyFilter]
  );

  const { currentPage, totalPages, paginatedItems, goToPage, totalItems, itemsPerPage } = usePagination(filtered);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (product) => {
    setEditing(product);
    setForm({
      code: product.code,
      name: product.name,
      description: product.description || '',
      categoryId: product.category?.id || product.categoryId || '',
      company: product.company,
      defaultSellingPrice: Number(product.defaultSellingPrice),
      reorderLevel: product.reorderLevel,
      supplierId: product.supplier?.id || product.supplierId || '',
      isActive: product.isActive,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      toast.error('Code and name are required');
      return;
    }
    const payload = {
      ...form,
      categoryId: form.categoryId || null,
      supplierId: form.supplierId || null,
      defaultSellingPrice: Number(form.defaultSellingPrice) || 0,
      reorderLevel: Number(form.reorderLevel) || 0,
    };
    setSaving(true);
    try {
      if (editing) {
        await productsApi.update(editing.id, payload);
        toast.success('Product updated');
      } else {
        await productsApi.create(payload);
        toast.success('Product created');
      }
      setModalOpen(false);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save product'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await productsApi.remove(deleteTarget.id);
      toast.success('Product deactivated');
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to deactivate product'));
    }
  };

  const showActions = can('products.edit') || can('products.delete');
  const columns = [
    { key: 'code', label: 'Code', render: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { key: 'name', label: 'Product Name', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'category', label: 'Category', render: (r) => r.category?.name || '—' },
    {
      key: 'company',
      label: 'Source',
      render: (r) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            r.company === 'GENIUS'
              ? 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-400'
              : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
          }`}
        >
          {r.company}
        </span>
      ),
    },
    { key: 'defaultSellingPrice', label: 'Default Price', render: (r) => formatCurrency(Number(r.defaultSellingPrice)) },
    { key: 'reorderLevel', label: 'Reorder', render: (r) => r.reorderLevel },
    { key: 'supplier', label: 'Supplier', render: (r) => r.supplier?.name || '—' },
    {
      key: 'isActive',
      label: 'Status',
      render: (r) => (
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
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
          <Can permission="products.edit">
            <button onClick={() => openEdit(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800" title="Edit">
              <Pencil className="h-4 w-4" />
            </button>
          </Can>
          <Can permission="products.delete">
            <button onClick={() => setDeleteTarget(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950" title="Deactivate">
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
        title="Products"
        subtitle="Manage the product catalog"
        actions={
          <Can permission="products.create">
            <button onClick={openCreate} className="btn-primary"><Plus className="h-4 w-4" /> Add Product</button>
          </Can>
        }
      />

      <div className="glass-card mb-6 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search products..." className="flex-1" />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="select-field !w-auto">
            <option value="All">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="select-field !w-auto">
            <option value="All">All Sources</option>
            {COMPANIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="glass-card p-4">
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading products…</p>
        ) : (
          <>
            <DataTable columns={columns} data={paginatedItems} />
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} totalItems={totalItems} itemsPerPage={itemsPerPage} />
            </div>
          </>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Product' : 'Add Product'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Code *</label>
              <input className="input-field" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. ACC-MSE-001" />
            </div>
            <div>
              <label className="label">Name *</label>
              <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Product name" />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input-field" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Category</label>
              <select className="select-field" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">— None —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Source Company</label>
              <select className="select-field" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}>
                {COMPANIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Default Selling Price (LKR)</label>
              <input type="number" min="0" step="0.01" className="input-field" value={form.defaultSellingPrice} onChange={(e) => setForm({ ...form, defaultSellingPrice: e.target.value })} />
            </div>
            <div>
              <label className="label">Reorder Level</label>
              <input type="number" min="0" className="input-field" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Supplier</label>
              <select className="select-field" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
                <option value="">— None —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          {editing && (
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
              Active
            </label>
          )}
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">{saving ? 'Saving…' : editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Deactivate Product"
        message={`Deactivate "${deleteTarget?.name}"? It will be hidden from active lists but kept for history.`}
        confirmText="Deactivate"
      />
    </div>
  );
}
