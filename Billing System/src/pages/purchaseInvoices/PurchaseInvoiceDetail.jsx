import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, PackageCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import Can from '../../components/auth/Can';
import { purchaseInvoicesApi } from '../../api/procurement';
import { getErrorMessage } from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/helpers';

export default function PurchaseInvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [tally, setTally] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [inv, t] = await Promise.all([
          purchaseInvoicesApi.get(id),
          purchaseInvoicesApi.tally(id),
        ]);
        if (!cancelled) { setInvoice(inv); setTally(t); }
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to load invoice'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <p className="py-16 text-center text-slate-500">Loading…</p>;
  if (!invoice) return <p className="py-16 text-center text-slate-500">Invoice not found</p>;

  return (
    <div>
      <PageHeader
        title={invoice.supplierInvoiceNo || 'Purchase Invoice'}
        subtitle={`${invoice.supplier?.name} • ${formatDate(invoice.createdAt)}`}
        actions={
          <div className="flex gap-2">
            <button onClick={() => navigate('/purchase-invoices')} className="btn-secondary"><ArrowLeft className="h-4 w-4" /> Back</button>
            {!invoice.grn && (
              <Can permission="grn.create">
                <Link to={`/grn/new?purchaseInvoiceId=${invoice.id}`} className="btn-primary"><PackageCheck className="h-4 w-4" /> Create GRN</Link>
              </Can>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="glass-card space-y-3 p-6">
          <div><p className="text-xs text-slate-500">PO</p><p className="font-medium">{invoice.po?.poNumber || '—'}</p></div>
          <div><p className="text-xs text-slate-500">Purchase with VAT</p><p>{invoice.purchaseWithVat ? 'Yes' : 'No'} ({Number(invoice.vatRate)}%)</p></div>
          <div><p className="text-xs text-slate-500">Subtotal</p><p>{formatCurrency(Number(invoice.subtotal))}</p></div>
          <div><p className="text-xs text-slate-500">VAT</p><p>{formatCurrency(Number(invoice.vatAmount))}</p></div>
          <div><p className="text-xs text-slate-500">Total</p><p className="text-xl font-bold text-primary-600">{formatCurrency(Number(invoice.total))}</p></div>
          {invoice.grn && <div><p className="text-xs text-slate-500">GRN</p><p className="text-primary-600">{invoice.grn.grnNumber}</p></div>}
        </div>

        <div className="glass-card p-6 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold">Items & Tally</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="pb-3 text-left text-xs uppercase text-slate-500">Product</th>
                <th className="pb-3 text-right text-xs uppercase text-slate-500">Unit Price</th>
                <th className="pb-3 text-right text-xs uppercase text-slate-500">Units</th>
                <th className="pb-3 text-right text-xs uppercase text-slate-500">Received</th>
                <th className="pb-3 text-right text-xs uppercase text-slate-500">Remaining</th>
                <th className="pb-3 text-right text-xs uppercase text-slate-500">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => {
                const t = tally?.lines?.find((l) => l.productId === item.productId);
                return (
                  <tr key={item.id} className="border-b border-slate-50 dark:border-slate-800/50">
                    <td className="py-3">{item.product?.name}</td>
                    <td className="py-3 text-right">{formatCurrency(Number(item.unitPrice))}</td>
                    <td className="py-3 text-right">{item.units}</td>
                    <td className="py-3 text-right">{t?.receivedQty ?? 0}</td>
                    <td className="py-3 text-right font-medium">{t?.remainingQty ?? item.units}</td>
                    <td className="py-3 text-right">{formatCurrency(Number(item.lineTotal))}</td>
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
