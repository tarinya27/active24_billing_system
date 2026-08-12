import { useState, useEffect, useCallback, useRef } from 'react';
import { ShoppingCart, Trash2, Receipt, History, Plus, Wrench, ChevronDown, Package } from 'lucide-react';
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
  const [scanning, setScanning] = useState(false);
  const scanLockRef = useRef(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [manualFormOpen, setManualFormOpen] = useState(false);
  const [manualKind, setManualKind] = useState('SERVICE'); // 'ITEM' | 'SERVICE'
  const [manualDraft, setManualDraft] = useState({ description: '', amount: '' });
  const [editingManualId, setEditingManualId] = useState(null);
  const addMenuRef = useRef(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  const [editingInvoiceNumber, setEditingInvoiceNumber] = useState('');

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
    if (!addMenuOpen) return undefined;
    const onPointerDown = (e) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target)) {
        setAddMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [addMenuOpen]);

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
    if (editingInvoiceId) {
      toast.info('Items are locked while editing. Change customer or payment method only.');
      return;
    }
    const trimmed = barcode.trim();
    if (!trimmed || scanLockRef.current) return;

    scanLockRef.current = true;
    setScanning(true);
    try {
      const unit = await stockApi.lookup(
        trimmed,
        editingInvoiceId ? { forInvoiceId: editingInvoiceId } : {}
      );
      const details = unit.saleDetails || {};
      const cartItem = {
        lineType: 'PRODUCT',
        cartKey: `product:${unit.barcode}`,
        barcode: unit.barcode,
        productUnitId: unit.id,
        productId: unit.productId,
        productName: unit.product.name,
        productCode: unit.product.code,
        stockSource: details.stockSource || 'GRN',
        category: details.category || unit.product?.category?.name || '—',
        description: details.description || unit.product?.name,
        purchasePrice: details.purchasePrice ?? Number(unit.costPrice ?? 0),
        grnNumber: details.grnNumber || null,
        poNumber: details.poNumber || null,
        purchaseInvoiceNo: details.purchaseInvoiceNo || null,
        supplierTin: details.supplierTin || null,
        warrantyMonths: details.warrantyMonths ?? null,
        unitPrice: Number(details.sellingPrice ?? unit.sellingPrice),
        discount: 0,
        quantity: 1,
      };

      let added = false;
      setCartItems((prev) => {
        if (prev.some((i) => i.lineType !== 'SERVICE' && i.barcode === cartItem.barcode)) return prev;
        added = true;
        return [...prev, cartItem];
      });
      if (!added) {
        toast.warning('Unit already in cart');
        return;
      }

      setLastScanned(cartItem);
      const sourceLabel = cartItem.stockSource === 'DN' ? 'Delivery Note stock' : `GRN ${details.grnNumber || 'linked'}`;
      toast.success(`${unit.product.name} added — ${sourceLabel}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unit not available'));
    } finally {
      scanLockRef.current = false;
      setScanning(false);
    }
  };

  const updateItem = (cartKey, field, value) => {
    if (editingInvoiceId) return;
    setCartItems((prev) =>
      prev.map((i) => (i.cartKey === cartKey ? { ...i, [field]: value } : i))
    );
  };

  const removeItem = (cartKey) => {
    if (editingInvoiceId) return;
    setCartItems((prev) => prev.filter((i) => i.cartKey !== cartKey));
    setLastScanned((prev) => (prev?.cartKey === cartKey ? null : prev));
  };

  const resetManualForm = () => {
    setManualDraft({ description: '', amount: '' });
    setEditingManualId(null);
    setManualFormOpen(false);
    setAddMenuOpen(false);
  };

  const openManualForm = (kind) => {
    setManualKind(kind);
    setEditingManualId(null);
    setManualDraft({ description: '', amount: '' });
    setManualFormOpen(true);
    setAddMenuOpen(false);
  };

  const handleAddOrUpdateManualLine = () => {
    const description = String(manualDraft.description || '').trim();
    const amount = Number(manualDraft.amount);
    const kindLabel = manualKind === 'ITEM' ? 'Item' : 'Service';
    if (!description) {
      toast.error(`${kindLabel} description is required`);
      return;
    }
    if (!(amount > 0)) {
      toast.error(`${kindLabel} amount must be greater than 0`);
      return;
    }

    if (editingManualId) {
      setCartItems((prev) => prev.map((item) => (
        item.cartKey === editingManualId
          ? {
              ...item,
              chargeKind: manualKind,
              description,
              productName: description,
              category: kindLabel,
              unitPrice: amount,
            }
          : item
      )));
      toast.success(`${kindLabel} updated`);
    } else {
      const cartKey = `manual:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setCartItems((prev) => [
        ...prev,
        {
          lineType: 'SERVICE',
          chargeKind: manualKind,
          cartKey,
          description,
          productName: description,
          category: kindLabel,
          unitPrice: amount,
          discount: 0,
          quantity: 1,
          barcode: null,
        },
      ]);
      toast.success(`${kindLabel} added to invoice`);
    }
    resetManualForm();
  };

  const startEditManualLine = (item) => {
    const kind = item.chargeKind === 'ITEM' ? 'ITEM' : 'SERVICE';
    setManualKind(kind);
    setEditingManualId(item.cartKey);
    setManualDraft({
      description: item.description || item.productName || '',
      amount: String(item.unitPrice ?? ''),
    });
    setManualFormOpen(true);
    setAddMenuOpen(false);
  };

  const productCartItems = cartItems.filter((i) => i.lineType !== 'SERVICE');
  const serviceCartItems = cartItems.filter((i) => i.lineType === 'SERVICE');
  const totals = calculateInvoiceTotals(cartItems);

  const mapInvoiceItemForView = (item, cartSnapshot = []) => {
    const isService = item.itemType === 'SERVICE';
    const cartLine = cartSnapshot.find((c) => (
      isService
        ? c.lineType === 'SERVICE' && (c.description === item.description || c.productName === item.description)
        : c.barcode === item.productUnit?.barcode || c.productUnitId === item.productUnitId
    ));
    return {
      id: item.id,
      itemType: item.itemType || (isService ? 'SERVICE' : 'PRODUCT'),
      productId: item.productId,
      productName: isService ? (item.description || 'Service') : item.product?.name,
      productCode: item.product?.code,
      categoryName: isService
        ? (cartLine?.category || (cartLine?.chargeKind === 'ITEM' ? 'Item' : 'Service'))
        : (item.categoryName ?? cartLine?.category ?? null),
      itemDescription: isService
        ? (item.description || item.itemDescription || 'Service')
        : (item.itemDescription ?? cartLine?.description ?? null),
      description: item.description || null,
      barcode: isService ? null : (item.productUnit?.barcode || cartLine?.barcode),
      unitPrice: item.unitPrice,
      discount: item.discount,
      quantity: Number(item.quantity ?? 1),
      warrantyMonths: isService ? null : (item.warrantyMonths ?? cartLine?.warrantyMonths ?? null),
      chargeKind: isService ? (cartLine?.chargeKind || 'SERVICE') : undefined,
    };
  };

  const clearBillingCart = () => {
    setCartItems([]);
    setLastScanned(null);
    resetManualForm();
    setEditingInvoiceId(null);
    setEditingInvoiceNumber('');
  };

  const handleGenerateInvoice = async () => {
    if (cartItems.length === 0) {
      toast.error('Add at least one product or service');
      return;
    }
    if (!selectedCustomer) {
      toast.error('Select a customer');
      return;
    }
    setSubmitting(true);
    const wasEditing = Boolean(editingInvoiceId);
    const payload = wasEditing
      ? {
          customerId: selectedCustomer,
          paymentMethod: PAYMENT_METHOD_API[paymentMethod],
        }
      : {
          customerId: selectedCustomer,
          paymentMethod: PAYMENT_METHOD_API[paymentMethod],
          items: productCartItems.map((i) => ({ barcode: i.barcode, discount: i.discount || 0 })),
          services: serviceCartItems.map((i) => ({
            description: i.description || i.productName,
            unitPrice: Number(i.unitPrice),
            discount: i.discount || 0,
          })),
        };
    try {
      const invoice = wasEditing
        ? await invoicesApi.update(editingInvoiceId, payload)
        : await invoicesApi.create(payload);
      const viewInvoice = {
        ...invoice,
        date: invoice.createdAt,
        cashier: invoice.cashier?.name || user?.name,
        paymentMethod: PAYMENT_METHOD_LABEL[invoice.paymentMethod] || invoice.paymentMethod,
        customer,
        poNumber: invoice.poNumber ?? resolveTaxInvoicePoNumber(productCartItems),
        supplierTin: invoice.supplierTin ?? resolveTaxInvoiceSupplierTin(productCartItems),
        items: invoice.items.map((item) => mapInvoiceItemForView(item, cartItems)),
      };
      setGeneratedInvoice(viewInvoice);
      setShowPreview(true);
      clearBillingCart();
      toast.success(wasEditing ? 'Invoice updated successfully!' : 'Invoice generated successfully!');
    } catch (err) {
      toast.error(getErrorMessage(err, wasEditing ? 'Failed to update invoice' : 'Failed to create invoice'));
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
        items: full.items.map((item) => mapInvoiceItemForView(item)),
      });
      setShowPreviousInvoices(false);
      setShowPreview(true);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const loadInvoiceForEdit = async (invoice) => {
    try {
      const full = await invoicesApi.get(invoice.id || invoice);
      if (full.status === 'CANCELLED') {
        toast.error('Cancelled invoices cannot be edited');
        return;
      }

      const nextCart = (full.items || []).map((item) => {
        if (item.itemType === 'SERVICE') {
          const description = item.description || item.itemDescription || 'Service';
          const isItem = item.categoryName === 'Item';
          return {
            lineType: 'SERVICE',
            chargeKind: isItem ? 'ITEM' : 'SERVICE',
            cartKey: `manual:${item.id}`,
            description,
            productName: description,
            category: isItem ? 'Item' : 'Service',
            unitPrice: Number(item.unitPrice),
            discount: Number(item.discount || 0),
            quantity: Number(item.quantity || 1),
            barcode: null,
          };
        }

        const barcode = item.productUnit?.barcode || item.barcode;
        return {
          lineType: 'PRODUCT',
          cartKey: `product:${barcode}`,
          barcode,
          productUnitId: item.productUnitId || item.productUnit?.id,
          productId: item.productId,
          productName: item.product?.name || item.productName || 'Product',
          productCode: item.product?.code || item.productCode,
          stockSource: 'GRN',
          category: item.categoryName || '—',
          description: item.itemDescription || item.product?.name || item.productName,
          purchasePrice: 0,
          grnNumber: null,
          poNumber: null,
          purchaseInvoiceNo: null,
          supplierTin: null,
          warrantyMonths: item.warrantyMonths ?? null,
          unitPrice: Number(item.unitPrice),
          discount: Number(item.discount || 0),
          quantity: Number(item.quantity || 1),
        };
      });

      setCartItems(nextCart);
      setSelectedCustomer(full.customerId);
      setPaymentMethod(PAYMENT_METHOD_LABEL[full.paymentMethod] || 'Cash');
      setEditingInvoiceId(full.id);
      setEditingInvoiceNumber(full.invoiceNumber);
      setLastScanned(null);
      resetManualForm();
      setShowPreview(false);
      setShowPreviousInvoices(false);
      toast.success(`Editing ${full.invoiceNumber} — customer & payment only`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load invoice for editing'));
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
          {!editingInvoiceId && (
          <div className="glass-card p-4">
            <BarcodeInput
              onScan={handleBarcodeScan}
              placeholder="Scan unit barcode to add item..."
              clearOnScan
              disabled={scanning}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="relative" ref={addMenuRef}>
                <button
                  type="button"
                  className="btn-secondary !py-2 !text-sm"
                  onClick={() => setAddMenuOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={addMenuOpen}
                >
                  <Plus className="h-4 w-4" /> Add
                  <ChevronDown className={`h-4 w-4 transition-transform ${addMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {addMenuOpen && (
                  <div
                    role="menu"
                    className="absolute left-0 z-20 mt-1 min-w-[140px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                      onClick={() => openManualForm('ITEM')}
                    >
                      <Package className="h-4 w-4 text-slate-500" /> Item
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                      onClick={() => openManualForm('SERVICE')}
                    >
                      <Wrench className="h-4 w-4 text-slate-500" /> Service
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Scan barcodes, or use Add → Item / Service for description and amount (no barcode).
              </p>
            </div>

            {manualFormOpen && (
              <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {manualKind === 'ITEM' ? (
                    <Package className="h-4 w-4 text-primary-600" />
                  ) : (
                    <Wrench className="h-4 w-4 text-primary-600" />
                  )}
                  {editingManualId
                    ? (manualKind === 'ITEM' ? 'Edit Item' : 'Edit Service')
                    : (manualKind === 'ITEM' ? 'Add Item' : 'Add Service')}
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <label className="label">
                      {manualKind === 'ITEM' ? 'Item Description' : 'Service Description'}
                    </label>
                    <input
                      className="input-field"
                      value={manualDraft.description}
                      onChange={(e) => setManualDraft((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder={
                        manualKind === 'ITEM'
                          ? 'e.g. Extra cable / accessories'
                          : 'e.g. CCTV Installation and Configuration'
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Amount</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      className="input-field"
                      value={manualDraft.amount}
                      onChange={(e) => setManualDraft((prev) => ({ ...prev, amount: e.target.value }))}
                      placeholder="15000.00"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn-secondary !py-2 !text-sm" onClick={resetManualForm}>
                    Cancel
                  </button>
                  <button type="button" className="btn-primary !py-2 !text-sm" onClick={handleAddOrUpdateManualLine}>
                    {editingManualId ? 'Update' : 'Add'}
                  </button>
                </div>
              </div>
            )}
          </div>
          )}

          {editingInvoiceId && (
            <div className="glass-card p-4 text-sm text-slate-600 dark:text-slate-300">
              Editing <span className="font-semibold text-slate-800 dark:text-slate-100">{editingInvoiceNumber}</span>.
              Only customer and payment method can be changed. Items, prices, and totals stay fixed.
            </div>
          )}

          {lastScanned && !editingInvoiceId && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-primary-600">Last Scanned</h3>
              <ScannedUnitDetails item={lastScanned} highlight />
            </div>
          )}

          {productCartItems.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">
                {editingInvoiceId ? 'Products' : 'Scanned Products'} ({productCartItems.length})
              </h3>
              <div className="space-y-3">
                {productCartItems.map((item) => (
                  <ScannedUnitDetails key={item.cartKey} item={item} />
                ))}
              </div>
            </div>
          )}

          {serviceCartItems.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Items & Services ({serviceCartItems.length})</h3>
              <div className="space-y-2">
                {serviceCartItems.map((item) => {
                  const kindLabel = item.chargeKind === 'ITEM' ? 'Item' : 'Service';
                  return (
                    <div key={item.cartKey} className="glass-card flex items-start justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-600">{kindLabel}</p>
                        <p className="mt-1 font-medium text-slate-800 dark:text-slate-100">{item.description}</p>
                        <p className="mt-1 text-sm text-emerald-600">{formatCurrency(item.unitPrice)}</p>
                      </div>
                      {!editingInvoiceId && (
                        <div className="flex shrink-0 gap-2">
                          <button type="button" className="btn-secondary !px-2.5 !py-1.5 !text-xs" onClick={() => startEditManualLine(item)}>
                            Edit
                          </button>
                          <button type="button" className="text-red-400 hover:text-red-600" onClick={() => removeItem(item.cartKey)}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {cartItems.length === 0 && !lastScanned && !editingInvoiceId && (
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
                {cartItems.length} line{cartItems.length === 1 ? '' : 's'}
              </span>
            </div>

            {editingInvoiceId && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs dark:border-amber-900 dark:bg-amber-950/30">
                <span className="font-medium text-amber-900 dark:text-amber-300">
                  Editing {editingInvoiceNumber} — customer & payment only
                </span>
                <button type="button" className="font-semibold text-amber-800 hover:underline dark:text-amber-200" onClick={clearBillingCart}>
                  Cancel edit
                </button>
              </div>
            )}

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
                      <th className="pb-2 text-left">Line</th>
                      <th className="pb-2 text-right">Price</th>
                      <th className="pb-2 text-right">Disc.</th>
                      <th className="pb-2 text-right">Total</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {cartItems.map((item) => {
                      const isService = item.lineType === 'SERVICE';
                      const lineTotal = (Number(item.unitPrice) * Number(item.quantity || 1)) - (item.discount || 0);
                      return (
                        <tr key={item.cartKey} className="border-b border-slate-50 dark:border-slate-800/50">
                          <td className="py-2 pr-2">
                            <p className="font-medium truncate max-w-[140px]">
                              {isService ? item.description : item.productName}
                            </p>
                            {isService ? (
                              <p className="text-[10px] text-primary-600">
                                {item.chargeKind === 'ITEM' ? 'Item' : 'Service'}
                              </p>
                            ) : (
                              <>
                                <p className="font-mono text-[10px] text-slate-400">{item.barcode}</p>
                                {item.stockSource !== 'DN' && (item.grnNumber || item.poNumber) && (
                                  <p className="text-[10px] text-slate-400">
                                    {[item.grnNumber, item.poNumber].filter(Boolean).join(' • ')}
                                  </p>
                                )}
                              </>
                            )}
                          </td>
                          <td className="py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                          <td className="py-2 text-right">
                            {editingInvoiceId ? (
                              <span>{formatCurrency(item.discount || 0)}</span>
                            ) : (
                              <input
                                type="number"
                                min="0"
                                value={item.discount || 0}
                                onChange={(e) => updateItem(item.cartKey, 'discount', parseFloat(e.target.value) || 0)}
                                className="input-field !w-16 !py-1 text-right !text-xs ml-auto"
                              />
                            )}
                          </td>
                          <td className="py-2 text-right font-semibold">{formatCurrency(lineTotal)}</td>
                          <td className="py-2">
                            {!editingInvoiceId && (
                              <div className="flex items-center justify-end gap-1">
                                {isService && (
                                  <button type="button" onClick={() => startEditManualLine(item)} className="text-slate-400 hover:text-primary-600 text-[10px] font-medium">
                                    Edit
                                  </button>
                                )}
                                <button type="button" onClick={() => removeItem(item.cartKey)} className="text-red-400 hover:text-red-600">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">Scan barcodes or Add → Item / Service</p>
            )}

            <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal</span><span>{formatCurrency(totals.subtotal)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Discount</span><span className="text-red-500">-{formatCurrency(totals.totalDiscount)}</span></div>
              <div className="flex justify-between border-t border-slate-100 pt-2 text-lg font-bold dark:border-slate-800">
                <span>Grand Total</span><span className="text-primary-600">{formatCurrency(totals.grandTotal)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={clearBillingCart} className="btn-secondary flex-1" disabled={cartItems.length === 0 && !editingInvoiceId}>Clear</button>
              <button type="button" onClick={handleGenerateInvoice} className="btn-primary flex-1" disabled={cartItems.length === 0 || submitting}>
                <Receipt className="h-4 w-4" />
                {submitting
                  ? 'Processing…'
                  : (editingInvoiceId ? 'Update Invoice' : 'Generate Invoice')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={showPreview} onClose={() => setShowPreview(false)} title="Invoice Preview — A4" size="xl">
        {generatedInvoice && (
          <div className="rounded-lg bg-slate-100 p-4 dark:bg-slate-950">
            <InvoicePrintView
              invoice={generatedInvoice}
              settings={settings}
              onClose={() => setShowPreview(false)}
              onPrint={handlePrint}
              onEdit={
                generatedInvoice.status === 'CANCELLED'
                  ? undefined
                  : () => loadInvoiceForEdit(generatedInvoice)
              }
            />
          </div>
        )}
      </Modal>

      <PreviousInvoicesDrawer
        isOpen={showPreviousInvoices}
        onClose={() => setShowPreviousInvoices(false)}
        customers={customers}
        onViewInvoice={openInvoicePreview}
        onEditInvoice={loadInvoiceForEdit}
      />
    </div>
  );
}
