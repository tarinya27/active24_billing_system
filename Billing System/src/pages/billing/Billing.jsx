import { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, Trash2, Receipt, History } from 'lucide-react';
import PreviousInvoicesDrawer from '../../components/billing/PreviousInvoicesDrawer';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import BarcodeInput from '../../components/ui/BarcodeInput';
import Modal from '../../components/ui/Modal';
import InvoicePrintView from '../../components/billing/InvoicePrintView';
import WalkInCustomerForm from '../../components/billing/WalkInCustomerForm';
import ScannedUnitDetails, { ScannedUnitEmpty } from '../../components/billing/ScannedUnitDetails';
import { customersApi } from '../../api/masters';
import { stockApi, invoicesApi, settingsApi, PAYMENT_METHOD_API, PAYMENT_METHOD_LABEL } from '../../api/ops';
import { getErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { calculateInvoiceTotals } from '../../utils/invoiceCalculations';
import { printElement } from '../../utils/printDocument';
import { formatCurrency } from '../../utils/helpers';
import { PAYMENT_METHODS, CREDIT_PAYMENT_TERM_DAYS } from '../../utils/constants';
import {
  resolveTaxInvoicePoNumber,
  resolveTaxInvoiceSupplierTin,
} from '../../utils/invoicePrintMeta';

export default function Billing() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [showPreview, setShowPreview] = useState(false);
  const [showPreviousInvoices, setShowPreviousInvoices] = useState(false);
  const [generatedInvoice, setGeneratedInvoice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastScanned, setLastScanned] = useState(null);

  const loadCustomers = useCallback(async () => {
    try {
      const result = await customersApi.list({ pageSize: 200 });
      const items = result.items || result;
      setCustomers(items);
      const walkIn = items.find((c) => c.type === 'WALK_IN');
      if (walkIn && !selectedCustomer) setSelectedCustomer(walkIn.id);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load customers'));
    }
  }, [selectedCustomer]);

  useEffect(() => {
    loadCustomers();
    settingsApi.get().then(setSettings).catch(() => {});
  }, [loadCustomers]);

  useEffect(() => {
    if (!showPreview || !generatedInvoice || !settings?.autoPrint) return undefined;
    const timer = setTimeout(() => {
      printElement('invoice-print-content').catch((err) => {
        console.error(err);
        toast.error('Could not open print preview. Try Print Invoice again.');
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [showPreview, generatedInvoice, settings?.autoPrint]);

  const customer = customers.find((c) => c.id === selectedCustomer);
  const isWalkInCustomer = customer?.type === 'WALK_IN' && customer?.name === 'Walk-in Customer';

  const handleSaveWalkInCustomer = async (customerData) => {
    try {
      const created = await customersApi.create({
        name: customerData.name,
        mobile: customerData.mobile,
        address: customerData.address,
        type: 'WALK_IN',
      });
      setCustomers((prev) => [created, ...prev]);
      setSelectedCustomer(created.id);
      toast.success(`${created.name} added to customer base`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleBarcodeScan = async (barcode) => {
    const trimmed = barcode.trim();
    if (!trimmed) return;
    if (cartItems.some((i) => i.barcode === trimmed)) {
      toast.warning('Unit already in cart');
      return;
    }
    try {
      const unit = await stockApi.lookup(trimmed);
      const details = unit.saleDetails || {};
      const cartItem = {
        barcode: unit.barcode,
        productUnitId: unit.id,
        productId: unit.productId,
        productName: unit.product.name,
        productCode: unit.product.code,
        category: details.category || unit.product?.category?.name || '—',
        description: details.description || unit.product?.name,
        purchasePrice: details.purchasePrice ?? Number(unit.costPrice ?? 0),
        grnNumber: details.grnNumber || '—',
        poNumber: details.poNumber || null,
        purchaseInvoiceNo: details.purchaseInvoiceNo || '—',
        supplierTin: details.supplierTin || null,
        warrantyMonths: details.warrantyMonths ?? null,
        unitPrice: Number(details.sellingPrice ?? unit.sellingPrice),
        discount: 0,
        quantity: 1,
      };
      setCartItems((prev) => [...prev, cartItem]);
      setLastScanned(cartItem);
      toast.success(`${unit.product.name} added — GRN ${details.grnNumber || 'linked'}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unit not available'));
    }
  };

  const updateItem = (barcode, field, value) => {
    setCartItems((prev) =>
      prev.map((i) => (i.barcode === barcode ? { ...i, [field]: value } : i))
    );
  };

  const removeItem = (barcode) => {
    setCartItems((prev) => prev.filter((i) => i.barcode !== barcode));
    setLastScanned((prev) => (prev?.barcode === barcode ? null : prev));
  };

  const totals = calculateInvoiceTotals(cartItems);

  const handleGenerateInvoice = async () => {
    if (cartItems.length === 0) {
      toast.error('Scan at least one unit barcode');
      return;
    }
    if (!selectedCustomer) {
      toast.error('Select a customer');
      return;
    }
    setSubmitting(true);
    try {
      const invoice = await invoicesApi.create({
        customerId: selectedCustomer,
        paymentMethod: PAYMENT_METHOD_API[paymentMethod],
        items: cartItems.map((i) => ({ barcode: i.barcode, discount: i.discount || 0 })),
      });
      const viewInvoice = {
        ...invoice,
        date: invoice.createdAt,
        cashier: invoice.cashier?.name || user?.name,
        paymentMethod: PAYMENT_METHOD_LABEL[invoice.paymentMethod] || invoice.paymentMethod,
        customer,
        poNumber: invoice.poNumber ?? resolveTaxInvoicePoNumber(cartItems),
        supplierTin: invoice.supplierTin ?? resolveTaxInvoiceSupplierTin(cartItems),
        items: invoice.items.map((item) => ({
          productId: item.productId,
          productName: item.product?.name,
          productCode: item.product?.code,
          barcode: item.productUnit?.barcode,
          unitPrice: item.unitPrice,
          discount: item.discount,
          quantity: 1,
          warrantyMonths: item.warrantyMonths ?? null,
        })),
      };
      setGeneratedInvoice(viewInvoice);
      setShowPreview(true);
      setCartItems([]);
      setLastScanned(null);
      toast.success('Invoice generated successfully!');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to create invoice'));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    printElement('invoice-print-content').catch((err) => {
      console.error(err);
      toast.error('Could not open print preview. Please try again.');
    });
  };

  const openInvoicePreview = async (invoice) => {
    try {
      const full = await invoicesApi.get(invoice.id);
      const invCustomer = customers.find((c) => c.id === full.customerId) || full.customer;
      setGeneratedInvoice({
        ...full,
        date: full.createdAt,
        cashier: full.cashier?.name,
        paymentMethod: PAYMENT_METHOD_LABEL[full.paymentMethod] || full.paymentMethod,
        customer: invCustomer,
        poNumber: full.poNumber ?? null,
        supplierTin: full.supplierTin ?? null,
        items: full.items.map((item) => ({
          productId: item.productId,
          productName: item.product?.name,
          productCode: item.product?.code,
          barcode: item.productUnit?.barcode,
          unitPrice: item.unitPrice,
          discount: item.discount,
          quantity: 1,
          warrantyMonths: item.warrantyMonths ?? null,
        })),
      });
      setShowPreviousInvoices(false);
      setShowPreview(true);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Billing / Sales Invoice"
        subtitle="PO → Purchase Invoice → GRN → Sales — scan unit barcodes to sell"
        actions={
          <button type="button" onClick={() => setShowPreviousInvoices(true)} className="btn-secondary">
            <History className="h-4 w-4" /> Previous Invoices
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3 space-y-4">
          <div className="glass-card p-4">
            <BarcodeInput onScan={handleBarcodeScan} placeholder="Scan unit barcode to add item..." />
            <p className="mt-2 text-xs text-slate-500">
              Scan physical unit barcodes received via GRN. Product, PO, purchase invoice, and pricing details load automatically.
            </p>
          </div>

          {lastScanned && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-primary-600">Last Scanned</h3>
              <ScannedUnitDetails item={lastScanned} highlight />
            </div>
          )}

          {cartItems.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">All Scanned Items ({cartItems.length})</h3>
              <div className="space-y-3">
                {cartItems.map((item) => (
                  <ScannedUnitDetails key={item.barcode} item={item} />
                ))}
              </div>
            </div>
          )}

          {cartItems.length === 0 && !lastScanned && (
            <div className="glass-card p-4">
              <ScannedUnitEmpty />
            </div>
          )}
        </div>

        <div className="xl:col-span-2">
          <div className="glass-card sticky top-20 p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <ShoppingCart className="h-5 w-5 text-primary-600" />
              <h3 className="font-semibold">Current Invoice</h3>
              <span className="ml-auto rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-950 dark:text-primary-400">
                {cartItems.length} units
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Customer</label>
                <select value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)} className="select-field !text-sm">
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {customer && (
                <div className="rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800/50">
                  <p><span className="text-slate-500">Mobile:</span> {customer.mobile}</p>
                  <p className="mt-1"><span className="text-slate-500">Address:</span> {customer.address}</p>
                </div>
              )}
              {isWalkInCustomer && <WalkInCustomerForm onSave={handleSaveWalkInCustomer} />}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Payment Method</label>
                <div className="flex flex-wrap gap-2">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${paymentMethod === m ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-400' : 'border-slate-200 text-slate-600 dark:border-slate-700'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                {paymentMethod === 'Credit' && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-300">
                      Payment due within {CREDIT_PAYMENT_TERM_DAYS} days
                    </p>
                  </div>
                )}
              </div>
            </div>

            {cartItems.length > 0 ? (
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="pb-2 text-left">Unit</th>
                      <th className="pb-2 text-right">Price</th>
                      <th className="pb-2 text-right">Disc.</th>
                      <th className="pb-2 text-right">Total</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {cartItems.map((item) => {
                      const lineTotal = item.unitPrice - (item.discount || 0);
                      return (
                        <tr key={item.barcode} className="border-b border-slate-50 dark:border-slate-800/50">
                          <td className="py-2 pr-2">
                            <p className="font-medium truncate max-w-[140px]">{item.productName}</p>
                            <p className="font-mono text-[10px] text-slate-400">{item.barcode}</p>
                            <p className="text-[10px] text-slate-400">{item.grnNumber} • {item.poNumber}</p>
                          </td>
                          <td className="py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                          <td className="py-2">
                            <input
                              type="number"
                              min="0"
                              value={item.discount || 0}
                              onChange={(e) => updateItem(item.barcode, 'discount', parseFloat(e.target.value) || 0)}
                              className="input-field !w-16 !py-1 text-right !text-xs ml-auto"
                            />
                          </td>
                          <td className="py-2 text-right font-semibold">{formatCurrency(lineTotal)}</td>
                          <td className="py-2">
                            <button type="button" onClick={() => removeItem(item.barcode)} className="text-red-400 hover:text-red-600">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">Scan unit barcodes to add items</p>
            )}

            <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal</span><span>{formatCurrency(totals.subtotal)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Discount</span><span className="text-red-500">-{formatCurrency(totals.totalDiscount)}</span></div>
              <div className="flex justify-between border-t border-slate-100 pt-2 text-lg font-bold dark:border-slate-800">
                <span>Grand Total</span><span className="text-primary-600">{formatCurrency(totals.grandTotal)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={() => { setCartItems([]); setLastScanned(null); }} className="btn-secondary flex-1" disabled={cartItems.length === 0}>Clear</button>
              <button type="button" onClick={handleGenerateInvoice} className="btn-primary flex-1" disabled={cartItems.length === 0 || submitting}>
                <Receipt className="h-4 w-4" /> {submitting ? 'Processing…' : 'Generate Invoice'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={showPreview} onClose={() => setShowPreview(false)} title="Invoice Preview — A4" size="xl">
        {generatedInvoice && (
          <div className="rounded-lg bg-slate-100 p-4 dark:bg-slate-950">
            <InvoicePrintView invoice={generatedInvoice} settings={settings} onClose={() => setShowPreview(false)} onPrint={handlePrint} />
          </div>
        )}
      </Modal>

      <PreviousInvoicesDrawer
        isOpen={showPreviousInvoices}
        onClose={() => setShowPreviousInvoices(false)}
        customers={customers}
        onViewInvoice={openInvoicePreview}
      />
    </div>
  );
}
