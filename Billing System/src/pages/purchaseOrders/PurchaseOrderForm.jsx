import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Save, ArrowLeft } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/helpers';
import { toast } from 'react-toastify';

export default function PurchaseOrderForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { purchaseOrders, suppliers, products, addPurchaseOrder, updatePurchaseOrder } = useApp();

  const existing = isEdit ? purchaseOrders.find((po) => po.id === id) : null;

  const [form, setForm] = useState({
    supplierId: '',
    date: new Date().toISOString().split('T')[0],
    expectedDelivery: '',
    status: 'Pending',
    notes: '',
    items: [{ productId: '', quantity: 1, costPrice: 0 }],
  });

  useEffect(() => {
    if (existing) {
      setForm({
        supplierId: existing.supplierId,
        date: existing.date,
        expectedDelivery: existing.expectedDelivery,
        status: existing.status,
        notes: existing.notes,
        items: existing.items,
      });
    }
  }, [existing]);

  const totalAmount = form.items.reduce((sum, item) => sum + item.quantity * item.costPrice, 0);

  const handleProductChange = (index, productId) => {
    const product = products.find((p) => p.id === productId);
    const items = [...form.items];
    items[index] = { ...items[index], productId, costPrice: product?.costPrice || 0 };
    setForm({ ...form, items });
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { productId: '', quantity: 1, costPrice: 0 }] });
  const removeItem = (index) => setForm({ ...form, items: form.items.filter((_, i) => i !== index) });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.supplierId) { toast.error('Please select a supplier'); return; }
    if (form.items.some((i) => !i.productId)) { toast.error('Please select all products'); return; }

    const data = { ...form, totalAmount };
    if (isEdit) {
      updatePurchaseOrder(id, data);
      toast.success('Purchase Order updated successfully');
    } else {
      addPurchaseOrder(data);
      toast.success('Purchase Order created successfully');
    }
    navigate('/purchase-orders');
  };

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit Purchase Order' : 'Create Purchase Order'}
        subtitle={isEdit ? `Editing ${existing?.poNumber}` : 'Create a new purchase order'}
        actions={
          <button onClick={() => navigate('/purchase-orders')} className="btn-secondary">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        }
      />

      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Supplier *</label>
            <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} className="select-field" required>
              <option value="">Select supplier</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Expected Delivery</label>
            <input type="date" value={form.expectedDelivery} onChange={(e) => setForm({ ...form, expectedDelivery: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="select-field">
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Received">Received</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Notes</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="input-field" placeholder="Additional notes..." />
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Order Items</h3>
            <button type="button" onClick={addItem} className="btn-secondary !py-2 !text-xs"><Plus className="h-3.5 w-3.5" /> Add Item</button>
          </div>
          <div className="space-y-3">
            {form.items.map((item, index) => (
              <div key={index} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-100 p-4 md:grid-cols-12 dark:border-slate-800">
                <div className="md:col-span-5">
                  <select value={item.productId} onChange={(e) => handleProductChange(index, e.target.value)} className="select-field">
                    <option value="">Select product</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <input type="number" min="1" value={item.quantity} onChange={(e) => { const items = [...form.items]; items[index].quantity = parseInt(e.target.value) || 1; setForm({ ...form, items }); }} className="input-field" placeholder="Qty" />
                </div>
                <div className="md:col-span-2">
                  <input type="number" min="0" value={item.costPrice} onChange={(e) => { const items = [...form.items]; items[index].costPrice = parseFloat(e.target.value) || 0; setForm({ ...form, items }); }} className="input-field" placeholder="Cost" />
                </div>
                <div className="md:col-span-2 flex items-center font-medium">{formatCurrency(item.quantity * item.costPrice)}</div>
                <div className="md:col-span-1 flex items-center">
                  {form.items.length > 1 && (
                    <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className="text-lg font-bold">Total: {formatCurrency(totalAmount)}</p>
          <button type="submit" className="btn-primary"><Save className="h-4 w-4" /> {isEdit ? 'Update PO' : 'Create PO'}</button>
        </div>
      </form>
    </div>
  );
}
