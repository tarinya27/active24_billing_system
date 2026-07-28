import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import BarcodeInput from '../../components/ui/BarcodeInput';
import { deliveryNotesApi } from '../../api/procurement';
import { categoriesApi, suppliersApi, customersApi } from '../../api/masters';
import { getErrorMessage } from '../../api/client';
import { calcGrnAutoSellingPrice } from '../../utils/pricing';
import { formatCurrency } from '../../utils/helpers';

const emptyLine = () => ({
  categoryId: '',
  description: '',
  purchasePrice: 0,
  sellingPriceMode: 'AUTO',
  sellingPrice: 0,
  warrantyMonths: '',
  barcodes: [],
});

export default function DeliveryNoteForm() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supplierId: '',
    customerId: '',
    notes: '',
    lines: [emptyLine()],
  });

  useEffect(() => {
    Promise.all([
      suppliersApi.list({ pageSize: 200, isActive: 'true' }),
      customersApi.list({ pageSize: 200 }),
      categoriesApi.list({ isActive: 'true' }),
    ])
      .then(([s, c, cats]) => {
        setSuppliers(s.items || []);
        setCustomers(c.items || c || []);
        const list = Array.isArray(cats) ? cats : cats?.items || [];
        setCategories(list.filter((cat) => cat.isActive !== false));
      })
      .catch(() => toast.error('Failed to load form data'));
  }, []);

  const updateLine = (index, patch) => {
    const lines = [...form.lines];
    lines[index] = { ...lines[index], ...patch };
    if (patch.purchasePrice !== undefined || patch.sellingPriceMode !== undefined) {
      if (lines[index].sellingPriceMode === 'AUTO') {
        lines[index].sellingPrice = calcGrnAutoSellingPrice(lines[index].purchasePrice);
      }
    }
    setForm({ ...form, lines });
  };

  const allScannedBarcodes = useMemo(
    () => form.lines.flatMap((l) => l.barcodes),
    [form.lines]
  );

  const handleScanBarcode = (lineIndex, raw) => {
    const barcode = String(raw || '').trim();
    if (!barcode) return;

    const line = form.lines[lineIndex];
    if (!line?.categoryId) {
      toast.error('Select an item (category) before scanning barcodes');
      return;
    }
    if (!String(line.description || '').trim()) {
      toast.error('Enter a description before scanning barcodes');
      return;
    }
    if (line.barcodes.includes(barcode)) {
      toast.error('Barcode already scanned on this line');
      return;
    }
    if (allScannedBarcodes.includes(barcode)) {
      toast.error('Barcode already scanned on another line');
      return;
    }

    const lines = [...form.lines];
    lines[lineIndex] = {
      ...line,
      barcodes: [...line.barcodes, barcode],
    };
    setForm({ ...form, lines });
    toast.success(`Scanned ${barcode}`);
  };

  const removeBarcode = (lineIndex, barcode) => {
    const lines = [...form.lines];
    lines[lineIndex] = {
      ...lines[lineIndex],
      barcodes: lines[lineIndex].barcodes.filter((b) => b !== barcode),
    };
    setForm({ ...form, lines });
  };

  const totals = useMemo(() => {
    const units = form.lines.reduce((s, l) => s + l.barcodes.length, 0);
    const purchase = form.lines.reduce(
      (s, l) => s + (Number(l.purchasePrice) || 0) * l.barcodes.length,
      0
    );
    return { units, purchase };
  }, [form.lines]);

  const readyToSave = form.lines.length > 0
    && form.lines.every((l) => l.categoryId && String(l.description || '').trim() && l.barcodes.length > 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplierId) {
      toast.error('Select a supplier');
      return;
    }
    if (!readyToSave) {
      toast.error('Select item, enter description, and scan at least one barcode on every line');
      return;
    }

    setSaving(true);
    try {
      const dn = await deliveryNotesApi.create({
        supplierId: form.supplierId,
        customerId: form.customerId || null,
        notes: form.notes,
        lines: form.lines.map((l) => ({
          categoryId: l.categoryId,
          description: String(l.description).trim(),
          purchasePrice: Number(l.purchasePrice),
          units: l.barcodes.length,
          barcodes: l.barcodes,
          sellingPriceMode: l.sellingPriceMode,
          sellingPrice: l.sellingPriceMode === 'MANUAL' ? Number(l.sellingPrice) : undefined,
          warrantyMonths: l.warrantyMonths === '' || l.warrantyMonths == null
            ? null
            : Number(l.warrantyMonths),
        })),
      });
      toast.success('Delivery note created — stock updated and ready to invoice');
      navigate(`/delivery-notes/${dn.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to create delivery note'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="New Delivery Note"
        subtitle="Choose item category, describe the goods, scan barcodes — stock is added for billing"
        actions={
          <Link to="/delivery-notes" className="btn-secondary">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="glass-card grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
          <div>
            <label className="label">Supplier <span className="text-red-500">*</span></label>
            <select
              className="select-field"
              value={form.supplierId}
              onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
              required
            >
              <option value="">-- Select supplier --</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Customer (optional — for later invoicing)</label>
            <select
              className="select-field"
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
            >
              <option value="">-- Select later --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Notes</label>
            <input
              className="input-field"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </section>

        <section className="glass-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Items</h2>
            <button
              type="button"
              className="btn-secondary !py-2 !text-sm"
              onClick={() => setForm({ ...form, lines: [...form.lines, emptyLine()] })}
            >
              <Plus className="h-4 w-4" /> Add Line
            </button>
          </div>

          <div className="space-y-4">
            {form.lines.map((line, index) => (
              <div key={index} className="space-y-4 rounded-xl border border-slate-100 p-4 dark:border-slate-800">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
                  <div className="xl:col-span-2">
                    <label className="label">Item <span className="text-red-500">*</span></label>
                    <select
                      className="select-field"
                      value={line.categoryId}
                      onChange={(e) => updateLine(index, { categoryId: e.target.value })}
                      required
                    >
                      <option value="">-- Select category --</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="xl:col-span-2">
                    <label className="label">Description <span className="text-red-500">*</span></label>
                    <input
                      className="input-field"
                      value={line.description}
                      onChange={(e) => updateLine(index, { description: e.target.value })}
                      placeholder="e.g. Apple MacBook Pro M4 Laptop Computer"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Qty (from scans)</label>
                    <p className="input-field bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
                      {line.barcodes.length}
                    </p>
                  </div>
                  <div>
                    <label className="label">Purchase Price</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input-field"
                      value={line.purchasePrice}
                      onChange={(e) => updateLine(index, { purchasePrice: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Sell Mode</label>
                    <select
                      className="select-field"
                      value={line.sellingPriceMode}
                      onChange={(e) => updateLine(index, { sellingPriceMode: e.target.value })}
                    >
                      <option value="AUTO">Auto (×1.30)</option>
                      <option value="MANUAL">Manual</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Selling Price</label>
                    {line.sellingPriceMode === 'MANUAL' ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="input-field"
                        value={line.sellingPrice}
                        onChange={(e) => updateLine(index, { sellingPrice: e.target.value })}
                      />
                    ) : (
                      <p className="input-field bg-emerald-50 font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                        {formatCurrency(line.sellingPrice)}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="label">Warranty (Months)</label>
                    <input
                      type="number"
                      min="1"
                      className="input-field"
                      value={line.warrantyMonths}
                      onChange={(e) => updateLine(index, { warrantyMonths: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="flex items-end">
                    {form.lines.length > 1 && (
                      <button
                        type="button"
                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        onClick={() => setForm({ ...form, lines: form.lines.filter((_, i) => i !== index) })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/30">
                  <div className="mb-2">
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-white">
                      Scan barcodes <span className="text-red-500">*</span>
                    </h4>
                    <p className="text-xs text-slate-500">
                      Each scan is one stock unit for inventory and billing.
                    </p>
                  </div>
                  <BarcodeInput
                    onScan={(value) => handleScanBarcode(index, value)}
                    placeholder={
                      line.categoryId && String(line.description || '').trim()
                        ? 'Scan or enter unit barcode…'
                        : 'Select item and enter description first…'
                    }
                    clearOnScan
                    disabled={!line.categoryId || !String(line.description || '').trim()}
                  />
                  <div className="mt-3">
                    {line.barcodes.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500 dark:border-slate-700">
                        No barcodes scanned yet for this item.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {line.barcodes.map((barcode) => (
                          <span
                            key={barcode}
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-mono text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                          >
                            {barcode}
                            <button
                              type="button"
                              onClick={() => removeBarcode(index, barcode)}
                              className="text-emerald-600 hover:text-red-600"
                              aria-label={`Remove ${barcode}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-4 text-sm dark:border-slate-800">
            <p>Total units: <strong>{totals.units}</strong></p>
            <p>Purchase total: <strong>{formatCurrency(totals.purchase)}</strong></p>
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => navigate('/delivery-notes')}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving || !readyToSave}>
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Create DN & Stock In'}
          </button>
        </div>
      </form>
    </div>
  );
}
