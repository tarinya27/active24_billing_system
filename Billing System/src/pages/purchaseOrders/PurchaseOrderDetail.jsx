import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import Can from '../../components/auth/Can';
import { purchaseOrdersApi } from '../../api/procurement';
import { getErrorMessage } from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { poStatusLabel } from '../../utils/constants';

export default function PurchaseOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [po, setPo] = useState(null);
  const [tally, setTally] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [poData, tallyData] = await Promise.all([
          purchaseOrdersApi.get(id),
          purchaseOrdersApi.tally(id),
        ]);
        if (!cancelled) {
          setPo(poData);
          setTally(tallyData);
        }
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to load PO'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <p className="py-16 text-center text-slate-500">Loading…</p>;
  if (!po) return <div className="py-16 text-center text-slate-500">Purchase Order not found</div>;

  return (
    <div>
      <PageHeader
        title={po.poNumber}
        subtitle={`${po.company} • ${formatDate(po.orderDate)}${po.externalRef ? ` • Ref ${po.externalRef}` : ''}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate('/purchase-orders')} className="btn-secondary"><ArrowLeft className="h-4 w-4" /> Back</button>
            <Can permission="purchase_invoices.create">
              <Link to={`/purchase-invoices/new?poId=${po.id}`} className="btn-primary"><FileText className="h-4 w-4" /> Create Purchase Invoice</Link>
            </Can>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="glass-card space-y-4 p-6 lg:col-span-1">
          <div><p className="text-xs text-slate-500">Status</p><StatusBadge status={poStatusLabel(po.status)} /></div>
          <div><p className="text-xs text-slate-500">Supplier</p><p className="font-medium">{po.supplier?.name}</p></div>
          <div><p className="text-xs text-slate-500">Expected Delivery</p><p className="font-medium">{formatDate(po.expectedDelivery)}</p></div>
          <div><p className="text-xs text-slate-500">Total Amount</p><p className="text-xl font-bold text-primary-600">{formatCurrency(Number(po.totalAmount))}</p></div>
          {po.notes && <div><p className="text-xs text-slate-500">Notes</p><p className="text-sm">{po.notes}</p></div>}
        </div>

        <div className="glass-card p-6 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold">Order Items & Tally</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="pb-3 text-left text-xs font-semibold uppercase text-slate-500">Product</th>
                  <th className="pb-3 text-right text-xs font-semibold uppercase text-slate-500">Ordered</th>
                  <th className="pb-3 text-right text-xs font-semibold uppercase text-slate-500">Invoiced</th>
                  <th className="pb-3 text-right text-xs font-semibold uppercase text-slate-500">Received</th>
                  <th className="pb-3 text-right text-xs font-semibold uppercase text-slate-500">Remaining</th>
                  <th className="pb-3 text-right text-xs font-semibold uppercase text-slate-500">Cost</th>
                </tr>
              </thead>
              <tbody>
                {po.items.map((item) => {
                  const t = tally?.lines?.find((l) => l.productId === item.productId);
                  return (
                    <tr key={item.id} className="border-b border-slate-50 dark:border-slate-800/50">
                      <td className="py-3">
                        <p className="font-medium">{item.product?.name}</p>
                        <p className="text-xs text-slate-400">{item.product?.code}</p>
                      </td>
                      <td className="py-3 text-right">{t?.orderedQty ?? item.quantity}</td>
                      <td className="py-3 text-right">{t?.invoicedQty ?? 0}</td>
                      <td className="py-3 text-right">{t?.receivedQty ?? 0}</td>
                      <td className="py-3 text-right font-medium">{t?.remainingQty ?? item.quantity}</td>
                      <td className="py-3 text-right">{formatCurrency(Number(item.costPrice))}</td>
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
