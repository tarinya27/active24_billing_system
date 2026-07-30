import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import { grnsApi } from '../../api/procurement';
import { getErrorMessage } from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { calcGrnAutoSellingPrice } from '../../utils/pricing';
import { usePermission } from '../../hooks/usePermission';

export default function GRNEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canAny } = usePermission();
  const canEditDescription = canAny('grn.edit_description');
  const canSetPrice = canAny('grn.set_price');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [grnNumber, setGrnNumber] = useState('');
  const [receivedDate, setReceivedDate] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([]);

  useEffect(() => {
    if (!canAny('grn.edit_description', 'grn.set_price')) {
      toast.error('You do not have permission to edit GRNs');
      navigate(`/grn/${id}`, { replace: true });
      return;
    }

    let cancelled = false;
    grnsApi.get(id)
      .then((grn) => {
        if (cancelled) return;
        if (grn.status === 'CANCELLED') {
          toast.error('Cancelled GRNs cannot be edited');
          navigate(`/grn/${id}`, { replace: true });
          return;
        }
        setGrnNumber(grn.grnNumber);
        setReceivedDate(grn.receivedDate);
        setSupplierName(grn.supplier?.name || '');
        setNotes(grn.notes || '');
        setLines((grn.items || []).map((item) => ({
          id: item.id,
          productCode: item.product?.code || '',
          productName: item.product?.name || '',
          categoryName: item.category?.name || '',
          units: item.units,
          purchasePrice: Number(item.purchasePrice) || 0,
          description: item.description || '',
          sellingPriceMode: item.sellingPriceMode || 'AUTO',
          sellingPrice: Number(item.sellingPrice) || 0,
        })));
      })
      .catch((err) => {
        toast.error(getErrorMessage(err, 'Failed to load GRN'));
        navigate('/grn', { replace: true });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [id]);

  const updateLine = (lineId, patch) => {
    setLines((prev) => prev.map((line) => {
      if (line.id !== lineId) return line;
      const next = { ...line, ...patch };
      if (patch.sellingPriceMode === 'AUTO' || (patch.purchasePrice === undefined && next.sellingPriceMode === 'AUTO' && patch.sellingPrice === undefined)) {
        if (patch.sellingPriceMode === 'AUTO') {
          next.sellingPrice = calcGrnAutoSellingPrice(next.purchasePrice);
        }
      }
      return next;
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {};
      if (canEditDescription) payload.notes = notes.trim() || null;
      payload.items = lines.map((line) => {
        const item = { id: line.id };
        if (canEditDescription) item.description = line.description.trim() || null;
        if (canSetPrice) {
          item.sellingPriceMode = line.sellingPriceMode;
          item.sellingPrice = Number(line.sellingPrice) || 0;
        }
        return item;
      });

      await grnsApi.update(id, payload);
      toast.success('GRN updated');
      navigate(`/grn/${id}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update GRN'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="py-16 text-center text-slate-500">Loading…</p>;

  return (
    <div>
      <PageHeader
        title={`Edit ${grnNumber}`}
        subtitle={`${supplierName || 'Supplier'} • Received ${formatDate(receivedDate)}`}
        actions={
          <Link to={`/grn/${id}`} className="btn-secondary">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {canEditDescription && (
          <div className="glass-card space-y-3 p-6">
            <label className="label">Notes</label>
            <textarea
              className="input-field"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
            />
          </div>
        )}

        <div className="glass-card p-6">
          <h3 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-100">Received Items</h3>
          <div className="space-y-4">
            {lines.map((line) => (
              <div
                key={line.id}
                className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-900/40"
              >
                <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">
                      {line.categoryName || 'Uncategorized'}
                    </p>
                    <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                      {line.productName || '—'}
                      {line.productCode ? (
                        <span className="ml-2 font-mono text-xs font-normal text-slate-500">{line.productCode}</span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {line.units} unit{line.units === 1 ? '' : 's'} · Purchase {formatCurrency(line.purchasePrice)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {canEditDescription && (
                    <div className="md:col-span-2">
                      <label className="label">Item Description</label>
                      <input
                        className="input-field"
                        value={line.description}
                        onChange={(e) => updateLine(line.id, { description: e.target.value })}
                        placeholder="Description shown on GRN"
                      />
                    </div>
                  )}

                  {canSetPrice && (
                    <>
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
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link to={`/grn/${id}`} className="btn-secondary">Cancel</Link>
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
