import { useMemo, useState } from 'react';
import { Plus, Pencil, UserX } from 'lucide-react';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import SearchBar from '../../components/ui/SearchBar';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Pagination from '../../components/ui/Pagination';
import Can from '../../components/auth/Can';
import { useAuth } from '../../context/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import { usePagination, useSearch } from '../../hooks/usePagination';
import { useResourceList } from '../../hooks/useResourceList';
import { usersApi } from '../../api/masters';
import { getErrorMessage } from '../../api/client';
import { formatDate } from '../../utils/helpers';

const ROLES = ['MANAGER', 'ADMIN', 'CASHIER'];
const roleClasses = {
  MANAGER: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-400',
  ADMIN: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  CASHIER: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
};

const emptyForm = { name: '', email: '', password: '', role: 'CASHIER', isActive: true };

export default function UserList() {
  const { user: currentUser } = useAuth();
  const { can } = usePermission();
  const { items: users, loading, reload } = useResourceList(usersApi);

  const [roleFilter, setRoleFilter] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { searchQuery, setSearchQuery, filteredItems } = useSearch(users, ['name', 'email']);
  const filtered = useMemo(
    () => filteredItems.filter((u) => roleFilter === 'All' || u.role === roleFilter),
    [filteredItems, roleFilter]
  );
  const { currentPage, totalPages, paginatedItems, goToPage, totalItems, itemsPerPage } = usePagination(filtered);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role, isActive: u.isActive });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    if (!editing && form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const payload = { name: form.name, email: form.email, role: form.role, isActive: form.isActive };
        if (form.password) payload.password = form.password;
        await usersApi.update(editing.id, payload);
        toast.success('User updated');
      } else {
        await usersApi.create({ name: form.name, email: form.email, password: form.password, role: form.role });
        toast.success('User created');
      }
      setModalOpen(false);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save user'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await usersApi.remove(deleteTarget.id);
      toast.success('User deactivated');
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to deactivate user'));
    }
  };

  const showActions = can('users.edit') || can('users.delete');
  const columns = [
    { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'email', label: 'Email', render: (r) => <span className="text-slate-500">{r.email}</span> },
    {
      key: 'role',
      label: 'Role',
      render: (r) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleClasses[r.role] || ''}`}>{r.role}</span>,
    },
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
    { key: 'createdAt', label: 'Created', render: (r) => formatDate(r.createdAt) },
  ];
  if (showActions) {
    columns.push({
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Can permission="users.edit">
            <button onClick={() => openEdit(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800" title="Edit">
              <Pencil className="h-4 w-4" />
            </button>
          </Can>
          <Can permission="users.delete">
            {r.id !== currentUser?.id && r.isActive && (
              <button onClick={() => setDeleteTarget(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950" title="Deactivate">
                <UserX className="h-4 w-4" />
              </button>
            )}
          </Can>
        </div>
      ),
    });
  }

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Manage system users and their roles"
        actions={
          <Can permission="users.create">
            <button onClick={openCreate} className="btn-primary"><Plus className="h-4 w-4" /> Add User</button>
          </Can>
        }
      />

      <div className="glass-card mb-6 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search users..." className="flex-1" />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="select-field !w-auto">
            <option value="All">All Roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="glass-card p-4">
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading users…</p>
        ) : (
          <>
            <DataTable columns={columns} data={paginatedItems} />
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} totalItems={totalItems} itemsPerPage={itemsPerPage} />
            </div>
          </>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit User' : 'Add User'} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
          </div>
          <div>
            <label className="label">Email *</label>
            <input type="email" className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@active24.lk" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">{editing ? 'New Password' : 'Password *'}</label>
              <input type="password" className="input-field" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editing ? 'Leave blank to keep current' : 'Min 6 characters'} />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="select-field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
          {editing && (
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                disabled={editing.id === currentUser?.id}
                className="h-4 w-4 rounded border-slate-300 disabled:opacity-50"
              />
              Active {editing.id === currentUser?.id && <span className="text-xs text-slate-400">(you cannot deactivate yourself)</span>}
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
        title="Deactivate User"
        message={`Deactivate "${deleteTarget?.name}"? They will no longer be able to sign in.`}
        confirmText="Deactivate"
      />
    </div>
  );
}
