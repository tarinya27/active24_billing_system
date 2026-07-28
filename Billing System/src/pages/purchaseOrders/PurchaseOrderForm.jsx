import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Save, Printer } from 'lucide-react';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import { purchaseOrdersApi } from '../../api/procurement';
import { categoriesApi, suppliersApi } from '../../api/masters';
import { getErrorMessage } from '../../api/client';
import {
  PO_COMPANY,
  PO_COMPANY_LABEL,
  PO_DELIVERY_ADDRESS,
  PO_PAYMENT_TERM_OPTIONS,
  resolvePaymentTerms,
  splitPaymentTerms,
} from '../../utils/poConstants';

const emptyItem = () => ({
  categoryId: '',
  description: '',
  quantity: 1,
  costPrice: 0,
  warrantyMonths: '',
});

const emptyForm = {
  supplierId: '',
  orderDate: new Date().toISOString().split('T')[0],
  supplierRefNo: '',
  attn: '',
  paymentTerms: '30 days',
  paymentTermsOther: '',
  fulfillmentType: 'DELIVERY',
  deliveryAddress: PO_DELIVERY_ADDRESS,
  collectedBy: '',
  vatRate: 0,
  items: [emptyItem()],
};

function formatAmount(amount) {
  return new Intl.NumberFormat('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

export default function PurchaseOrderForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [nextSerial, setNextSerial] = useState('—');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    Promise.all([
      suppliersApi.list({ pageSize: 200, company: PO_COMPANY, isActive: 'true' }),
      categoriesApi.list({ isActive: 'true' }),
      !isEdit ? purchaseOrdersApi.nextSerial(PO_COMPANY) : Promise.resolve(null),
    ])
      .then(([s, cats, serial]) => {
        setSuppliers(s.items || []);
        const list = Array.isArray(cats) ? cats : cats?.items || [];
        setCategories(list.filter((cat) => cat.isActive !== false));
        if (serial?.serial) setNextSerial(serial.serial);
      })
      .catch(() => toast.error('Failed to load form data'));
  }, [isEdit]);

  useEffect(() => {
    if (!isEdit || !id) return;
    setLoading(true);
    purchaseOrdersApi
      .get(id)
      .then((po) => {
        setNextSerial(po.poNumber);
        const terms = splitPaymentTerms(po.paymentTerms);
        setForm({
          supplierId: po.supplierId,
          orderDate: po.orderDate?.slice(0, 10) || '',
          supplierRefNo: po.supplierRefNo || '',
          attn: po.attn || po.supplier?.contactPerson || '',
          paymentTerms: terms.paymentTerms,
          paymentTermsOther: terms.paymentTermsOther,
          fulfillmentType: po.fulfillmentType || 'DELIVERY',
          deliveryAddress: PO_DELIVERY_ADDRESS,
          collectedBy: po.collectedBy || '',
          vatRate: Number(po.vatRate ?? 0),
          items: po.items.map((i) => ({
            categoryId: i.product?.categoryId || i.product?.category?.id || '',
            description: i.description || i.product?.name || '',
            quantity: i.quantity,
            costPrice: Number(i.costPrice),
            warrantyMonths: i.warrantyMonths ?? '',
          })),
        });
      })
      .catch((err) => toast.error(getErrorMessage(err, 'Failed to load PO')))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === form.supplierId),
    [suppliers, form.supplierId]
  );

  const subTotal = useMemo(
    () => form.items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.costPrice) || 0), 0),
    [form.items]
  );

  const vatRate = form.supplierId ? Number(form.vatRate) || 0 : 0;
  const vatAmount = Math.round(subTotal * vatRate / 100 * 100) / 100;
  const grandTotal = subTotal + vatAmount;

  const handleSupplierChange = (supplierId) => {
    const supplier = suppliers.find((s) => s.id === supplierId);
    setForm((prev) => ({
      ...prev,
      supplierId,
      attn: supplier?.contactPerson || prev.attn,
      vatRate: Number(supplier?.vatRate ?? 0),
    }));
  };

  const updateItem = (index, patch) => {
    const items = [...form.items];
    items[index] = { ...items[index], ...patch };
    setForm({ ...form, items });
  };

  const addItem = () => setForm({ ...form, items: [...form.items, emptyItem()] });

  const buildPayload = () => ({
    company: PO_COMPANY,
    supplierId: form.supplierId,
    orderDate: form.orderDate,
    supplierRefNo: form.supplierRefNo,
    attn: form.attn,
    paymentTerms: resolvePaymentTerms(form.paymentTerms, form.paymentTermsOther),
    fulfillmentType: form.fulfillmentType,
    deliveryAddress: form.fulfillmentType === 'DELIVERY' ? PO_DELIVERY_ADDRESS : '',
    collectedBy: form.fulfillmentType === 'COLLECTION' ? form.collectedBy : '',
    vatRate,
    items: form.items.map((i) => ({
      categoryId: i.categoryId || null,
      description: i.description.trim(),
      quantity: Number(i.quantity),
      costPrice: Number(i.costPrice),
      warrantyMonths: i.warrantyMonths === '' || i.warrantyMonths == null
        ? null
        : Number(i.warrantyMonths),
    })),
  });

  const validate = () => {
    if (!form.supplierId) {
      toast.error('Please select a supplier');
      return false;
    }
    if (!form.orderDate) {
      toast.error('PO date is required');
      return false;
    }
    if (form.items.some((i) => !i.categoryId)) {
      toast.error('Please select a category for all items');
      return false;
    }
    if (form.items.some((i) => !i.description.trim())) {
      toast.error('Please enter a description for all items');
      return false;
    }
    if (form.fulfillmentType === 'COLLECTION' && !form.collectedBy.trim()) {
      toast.error('Please enter who will collect');
      return false;
    }
    if (form.paymentTerms === 'other' && !form.paymentTermsOther.trim()) {
      toast.error('Please enter custom payment terms');
      return false;
    }
    return true;
  };

  const handleSave = async (printAfter = false) => {
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = buildPayload();
      let saved;
      if (isEdit) {
        saved = await purchaseOrdersApi.update(id, payload);
        toast.success('Purchase order updated');
      } else {
        saved = await purchaseOrdersApi.create(payload);
        toast.success('Purchase order created');
      }

      if (printAfter) {
        navigate(`/purchase-orders/${saved.id}/print`);
      } else {
        navigate(`/purchase-invoices/new?poId=${saved.id}`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save PO'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="py-16 text-center text-slate-500">Loading…</p>;

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit Purchase Order' : 'New Purchase Order'}
        subtitle={PO_COMPANY_LABEL}
        actions={
          <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            {PO_COMPANY_LABEL}
          </span>
        }
      />

      <div className="space-y-6">
        {/* Order Details */}
        <section className="glass-card p-6">
          <h2 className="mb-5 text-base font-semibold text-slate-800 dark:text-white">Order Details</h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">PO Serial Number</label>
              <input type="text" value={nextSerial} readOnly className="input-field bg-slate-50 dark:bg-slate-900/60" />
              <p className="mt-1 text-xs text-slate-500">Auto-generated for {PO_COMPANY_LABEL}</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                PO Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.orderDate}
                onChange={(e) => setForm({ ...form, orderDate: e.target.value })}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Supplier / Company <span className="text-red-500">*</span>
              </label>
              <select
                id="po-supplier-select"
                value={form.supplierId}
                onChange={(e) => handleSupplierChange(e.target.value)}
                className="select-field"
                required
              >
                <option value="">-- Select supplier --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">VAT is loaded automatically from the supplier.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Attn (Contact Person)</label>
              <input
                type="text"
                value={form.attn}
                onChange={(e) => setForm({ ...form, attn: e.target.value })}
                placeholder="e.g. Dilantha"
                className="input-field"
              />
            </div>
            <div className="md:col-span-1">
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Supplier&apos;s Ref No.</label>
              <input
                type="text"
                value={form.supplierRefNo}
                onChange={(e) => setForm({ ...form, supplierRefNo: e.target.value })}
                className="input-field"
              />
            </div>
          </div>
        </section>

        {/* Items */}
        <section className="glass-card p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-800 dark:text-white">Items</h2>
            <button type="button" onClick={addItem} className="btn-secondary !py-2 !text-sm">
              <Plus className="h-4 w-4" /> Add Item
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="pb-3 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 w-12">No</th>
                  <th className="pb-3 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 w-44">Category</th>
                  <th className="pb-3 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Description of Goods</th>
                  <th className="pb-3 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 w-28">Quantity</th>
                  <th className="pb-3 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 w-36">Unit Price (Rs)</th>
                  <th className="pb-3 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 w-32">Warranty (Months)</th>
                  <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 w-32">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((item, index) => {
                  const lineTotal = (Number(item.quantity) || 0) * (Number(item.costPrice) || 0);
                  return (
                    <tr key={index} className="border-b border-slate-50 dark:border-slate-800/50">
                      <td className="py-3 pr-3 align-top text-slate-600">{index + 1}</td>
                      <td className="py-3 pr-3 align-top">
                        <select
                          value={item.categoryId}
                          onChange={(e) => updateItem(index, { categoryId: e.target.value })}
                          className="select-field"
                          required
                        >
                          <option value="">-- Select --</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 pr-3 align-top">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(index, { description: e.target.value })}
                          placeholder="Description of goods"
                          className="input-field"
                        />
                      </td>
                      <td className="py-3 pr-3 align-top">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, { quantity: parseInt(e.target.value, 10) || 1 })}
                          className="input-field"
                        />
                      </td>
                      <td className="py-3 pr-3 align-top">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={item.costPrice}
                          onChange={(e) => updateItem(index, { costPrice: parseFloat(e.target.value) || 0 })}
                          className="input-field"
                        />
                      </td>
                      <td className="py-3 pr-3 align-top">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.warrantyMonths}
                          onChange={(e) => updateItem(index, { warrantyMonths: e.target.value })}
                          placeholder="Optional"
                          className="input-field"
                        />
                      </td>
                      <td className="py-3 text-right align-top font-medium text-slate-700 dark:text-slate-200">
                        {formatAmount(lineTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-end">
            <div className="w-full max-w-xs rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="flex justify-between py-1.5 text-sm text-slate-600 dark:text-slate-300">
                <span>Sub Total</span>
                <span>{formatAmount(subTotal)}</span>
              </div>
              <div className="flex justify-between py-1.5 text-sm text-slate-600 dark:text-slate-300">
                <span>
                  VAT
                  {!form.supplierId && (
                    <button
                      type="button"
                      onClick={() => document.getElementById('po-supplier-select')?.focus()}
                      className="ml-1 text-primary-600 underline"
                    >
                      select supplier
                    </button>
                  )}
                </span>
                <span>{formatAmount(vatAmount)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-slate-200 pt-3 text-base font-bold text-slate-800 dark:border-slate-700 dark:text-white">
                <span>Grand Total</span>
                <span>{formatAmount(grandTotal)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Terms & Delivery */}
        <section className="glass-card p-6">
          <h2 className="mb-5 text-base font-semibold text-slate-800 dark:text-white">Terms &amp; Delivery</h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Terms</label>
              <select
                value={form.paymentTerms}
                onChange={(e) => setForm({
                  ...form,
                  paymentTerms: e.target.value,
                  paymentTermsOther: e.target.value === 'other' ? form.paymentTermsOther : '',
                })}
                className="select-field"
              >
                {PO_PAYMENT_TERM_OPTIONS.map((term) => (
                  <option key={term} value={term}>{term === 'other' ? 'Other' : term}</option>
                ))}
              </select>
              {form.paymentTerms === 'other' && (
                <input
                  type="text"
                  value={form.paymentTermsOther}
                  onChange={(e) => setForm({ ...form, paymentTermsOther: e.target.value })}
                  placeholder="Enter custom terms"
                  className="input-field mt-2"
                />
              )}
            </div>
            <div>
              <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Fulfillment</span>
              <div className="flex flex-wrap gap-5">
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="fulfillmentType"
                    value="DELIVERY"
                    checked={form.fulfillmentType === 'DELIVERY'}
                    onChange={() => setForm({ ...form, fulfillmentType: 'DELIVERY' })}
                    className="text-primary-600"
                  />
                  Delivery
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="fulfillmentType"
                    value="COLLECTION"
                    checked={form.fulfillmentType === 'COLLECTION'}
                    onChange={() => setForm({ ...form, fulfillmentType: 'COLLECTION' })}
                    className="text-primary-600"
                  />
                  Collected by
                </label>
              </div>
              <p className="mt-2 text-xs text-slate-500">Choose delivery address or who will collect — not both.</p>
            </div>
            {form.fulfillmentType === 'DELIVERY' ? (
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Delivery</label>
                <input
                  type="text"
                  value={PO_DELIVERY_ADDRESS}
                  readOnly
                  className="input-field bg-slate-50 dark:bg-slate-900/60"
                />
              </div>
            ) : (
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Collected by</label>
                <input
                  type="text"
                  value={form.collectedBy}
                  onChange={(e) => setForm({ ...form, collectedBy: e.target.value })}
                  placeholder="Name of person collecting"
                  className="input-field"
                />
              </div>
            )}
          </div>
        </section>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link to={isEdit ? `/purchase-orders/${id}` : '/purchase-orders'} className="btn-secondary">
            Cancel
          </Link>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
          >
            <Printer className="h-4 w-4" />
            {saving ? 'Saving…' : isEdit ? 'Save & Print' : 'Create & Print'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave(false)}
            className="btn-primary"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save only'}
          </button>
        </div>
      </div>
    </div>
  );
}
