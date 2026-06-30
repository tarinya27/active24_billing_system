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
import { suppliersApi } from '../../api/masters';
import { getErrorMessage } from '../../api/client';

const COMPANIES = ['ACTIVE24', 'GENIUS', 'BOTH'];

const emptyForm = { code: '', name: '', contactPerson: '', phone: '', email: '', address: '', city: '', company: 'ACTIVE24' };

export default function SupplierList() {
  const { can } = usePermission();
  const { items: suppliers, loading, reload } = useResourceList(suppliersApi);

  const [companyFilter, setCompanyFilter] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { searchQuery, setSearchQuery, filteredItems } = useSearch(suppliers, ['name', 'code', 'contactPerson', 'phone', 'city']);
  const filtered = useMemo(
    () => filteredItems.filter((s) => companyFilter === 'All' || s.company === companyFilter),
    [filteredItems, companyFilter]
  );
  const { currentPage, totalPages, paginatedItems, goToPage, totalItems, itemsPerPage } = usePagination(filtered);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (supplier) => {
    setEditing(supplier);
    setForm({
      code: supplier.code || '',
      name: supplier.name,
      contactPerson: supplier.contactPerson || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      city: supplier.city || '',
      company: supplier.company,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await suppliersApi.update(editing.id, form);
        toast.success('Supplier updated');
      } else {
        await suppliersApi.create(form);
        toast.success('Supplier created');
      }
      setModalOpen(false);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save supplier'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await suppliersApi.remove(deleteTarget.id);
      toast.success('Supplier deleted');
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete supplier'));
    }
  };

  const showActions = can('suppliers.edit') || can('suppliers.delete');
  const columns = [
    { key: 'code', label: 'Code', render: (r) => <span className="font-mono text-xs">{r.code || '—'}</span> },
    { key: 'name', label: 'Supplier', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'contactPerson', label: 'Contact', render: (r) => r.contactPerson || '—' },
    { key: 'phone', label: 'Phone', render: (r) => r.phone || '—' },
    { key: 'city', label: 'City', render: (r) => r.city || '—' },
    {
      key: 'company',
      label: 'Company',
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
  ];
  if (showActions) {
    columns.push({
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Can permission="suppliers.edit">
            <button onClick={() => openEdit(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800" title="Edit">
              <Pencil className="h-4 w-4" />
            </button>
          </Can>
          <Can permission="suppliers.delete">
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
        title="Suppliers"
        subtitle="Manage suppliers for both companies"
        actions={
          <Can permission="suppliers.create">
            <button onClick={openCreate} className="btn-primary"><Plus className="h-4 w-4" /> Add Supplier</button>
          </Can>
        }
      />

      <div className="glass-card mb-6 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search suppliers..." className="flex-1" />
          <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="select-field !w-auto">
            <option value="All">All Companies</option>
            {COMPANIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="glass-card p-4">
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading suppliers…</p>
        ) : (
          <>
            <DataTable columns={columns} data={paginatedItems} />
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} totalItems={totalItems} itemsPerPage={itemsPerPage} />
            </div>
          </>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Supplier' : 'Add Supplier'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Code</label>
              <input className="input-field" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. SUP-001" />
            </div>
            <div>
              <label className="label">Name *</label>
              <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Supplier name" />
            </div>
            <div>
              <label className="label">Contact Person</label>
              <input className="input-field" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">City</label>
              <input className="input-field" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Address</label>
              <input className="input-field" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <label className="label">Company</label>
              <select className="select-field" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}>
                {COMPANIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
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
        title="Delete Supplier"
        message={`Delete "${deleteTarget?.name}"? This only works if no products or orders reference it.`}
        confirmText="Delete"
      />
    </div>
  );
}
