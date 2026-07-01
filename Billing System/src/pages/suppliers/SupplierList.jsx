import { useState } from 'react';
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
import { PO_COMPANY, PO_COMPANY_LABEL } from '../../utils/poConstants';

const emptyForm = {
  name: '',
  vatRate: 0,
  vatRegistrationNo: '',
  contactPerson: '',
  phone: '',
  address: '',
  company: PO_COMPANY,
};

export default function SupplierList() {
  const { can } = usePermission();
  const { items: suppliers, loading, reload } = useResourceList(suppliersApi, { company: PO_COMPANY });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { searchQuery, setSearchQuery, filteredItems } = useSearch(suppliers, [
    'name', 'contactPerson', 'phone', 'address', 'vatRegistrationNo',
  ]);
  const { currentPage, totalPages, paginatedItems, goToPage, totalItems, itemsPerPage } = usePagination(filteredItems);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (supplier) => {
    setEditing(supplier);
    setForm({
      name: supplier.name,
      vatRate: Number(supplier.vatRate ?? 0),
      vatRegistrationNo: supplier.vatRegistrationNo || '',
      contactPerson: supplier.contactPerson || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      company: PO_COMPANY,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Company name is required');
      return;
    }
    if (form.vatRate === '' || Number(form.vatRate) < 0) {
      toast.error('VAT percentage is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        vatRate: Number(form.vatRate),
        company: PO_COMPANY,
      };
      if (editing) {
        await suppliersApi.update(editing.id, payload);
        toast.success('Supplier updated');
      } else {
        await suppliersApi.create(payload);
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
    { key: 'name', label: 'Company Name', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'contactPerson', label: 'Contact Person', render: (r) => r.contactPerson || '—' },
    { key: 'phone', label: 'Telephone', render: (r) => r.phone || '—' },
    { key: 'vatRate', label: 'VAT %', render: (r) => `${Number(r.vatRate ?? 0)}%` },
    { key: 'address', label: 'Address', render: (r) => r.address || '—' },
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
        subtitle={`Manage suppliers for ${PO_COMPANY_LABEL}`}
        actions={
          <Can permission="suppliers.create">
            <button onClick={openCreate} className="btn-primary"><Plus className="h-4 w-4" /> Add Supplier</button>
          </Can>
        }
      />

      <div className="glass-card mb-6 p-4">
        <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search suppliers..." className="max-w-xl" />
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

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Supplier' : 'New Supplier'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              className="input-field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. IT Gallery Computers (Pvt) Ltd"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                VAT Percentage <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                className="input-field"
                value={form.vatRate}
                onChange={(e) => setForm({ ...form, vatRate: e.target.value })}
                required
              />
              <p className="mt-1 text-xs text-slate-500">e.g. 18, 20 or 0 (no VAT)</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">VAT Registration No.</label>
              <input
                className="input-field"
                value={form.vatRegistrationNo}
                onChange={(e) => setForm({ ...form, vatRegistrationNo: e.target.value })}
                placeholder="optional"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Contact Person</label>
              <input
                className="input-field"
                value={form.contactPerson}
                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                placeholder="e.g. Dilantha"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Telephone</label>
              <input
                className="input-field"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="e.g. 011 234 5678"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Address</label>
            <input
              className="input-field"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="optional"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Supplier'}
            </button>
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
