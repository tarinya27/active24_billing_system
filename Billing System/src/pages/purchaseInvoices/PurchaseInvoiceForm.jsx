import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Save } from 'lucide-react';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import PurchaseInvoiceLineTable from '../../components/purchaseInvoices/PurchaseInvoiceLineTable';
import { purchaseInvoicesApi, purchaseOrdersApi } from '../../api/procurement';
import { productsApi, suppliersApi } from '../../api/masters';
import { getErrorMessage } from '../../api/client';
import { formatCurrency } from '../../utils/helpers';
import { calcPurchaseInvoiceTotals } from '../../utils/pricing';

const COMPANY = 'ACTIVE24';
const VAT_RATE = 18;

const emptyLine = () => ({ productId: '', description: '', unitPrice: 0, units: 1 });

export default function PurchaseInvoiceForm() {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const [searchParams] = useSearchParams();
  const prefillPoId = searchParams.get('poId');
  const isEdit = Boolean(editId);

  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supplierInvoiceNo: '',
    poId: prefillPoId || '',
    supplierId: '',
    vatEnabled: true,
    items: [emptyLine()],
  });

  useEffect(() => {
    Promise.all([
      suppliersApi.list({ pageSize: 200, isActive: 'true' }),
      productsApi.list({ pageSize: 500, isActive: 'true' }),
    ]).then(([s, p]) => {
      setSuppliers(s.items || []);
      setProducts(p.items || []);
    }).catch(() => toast.error('Failed to load masters'));
  }, []);

  useEffect(() => {
    if (!isEdit || !editId) return;
    setLoading(true);
    purchaseInvoicesApi.get(editId).then((inv) => {
      if (inv.grn) toast.warning('This invoice has a GRN — editing may be blocked');
      setForm({
        supplierInvoiceNo: inv.supplierInvoiceNo || '',
        poId: inv.poId || '',
        supplierId: inv.supplierId,
        vatEnabled: inv.vatEnabled ?? (Number(inv.vatRate) > 0 && !inv.purchaseWithVat),
        items: inv.items.map((i) => ({
          productId: i.productId,
          description: i.description || i.product?.name || '',
          unitPrice: Number(i.unitPrice),
          units: i.units,
        })),
      });
    }).catch((err) => toast.error(getErrorMessage(err, 'Failed to load invoice')))
      .finally(() => setLoading(false));
  }, [editId, isEdit]);

  useEffect(() => {
    if (!prefillPoId || isEdit) return;
    purchaseOrdersApi.get(prefillPoId).then((po) => {
      setForm((f) => ({
        ...f,
        poId: po.id,
        supplierId: po.supplierId,
        items: po.items.map((i) => ({
          productId: i.productId,
          description: i.product?.name || '',
          unitPrice: Number(i.costPrice),
          units: i.quantity,
        })),
      }));
    }).catch(() => {});
  }, [prefillPoId, isEdit]);

  const totals = useMemo(
    () => calcPurchaseInvoiceTotals(form.items, form.vatEnabled, VAT_RATE),
    [form.items, form.vatEnabled]
  );

  const updateItem = (index, field, value) => {
    const items = [...form.items];
    items[index] = { ...items[index], [field]: value };
    if (field === 'productId') {
      const product = products.find((p) => p.id === value);
      if (product) {
        items[index].unitPrice = Number(product.purchasePrice ?? product.defaultSellingPrice * 0.65);
        if (!items[index].description) items[index].description = product.name;
      }
    }
    setForm({ ...form, items });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplierId) { toast.error('Select a supplier'); return; }
    if (form.items.some((i) => !i.productId || !i.units)) { toast.error('Complete all line items'); return; }

    const payload = {
      supplierInvoiceNo: form.supplierInvoiceNo,
      poId: form.poId || null,
      supplierId: form.supplierId,
      company: COMPANY,
      vatEnabled: form.vatEnabled,
      purchaseWithVat: false,
      vatRate: form.vatEnabled ? VAT_RATE : 0,
      items: form.items.map((i) => ({
        productId: i.productId,
        description: i.description?.trim() || null,
        unitPrice: Number(i.unitPrice),
        units: Number(i.units),
      })),
    };

    setSaving(true);
    try {
      const invoice = isEdit
        ? await purchaseInvoicesApi.update(editId, payload)
        : await purchaseInvoicesApi.create(payload);
      toast.success(isEdit ? 'Purchase invoice updated' : 'Purchase invoice saved');
      navigate(`/purchase-invoices/${invoice.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save invoice'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="py-16 text-center text-slate-500">Loading invoice…</p>;

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit Purchase Invoice' : 'Purchase Invoice Entry'}
        subtitle="Record supplier invoice before GRN — totals auto-calculate"
        actions={
          <button type="button" onClick={() => navigate('/purchase-invoices')} className="btn-secondary">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="glass-card grid grid-cols-1 gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label">Supplier Invoice No.</label>
            <input className="input-field" value={form.supplierInvoiceNo} onChange={(e) => setForm({ ...form, supplierInvoiceNo: e.target.value })} placeholder="Supplier reference" />
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
            <p className="input-field cursor-default bg-slate-50 text-slate-700 dark:bg-slate-800/50 dark:text-slate-200">Active24</p>
          </div>
          <div>
            <label className="label">Linked PO ID</label>
            <input className="input-field" value={form.poId} onChange={(e) => setForm({ ...form, poId: e.target.value })} placeholder="Optional PO id" />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="label">Apply 18% VAT on this invoice?</label>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-xl border-2 border-slate-200 bg-slate-100 p-1 dark:border-slate-600 dark:bg-slate-800/80">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, vatEnabled: true })}
                  className={`min-w-[88px] rounded-lg px-6 py-2.5 text-sm font-bold transition-all ${
                    form.vatEnabled
                      ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-600/30'
                      : 'text-slate-500 hover:bg-white/60 dark:text-slate-400 dark:hover:bg-slate-700'
                  }`}
                >
                  YES
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, vatEnabled: false })}
                  className={`min-w-[88px] rounded-lg px-6 py-2.5 text-sm font-bold transition-all ${
                    !form.vatEnabled
                      ? 'bg-slate-600 text-white shadow-md ring-2 ring-slate-600/30 dark:bg-slate-500'
                      : 'text-slate-500 hover:bg-white/60 dark:text-slate-400 dark:hover:bg-slate-700'
                  }`}
                >
                  NO
                </button>
              </div>
              <p className={`text-sm font-medium ${form.vatEnabled ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500'}`}>
                {form.vatEnabled
                  ? '18% VAT will be added to each line total'
                  : 'No VAT — line totals = Unit Price × Units only'}
              </p>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Invoice Line Items</h3>
            <button
              type="button"
              onClick={() => setForm({ ...form, items: [...form.items, emptyLine()] })}
              className="btn-secondary !py-2 !text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> Add Line
            </button>
          </div>
          <PurchaseInvoiceLineTable
            lines={form.items}
            products={products}
            vatEnabled={form.vatEnabled}
            vatRate={VAT_RATE}
            onChange={updateItem}
            onRemove={(index) => setForm({ ...form, items: form.items.filter((_, i) => i !== index) })}
            canRemove={form.items.length > 1}
          />
          {form.vatEnabled && (
            <p className="mt-3 text-xs text-slate-500">
              VAT formula: (Unit Price × Units × 18%) ÷ 100 — added to line total.
            </p>
          )}
        </div>

        <div className="glass-card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid grid-cols-3 gap-6 text-sm">
            <div>
              <p className="text-xs text-slate-500">Subtotal</p>
              <p className="text-lg font-semibold">{formatCurrency(totals.subtotal)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">VAT {form.vatEnabled ? '(18%)' : '(off)'}</p>
              <p className="text-lg font-semibold">{formatCurrency(totals.vatAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Grand Total</p>
              <p className="text-xl font-bold text-primary-600">{formatCurrency(totals.total)}</p>
            </div>
          </div>
          <button type="submit" disabled={saving} className="btn-primary shrink-0 disabled:opacity-60">
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : isEdit ? 'Update Invoice' : 'Save Invoice'}
          </button>
        </div>
      </form>
    </div>
  );
}
