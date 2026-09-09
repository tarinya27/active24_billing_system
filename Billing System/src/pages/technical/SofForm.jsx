import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import CustomerSearchSelect from '../../components/billing/CustomerSearchSelect';
import { sofApi } from '../../api/technical';
import { getErrorMessage } from '../../api/client';
import { useCustomers } from '../../context/CustomersContext';

export default function SofForm() {
  const navigate = useNavigate();
  const { customers } = useCustomers();
  const [form, setForm] = useState({ customerId: '', description: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customerId) {
      toast.error('Select a customer');
      return;
    }
    setSaving(true);
    try {
      const created = await sofApi.create({
        customerId: form.customerId,
        description: form.description.trim() || null,
        notes: form.notes.trim() || null,
      });
      toast.success(`Service order ${created.sofNumber} created`);
      navigate('/technical/sof-history');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save service order'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Service Order Form (SOF)"
        subtitle="Create a service order for a customer"
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
            placeholder="Describe the job. Press Enter for a new line."
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
          <button type="button" className="btn-secondary" onClick={() => navigate('/technical/sof-history')}>
            View history
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save SOF'}
          </button>
        </div>
      </form>
    </div>
  );
}
