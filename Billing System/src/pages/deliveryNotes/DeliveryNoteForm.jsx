import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import ProductSearchSelect from '../../components/ui/ProductSearchSelect';
import { deliveryNotesApi } from '../../api/procurement';
import { productsApi, suppliersApi, customersApi } from '../../api/masters';
import { getErrorMessage } from '../../api/client';
import { calcGrnAutoSellingPrice } from '../../utils/pricing';
import { formatCurrency } from '../../utils/helpers';

const emptyLine = () => ({
  productId: '',
  description: '',
  purchasePrice: 0,
  units: 1,
  sellingPriceMode: 'AUTO',
  sellingPrice: 0,
  warrantyMonths: '',
});

export default function DeliveryNoteForm() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
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
      productsApi.list({ pageSize: 500, isActive: 'true' }),
    ])
      .then(([s, c, p]) => {
        setSuppliers(s.items || []);
        setCustomers(c.items || c || []);
        setProducts(p.items || []);
      })
      .catch(() => toast.error('Failed to load form data'));
  }, []);

  const updateLine = (index, patch) => {
    const lines = [...form.lines];
    lines[index] = { ...lines[index], ...patch };
    if (patch.productId) {
      const product = products.find((p) => p.id === patch.productId);
      if (product) {
        const purchasePrice = Number(product.purchasePrice || 0);
        lines[index].description = product.name;
        lines[index].purchasePrice = purchasePrice;
        if (lines[index].sellingPriceMode === 'AUTO') {
          lines[index].sellingPrice = calcGrnAutoSellingPrice(purchasePrice);
        }
      }
    }
    if (patch.purchasePrice !== undefined || patch.sellingPriceMode !== undefined) {
      if (lines[index].sellingPriceMode === 'AUTO') {
        lines[index].sellingPrice = calcGrnAutoSellingPrice(lines[index].purchasePrice);
      }
    }
    setForm({ ...form, lines });
  };

  const totals = useMemo(() => {
    const units = form.lines.reduce((s, l) => s + (Number(l.units) || 0), 0);
    const purchase = form.lines.reduce(
      (s, l) => s + (Number(l.purchasePrice) || 0) * (Number(l.units) || 0),
      0
    );
    return { units, purchase };
  }, [form.lines]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplierId) {
      toast.error('Select a supplier');
      return;
    }
    if (form.lines.some((l) => !l.productId || !l.units)) {
      toast.error('Complete all product lines');
      return;
    }

    setSaving(true);
    try {
      const dn = await deliveryNotesApi.create({
        supplierId: form.supplierId,
        customerId: form.customerId || null,
        notes: form.notes,
        lines: form.lines.map((l) => ({
          productId: l.productId,
          description: l.description,
          purchasePrice: Number(l.purchasePrice),
          units: Number(l.units),
          sellingPriceMode: l.sellingPriceMode,
          sellingPrice: l.sellingPriceMode === 'MANUAL' ? Number(l.sellingPrice) : undefined,
          warrantyMonths: l.warrantyMonths === '' || l.warrantyMonths == null
            ? null
            : Number(l.warrantyMonths),
        })),
      });
      toast.success('Delivery note created — scan barcodes to stock in');
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
        subtitle="Add products, then scan barcodes on the next screen to stock inventory"
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
              <div key={index} className="rounded-xl border border-slate-100 p-4 dark:border-slate-800">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
                  <div className="xl:col-span-2">
                    <label className="label">Product</label>
                    <ProductSearchSelect
                      products={products}
                      value={line.productId}
                      onChange={(id) => updateLine(index, { productId: id })}
                    />
                  </div>
                  <div className="xl:col-span-2">
                    <label className="label">Description</label>
                    <input
                      className="input-field"
                      value={line.description}
                      onChange={(e) => updateLine(index, { description: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Qty</label>
                    <input
                      type="number"
                      min="1"
                      className="input-field"
                      value={line.units}
                      onChange={(e) => updateLine(index, { units: parseInt(e.target.value, 10) || 1 })}
                    />
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
          <button type="submit" className="btn-primary" disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Create & Scan'}
          </button>
        </div>
      </form>
    </div>
  );
}
