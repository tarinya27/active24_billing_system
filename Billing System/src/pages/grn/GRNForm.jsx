import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, PackageCheck, FileText, CalendarDays, Building2, Boxes, CircleCheckBig } from 'lucide-react';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import BarcodeInput from '../../components/ui/BarcodeInput';
import { grnsApi, purchaseInvoicesApi } from '../../api/procurement';
import { categoriesApi } from '../../api/masters';
import { getErrorMessage } from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { calcGrnAutoSellingPrice } from '../../utils/pricing';
import { formatWarrantyLabel } from '../../utils/warranty';

function buildLine(product, {
  unitPrice = 0,
  expectedUnits = 0,
  description = '',
  warrantyMonths = null,
  purchaseWithVat = false,
  vatRate = 0,
  scannedUnits = [],
} = {}) {
  const purchasePrice = Number(unitPrice) || 0;
  return {
    productId: product?.id || '',
    product,
    categoryId: product?.category?.id || product?.categoryId || '',
    description: description || product?.description || product?.name || '',
    warrantyMonths,
    purchasePrice,
    purchasePriceLocked: true,
    sellingPriceMode: 'AUTO',
    sellingPrice: calcGrnAutoSellingPrice(purchasePrice),
    scannedUnits,
    expectedUnits,
    purchaseWithVat,
    vatRate,
  };
}

function getLineCounts(line) {
  const invoiceQty = Number(line.expectedUnits) || 0;
  const receivedQty = line.scannedUnits.length;
  return {
    invoiceQty,
    receivedQty,
    remainingQty: Math.max(0, invoiceQty - receivedQty),
    progress: invoiceQty > 0 ? Math.min(100, Math.round((receivedQty / invoiceQty) * 100)) : 0,
  };
}

function summaryCard(icon, label, value, accent = '') {
  const Icon = icon;
  return (
    <div className="glass-card flex items-start gap-3 p-5">
      <div className={`rounded-xl p-2 ${accent || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 truncate text-base font-semibold text-slate-800 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

export default function GRNForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillPurchaseInvoiceId = searchParams.get('purchaseInvoiceId');

  const [categories, setCategories] = useState([]);
  const [purchaseInvoiceId, setPurchaseInvoiceId] = useState(prefillPurchaseInvoiceId || '');
  const [poId, setPoId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState('PENDING');
  const [scanningProductId, setScanningProductId] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingInvoice, setLoadingInvoice] = useState(Boolean(prefillPurchaseInvoiceId));
  const [form, setForm] = useState({
    supplierId: '',
    poRef: '',
    purchaseWithVat: false,
    vatRate: 0,
    notes: '',
    lines: [],
  });

  useEffect(() => {
    categoriesApi.list().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (!prefillPurchaseInvoiceId) return;
    setLoadingInvoice(true);
    purchaseInvoicesApi.get(prefillPurchaseInvoiceId).then((pi) => {
      if (pi.grn) {
        toast.warning('This purchase invoice already has a GRN');
        navigate(`/purchase-invoices/${pi.id}`, { replace: true });
        return;
      }
      if (!pi.poId || !pi.po?.poNumber) {
        toast.error('Purchase invoice must be linked to a purchase order');
        navigate(`/purchase-invoices/${pi.id}`, { replace: true });
        return;
      }
      if (!pi.supplierInvoiceNo?.trim()) {
        toast.error('Purchase invoice number is required before GRN');
        navigate(`/purchase-invoices/${pi.id}`, { replace: true });
        return;
      }

      const pendingUnitsByProduct = (pi.units || [])
        .filter((unit) => unit.status === 'PENDING_GRN')
        .reduce((acc, unit) => {
          acc[unit.productId] ||= [];
          acc[unit.productId].push(unit);
          return acc;
        }, {});

      setPurchaseInvoiceId(pi.id);
      setPoId(pi.poId);
      setInvoiceNumber(pi.supplierInvoiceNo.trim());
      setInvoiceDate(pi.createdAt);
      setSupplierName(pi.supplier?.name || '—');
      setInvoiceStatus(pi.status || 'PENDING');
      setForm((f) => ({
        ...f,
        supplierId: pi.supplierId,
        purchaseWithVat: false,
        vatRate: pi.vatEnabled ? Number(pi.vatRate) : 0,
        poRef: pi.po?.poNumber || f.poRef,
        lines: pi.items.map((item) => ({
          ...buildLine(item.product, {
            unitPrice: Number(item.unitPrice),
            expectedUnits: item.units,
            description: item.description || item.product?.name,
            warrantyMonths: item.warrantyMonths ?? null,
            purchaseWithVat: false,
            vatRate: pi.vatEnabled ? Number(pi.vatRate) : 0,
            scannedUnits: pendingUnitsByProduct[item.productId] || [],
          }),
        })),
      }));
    }).catch(() => {
      toast.error('Failed to load purchase invoice');
      navigate('/purchase-invoices', { replace: true });
    }).finally(() => setLoadingInvoice(false));
  }, [prefillPurchaseInvoiceId, navigate]);

  const enrichedLines = useMemo(
    () => form.lines.map((line) => {
      const autoSell = calcGrnAutoSellingPrice(line.purchasePrice);
      const sellingPrice = line.sellingPriceMode === 'MANUAL' ? Number(line.sellingPrice) : autoSell;
      return { ...line, sellingPrice, autoSell, ...getLineCounts(line) };
    }),
    [form.lines]
  );

  const summary = useMemo(() => {
    const totalInvoiceQty = enrichedLines.reduce((sum, line) => sum + line.invoiceQty, 0);
    const totalReceived = enrichedLines.reduce((sum, line) => sum + line.receivedQty, 0);
    const remaining = Math.max(0, totalInvoiceQty - totalReceived);
    return {
      totalInvoiceQty,
      totalReceived,
      remaining,
      readyToConfirm: enrichedLines.length > 0 && enrichedLines.every((line) => line.receivedQty === line.invoiceQty),
    };
  }, [enrichedLines]);

  const updateLine = (index, patch) => {
    const lines = [...form.lines];
    lines[index] = { ...lines[index], ...patch };
    if (patch.purchasePrice !== undefined || patch.sellingPriceMode !== undefined) {
      if (lines[index].sellingPriceMode === 'AUTO') {
        lines[index].sellingPrice = calcGrnAutoSellingPrice(lines[index].purchasePrice);
      }
    }
    setForm({ ...form, lines });
  };

  const handleLineBarcodeScan = async (lineIndex, scanned) => {
    const line = form.lines[lineIndex];
    if (!line) return;
    const { receivedQty, invoiceQty } = getLineCounts(line);
    if (receivedQty >= invoiceQty) {
      toast.error('Invoice quantity exceeded.');
      return;
    }

    setScanningProductId(line.productId);
    try {
      const unit = await grnsApi.reserveBarcode({
        purchaseInvoiceId,
        productId: line.productId,
        barcode: scanned,
        categoryId: line.categoryId || null,
        description: line.description,
        purchasePrice: Number(line.purchasePrice),
        sellingPriceMode: line.sellingPriceMode,
        sellingPrice: line.sellingPriceMode === 'MANUAL' ? Number(line.sellingPrice) : undefined,
        purchaseWithVat: form.purchaseWithVat,
        vatRate: Number(form.vatRate),
      });
      const lines = [...form.lines];
      lines[lineIndex] = {
        ...line,
        scannedUnits: [unit, ...line.scannedUnits],
      };
      setForm((prev) => ({ ...prev, lines }));
      toast.success(`Scanned ${unit.barcode}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to scan barcode'));
    } finally {
      setScanningProductId('');
    }
  };

  const removePendingUnit = async (lineIndex, unitId) => {
    try {
      await grnsApi.removePendingUnit(unitId);
      const lines = [...form.lines];
      lines[lineIndex] = {
        ...lines[lineIndex],
        scannedUnits: lines[lineIndex].scannedUnits.filter((unit) => unit.id !== unitId),
      };
      setForm((prev) => ({ ...prev, lines }));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to remove scanned barcode'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplierId) { toast.error('Select a supplier'); return; }
    if (!poId) { toast.error('Purchase order is required'); return; }
    if (form.lines.length === 0) { toast.error('Add at least one product line'); return; }
    if (!summary.readyToConfirm) {
      toast.error('Receive all invoice quantities before confirming GRN');
      return;
    }

    setSaving(true);
    try {
      const noteParts = [
        form.notes,
        form.poRef ? `PO: ${form.poRef}` : '',
        invoiceNumber ? `PI: ${invoiceNumber}` : '',
      ].filter(Boolean);
      await grnsApi.complete({
        supplierId: form.supplierId,
        poId,
        purchaseInvoiceId,
        purchaseWithVat: form.purchaseWithVat,
        vatRate: Number(form.vatRate),
        notes: noteParts.join('\n'),
        lines: form.lines.map((line) => ({
          productId: line.productId,
          categoryId: line.categoryId || null,
          description: line.description,
          purchasePrice: Number(line.purchasePrice),
          sellingPriceMode: line.sellingPriceMode,
          sellingPrice: line.sellingPriceMode === 'MANUAL' ? Number(line.sellingPrice) : undefined,
          warrantyMonths: line.warrantyMonths ?? null,
        })),
      });
      toast.success('GRN confirmed — stock updated');
      navigate('/grn');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to complete GRN'));
    } finally {
      setSaving(false);
    }
  };

  if (!prefillPurchaseInvoiceId) {
    return (
      <div className="py-20 text-center">
        <FileText className="mx-auto mb-4 h-12 w-12 text-slate-400" />
        <h2 className="text-lg font-semibold">Purchase invoice required</h2>
        <p className="mt-2 text-sm text-slate-500">Create a purchase invoice first, then open GRN from the invoice detail page.</p>
        <Link to="/purchase-invoices" className="btn-primary mt-6 inline-flex">Go to Purchase Invoices</Link>
      </div>
    );
  }

  if (loadingInvoice) {
    return <p className="py-16 text-center text-slate-500">Loading purchase invoice…</p>;
  }

  return (
    <div>
      <PageHeader
        title="GRN — Goods Received Note"
        subtitle="Receive every physical unit by barcode before confirming stock"
        actions={
          <button type="button" onClick={() => navigate(`/purchase-invoices/${purchaseInvoiceId}`)} className="btn-secondary"><ArrowLeft className="h-4 w-4" /> Back to Invoice</button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCard(FileText, 'Purchase Invoice', invoiceNumber || '—', 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300')}
          {summaryCard(Building2, 'Supplier', supplierName || '—', 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300')}
          {summaryCard(CalendarDays, 'Invoice Date', formatDate(invoiceDate), 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300')}
          {summaryCard(Boxes, 'GRN Status', summary.readyToConfirm ? 'Ready to Confirm' : invoiceStatus === 'RECEIVED' ? 'Received' : 'Pending Scan', summary.readyToConfirm ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}
        </div>

        <div className="glass-card grid grid-cols-1 gap-4 p-6 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="label">Purchase Order No.</label>
            <p className="input-field bg-slate-50 font-semibold dark:bg-slate-800/50">{form.poRef || '—'}</p>
          </div>
          <div>
            <label className="label">Invoice Quantity</label>
            <p className="input-field bg-slate-50 font-semibold dark:bg-slate-800/50">{summary.totalInvoiceQty}</p>
          </div>
          <div>
            <label className="label">Total Received</label>
            <p className="input-field bg-emerald-50 font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">{summary.totalReceived}</p>
          </div>
          <div>
            <label className="label">Remaining</label>
            <p className="input-field bg-amber-50 font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">{summary.remaining}</p>
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input-field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        {enrichedLines.map((line, lineIndex) => {
          const categoryName = categories.find((c) => c.id === line.categoryId)?.name
            || line.product?.category?.name
            || '—';
          const isComplete = line.receivedQty >= line.invoiceQty;

          return (
            <div key={`${line.productId}-${lineIndex}`} className="glass-card space-y-5 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-white">
                    <PackageCheck className="h-4 w-4 text-primary-600" />
                    {line.product?.name || line.productId}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">{line.product?.code || '—'}</p>
                </div>
                <div className="min-w-[220px] flex-1">
                  <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>Receiving Progress</span>
                    <span>{line.receivedQty} / {line.invoiceQty}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all ${isComplete ? 'bg-emerald-500' : 'bg-primary-600'}`}
                      style={{ width: `${line.progress}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="label">Category</label>
                  <p className="input-field bg-slate-50 dark:bg-slate-800/50">{categoryName}</p>
                </div>
                <div className="xl:col-span-2">
                  <label className="label">Item Description</label>
                  <input className="input-field" value={line.description} onChange={(e) => updateLine(lineIndex, { description: e.target.value })} />
                </div>
                <div>
                  <label className="label">Warranty</label>
                  <p className="input-field bg-slate-50 dark:bg-slate-800/50">
                    {formatWarrantyLabel(line.warrantyMonths) || '—'}
                  </p>
                </div>
                <div>
                  <label className="label">Purchase Price</label>
                  <p className="input-field bg-slate-50 font-medium dark:bg-slate-800/50">{formatCurrency(line.purchasePrice)}</p>
                </div>
                <div>
                  <label className="label">Selling Price Mode</label>
                  <select className="select-field" value={line.sellingPriceMode} onChange={(e) => updateLine(lineIndex, { sellingPriceMode: e.target.value })}>
                    <option value="AUTO">Auto (purchase × 1.30)</option>
                    <option value="MANUAL">Manual override</option>
                  </select>
                </div>
                <div>
                  <label className="label">Selling Price</label>
                  {line.sellingPriceMode === 'MANUAL' ? (
                    <input type="number" min="0" step="0.01" className="input-field" value={line.sellingPrice} onChange={(e) => updateLine(lineIndex, { sellingPrice: e.target.value })} />
                  ) : (
                    <p className="input-field bg-emerald-50 font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">{formatCurrency(line.sellingPrice)}</p>
                  )}
                </div>
                <div>
                  <label className="label">Invoice Qty</label>
                  <p className="input-field bg-slate-50 font-semibold dark:bg-slate-800/50">{line.invoiceQty}</p>
                </div>
                <div>
                  <label className="label">Received Qty</label>
                  <p className="input-field bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">{line.receivedQty}</p>
                </div>
                <div>
                  <label className="label">Remaining Qty</label>
                  <p className="input-field bg-amber-50 font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">{line.remainingQty}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/30">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-white">Barcode Scanner</h4>
                    <p className="text-xs text-slate-500">Each successful scan creates one pending inventory item for this product.</p>
                  </div>
                  {isComplete && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                      <CircleCheckBig className="h-3.5 w-3.5" /> Fully Received
                    </span>
                  )}
                </div>
                <BarcodeInput
                  onScan={(value) => handleLineBarcodeScan(lineIndex, value)}
                  placeholder={scanningProductId === line.productId ? 'Saving barcode…' : 'Scan or enter unit barcode…'}
                  clearOnScan
                />
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-white">Scan History</h4>
                  <span className="text-xs text-slate-500">Newest first</span>
                </div>
                {line.scannedUnits.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500 dark:border-slate-700">
                    No unit barcodes scanned yet for this product.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {line.scannedUnits.map((unit) => (
                      <div key={unit.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
                        <div className="flex items-center gap-2 font-mono text-sm text-slate-700 dark:text-slate-200">
                          <span className="text-emerald-600">✓</span>
                          <span>{unit.barcode}</span>
                        </div>
                        <button type="button" onClick={() => removePendingUnit(lineIndex, unit.id)} className="text-sm font-medium text-red-500 hover:text-red-700">
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div className="glass-card flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-slate-500">Invoice Qty</p>
              <p className="text-lg font-semibold text-slate-800 dark:text-white">{summary.totalInvoiceQty}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Received Qty</p>
              <p className="text-lg font-semibold text-emerald-600">{summary.totalReceived}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Remaining Qty</p>
              <p className="text-lg font-semibold text-amber-600">{summary.remaining}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Ready to Confirm</p>
              <p className={`text-lg font-semibold ${summary.readyToConfirm ? 'text-emerald-600' : 'text-slate-500'}`}>
                {summary.readyToConfirm ? 'Yes' : 'No'}
              </p>
            </div>
          </div>

          <button type="submit" disabled={saving || form.lines.length === 0 || !summary.readyToConfirm} className="btn-primary disabled:opacity-60">
            <Save className="h-4 w-4" /> {saving ? 'Confirming GRN…' : 'Confirm GRN & Update Stock'}
          </button>
        </div>
      </form>
    </div>
  );
}
