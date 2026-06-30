import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import Can from '../../components/auth/Can';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { grnsApi } from '../../api/procurement';
import { getErrorMessage } from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { grnStatusLabel } from '../../utils/constants';

export default function GRNDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [grn, setGrn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const reload = async () => {
    const data = await grnsApi.get(id);
    setGrn(data);
  };

  useEffect(() => {
    reload().catch((err) => toast.error(getErrorMessage(err))).finally(() => setLoading(false));
  }, [id]);

  const handleCancel = async () => {
    try {
      await grnsApi.cancel(id, 'Cancelled from detail view');
      toast.success('GRN cancelled');
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to cancel GRN'));
    }
  };

  if (loading) return <p className="py-16 text-center text-slate-500">Loading…</p>;
  if (!grn) return <p className="py-16 text-center text-slate-500">GRN not found</p>;

  return (
    <div>
      <PageHeader title={grn.grnNumber} subtitle={`Received ${formatDate(grn.receivedDate)}`} actions={
        <div className="flex gap-2">
          <button onClick={() => navigate('/grn')} className="btn-secondary"><ArrowLeft className="h-4 w-4" /> Back</button>
          {grn.status === 'COMPLETED' && (
            <Can permission="grn.cancel">
              <button onClick={() => setConfirmCancel(true)} className="btn-danger">Cancel GRN</button>
            </Can>
          )}
        </div>
      } />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="glass-card space-y-3 p-6">
          <div><p className="text-xs text-slate-500">Status</p><StatusBadge status={grnStatusLabel(grn.status)} /></div>
          <div><p className="text-xs text-slate-500">Supplier</p><p className="font-medium">{grn.supplier?.name}</p></div>
          <div><p className="text-xs text-slate-500">Received By</p><p>{grn.receivedBy?.name || '—'}</p></div>
          <div><p className="text-xs text-slate-500">Purchase with VAT</p><p>{grn.purchaseWithVat ? 'Yes' : 'No'}</p></div>
          {grn.po && <div><p className="text-xs text-slate-500">PO</p><p className="text-primary-600">{grn.po.poNumber}</p></div>}
          {grn.purchaseInvoice && <div><p className="text-xs text-slate-500">Purchase Invoice</p><p>{grn.purchaseInvoice.supplierInvoiceNo || grn.purchaseInvoice.id}</p></div>}
          {grn.notes && <div><p className="text-xs text-slate-500">Notes</p><p className="text-sm">{grn.notes}</p></div>}
        </div>

        <div className="glass-card space-y-6 p-6 lg:col-span-2">
          {grn.items.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-100 p-4 dark:border-slate-800">
              <div className="mb-3 flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-medium">{item.product?.name}</p>
                  <p className="text-xs text-slate-500">{item.product?.code} • {item.category?.name || 'No category'}</p>
                  {item.description && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.description}</p>}
                </div>
                <div className="text-right text-sm">
                  <p>Purchase: {formatCurrency(Number(item.purchasePrice))}</p>
                  <p>Cost ex-VAT: {formatCurrency(Number(item.costExVat))}</p>
                  <p className="font-semibold text-emerald-600">Sell: {formatCurrency(Number(item.sellingPrice))} ({item.sellingPriceMode})</p>
                </div>
              </div>
              <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Serialized units ({item.productUnits?.length || 0})</p>
              <div className="flex flex-wrap gap-2">
                {item.productUnits?.map((u) => (
                  <span key={u.id} className={`rounded-full px-2.5 py-1 font-mono text-xs ${u.status === 'IN_STOCK' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                    {u.barcode}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog isOpen={confirmCancel} onClose={() => setConfirmCancel(false)} onConfirm={handleCancel} title="Cancel GRN" message="Void all stock units from this GRN? Units already sold cannot be cancelled." confirmText="Cancel GRN" />
    </div>
  );
}
