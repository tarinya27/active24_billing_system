import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import CustomerSearchSelect from '../../components/billing/CustomerSearchSelect';
import { estimatesApi } from '../../api/technical';
import { getErrorMessage } from '../../api/client';
import { useCustomers } from '../../context/CustomersContext';

export default function EstimateForm() {
  const navigate = useNavigate();
  const { customers } = useCustomers();
  const [form, setForm] = useState({ customerId: '', description: '', amount: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customerId) {
      toast.error('Select a customer');
      return;
    }
    setSaving(true);
    try {
      const created = await estimatesApi.create({
        customerId: form.customerId,
        description: form.description.trim() || null,
        notes: form.notes.trim() || null,
        amount: Number(form.amount || 0),
      });
      toast.success(`Estimate ${created.estimateNumber} created`);
      navigate('/technical/estimate-history');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save estimate'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Estimates"
        subtitle="Create a job estimate for a customer"
      />
      <form onSubmit={handleSubmit} className="glass-card max-w-3xl space-y-4 p-6">
        <div>
          <label className="label">Customer *</label>
          <CustomerSearchSelect
            customers={customers}
            value={form.customerId}
            onChange={(customerId) => setForm((prev) => ({ ...prev, customerId }))}
          />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea
            className="input-field min-h-[120px] resize-y"
            rows={5}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Describe the estimate. Press Enter for a new line."
          />
        </div>
        <div>
          <label className="label">Amount (LKR)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input-field max-w-xs"
            value={form.amount}
            onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea
            className="input-field min-h-[80px] resize-y"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => navigate('/technical/estimate-history')}>
            View history
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save estimate'}
          </button>
        </div>
      </form>
    </div>
  );
}
