import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, PackageCheck, Receipt, Trash2, Printer } from 'lucide-react';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import Can from '../../components/auth/Can';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import BarcodeInput from '../../components/ui/BarcodeInput';
import Modal from '../../components/ui/Modal';
import InvoicePrintView from '../../components/billing/InvoicePrintView';
import DeliveryNotePrintView from '../../components/deliveryNotes/DeliveryNotePrintView';
import { deliveryNotesApi } from '../../api/procurement';
import { customersApi } from '../../api/masters';
import { getErrorMessage } from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { dnStatusLabel, PAYMENT_METHODS } from '../../utils/constants';
import { PAYMENT_METHOD_API, PAYMENT_METHOD_LABEL } from '../../api/ops';
import { printElement } from '../../utils/printDocument';
import { useAuth } from '../../context/AuthContext';

export default function DeliveryNoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dn, setDn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanningProductId, setScanningProductId] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showDnPrint, setShowDnPrint] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [invoiceForm, setInvoiceForm] = useState({ customerId: '', paymentMethod: 'Cash' });
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [generatedInvoice, setGeneratedInvoice] = useState(null);

  const reload = async () => {
    const data = await deliveryNotesApi.get(id);
    setDn(data);
    if (data.customerId) {
      setInvoiceForm((f) => ({ ...f, customerId: data.customerId }));
    }
  };

  useEffect(() => {
    reload()
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
    customersApi.list({ pageSize: 200 }).then((r) => setCustomers(r.items || r)).catch(() => {});
  }, [id]);

  const pendingByProduct = useMemo(() => {
    const map = {};
    (dn?.units || []).forEach((unit) => {
      map[unit.productId] ||= [];
      map[unit.productId].push(unit);
    });
    return map;
  }, [dn]);

  const readyToComplete = useMemo(() => {
    if (!dn || dn.status !== 'DRAFT') return false;
    return dn.items.every((item) => (pendingByProduct[item.productId] || []).length === item.units);
  }, [dn, pendingByProduct]);

  const inStockCount = useMemo(() => {
    if (!dn) return 0;
    return dn.items.reduce(
      (sum, item) => sum + (item.productUnits || []).filter((u) => u.status === 'IN_STOCK').length,
      0
    );
  }, [dn]);

  const handleScan = async (productId, barcode) => {
    const item = dn.items.find((i) => i.productId === productId);
    if (!item) return;
    const scanned = (pendingByProduct[productId] || []).length;
    if (scanned >= item.units) {
      toast.error('Quantity exceeded for this product');
      return;
    }
    setScanningProductId(productId);
    try {
      await deliveryNotesApi.reserveBarcode({
        deliveryNoteId: dn.id,
        productId,
        barcode,
      });
      toast.success(`Scanned ${barcode}`);
      await reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to scan barcode'));
    } finally {
      setScanningProductId('');
    }
  };

  const removePending = async (unitId) => {
    try {
      await deliveryNotesApi.removePendingUnit(unitId);
      await reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to remove barcode'));
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await deliveryNotesApi.complete(dn.id);
      toast.success('Delivery note completed — stock updated');
      await reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to complete delivery note'));
    } finally {
      setCompleting(false);
      setConfirmComplete(false);
    }
  };

  const handleCancel = async () => {
    try {
      await deliveryNotesApi.cancel(id, 'Cancelled from detail view');
      toast.success('Delivery note cancelled');
      await reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to cancel delivery note'));
    }
  };

  const handleCreateInvoice = async () => {
    if (!invoiceForm.customerId) {
      toast.error('Select a customer');
      return;
    }
    setCreatingInvoice(true);
    try {
      const invoice = await deliveryNotesApi.createInvoice(dn.id, {
        customerId: invoiceForm.customerId,
        paymentMethod: PAYMENT_METHOD_API[invoiceForm.paymentMethod],
      });
      const customer = customers.find((c) => c.id === invoice.customerId) || invoice.customer;
      setGeneratedInvoice({
        ...invoice,
        date: invoice.createdAt,
        cashier: invoice.cashier?.name || user?.name,
        paymentMethod: PAYMENT_METHOD_LABEL[invoice.paymentMethod] || invoice.paymentMethod,
        customer,
        items: invoice.items.map((item) => ({
          productId: item.productId,
          productName: item.product?.name,
          productCode: item.product?.code,
          categoryName: item.categoryName ?? null,
          itemDescription: item.itemDescription ?? null,
          barcode: item.productUnit?.barcode,
          unitPrice: item.unitPrice,
          discount: item.discount,
          quantity: 1,
          warrantyMonths: item.warrantyMonths ?? null,
        })),
      });
      setShowInvoiceModal(false);
      toast.success('Invoice created from delivery note');
      await reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to create invoice'));
    } finally {
      setCreatingInvoice(false);
    }
  };

  if (loading) return <p className="py-16 text-center text-slate-500">Loading…</p>;
  if (!dn) return <p className="py-16 text-center text-slate-500">Delivery note not found</p>;

  return (
    <div>
      <PageHeader
        title={dn.dnNumber}
        subtitle={`Created ${formatDate(dn.createdAt)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => navigate('/delivery-notes')} className="btn-secondary">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowDnPrint(true)}>
              <Printer className="h-4 w-4" /> Print DN
            </button>
            {dn.status === 'DRAFT' && (
              <Can permission="delivery_notes.create">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!readyToComplete || completing}
                  onClick={() => setConfirmComplete(true)}
                >
                  <PackageCheck className="h-4 w-4" /> Confirm Stock In
                </button>
              </Can>
            )}
            {(dn.status === 'COMPLETED' || dn.status === 'INVOICED') && inStockCount > 0 && (
              <Can permission="invoices.create">
                <button type="button" className="btn-primary" onClick={() => setShowInvoiceModal(true)}>
                  <Receipt className="h-4 w-4" /> Create Invoice
                </button>
              </Can>
            )}
            {(dn.status === 'DRAFT' || dn.status === 'COMPLETED') && (
              <Can permission="delivery_notes.cancel">
                <button type="button" className="btn-danger" onClick={() => setConfirmCancel(true)}>
                  Cancel DN
                </button>
              </Can>
            )}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="glass-card p-4">
          <p className="text-xs text-slate-500">Status</p>
          <StatusBadge status={dnStatusLabel(dn.status)} />
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-slate-500">Supplier</p>
          <p className="font-medium">{dn.supplier?.name || '—'}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-slate-500">Customer</p>
          <p className="font-medium">{dn.customer?.name || '—'}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-slate-500">INV No</p>
          <p className="font-medium">{dn.invNo || '—'}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-slate-500">Received By</p>
          <p className="font-medium">{dn.receivedBy?.name || '—'}</p>
        </div>
      </div>

      {dn.notes && (
        <div className="glass-card mb-6 p-4">
          <p className="text-xs text-slate-500">Remarks</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{dn.notes}</p>
        </div>
      )}

      <div className="space-y-4">
        {dn.items.map((item) => {
          const pending = pendingByProduct[item.productId] || [];
          const stocked = item.productUnits || [];
          const receivedQty = dn.status === 'DRAFT' ? pending.length : stocked.length;
          return (
            <div key={item.id} className="glass-card space-y-4 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-white">
                    {item.category?.name || item.product?.name || 'Item'}
                  </h3>
                  {item.product?.code && (
                    <p className="text-xs text-slate-500">{item.product.code}</p>
                  )}
                  {item.description && <p className="mt-1 text-sm">{item.description}</p>}
                </div>
                <div className="text-right text-sm">
                  <p>Purchase: {formatCurrency(Number(item.purchasePrice))}</p>
                  <p className="font-semibold text-emerald-600">Sell: {formatCurrency(Number(item.sellingPrice))}</p>
                  <p className="text-xs text-slate-500">{receivedQty} / {item.units} units</p>
                </div>
              </div>

              {dn.status === 'DRAFT' && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/30">
                  <BarcodeInput
                    onScan={(value) => handleScan(item.productId, value)}
                    placeholder={
                      scanningProductId === item.productId
                        ? 'Scanning…'
                        : `Scan barcode for ${item.product?.code || 'product'}…`
                    }
                    disabled={scanningProductId === item.productId || pending.length >= item.units}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {pending.map((unit) => (
                      <span
                        key={unit.id}
                        className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-mono text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                      >
                        {unit.barcode}
                        <button type="button" onClick={() => removePending(unit.id)} className="text-amber-600 hover:text-red-600">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {dn.status !== 'DRAFT' && (
                <div className="flex flex-wrap gap-2">
                  {stocked.map((unit) => (
                    <span
                      key={unit.id}
                      className={`rounded-full px-2.5 py-1 font-mono text-xs ${
                        unit.status === 'IN_STOCK'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                          : unit.status === 'SOLD'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                      }`}
                    >
                      {unit.barcode} · {unit.status}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {dn.invoices?.length > 0 && (
        <div className="glass-card mt-6 p-6">
          <h3 className="mb-3 font-semibold">Linked Invoices</h3>
          <ul className="space-y-2 text-sm">
            {dn.invoices.map((inv) => (
              <li key={inv.id} className="flex justify-between">
                <span className="font-medium text-primary-600">{inv.invoiceNumber}</span>
                <span>{formatCurrency(Number(inv.grandTotal))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmComplete}
        onClose={() => setConfirmComplete(false)}
        onConfirm={handleComplete}
        title="Confirm Stock In"
        message="Mark all scanned units as in stock? This adds them to inventory."
        confirmText={completing ? 'Working…' : 'Confirm Stock In'}
      />
      <ConfirmDialog
        isOpen={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={handleCancel}
        title="Cancel Delivery Note"
        message="Cancel this delivery note? Pending scans will be removed; completed stock units will be voided if unsold."
        confirmText="Cancel DN"
      />

      <Modal isOpen={showInvoiceModal} onClose={() => setShowInvoiceModal(false)} title="Create Invoice from DN">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Creates a sales invoice for all <strong>{inStockCount}</strong> in-stock unit(s) on this delivery note.
          </p>
          <div>
            <label className="label">Customer</label>
            <select
              className="select-field"
              value={invoiceForm.customerId}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, customerId: e.target.value })}
            >
              <option value="">-- Select customer --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Payment Method</label>
            <select
              className="select-field"
              value={invoiceForm.paymentMethod}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, paymentMethod: e.target.value })}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setShowInvoiceModal(false)}>Cancel</button>
            <button type="button" className="btn-primary" disabled={creatingInvoice} onClick={handleCreateInvoice}>
              {creatingInvoice ? 'Creating…' : 'Generate Invoice'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showDnPrint}
        onClose={() => setShowDnPrint(false)}
        title="Delivery Note"
        size="xl"
      >
        <DeliveryNotePrintView
          dn={dn}
          onClose={() => setShowDnPrint(false)}
          onPrint={() => {
            printElement('dn-print-content').catch((err) => {
              console.error(err);
              toast.error('Could not open print preview');
            });
          }}
        />
      </Modal>

      <Modal
        isOpen={Boolean(generatedInvoice)}
        onClose={() => setGeneratedInvoice(null)}
        title="Tax Invoice"
        size="xl"
      >
        {generatedInvoice && (
          <InvoicePrintView
            invoice={generatedInvoice}
            onClose={() => setGeneratedInvoice(null)}
            onPrint={() => printElement('invoice-print-content')}
          />
        )}
      </Modal>
    </div>
  );
}
