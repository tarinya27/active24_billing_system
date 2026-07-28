import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Copy, Trash2, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Can from '../../components/auth/Can';
import { productsApi } from '../../api/masters';
import { getErrorMessage } from '../../api/client';
import { formatCurrency, formatDateTime, getStockStatus } from '../../utils/helpers';
import ProductFormModal from './ProductFormModal';
import { useResourceList } from '../../hooks/useResourceList';
import { categoriesApi, suppliersApi } from '../../api/masters';

function DetailCard({ title, children }) {
  return (
    <div className="glass-card p-6">
      <h3 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-800 dark:text-slate-100">{value ?? '—'}</p>
    </div>
  );
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { items: categories } = useResourceList(categoriesApi);
  const { items: suppliers } = useResourceList(suppliersApi);

  const load = async () => {
    setLoading(true);
    try {
      const [data, hist] = await Promise.all([
        productsApi.get(id),
        productsApi.supplierHistory(id).catch(() => null),
      ]);
      setProduct(data);
      setHistory(hist);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load product'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleDuplicate = async () => {
    try {
      const copy = await productsApi.duplicate(id);
      toast.success('Product duplicated');
      navigate(`/products/${copy.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to duplicate product'));
    }
  };

  const handleToggleStatus = async () => {
    try {
      const updated = await productsApi.updateStatus(id, !product.isActive);
      setProduct(updated);
      toast.success(updated.isActive ? 'Product activated' : 'Product deactivated');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update status'));
    }
  };

  const handleDelete = async () => {
    try {
      await productsApi.remove(id);
      toast.success('Product deactivated');
      navigate('/products');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to deactivate product'));
    }
  };

  if (loading) return <p className="py-16 text-center text-slate-500">Loading product…</p>;
  if (!product) return <div className="py-16 text-center text-slate-500">Product not found</div>;

  const stockStatus = getStockStatus(product.currentStock ?? 0, product.reorderLevel);

  return (
    <div>
      <PageHeader
        title={product.name}
        subtitle={`${product.code}${product.barcode ? ` • ${product.barcode}` : ''}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/products" className="btn-secondary"><ArrowLeft className="h-4 w-4" /> Back</Link>
            <Can permission="products.create">
              <button onClick={handleDuplicate} className="btn-secondary"><Copy className="h-4 w-4" /> Duplicate</button>
            </Can>
            <Can permission="products.edit">
              <button onClick={() => setEditOpen(true)} className="btn-secondary"><Pencil className="h-4 w-4" /> Edit</button>
              <button onClick={handleToggleStatus} className="btn-secondary">
                {product.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                {product.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </Can>
            <Can permission="products.delete">
              <button onClick={() => setDeleteOpen(true)} className="btn-danger"><Trash2 className="h-4 w-4" /> Delete</button>
            </Can>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DetailCard title="Product Information">
          <Field label="Inventory Code" value={product.code} />
          <Field label="Barcode" value={product.barcode} />
          <Field label="Category" value={product.category?.name} />
          <Field label="Brand" value={product.brand} />
          <Field label="VAT %" value={`${Number(product.vatPercentage ?? 0)}%`} />
          <Field label="Status" value={product.isActive ? 'Active' : 'Inactive'} />
          <Field label="Description" value={product.description} />
        </DetailCard>

        <DetailCard title="Pricing & Profit">
          <Field label="Purchase Price" value={formatCurrency(Number(product.purchasePrice ?? 0))} />
          <Field label="Selling Price" value={formatCurrency(Number(product.sellingPrice ?? product.defaultSellingPrice ?? 0))} />
          <Field label="Profit" value={formatCurrency(Number(product.profit ?? 0))} />
          <Field label="Reorder Level" value={product.reorderLevel} />
        </DetailCard>

        <DetailCard title="Supplier Information">
          <Field label="Supplier" value={product.supplier?.name} />
          <Field label="Contact" value={product.supplier?.phone || product.supplier?.email} />
          <Field label="Address" value={[product.supplier?.address, product.supplier?.city].filter(Boolean).join(', ') || '—'} />
        </DetailCard>

        <DetailCard title="Stock Information">
          <Field label="Current Stock" value={product.currentStock ?? 0} />
          <Field label="Stock Status" value={stockStatus} />
          <Field label="Reorder Level" value={product.reorderLevel} />
          <p className="sm:col-span-2 text-xs text-slate-500">Stock is updated automatically via Purchase Invoices, GRN receipts, and Sales — it cannot be edited manually.</p>
        </DetailCard>

        <DetailCard title="Audit">
          <Field label="Created" value={formatDateTime(product.createdAt)} />
          <Field label="Last Updated" value={formatDateTime(product.updatedAt)} />
        </DetailCard>
      </div>

      {history && (
        <div className="glass-card mt-6 p-6">
          <h3 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-100">Supplier & Stock Transaction History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="pb-3 text-left text-xs font-semibold uppercase text-slate-500">Type</th>
                  <th className="pb-3 text-left text-xs font-semibold uppercase text-slate-500">Reference</th>
                  <th className="pb-3 text-left text-xs font-semibold uppercase text-slate-500">Supplier</th>
                  <th className="pb-3 text-right text-xs font-semibold uppercase text-slate-500">Qty</th>
                  <th className="pb-3 text-center text-xs font-semibold uppercase text-slate-500">Effect</th>
                  <th className="pb-3 text-right text-xs font-semibold uppercase text-slate-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {[...(history.grns || []), ...(history.purchaseInvoices || []), ...(history.sales || [])]
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                  .slice(0, 30)
                  .map((row, idx) => (
                    <tr key={`${row.type}-${row.reference}-${idx}`} className="border-b border-slate-50 dark:border-slate-800/50">
                      <td className="py-2.5">{row.type.replace('_', ' ')}</td>
                      <td className="py-2.5 font-mono text-xs">{row.reference}</td>
                      <td className="py-2.5">{row.supplier || '—'}</td>
                      <td className="py-2.5 text-right">{row.quantity}</td>
                      <td className={`py-2.5 text-center font-bold ${row.stockEffect === '+' ? 'text-emerald-600' : 'text-red-600'}`}>{row.stockEffect}</td>
                      <td className="py-2.5 text-right text-slate-500">{formatDateTime(row.date)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ProductFormModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        editing={product}
        categories={categories}
        suppliers={suppliers}
        onSaved={load}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Deactivate Product"
        message={`Deactivate "${product.name}"? It will be hidden from active lists but kept for history.`}
        confirmText="Deactivate"
      />
    </div>
  );
}
