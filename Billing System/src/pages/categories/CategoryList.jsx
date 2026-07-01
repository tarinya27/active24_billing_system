import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import SearchBar from '../../components/ui/SearchBar';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useResourceList } from '../../hooks/useResourceList';
import { useSearch } from '../../hooks/usePagination';
import { categoriesApi } from '../../api/masters';
import { getErrorMessage } from '../../api/client';

export default function CategoryList() {
  const { items: categories, loading, reload } = useResourceList(categoriesApi);
  const [statusFilter, setStatusFilter] = useState('all');
  const { searchQuery, setSearchQuery, filteredItems } = useSearch(categories, ['name']);

  const visible = useMemo(() => {
    if (statusFilter === 'active') return filteredItems.filter((c) => c.isActive !== false);
    if (statusFilter === 'inactive') return filteredItems.filter((c) => c.isActive === false);
    return filteredItems;
  }, [filteredItems, statusFilter]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setIsActive(true);
    setModalOpen(true);
  };

  const openEdit = (category) => {
    setEditing(category);
    setName(category.name);
    setIsActive(category.isActive !== false);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = { name: name.trim(), isActive };
      if (editing) {
        await categoriesApi.update(editing.id, payload);
        toast.success('Category updated');
      } else {
        await categoriesApi.create(payload);
        toast.success('Category created');
      }
      setModalOpen(false);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save category'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (category) => {
    try {
      await categoriesApi.updateStatus(category.id, !category.isActive);
      toast.success(category.isActive ? 'Category deactivated' : 'Category activated');
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update status'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const result = await categoriesApi.remove(deleteTarget.id);
      toast.success(result.deleted ? 'Category deleted' : 'Category deactivated (has products)');
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete category'));
    }
  };

  const columns = [
    { key: 'name', label: 'Category', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'productCount', label: 'Products', render: (r) => r.productCount ?? 0 },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
          r.isActive !== false
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400'
            : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
        }`}
        >
          {r.isActive !== false ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => openEdit(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800" title="Edit">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => handleToggleStatus(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-slate-800" title={r.isActive !== false ? 'Deactivate' : 'Activate'}>
            {r.isActive !== false ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
          </button>
          <button onClick={() => setDeleteTarget(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950" title="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle="Organize products — categories must exist before adding products"
        actions={<button onClick={openCreate} className="btn-primary"><Plus className="h-4 w-4" /> Add Category</button>}
      />

      <div className="glass-card mb-6 p-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search categories..." className="flex-1" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select-field !w-auto">
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="glass-card p-4">
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading categories…</p>
        ) : (
          <DataTable columns={columns} data={visible} />
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Category' : 'Add Category'} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Category Name *</label>
            <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Networking" autoFocus />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="select-field" value={isActive ? 'active' : 'inactive'} onChange={(e) => setIsActive(e.target.value === 'active')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">{saving ? 'Saving…' : editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Category"
        message={`Delete "${deleteTarget?.name}"? If products use it, the category will be deactivated instead.`}
        confirmText="Delete"
      />
    </div>
  );
}
