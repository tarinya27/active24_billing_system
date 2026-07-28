import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import Modal from '../../components/ui/Modal';
import BarcodeInput from '../../components/ui/BarcodeInput';
import { productsApi } from '../../api/masters';
import { getErrorMessage } from '../../api/client';
import { formatCurrency } from '../../utils/helpers';

export const emptyProductForm = {
  name: '',
  barcode: '',
  description: '',
  brand: '',
  categoryId: '',
  purchasePrice: 0,
  defaultSellingPrice: 0,
  vatPercentage: 0,
  reorderLevel: 10,
  supplierId: '',
  isActive: true,
};

function StockBadge({ stock, reorderLevel }) {
  if (stock <= 0) {
    return <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-400">Out of Stock</span>;
  }
  if (stock <= reorderLevel) {
    return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">Low Stock ({stock})</span>;
  }
  return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">In Stock ({stock})</span>;
}

export default function ProductFormModal({
  isOpen,
  onClose,
  editing,
  categories,
  suppliers,
  onSaved,
}) {
  const [form, setForm] = useState(emptyProductForm);
  const [saving, setSaving] = useState(false);
  const [maxVat, setMaxVat] = useState(100);

  const activeCategories = useMemo(
    () => categories.filter((c) => c.isActive !== false),
    [categories]
  );
  const activeSuppliers = useMemo(
    () => suppliers.filter((s) => s.isActive !== false),
    [suppliers]
  );

  const purchasePrice = Number(form.purchasePrice) || 0;
  const sellingPrice = Number(form.defaultSellingPrice) || 0;
  const profit = Math.round((sellingPrice - purchasePrice) * 100) / 100;
  const priceError = sellingPrice < purchasePrice;

  const selectedCategory = useMemo(
    () => activeCategories.find((c) => c.id === form.categoryId) || null,
    [activeCategories, form.categoryId]
  );

  const inventoryCodePreview = useMemo(() => {
    if (editing?.code) return editing.code;
    if (!selectedCategory) return 'Select a category';
    if (!selectedCategory.codePrefix) return 'Auto (PRD-#####) on save';
    const next = (Number(selectedCategory.codeSequence) || 0) + 1;
    const width = Math.max(2, String(next).length);
    return `${selectedCategory.codePrefix}${String(next).padStart(width, '0')}`;
  }, [editing, selectedCategory]);

  useEffect(() => {
    if (!isOpen) return;
    productsApi.meta().then((m) => setMaxVat(m.maxVat ?? 100)).catch(() => {});
    if (editing) {
      setForm({
        name: editing.name || editing.productName || '',
        barcode: editing.barcode || '',
        description: editing.description || '',
        brand: editing.brand || '',
        categoryId: editing.category?.id || editing.categoryId || '',
        purchasePrice: Number(editing.purchasePrice ?? 0),
        defaultSellingPrice: Number(editing.sellingPrice ?? editing.defaultSellingPrice ?? 0),
        vatPercentage: Number(editing.vatPercentage ?? 0),
        reorderLevel: editing.reorderLevel ?? 10,
        supplierId: editing.supplier?.id || editing.supplierId || '',
        isActive: editing.isActive !== false,
      });
    } else {
      setForm(emptyProductForm);
    }
  }, [isOpen, editing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Product name is required');
      return;
    }
    if (!form.categoryId) {
      toast.error('Category is required');
      return;
    }
    if (!form.supplierId) {
      toast.error('Supplier is required');
      return;
    }
    const vat = Number(form.vatPercentage) || 0;

    if (priceError) {
      toast.error('Selling price must be greater than or equal to purchase price');
      return;
    }
    if (vat > maxVat) {
      toast.error(`VAT cannot exceed ${maxVat}%`);
      return;
    }

    const payload = {
      name: form.name.trim(),
      barcode: form.barcode.trim() || null,
      brand: form.brand.trim() || null,
      description: form.description,
      categoryId: form.categoryId,
      purchasePrice,
      defaultSellingPrice: sellingPrice,
      vatPercentage: vat,
      reorderLevel: Number(form.reorderLevel) || 0,
      supplierId: form.supplierId,
      isActive: form.isActive,
    };

    setSaving(true);
    try {
      if (editing) {
        await productsApi.update(editing.id, payload);
        toast.success('Product updated');
      } else {
        await productsApi.create(payload);
        toast.success('Product created');
      }
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save product'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editing ? 'Edit Product' : 'Add Product'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {editing && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900/50">
            <span className="text-slate-500">Current Stock (read-only):</span>
            <StockBadge stock={editing.currentStock ?? 0} reorderLevel={editing.reorderLevel ?? 10} />
            <span className="text-xs text-slate-400">Stock changes via Purchase Invoice, GRN, and Sales only.</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Product Name *</label>
            <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Product name" />
          </div>
          <div>
            <label className="label">Inventory Code</label>
            <input
              className="input-field font-mono text-sm bg-slate-50 dark:bg-slate-800/50"
              value={inventoryCodePreview}
              readOnly
              disabled
            />
            {!editing && (
              <p className="mt-1 text-xs text-slate-500">
                Generated automatically from the category prefix when you save.
              </p>
            )}
          </div>
          <div>
            <label className="label">Barcode</label>
            <BarcodeInput
              value={form.barcode}
              onChange={(barcode) => setForm({ ...form, barcode })}
              onScan={(barcode) => setForm({ ...form, barcode })}
              placeholder="Scan or enter barcode…"
            />
            <p className="mt-1 text-xs text-slate-500">Type manually or use a scanner — press Enter or Scan to confirm.</p>
          </div>
          <div>
            <label className="label">Brand</label>
            <input className="input-field" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Brand name" />
          </div>
          <div>
            <label className="label">Category *</label>
            <select className="select-field" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
              <option value="">Select category</option>
              {activeCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {!activeCategories.length && <p className="mt-1 text-xs text-amber-600">Create an active category first.</p>}
          </div>
          <div>
            <label className="label">Supplier *</label>
            <select className="select-field" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} required>
              <option value="">Select supplier</option>
              {activeSuppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {!activeSuppliers.length && <p className="mt-1 text-xs text-amber-600">Create an active supplier first.</p>}
          </div>
          <div>
            <label className="label">Purchase Price (LKR) *</label>
            <input type="number" min="0" step="0.01" className="input-field" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
          </div>
          <div>
            <label className="label">Selling Price (LKR) *</label>
            <input type="number" min="0" step="0.01" className={`input-field ${priceError ? 'border-red-400' : ''}`} value={form.defaultSellingPrice} onChange={(e) => setForm({ ...form, defaultSellingPrice: e.target.value })} />
            {priceError && <p className="mt-1 text-xs text-red-600">Must be &gt;= purchase price</p>}
          </div>
          <div className="sm:col-span-2 rounded-xl border border-primary-100 bg-primary-50/50 px-4 py-3 dark:border-primary-900/40 dark:bg-primary-950/20">
            <p className="text-xs text-slate-500">Profit Preview</p>
            <p className={`text-lg font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(profit)}</p>
          </div>
          <div>
            <label className="label">VAT % (max {maxVat}%)</label>
            <input type="number" min="0" max={maxVat} step="0.01" className="input-field" value={form.vatPercentage} onChange={(e) => setForm({ ...form, vatPercentage: e.target.value })} />
          </div>
          <div>
            <label className="label">Reorder Level</label>
            <input type="number" min="0" className="input-field" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Description</label>
            <textarea className="input-field" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="select-field" value={form.isActive ? 'active' : 'inactive'} onChange={(e) => setForm({ ...form, isActive: e.target.value === 'active' })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving || priceError} className="btn-primary disabled:opacity-60">{saving ? 'Saving…' : editing ? 'Update Product' : 'Create Product'}</button>
        </div>
      </form>
    </Modal>
  );
}
