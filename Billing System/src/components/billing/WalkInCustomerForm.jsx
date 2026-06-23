import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { toast } from 'react-toastify';

const emptyForm = { name: '', mobile: '', address: '' };

export default function WalkInCustomerForm({ onSave }) {
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Customer name is required');
      return;
    }
    if (!form.mobile.trim()) {
      toast.error('Mobile number is required');
      return;
    }

    onSave({
      name: form.name.trim(),
      mobile: form.mobile.trim(),
      address: form.address.trim() || '—',
      type: 'Walk-in',
    });
    setForm(emptyForm);
    setShowForm(false);
  };

  return (
    <div className="rounded-lg border border-primary-200 bg-primary-50/60 p-3 dark:border-primary-900 dark:bg-primary-950/30">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-primary-800 dark:text-primary-300">Walk-in Customer</p>
          <p className="mt-0.5 text-[11px] text-primary-700/80 dark:text-primary-400/80">
            Register details to save this customer to your customer base.
          </p>
        </div>
        {!showForm && (
          <button type="button" onClick={() => setShowForm(true)} className="btn-primary !px-3 !py-1.5 !text-xs shrink-0">
            <UserPlus className="h-3.5 w-3.5" /> Add New
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-3 space-y-2 border-t border-primary-200/60 pt-3 dark:border-primary-800">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">Customer Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field !py-2 !text-xs"
              placeholder="e.g. Mr. Ravi Perera"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">Mobile Number *</label>
            <input
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              className="input-field !py-2 !text-xs"
              placeholder="e.g. +94 77 123 4567"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">Address</label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="input-field !py-2 !text-xs"
              placeholder="Customer address (optional)"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => { setShowForm(false); setForm(emptyForm); }} className="btn-secondary flex-1 !py-2 !text-xs">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1 !py-2 !text-xs">
              Save to Customer Base
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
