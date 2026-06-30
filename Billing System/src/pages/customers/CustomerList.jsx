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
import { customersApi } from '../../api/masters';
import { getErrorMessage } from '../../api/client';

const TYPES = [
  { value: 'WALK_IN', label: 'Walk-in' },
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'BUSINESS', label: 'Business' },
  { value: 'CORPORATE', label: 'Corporate' },
];
const typeLabel = (v) => TYPES.find((t) => t.value === v)?.label || v;

const emptyForm = { name: '', mobile: '', address: '', email: '', type: 'WALK_IN' };

export default function CustomerList() {
  const { can } = usePermission();
  const { items: customers, loading, reload } = useResourceList(customersApi);

  const [typeFilter, setTypeFilter] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { searchQuery, setSearchQuery, filteredItems } = useSearch(customers, ['name', 'mobile', 'email']);
  const filtered = useMemo(
    () => filteredItems.filter((c) => typeFilter === 'All' || c.type === typeFilter),
    [filteredItems, typeFilter]
  );
  const { currentPage, totalPages, paginatedItems, goToPage, totalItems, itemsPerPage } = usePagination(filtered);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (customer) => {
    setEditing(customer);
    setForm({
      name: customer.name,
      mobile: customer.mobile || '',
      address: customer.address || '',
      email: customer.email || '',
      type: customer.type,
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
        await customersApi.update(editing.id, form);
        toast.success('Customer updated');
      } else {
        await customersApi.create(form);
        toast.success('Customer created');
      }
      setModalOpen(false);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save customer'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await customersApi.remove(deleteTarget.id);
      toast.success('Customer deleted');
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete customer'));
    }
  };

  const showActions = can('customers.edit') || can('customers.delete');
  const columns = [
    { key: 'name', label: 'Customer', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'mobile', label: 'Mobile', render: (r) => r.mobile || '—' },
    { key: 'email', label: 'Email', render: (r) => r.email || '—' },
    { key: 'type', label: 'Type', render: (r) => (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{typeLabel(r.type)}</span>
    ) },
  ];
  if (showActions) {
    columns.push({
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Can permission="customers.edit">
            <button onClick={() => openEdit(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800" title="Edit">
              <Pencil className="h-4 w-4" />
            </button>
          </Can>
          <Can permission="customers.delete">
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
        title="Customers"
        subtitle="Manage your customer base"
        actions={
          <Can permission="customers.create">
            <button onClick={openCreate} className="btn-primary"><Plus className="h-4 w-4" /> Add Customer</button>
          </Can>
        }
      />

      <div className="glass-card mb-6 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search customers..." className="flex-1" />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="select-field !w-auto">
            <option value="All">All Types</option>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="glass-card p-4">
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading customers…</p>
        ) : (
          <>
            <DataTable columns={columns} data={paginatedItems} />
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} totalItems={totalItems} itemsPerPage={itemsPerPage} />
            </div>
          </>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Customer' : 'Add Customer'} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Customer name" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Mobile</label>
              <input className="input-field" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <input className="input-field" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="select-field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
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
        title="Delete Customer"
        message={`Delete "${deleteTarget?.name}"? This only works if they have no invoices.`}
        confirmText="Delete"
      />
    </div>
  );
}
