import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, PackageCheck, Pencil } from 'lucide-react';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import Can from '../../components/auth/Can';
import { purchaseInvoicesApi } from '../../api/procurement';
import { getErrorMessage } from '../../api/client';
import { formatCurrency, formatDate, isInvoiceReadyForGrn } from '../../utils/helpers';

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

  const vatOn = invoice.vatEnabled ?? (Number(invoice.vatRate) > 0 && !invoice.purchaseWithVat);

  return (
    <div>
      <PageHeader
        title={invoice.supplierInvoiceNo || 'Purchase Invoice'}
        subtitle={`${invoice.supplier?.name} • ${formatDate(invoice.createdAt)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate('/purchase-invoices')} className="btn-secondary"><ArrowLeft className="h-4 w-4" /> Back</button>
            {!invoice.grn && (
              <Can permission="purchase_invoices.edit">
                <Link to={`/purchase-invoices/${id}/edit`} className="btn-secondary"><Pencil className="h-4 w-4" /> Edit</Link>
              </Can>
            )}
            {!invoice.grn && isInvoiceReadyForGrn(invoice) && (
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
          <div>
            <p className="text-xs text-slate-500">VAT</p>
            <p>{vatOn ? `Yes (${Number(invoice.vatRate)}%)` : 'No'}</p>
          </div>
          <div><p className="text-xs text-slate-500">Subtotal</p><p>{formatCurrency(Number(invoice.subtotal))}</p></div>
          <div><p className="text-xs text-slate-500">VAT Amount</p><p>{formatCurrency(Number(invoice.vatAmount))}</p></div>
          <div><p className="text-xs text-slate-500">Grand Total</p><p className="text-xl font-bold text-primary-600">{formatCurrency(Number(invoice.total))}</p></div>
          {invoice.grn ? (
            <div>
              <p className="text-xs text-slate-500">GRN</p>
              <Link to={`/grn/${invoice.grn.id}`} className="font-medium text-primary-600 hover:underline">{invoice.grn.grnNumber}</Link>
            </div>
          ) : (
            <Can permission="grn.create">
              {isInvoiceReadyForGrn(invoice) ? (
                <Link to={`/grn/new?purchaseInvoiceId=${invoice.id}`} className="btn-primary mt-2 w-full justify-center">
                  <PackageCheck className="h-4 w-4" /> Create GRN
                </Link>
              ) : (
                <p className="mt-2 text-xs text-amber-600">
                  {!invoice.po?.poNumber ? 'Link a purchase order before GRN.' : 'Enter a purchase invoice number before GRN.'}
                </p>
              )}
            </Can>
          )}
        </div>

        <div className="glass-card p-6 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold">Invoice Items & GRN Tally</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr>
                  <th className="px-4 pb-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Description</th>
                  <th className="px-4 pb-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Unit Price</th>
                  <th className="px-4 pb-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Units</th>
                  <th className="px-4 pb-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">VAT</th>
                  <th className="px-4 pb-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total</th>
                  <th className="px-4 pb-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Received</th>
                  <th className="px-4 pb-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => {
                  const t = tally?.lines?.find((l) => l.productId === item.productId);
                  return (
                    <tr key={item.id} className="rounded-2xl bg-slate-50/70 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900/40 dark:ring-slate-800">
                      <td className="rounded-l-2xl px-4 py-4 align-top">
                        <p className="font-medium text-slate-800 dark:text-slate-100">{item.description || item.product?.name}</p>
                        <p className="mt-1 text-xs text-slate-400">{item.product?.code}</p>
                      </td>
                      <td className="px-4 py-4 text-right align-top whitespace-nowrap text-slate-700 dark:text-slate-200">{formatCurrency(Number(item.unitPrice))}</td>
                      <td className="px-4 py-4 text-right align-top font-medium text-slate-700 dark:text-slate-200">{item.units}</td>
                      <td className="px-4 py-4 text-right align-top whitespace-nowrap text-slate-700 dark:text-slate-200">{formatCurrency(Number(item.vatAmount))}</td>
                      <td className="px-4 py-4 text-right align-top whitespace-nowrap font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(Number(item.lineTotal))}</td>
                      <td className="px-4 py-4 text-right align-top font-medium text-slate-700 dark:text-slate-200">{t?.receivedQty ?? 0}</td>
                      <td className="rounded-r-2xl px-4 py-4 text-right align-top font-semibold text-amber-600">{t?.remainingQty ?? item.units}</td>
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
