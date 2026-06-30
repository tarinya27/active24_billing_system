import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import { purchaseInvoicesApi, purchaseOrdersApi } from '../../api/procurement';
import { productsApi, suppliersApi } from '../../api/masters';
import { getErrorMessage } from '../../api/client';
import { formatCurrency } from '../../utils/helpers';

function calcPreview(items, purchaseWithVat, vatRate) {
  let subtotal = 0;
  let vatAmount = 0;
  items.forEach((item) => {
    const line = (Number(item.unitPrice) || 0) * (Number(item.units) || 0);
    subtotal += line;
    if (purchaseWithVat && vatRate > 0) vatAmount += line - line / (1 + vatRate / 100);
    else if (!purchaseWithVat && vatRate > 0) vatAmount += line * (vatRate / 100);
  });
  const total = purchaseWithVat ? subtotal : subtotal + vatAmount;
  return { subtotal, vatAmount, total };
}

export default function PurchaseInvoiceForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillPoId = searchParams.get('poId');

  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supplierInvoiceNo: '',
    poId: prefillPoId || '',
    supplierId: '',
    company: 'ACTIVE24',
    purchaseWithVat: false,
    vatRate: 0,
    items: [{ productId: '', unitPrice: 0, units: 1 }],
  });

  useEffect(() => {
    Promise.all([
      suppliersApi.list({ pageSize: 200 }),
      productsApi.list({ pageSize: 200, isActive: 'true' }),
    ]).then(([s, p]) => {
      setSuppliers(s.items || []);
      setProducts(p.items || []);
    }).catch(() => toast.error('Failed to load masters'));
  }, []);

  useEffect(() => {
    if (!prefillPoId) return;
    purchaseOrdersApi.get(prefillPoId).then((po) => {
      setForm((f) => ({
        ...f,
        poId: po.id,
        supplierId: po.supplierId,
        company: po.company,
        items: po.items.map((i) => ({
          productId: i.productId,
          unitPrice: Number(i.costPrice),
          units: i.quantity,
        })),
      }));
    }).catch(() => {});
  }, [prefillPoId]);

  const totals = useMemo(() => calcPreview(form.items, form.purchaseWithVat, Number(form.vatRate)), [form]);

  const updateItem = (index, field, value) => {
    const items = [...form.items];
    items[index] = { ...items[index], [field]: value };
    if (field === 'productId') {
      const product = products.find((p) => p.id === value);
      if (product) items[index].unitPrice = Number(product.defaultSellingPrice) * 0.65;
    }
    setForm({ ...form, items });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplierId) { toast.error('Select a supplier'); return; }
    if (form.items.some((i) => !i.productId || !i.units)) { toast.error('Complete all line items'); return; }

    setSaving(true);
    try {
      const invoice = await purchaseInvoicesApi.create({
        ...form,
        poId: form.poId || null,
        items: form.items.map((i) => ({
          productId: i.productId,
          unitPrice: Number(i.unitPrice),
          units: Number(i.units),
        })),
      });
      toast.success('Purchase invoice saved');
      navigate(`/purchase-invoices/${invoice.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save invoice'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Purchase Invoice Entry" subtitle="Record supplier invoice before GRN" actions={
        <button onClick={() => navigate('/purchase-invoices')} className="btn-secondary"><ArrowLeft className="h-4 w-4" /> Back</button>
      } />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="glass-card grid grid-cols-1 gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label">Supplier Invoice No.</label>
            <input className="input-field" value={form.supplierInvoiceNo} onChange={(e) => setForm({ ...form, supplierInvoiceNo: e.target.value })} placeholder="Supplier ref" />
          </div>
          <div>
            <label className="label">Supplier *</label>
            <select className="select-field" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} required>
              <option value="">Select supplier</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Company</label>
            <select className="select-field" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}>
              <option value="ACTIVE24">ACTIVE24</option>
              <option value="GENIUS">GENIUS</option>
              <option value="BOTH">BOTH</option>
            </select>
          </div>
          <div>
            <label className="label">Linked PO</label>
            <input className="input-field" value={form.poId} onChange={(e) => setForm({ ...form, poId: e.target.value })} placeholder="PO id (optional)" />
          </div>
          <div>
            <label className="label">VAT Rate (%)</label>
            <input type="number" min="0" step="0.01" className="input-field" value={form.vatRate} onChange={(e) => setForm({ ...form, vatRate: e.target.value })} />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.purchaseWithVat} onChange={(e) => setForm({ ...form, purchaseWithVat: e.target.checked })} className="h-4 w-4 rounded" />
              Purchase with VAT? (unit prices include VAT)
            </label>
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Line Items</h3>
            <button type="button" onClick={() => setForm({ ...form, items: [...form.items, { productId: '', unitPrice: 0, units: 1 }] })} className="btn-secondary !py-2 !text-xs"><Plus className="h-3.5 w-3.5" /> Add Line</button>
          </div>
          <div className="space-y-3">
            {form.items.map((item, index) => (
              <div key={index} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-100 p-4 md:grid-cols-12 dark:border-slate-800">
                <div className="md:col-span-5">
                  <select className="select-field" value={item.productId} onChange={(e) => updateItem(index, 'productId', e.target.value)}>
                    <option value="">Select product</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <input type="number" min="0" step="0.01" className="input-field" placeholder="Unit price" value={item.unitPrice} onChange={(e) => updateItem(index, 'unitPrice', e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <input type="number" min="1" className="input-field" placeholder="Units" value={item.units} onChange={(e) => updateItem(index, 'units', e.target.value)} />
                </div>
                <div className="md:col-span-2 flex items-center font-medium">{formatCurrency((Number(item.unitPrice) || 0) * (Number(item.units) || 0))}</div>
                <div className="md:col-span-1 flex items-center">
                  {form.items.length > 1 && (
                    <button type="button" onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== index) })} className="text-red-500"><Trash2 className="h-4 w-4" /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card flex flex-col gap-2 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-600 dark:text-slate-300">
            <p>Subtotal: <strong>{formatCurrency(totals.subtotal)}</strong></p>
            <p>VAT: <strong>{formatCurrency(totals.vatAmount)}</strong></p>
            <p className="text-lg">Total: <strong className="text-primary-600">{formatCurrency(totals.total)}</strong></p>
          </div>
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60"><Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save Invoice'}</button>
        </div>
      </form>
    </div>
  );
}
