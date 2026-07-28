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
import { formatWarrantyLabel } from '../../utils/warranty';

function grnLineTitle(item) {
  const description = item.description?.trim();
  if (description) return description;
  return item.product?.name || '—';
}

function grnLineMeta(item) {
  const warranty = formatWarrantyLabel(item.warrantyMonths);
  return warranty ? `Warranty: ${warranty}` : '';
}

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

        <div className="glass-card p-6 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-100">Received Items</h3>
          <div className="space-y-4">
            {grn.items.map((item) => {
              const meta = grnLineMeta(item);
              return (
                <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-900/40">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">
                        {item.category?.name || 'Uncategorized'}
                      </p>
                      <p className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
                        {grnLineTitle(item)}
                      </p>
                      {meta && (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{meta}</p>
                      )}
                    </div>

                    <div className="grid shrink-0 grid-cols-3 gap-3 text-right text-xs sm:gap-4">
                      <div>
                        <p className="text-slate-500">Purchase</p>
                        <p className="mt-0.5 font-medium text-slate-800 dark:text-slate-200">{formatCurrency(Number(item.purchasePrice))}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Cost ex-VAT</p>
                        <p className="mt-0.5 font-medium text-slate-800 dark:text-slate-200">{formatCurrency(Number(item.costExVat))}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Sell</p>
                        <p className="mt-0.5 font-semibold text-emerald-600">
                          {formatCurrency(Number(item.sellingPrice))}
                          <span className="ml-1 font-normal text-slate-500">({item.sellingPriceMode})</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-slate-200/80 pt-4 dark:border-slate-700">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Serialized units ({item.productUnits?.length || 0})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {item.productUnits?.length ? item.productUnits.map((u) => (
                        <span
                          key={u.id}
                          className={`rounded-full px-2.5 py-1 font-mono text-xs ${
                            u.status === 'IN_STOCK'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                          }`}
                        >
                          {u.barcode}
                        </span>
                      )) : (
                        <span className="text-xs text-slate-400">No units linked</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ConfirmDialog isOpen={confirmCancel} onClose={() => setConfirmCancel(false)} onConfirm={handleCancel} title="Cancel GRN" message="Void all stock units from this GRN? Units already sold cannot be cancelled." confirmText="Cancel GRN" />
    </div>
  );
}
