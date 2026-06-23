import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import { useApp } from '../../context/AppContext';
import { formatCurrency, formatDate } from '../../utils/helpers';

export default function GRNDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { grns, suppliers, products, purchaseOrders } = useApp();
  const grn = grns.find((g) => g.id === id);

  if (!grn) return <div className="py-16 text-center text-slate-500">GRN not found</div>;

  const supplier = suppliers.find((s) => s.id === grn.supplierId);
  const po = purchaseOrders.find((p) => p.id === grn.poId);

  return (
    <div>
      <PageHeader title={grn.grnNumber} subtitle={`Received on ${formatDate(grn.date)}`} actions={<button onClick={() => navigate('/grn')} className="btn-secondary"><ArrowLeft className="h-4 w-4" /> Back</button>} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="glass-card p-6 space-y-4">
          <div><p className="text-xs text-slate-500">Status</p><StatusBadge status={grn.status} /></div>
          <div><p className="text-xs text-slate-500">Supplier</p><p className="font-medium">{supplier?.name}</p></div>
          <div><p className="text-xs text-slate-500">Received By</p><p className="font-medium">{grn.receivedBy}</p></div>
          {po && <div><p className="text-xs text-slate-500">Linked PO</p><p className="font-medium text-primary-600">{po.poNumber}</p></div>}
          {grn.notes && <div><p className="text-xs text-slate-500">Notes</p><p className="text-sm">{grn.notes}</p></div>}
        </div>

        <div className="glass-card p-6 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold">Received Items</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="pb-3 text-left text-xs font-semibold uppercase text-slate-500">Product</th>
                <th className="pb-3 text-left text-xs font-semibold uppercase text-slate-500">Barcode</th>
                <th className="pb-3 text-right text-xs font-semibold uppercase text-slate-500">Qty</th>
                <th className="pb-3 text-right text-xs font-semibold uppercase text-slate-500">Cost</th>
                <th className="pb-3 text-right text-xs font-semibold uppercase text-slate-500">Total</th>
              </tr>
            </thead>
            <tbody>
              {grn.items.map((item, i) => {
                const product = products.find((p) => p.id === item.productId);
                return (
                  <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50">
                    <td className="py-3">{product?.name}</td>
                    <td className="py-3 text-slate-500">{product?.barcode}</td>
                    <td className="py-3 text-right">{item.quantityReceived}</td>
                    <td className="py-3 text-right">{formatCurrency(item.costPrice)}</td>
                    <td className="py-3 text-right font-medium">{formatCurrency(item.quantityReceived * item.costPrice)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
