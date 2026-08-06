import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import { deliveryNotesApi } from '../../api/procurement';
import { getErrorMessage } from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { calcGrnAutoSellingPrice } from '../../utils/pricing';

export default function DeliveryNoteEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dnNumber, setDnNumber] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([]);

  useEffect(() => {
    let cancelled = false;
    deliveryNotesApi.get(id)
      .then((dn) => {
        if (cancelled) return;
        if (dn.status === 'CANCELLED') {
          toast.error('Cancelled delivery notes cannot be edited');
          navigate(`/delivery-notes/${id}`, { replace: true });
          return;
        }
        setDnNumber(dn.dnNumber);
        setCreatedAt(dn.createdAt);
        setSupplierName(dn.supplier?.name || '');
        setNotes(dn.notes || '');
        setLines((dn.items || []).map((item) => ({
          id: item.id,
          productCode: item.product?.code || '',
          categoryName: item.category?.name || '',
          description: item.description || '',
          purchasePrice: Number(item.purchasePrice) || 0,
          sellingPriceMode: item.sellingPriceMode || 'AUTO',
          sellingPrice: Number(item.sellingPrice) || 0,
          units: Number(item.units) || 0,
        })));
      })
      .catch((err) => {
        toast.error(getErrorMessage(err, 'Failed to load delivery note'));
        navigate('/delivery-notes', { replace: true });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [id, navigate]);

  const updateLine = (lineId, patch) => {
    setLines((prev) => prev.map((line) => {
      if (line.id !== lineId) return line;
      const next = { ...line, ...patch };
      if (patch.sellingPriceMode === 'AUTO') {
        next.sellingPrice = calcGrnAutoSellingPrice(next.purchasePrice);
      }
      return next;
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await deliveryNotesApi.update(id, {
        notes: notes.trim() || null,
        items: lines.map((line) => ({
          id: line.id,
          description: line.description.trim() || null,
          sellingPriceMode: line.sellingPriceMode,
          sellingPrice: Number(line.sellingPrice) || 0,
        })),
      });
      toast.success('Delivery note updated');
      navigate(`/delivery-notes/${id}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update delivery note'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="py-16 text-center text-slate-500">Loading…</p>;

  return (
    <div>
      <PageHeader
        title={`Edit ${dnNumber}`}
        subtitle={`${supplierName || 'Supplier'} • Created ${formatDate(createdAt)}`}
        actions={(
          <Link to={`/delivery-notes/${id}`} className="btn-secondary">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        )}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="glass-card space-y-3 p-6">
          <label className="label">Remarks</label>
          <textarea
            className="input-field"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Shown on the printed delivery note"
          />
        </div>

        <div className="glass-card p-6">
          <h3 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-100">Items</h3>
          <div className="space-y-4">
            {lines.map((line) => (
              <div key={line.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-900/40">
                <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">
                      {line.categoryName || 'Uncategorized'}
                    </p>
                    <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                      {line.productCode || 'Item'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {line.units} unit{line.units === 1 ? '' : 's'} · Purchase {formatCurrency(line.purchasePrice)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="label">Description</label>
                    <input
                      className="input-field"
                      value={line.description}
                      onChange={(e) => updateLine(line.id, { description: e.target.value })}
                      placeholder="Item description"
                    />
                  </div>

                  <div>
                    <label className="label">Selling Price Mode</label>
                    <select
                      className="select-field"
                      value={line.sellingPriceMode}
                      onChange={(e) => updateLine(line.id, { sellingPriceMode: e.target.value })}
                    >
                      <option value="AUTO">Auto (Purchase × 1.30)</option>
                      <option value="MANUAL">Manual</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">Selling Price</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input-field"
                      value={line.sellingPrice}
                      disabled={line.sellingPriceMode === 'AUTO'}
                      onChange={(e) => updateLine(line.id, {
                        sellingPriceMode: 'MANUAL',
                        sellingPrice: e.target.value,
                      })}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link to={`/delivery-notes/${id}`} className="btn-secondary">Cancel</Link>
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
