import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, PackageCheck } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import BarcodeInput from '../../components/ui/BarcodeInput';
import { useApp } from '../../context/AppContext';
import { findProductByBarcode } from '../../data/mockProducts';
import { formatCurrency } from '../../utils/helpers';
import { toast } from 'react-toastify';
import { currentUser } from '../../data';

export default function GRNForm() {
  const navigate = useNavigate();
  const { suppliers, products, purchaseOrders, addGRN } = useApp();
  const [form, setForm] = useState({
    supplierId: '',
    poId: '',
    receivedBy: currentUser.name,
    notes: '',
    items: [],
  });

  const handleBarcodeScan = (barcode) => {
    const product = findProductByBarcode(barcode);
    if (!product) {
      toast.error('Product not found for this barcode');
      return;
    }
    if (form.items.some((i) => i.productId === product.id)) {
      toast.warning('Product already added to this GRN');
      return;
    }
    setForm({
      ...form,
      supplierId: form.supplierId || product.supplierId,
      items: [...form.items, {
        productId: product.id,
        product,
        quantityReceived: 1,
        costPrice: product.costPrice,
      }],
    });
    toast.success(`${product.name} added via barcode scan`);
  };

  const addManualProduct = (productId) => {
    const product = products.find((p) => p.id === productId);
    if (!product || form.items.some((i) => i.productId === productId)) return;
    setForm({
      ...form,
      items: [...form.items, { productId, product, quantityReceived: 1, costPrice: product.costPrice }],
    });
  };

  const updateItem = (index, field, value) => {
    const items = [...form.items];
    items[index] = { ...items[index], [field]: value };
    setForm({ ...form, items });
  };

  const removeItem = (index) => setForm({ ...form, items: form.items.filter((_, i) => i !== index) });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.supplierId) { toast.error('Please select a supplier'); return; }
    if (form.items.length === 0) { toast.error('Please add at least one product'); return; }

    addGRN({
      supplierId: form.supplierId,
      poId: form.poId || null,
      date: new Date().toISOString().split('T')[0],
      receivedBy: form.receivedBy,
      notes: form.notes,
      items: form.items.map(({ productId, quantityReceived, costPrice }) => ({ productId, quantityReceived, costPrice })),
    });

    toast.success('GRN completed successfully! Stock has been updated.');
    navigate('/grn');
  };

  return (
    <div>
      <PageHeader title="Create GRN" subtitle="Record goods received into inventory" actions={<button onClick={() => navigate('/grn')} className="btn-secondary"><ArrowLeft className="h-4 w-4" /> Back</button>} />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="glass-card p-6 space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><PackageCheck className="h-4 w-4 text-primary-600" /> Barcode Scanner</h3>
          <BarcodeInput onScan={handleBarcodeScan} placeholder="Scan or enter product barcode..." />
          <p className="text-xs text-slate-500">Try barcode: 4790123456789 (Genius Wireless Mouse)</p>
        </div>

        <div className="glass-card p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Supplier *</label>
              <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} className="select-field" required>
                <option value="">Select supplier</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Linked PO (Optional)</label>
              <select value={form.poId} onChange={(e) => setForm({ ...form, poId: e.target.value })} className="select-field">
                <option value="">None</option>
                {purchaseOrders.filter((po) => po.status !== 'Received').map((po) => <option key={po.id} value={po.id}>{po.poNumber}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Received By</label>
              <input value={form.receivedBy} onChange={(e) => setForm({ ...form, receivedBy: e.target.value })} className="input-field" />
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Received Items ({form.items.length})</h3>
            <select onChange={(e) => { if (e.target.value) { addManualProduct(e.target.value); e.target.value = ''; } }} className="select-field !w-auto !text-xs">
              <option value="">+ Add product manually</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {form.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Scan a barcode or add products manually</p>
          ) : (
            <div className="space-y-4">
              {form.items.map((item, index) => (
                <div key={item.productId} className="rounded-xl border border-slate-100 p-4 dark:border-slate-800">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-xs text-slate-500">Product</p>
                      <p className="font-medium">{item.product?.name}</p>
                      <p className="text-xs text-slate-400">{item.product?.barcode}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Source / Supplier</p>
                      <p className="text-sm">{item.product?.source} • {suppliers.find((s) => s.id === item.product?.supplierId)?.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Qty Received</p>
                      <input type="number" min="1" value={item.quantityReceived} onChange={(e) => updateItem(index, 'quantityReceived', parseInt(e.target.value) || 1)} className="input-field !py-1.5" />
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xs text-slate-500">Cost / Sell / Stock</p>
                        <p className="text-sm">{formatCurrency(item.costPrice)} / {formatCurrency(item.product?.sellingPrice)} / {item.product?.quantity}</p>
                      </div>
                      <button type="button" onClick={() => removeItem(index)} className="text-red-500"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={form.items.length === 0}><Save className="h-4 w-4" /> Complete GRN</button>
        </div>
      </form>
    </div>
  );
}
