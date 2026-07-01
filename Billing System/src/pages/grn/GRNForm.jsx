import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, PackageCheck, ScanLine, FileText } from 'lucide-react';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import BarcodeInput from '../../components/ui/BarcodeInput';
import { grnsApi, purchaseInvoicesApi } from '../../api/procurement';
import { categoriesApi, productsApi, suppliersApi } from '../../api/masters';
import { getErrorMessage } from '../../api/client';
import { formatCurrency } from '../../utils/helpers';
import { calcGrnAutoSellingPrice } from '../../utils/pricing';

function buildLine(product, { unitPrice = 0, expectedUnits = 0, description = '', purchaseWithVat = false, vatRate = 0 } = {}) {
  const purchasePrice = Number(unitPrice) || 0;
  return {
    productId: product?.id || '',
    product,
    categoryId: product?.category?.id || product?.categoryId || '',
    description: description || product?.description || product?.name || '',
    purchasePrice,
    purchasePriceLocked: false,
    sellingPriceMode: 'AUTO',
    sellingPrice: calcGrnAutoSellingPrice(purchasePrice),
    barcodes: [],
    expectedUnits,
    purchaseWithVat,
    vatRate,
  };
}

export default function GRNForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillPurchaseInvoiceId = searchParams.get('purchaseInvoiceId');

  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [purchaseInvoiceId, setPurchaseInvoiceId] = useState(prefillPurchaseInvoiceId || '');
  const [poId, setPoId] = useState('');
  const [invoiceItems, setInvoiceItems] = useState({});
  const [scanning, setScanning] = useState(false);
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
    if (prefillPurchaseInvoiceId) return;
    toast.error('Create a purchase invoice first, then open GRN from the invoice.');
    navigate('/purchase-invoices', { replace: true });
  }, [prefillPurchaseInvoiceId, navigate]);

  useEffect(() => {
    Promise.all([
      suppliersApi.list({ pageSize: 200, isActive: 'true' }),
      categoriesApi.list(),
    ]).then(([s, c]) => {
      setSuppliers(s.items || []);
      setCategories(c);
    }).catch(() => {});
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
      const itemMap = Object.fromEntries(
        pi.items.map((item) => [item.productId, {
          unitPrice: Number(item.unitPrice),
          units: item.units,
          description: item.description || item.product?.name || '',
        }])
      );
      setPurchaseInvoiceId(pi.id);
      setPoId(pi.poId || '');
      setInvoiceItems(itemMap);
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
            purchaseWithVat: false,
            vatRate: pi.vatEnabled ? Number(pi.vatRate) : 0,
          }),
          purchasePriceLocked: true,
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
      return { ...line, sellingPrice, autoSell };
    }),
    [form.lines]
  );

  const allBarcodes = useMemo(() => form.lines.flatMap((l) => l.barcodes), [form.lines]);

  const resolveUnitBarcode = (_product, scanned) => scanned.trim();

  const appendBarcodeToLine = (lineIndex, barcode) => {
    if (allBarcodes.includes(barcode)) {
      toast.warning('Barcode already used on this GRN');
      return false;
    }
    const lines = [...form.lines];
    const line = lines[lineIndex];
    if (line.expectedUnits > 0 && line.barcodes.length >= line.expectedUnits) {
      toast.warning(`Invoiced quantity (${line.expectedUnits}) already reached for this product`);
      return false;
    }
    lines[lineIndex] = { ...line, barcodes: [...line.barcodes, barcode] };
    setForm({ ...form, lines });
    return true;
  };

  const handleMasterBarcodeScan = async (scanned) => {
    const code = scanned?.trim();
    if (!code) return;

    if (allBarcodes.includes(code)) {
      toast.warning('Barcode already scanned on this GRN');
      return;
    }

    setScanning(true);
    try {
      const product = await productsApi.lookupByBarcode(code);
      const invoiceLine = invoiceItems[product.id];
      let lineIndex = form.lines.findIndex((l) => l.productId === product.id);

      if (lineIndex < 0) {
        if (!invoiceLine) {
          toast.error('Product is not on the linked purchase invoice');
          return;
        }
        const unitPrice = Number(invoiceLine.unitPrice ?? 0);
        const newLine = {
          ...buildLine(product, {
            unitPrice,
            expectedUnits: invoiceLine.units || 0,
            description: invoiceLine.description || product.name,
            purchaseWithVat: form.purchaseWithVat,
            vatRate: form.vatRate,
          }),
          purchasePriceLocked: true,
        };
        const unitBarcode = resolveUnitBarcode(product, code);
        setForm((f) => ({
          ...f,
          lines: [...f.lines, { ...newLine, barcodes: [unitBarcode] }],
        }));
        toast.success(`${product.code} — ${product.name}: auto-filled from barcode`);
        return;
      }

      const unitBarcode = resolveUnitBarcode(product, code);
      if (appendBarcodeToLine(lineIndex, unitBarcode)) {
        toast.success(`Unit added for ${product.name}`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Product lookup failed'));
    } finally {
      setScanning(false);
    }
  };

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

  const removeBarcode = (lineIndex, barcodeIndex) => {
    const lines = [...form.lines];
    lines[lineIndex] = {
      ...lines[lineIndex],
      barcodes: lines[lineIndex].barcodes.filter((_, i) => i !== barcodeIndex),
    };
    setForm({ ...form, lines });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplierId) { toast.error('Select a supplier'); return; }
    if (form.lines.length === 0) { toast.error('Add at least one product line'); return; }
    if (form.lines.some((l) => l.barcodes.length === 0)) {
      toast.error('Each line needs at least one scanned unit barcode');
      return;
    }

    setSaving(true);
    try {
      const noteParts = [form.notes, form.poRef ? `PO: ${form.poRef}` : ''].filter(Boolean);
      await grnsApi.complete({
        supplierId: form.supplierId,
        poId: poId || null,
        purchaseInvoiceId,
        purchaseWithVat: form.purchaseWithVat,
        vatRate: Number(form.vatRate),
        notes: noteParts.join('\n'),
        lines: form.lines.map((l) => ({
          productId: l.productId,
          categoryId: l.categoryId || null,
          description: l.description,
          purchasePrice: Number(l.purchasePrice),
          sellingPriceMode: l.sellingPriceMode,
          sellingPrice: l.sellingPriceMode === 'MANUAL' ? Number(l.sellingPrice) : undefined,
          barcodes: l.barcodes,
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

  const supplierName = suppliers.find((s) => s.id === form.supplierId)?.name;

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
      <PageHeader title="GRN from Purchase Invoice" subtitle="Scan barcodes to receive stock — purchase price locked from invoice" actions={
        <button type="button" onClick={() => navigate(`/purchase-invoices/${purchaseInvoiceId}`)} className="btn-secondary"><ArrowLeft className="h-4 w-4" /> Back to Invoice</button>
      } />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="glass-card grid grid-cols-1 gap-4 p-6 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">Supplier *</label>
            <p className="input-field bg-slate-50 font-medium dark:bg-slate-800/50">{supplierName || '—'}</p>
          </div>
          <div>
            <label className="label">PO Number</label>
            <p className="input-field bg-slate-50 dark:bg-slate-800/50">{form.poRef || '—'}</p>
          </div>
          <div>
            <label className="label">Purchase Invoice</label>
            <p className="input-field bg-slate-50 text-primary-600 dark:bg-slate-800/50">Linked</p>
          </div>
          <div className="lg:col-span-2">
            <label className="label">Notes</label>
            <input className="input-field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        <div className="glass-card space-y-3 border-2 border-primary-200 p-6 dark:border-primary-900/60">
          <div className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary-600" />
            <h3 className="font-semibold">Barcode Scanner</h3>
          </div>
          <p className="text-xs text-slate-500">
            Scan each physical unit barcode to add it to the matching invoice line. Quantity received updates automatically.
          </p>
          <BarcodeInput
            onScan={handleMasterBarcodeScan}
            placeholder={scanning ? 'Looking up product…' : 'Scan or enter barcode…'}
          />
        </div>

        {enrichedLines.length === 0 ? (
          <div className="glass-card p-8 text-center text-sm text-slate-500">
            Invoice lines are loaded. Scan unit barcodes above to receive stock.
          </div>
        ) : (
          enrichedLines.map((line, lineIndex) => {
            const categoryName = categories.find((c) => c.id === line.categoryId)?.name
              || line.product?.category?.name
              || '—';
            return (
              <div key={`${line.productId}-${lineIndex}`} className="glass-card space-y-4 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 font-semibold">
                      <PackageCheck className="h-4 w-4 text-primary-600" />
                      {line.product?.name || line.productId}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {line.product?.code}
                      {line.expectedUnits ? ` • Invoiced: ${line.expectedUnits} units` : ''}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="label">Category</label>
                    <p className="input-field bg-slate-50 dark:bg-slate-800/50">{categoryName}</p>
                  </div>
                  <div className="lg:col-span-2">
                    <label className="label">Item Description</label>
                    <input className="input-field" value={line.description} onChange={(e) => updateLine(lineIndex, { description: e.target.value })} />
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
                    <label className="label">Quantity Received</label>
                    <p className="text-lg font-bold">{line.barcodes.length}{line.expectedUnits ? ` / ${line.expectedUnits}` : ''}</p>
                  </div>
                </div>

                {line.barcodes.length > 0 && (
                  <div className="flex flex-wrap gap-2 rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/30">
                    {line.barcodes.map((code, bi) => (
                      <span key={bi} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-mono text-xs shadow-sm dark:bg-slate-800">
                        {code}
                        <button type="button" onClick={() => removeBarcode(lineIndex, bi)} className="text-red-400 hover:text-red-600">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}

        <div className="flex justify-end">
          <button type="submit" disabled={saving || form.lines.length === 0} className="btn-primary disabled:opacity-60">
            <Save className="h-4 w-4" /> {saving ? 'Confirming GRN…' : 'Confirm GRN & Update Stock'}
          </button>
        </div>
      </form>
    </div>
  );
}
