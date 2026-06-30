import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, PackageCheck, Wand2, Trash2, Plus } from 'lucide-react';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import BarcodeInput from '../../components/ui/BarcodeInput';
import { grnsApi, purchaseInvoicesApi } from '../../api/procurement';
import { categoriesApi, productsApi, suppliersApi } from '../../api/masters';
import { getErrorMessage } from '../../api/client';
import { formatCurrency } from '../../utils/helpers';

const OPENING_STOCK_NOTE = 'Previous stock available — opening balance';

function calcCostExVat(purchasePrice, purchaseWithVat, vatRate) {
  const p = Number(purchasePrice) || 0;
  const r = Number(vatRate) || 0;
  if (!purchaseWithVat || r <= 0) return p;
  return Math.round((p / (1 + r / 100)) * 100) / 100;
}

function calcAutoSell(costExVat) {
  return Math.round(Number(costExVat) * 1.3 * 100) / 100;
}

function generateBarcode() {
  return `A24${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`.slice(0, 32);
}

function emptyLine(product, unitPrice = 0, expectedUnits = 0) {
  return {
    productId: product?.id || '',
    product,
    categoryId: product?.category?.id || product?.categoryId || '',
    description: product?.description || product?.name || '',
    purchasePrice: unitPrice,
    sellingPriceMode: 'AUTO',
    sellingPrice: calcAutoSell(calcCostExVat(unitPrice, false, 0)),
    barcodes: [],
    expectedUnits,
    qtyToGenerate: expectedUnits || 1,
  };
}

export default function GRNForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillPoRef = searchParams.get('poRef');
  const prefillPurchaseInvoiceId = searchParams.get('purchaseInvoiceId');
  const isOpeningStock = searchParams.get('type') === 'opening';

  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [purchaseInvoiceId, setPurchaseInvoiceId] = useState(prefillPurchaseInvoiceId || '');
  const [saving, setSaving] = useState(false);
  const [scanTarget, setScanTarget] = useState(null);
  const [addProductId, setAddProductId] = useState('');
  const [form, setForm] = useState({
    supplierId: '',
    poRef: prefillPoRef || '',
    purchaseWithVat: false,
    vatRate: 0,
    notes: isOpeningStock ? OPENING_STOCK_NOTE : '',
    lines: [],
  });

  useEffect(() => {
    Promise.all([
      suppliersApi.list({ pageSize: 200 }),
      categoriesApi.list(),
      productsApi.list({ pageSize: 500, isActive: 'true' }),
    ]).then(([s, c, p]) => {
      setSuppliers(s.items || []);
      setCategories(c);
      setProducts(p.items || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!prefillPurchaseInvoiceId) return;
    purchaseInvoicesApi.get(prefillPurchaseInvoiceId).then((pi) => {
      if (pi.grn) {
        toast.warning('This purchase invoice already has a GRN');
        return;
      }
      setPurchaseInvoiceId(pi.id);
      setForm((f) => ({
        ...f,
        supplierId: pi.supplierId,
        purchaseWithVat: pi.purchaseWithVat,
        vatRate: Number(pi.vatRate),
        poRef: pi.po?.poNumber || f.poRef,
        lines: pi.items.map((item) => emptyLine(item.product, Number(item.unitPrice), item.units)),
      }));
    }).catch(() => toast.error('Failed to load purchase invoice'));
  }, [prefillPurchaseInvoiceId]);

  const enrichedLines = useMemo(
    () => form.lines.map((line) => {
      const costExVat = calcCostExVat(line.purchasePrice, form.purchaseWithVat, form.vatRate);
      const autoSell = calcAutoSell(costExVat);
      const sellingPrice = line.sellingPriceMode === 'MANUAL' ? Number(line.sellingPrice) : autoSell;
      return { ...line, costExVat, sellingPrice, autoSell };
    }),
    [form.lines, form.purchaseWithVat, form.vatRate]
  );

  const addProductLine = () => {
    if (!addProductId) { toast.error('Select a product'); return; }
    if (form.lines.some((l) => l.productId === addProductId)) {
      toast.warning('Product already on this GRN');
      return;
    }
    const product = products.find((p) => p.id === addProductId);
    if (!product) return;
    setForm({ ...form, lines: [...form.lines, emptyLine(product, Number(product.defaultSellingPrice) * 0.65)] });
    setAddProductId('');
  };

  const handleBarcodeForLine = (lineIndex, barcode) => {
    const allBarcodes = form.lines.flatMap((l) => l.barcodes);
    if (allBarcodes.includes(barcode)) {
      toast.warning('Barcode already scanned on this GRN');
      return;
    }
    const lines = [...form.lines];
    lines[lineIndex] = { ...lines[lineIndex], barcodes: [...lines[lineIndex].barcodes, barcode] };
    setForm({ ...form, lines });
    toast.success(`Unit barcode ${barcode} added`);
  };

  const generateBarcodesForLine = (lineIndex, count) => {
    if (count < 1) return;
    const lines = [...form.lines];
    const newCodes = Array.from({ length: count }, () => generateBarcode());
    lines[lineIndex] = { ...lines[lineIndex], barcodes: [...lines[lineIndex].barcodes, ...newCodes] };
    setForm({ ...form, lines });
    toast.success(`Generated ${count} barcode(s)`);
  };

  const updateLine = (index, patch) => {
    const lines = [...form.lines];
    lines[index] = { ...lines[index], ...patch };
    if (patch.purchasePrice !== undefined || patch.sellingPriceMode !== undefined) {
      const costExVat = calcCostExVat(lines[index].purchasePrice, form.purchaseWithVat, form.vatRate);
      if (lines[index].sellingPriceMode === 'AUTO') {
        lines[index].sellingPrice = calcAutoSell(costExVat);
      }
    }
    setForm({ ...form, lines });
  };

  const removeLine = (index) => setForm({ ...form, lines: form.lines.filter((_, i) => i !== index) });

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
      toast.error('Each line needs at least one unit barcode');
      return;
    }

    setSaving(true);
    try {
      const noteParts = [form.notes, form.poRef ? `PO ref: ${form.poRef}` : ''].filter(Boolean);
      await grnsApi.complete({
        supplierId: form.supplierId,
        poId: null,
        purchaseInvoiceId: purchaseInvoiceId || null,
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
      toast.success('GRN completed — serialized stock units created');
      navigate('/grn');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to complete GRN'));
    } finally {
      setSaving(false);
    }
  };

  const pageTitle = isOpeningStock ? 'Opening Stock GRN' : 'Create GRN';
  const pageSubtitle = isOpeningStock
    ? 'Add previous stock available — one barcode per physical unit'
    : purchaseInvoiceId
      ? 'Receive stock against purchase invoice'
      : 'Scan one barcode per physical unit (serialized inventory)';

  return (
    <div>
      <PageHeader title={pageTitle} subtitle={pageSubtitle} actions={
        <button onClick={() => navigate('/grn')} className="btn-secondary"><ArrowLeft className="h-4 w-4" /> Back</button>
      } />

      {isOpeningStock && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          Use this when historical sales need stock that was not in the system. Add product lines, generate barcodes for each unit, then post sales in Billing.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="glass-card grid grid-cols-1 gap-4 p-6 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">Supplier *</label>
            <select className="select-field" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} required>
              <option value="">Select supplier</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">PO reference</label>
            <input className="input-field" value={form.poRef} onChange={(e) => setForm({ ...form, poRef: e.target.value })} placeholder="Optional PO reference number" />
          </div>
          <div>
            <label className="label">VAT Rate (%)</label>
            <input type="number" min="0" className="input-field" value={form.vatRate} onChange={(e) => setForm({ ...form, vatRate: e.target.value })} />
          </div>
          <div className="lg:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.purchaseWithVat} onChange={(e) => setForm({ ...form, purchaseWithVat: e.target.checked })} className="h-4 w-4 rounded" />
              Purchase with VAT? (purchase price includes VAT — cost-ex-VAT used for markup)
            </label>
          </div>
          <div className="lg:col-span-2">
            <label className="label">Notes</label>
            <input className="input-field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="label">Add product line</label>
              <select className="select-field" value={addProductId} onChange={(e) => setAddProductId(e.target.value)}>
                <option value="">Select product</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
            </div>
            <button type="button" onClick={addProductLine} className="btn-secondary shrink-0">
              <Plus className="h-4 w-4" /> Add Line
            </button>
          </div>
        </div>

        {enrichedLines.length === 0 ? (
          <div className="glass-card p-8 text-center text-sm text-slate-500">
            Add product lines above. From a purchase invoice, use <strong>Create GRN</strong> on the invoice detail page.
          </div>
        ) : (
          enrichedLines.map((line, lineIndex) => (
            <div key={line.productId || lineIndex} className="glass-card space-y-4 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 font-semibold"><PackageCheck className="h-4 w-4 text-primary-600" />{line.product?.name || line.productId}</h3>
                  <p className="text-xs text-slate-500">{line.product?.code}{line.expectedUnits ? ` • Expected ${line.expectedUnits} units` : ''}</p>
                </div>
                <button type="button" onClick={() => removeLine(lineIndex)} className="text-red-500"><Trash2 className="h-4 w-4" /></button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="label">Category</label>
                  <select className="select-field" value={line.categoryId || ''} onChange={(e) => updateLine(lineIndex, { categoryId: e.target.value })}>
                    <option value="">—</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Purchase Price</label>
                  <input type="number" min="0" step="0.01" className="input-field" value={line.purchasePrice} onChange={(e) => updateLine(lineIndex, { purchasePrice: e.target.value })} />
                </div>
                <div>
                  <label className="label">Cost ex-VAT</label>
                  <p className="input-field bg-slate-50 dark:bg-slate-800/50">{formatCurrency(line.costExVat)}</p>
                </div>
                <div>
                  <label className="label">Selling Price Mode</label>
                  <select className="select-field" value={line.sellingPriceMode} onChange={(e) => updateLine(lineIndex, { sellingPriceMode: e.target.value })}>
                    <option value="AUTO">Auto (cost-ex-VAT × 1.30)</option>
                    <option value="MANUAL">Manual</option>
                  </select>
                </div>
                <div className="lg:col-span-2">
                  <label className="label">Description (editable)</label>
                  <input className="input-field" value={line.description} onChange={(e) => updateLine(lineIndex, { description: e.target.value })} />
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
                  <label className="label">Units scanned</label>
                  <p className="text-lg font-bold">{line.barcodes.length}{line.expectedUnits ? ` / ${line.expectedUnits}` : ''}</p>
                </div>
              </div>

              <div className="rounded-xl border border-dashed border-primary-200 bg-primary-50/40 p-4 dark:border-primary-900 dark:bg-primary-950/20">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setScanTarget(scanTarget === lineIndex ? null : lineIndex)} className="btn-secondary !py-2 !text-xs">
                    {scanTarget === lineIndex ? 'Scanning this line…' : 'Scan unit barcode'}
                  </button>
                  <button type="button" onClick={() => generateBarcodesForLine(lineIndex, 1)} className="btn-secondary !py-2 !text-xs"><Wand2 className="h-3.5 w-3.5" /> Generate 1</button>
                  {line.expectedUnits > line.barcodes.length && (
                    <button type="button" onClick={() => generateBarcodesForLine(lineIndex, line.expectedUnits - line.barcodes.length)} className="btn-secondary !py-2 !text-xs">
                      Generate remaining ({line.expectedUnits - line.barcodes.length})
                    </button>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      className="input-field !w-20 !py-1.5 !text-xs"
                      value={line.qtyToGenerate ?? 1}
                      onChange={(e) => updateLine(lineIndex, { qtyToGenerate: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => generateBarcodesForLine(lineIndex, Number(line.qtyToGenerate) || 1)}
                      className="btn-secondary !py-2 !text-xs"
                    >
                      <Wand2 className="h-3.5 w-3.5" /> Generate N
                    </button>
                  </div>
                </div>
                {scanTarget === lineIndex && (
                  <BarcodeInput onScan={(code) => { handleBarcodeForLine(lineIndex, code); setScanTarget(null); }} placeholder="Scan barcode for this unit…" />
                )}
                {line.barcodes.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {line.barcodes.map((code, bi) => (
                      <span key={bi} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-mono text-xs shadow-sm dark:bg-slate-800">
                        {code}
                        <button type="button" onClick={() => removeBarcode(lineIndex, bi)} className="text-red-400 hover:text-red-600">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        <div className="flex justify-end">
          <button type="submit" disabled={saving || form.lines.length === 0} className="btn-primary disabled:opacity-60">
            <Save className="h-4 w-4" /> {saving ? 'Posting GRN…' : 'Complete GRN & Create Stock Units'}
          </button>
        </div>
      </form>
    </div>
  );
}
