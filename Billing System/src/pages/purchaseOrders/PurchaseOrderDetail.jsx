import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import { useApp } from '../../context/AppContext';
import { formatCurrency, formatDate } from '../../utils/helpers';

export default function PurchaseOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { purchaseOrders, suppliers, products } = useApp();
  const po = purchaseOrders.find((p) => p.id === id);

  if (!po) {
    return <div className="text-center py-16 text-slate-500">Purchase Order not found</div>;
  }

  const supplier = suppliers.find((s) => s.id === po.supplierId);

  return (
    <div>
      <PageHeader
        title={po.poNumber}
        subtitle={`Created on ${formatDate(po.date)}`}
        actions={
          <div className="flex gap-2">
            <button onClick={() => navigate('/purchase-orders')} className="btn-secondary"><ArrowLeft className="h-4 w-4" /> Back</button>
            <button onClick={() => navigate(`/purchase-orders/edit/${po.id}`)} className="btn-primary"><Pencil className="h-4 w-4" /> Edit</button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="glass-card p-6 lg:col-span-1 space-y-4">
          <div><p className="text-xs text-slate-500">Status</p><StatusBadge status={po.status} /></div>
          <div><p className="text-xs text-slate-500">Supplier</p><p className="font-medium">{supplier?.name}</p></div>
          <div><p className="text-xs text-slate-500">Expected Delivery</p><p className="font-medium">{formatDate(po.expectedDelivery)}</p></div>
          <div><p className="text-xs text-slate-500">Total Amount</p><p className="text-xl font-bold text-primary-600">{formatCurrency(po.totalAmount)}</p></div>
          {po.notes && <div><p className="text-xs text-slate-500">Notes</p><p className="text-sm">{po.notes}</p></div>}
        </div>

        <div className="glass-card p-6 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold">Order Items</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="pb-3 text-left text-xs font-semibold uppercase text-slate-500">Product</th>
                  <th className="pb-3 text-right text-xs font-semibold uppercase text-slate-500">Qty</th>
                  <th className="pb-3 text-right text-xs font-semibold uppercase text-slate-500">Cost</th>
                  <th className="pb-3 text-right text-xs font-semibold uppercase text-slate-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {po.items.map((item, i) => {
                  const product = products.find((p) => p.id === item.productId);
                  return (
                    <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50">
                      <td className="py-3">{product?.name || item.productId}</td>
                      <td className="py-3 text-right">{item.quantity}</td>
                      <td className="py-3 text-right">{formatCurrency(item.costPrice)}</td>
                      <td className="py-3 text-right font-medium">{formatCurrency(item.quantity * item.costPrice)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
