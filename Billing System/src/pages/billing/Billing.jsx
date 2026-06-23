import { useState, useMemo } from 'react';
import { Search, ShoppingCart, Trash2, Receipt, History } from 'lucide-react';
import PreviousInvoicesDrawer from '../../components/billing/PreviousInvoicesDrawer';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import BarcodeInput from '../../components/ui/BarcodeInput';
import Modal from '../../components/ui/Modal';
import InvoicePrintView from '../../components/billing/InvoicePrintView';
import WalkInCustomerForm from '../../components/billing/WalkInCustomerForm';
import { useApp } from '../../context/AppContext';
import { findProductByBarcode } from '../../data/mockProducts';
import { calculateInvoiceTotals } from '../../utils/invoiceCalculations';
import { formatCurrency } from '../../utils/helpers';
import { PAYMENT_METHODS, CREDIT_PAYMENT_TERM_DAYS } from '../../utils/constants';
import { currentUser } from '../../data';

export default function Billing() {
  const { products, customers, invoices, addInvoice, addCustomer } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [cartItems, setCartItems] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('CUS-019');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [showPreview, setShowPreview] = useState(false);
  const [showPreviousInvoices, setShowPreviousInvoices] = useState(false);
  const [generatedInvoice, setGeneratedInvoice] = useState(null);

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products.filter((p) => p.quantity > 0).slice(0, 12);
    const q = searchQuery.toLowerCase();
    return products.filter((p) => p.quantity > 0 && (p.name.toLowerCase().includes(q) || p.barcode.includes(q) || p.code.toLowerCase().includes(q)));
  }, [products, searchQuery]);

  const customer = customers.find((c) => c.id === selectedCustomer);
  const isWalkInCustomer = customer?.type === 'Walk-in' && customer?.name === 'Walk-in Customer';

  const handleSaveWalkInCustomer = (customerData) => {
    const newCustomer = addCustomer(customerData);
    setSelectedCustomer(newCustomer.id);
    toast.success(`${newCustomer.name} added to customer base`);
  };

  const addToCart = (product) => {
    const existing = cartItems.find((i) => i.productId === product.id);
    if (existing) {
      if (existing.quantity >= product.quantity) { toast.warning('Insufficient stock'); return; }
      setCartItems(cartItems.map((i) => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCartItems([...cartItems, { productId: product.id, quantity: 1, unitPrice: product.sellingPrice, discount: 0 }]);
    }
    toast.success(`${product.name} added`);
  };

  const handleBarcodeScan = (barcode) => {
    const product = findProductByBarcode(barcode);
    if (!product) { toast.error('Product not found'); return; }
    if (product.quantity <= 0) { toast.error('Product out of stock'); return; }
    addToCart(product);
  };

  const updateItem = (productId, field, value) => {
    setCartItems(cartItems.map((i) => i.productId === productId ? { ...i, [field]: value } : i));
  };

  const removeItem = (productId) => setCartItems(cartItems.filter((i) => i.productId !== productId));

  const totals = calculateInvoiceTotals(cartItems);

  const handleGenerateInvoice = () => {
    if (cartItems.length === 0) { toast.error('Add items to the invoice'); return; }
    const invoice = addInvoice({
      customerId: selectedCustomer,
      cashier: currentUser.name,
      paymentMethod,
      items: cartItems,
      ...totals,
    });
    setGeneratedInvoice({ ...invoice, customer, items: cartItems });
    setShowPreview(true);
    setCartItems([]);
    toast.success('Invoice generated successfully!');
  };

  const handlePrint = () => {
    setTimeout(() => window.print(), 150);
  };

  const openInvoicePreview = (invoice) => {
    const invCustomer = customers.find((c) => c.id === invoice.customerId);
    setGeneratedInvoice({ ...invoice, customer: invCustomer, items: invoice.items });
    setShowPreviousInvoices(false);
    setShowPreview(true);
  };

  return (
    <div>
      <PageHeader
        title="Billing / Invoicing"
        subtitle="POS-style billing interface"
        actions={
          <button type="button" onClick={() => setShowPreviousInvoices(true)} className="btn-secondary">
            <History className="h-4 w-4" /> Previous Invoices
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* Left - Product Search */}
        <div className="xl:col-span-3 space-y-4">
          <div className="glass-card p-4">
            <BarcodeInput onScan={handleBarcodeScan} placeholder="Scan barcode to add product..." />
          </div>
          <div className="glass-card p-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search products by name, code, or barcode..." className="input-field pl-10" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((product) => (
                <button key={product.id} onClick={() => addToCart(product)} className="group rounded-xl border border-slate-100 p-4 text-left transition-all hover:border-primary-200 hover:bg-primary-50/50 hover:shadow-md dark:border-slate-800 dark:hover:border-primary-800 dark:hover:bg-primary-950/20">
                  <p className="text-sm font-medium text-slate-800 group-hover:text-primary-700 dark:text-white">{product.name}</p>
                  <p className="text-xs text-slate-500">{product.code}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-bold text-primary-600">{formatCurrency(product.sellingPrice)}</span>
                    <span className="text-xs text-slate-400">Stock: {product.quantity}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right - Invoice Summary */}
        <div className="xl:col-span-2">
          <div className="glass-card sticky top-20 p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <ShoppingCart className="h-5 w-5 text-primary-600" />
              <h3 className="font-semibold">Current Invoice</h3>
              <span className="ml-auto rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-950 dark:text-primary-400">{cartItems.length} items</span>
            </div>

            {/* Customer */}
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Customer</label>
                <select value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)} className="select-field !text-sm">
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {customer && (
                <div className="rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800/50">
                  <p><span className="text-slate-500">Mobile:</span> {customer.mobile}</p>
                  <p className="mt-1"><span className="text-slate-500">Address:</span> {customer.address}</p>
                </div>
              )}
              {isWalkInCustomer && (
                <WalkInCustomerForm onSave={handleSaveWalkInCustomer} />
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Payment Method</label>
                <div className="flex flex-wrap gap-2">
                  {PAYMENT_METHODS.map((m) => (
                    <button key={m} type="button" onClick={() => setPaymentMethod(m)} className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${paymentMethod === m ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-400' : 'border-slate-200 text-slate-600 dark:border-slate-700'}`}>
                      {m}
                    </button>
                  ))}
                </div>
                {paymentMethod === 'Credit' && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-300">
                      Immediate Payment: {CREDIT_PAYMENT_TERM_DAYS} days
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Cart Items */}
            {cartItems.length > 0 ? (
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="pb-2 text-left">Product</th>
                      <th className="pb-2 text-center">Qty</th>
                      <th className="pb-2 text-right">Disc.</th>
                      <th className="pb-2 text-right">Total</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cartItems.map((item) => {
                      const product = products.find((p) => p.id === item.productId);
                      const lineTotal = item.unitPrice * item.quantity - (item.discount || 0);
                      return (
                        <tr key={item.productId} className="border-b border-slate-50 dark:border-slate-800/50">
                          <td className="py-2 pr-2">
                            <p className="font-medium truncate max-w-[120px]">{product?.name}</p>
                            <p className="text-slate-400">{formatCurrency(item.unitPrice)}</p>
                          </td>
                          <td className="py-2">
                            <input type="number" min="1" max={product?.quantity} value={item.quantity} onChange={(e) => updateItem(item.productId, 'quantity', parseInt(e.target.value) || 1)} className="input-field !w-14 !py-1 text-center !text-xs" />
                          </td>
                          <td className="py-2">
                            <input type="number" min="0" value={item.discount || 0} onChange={(e) => updateItem(item.productId, 'discount', parseFloat(e.target.value) || 0)} className="input-field !w-16 !py-1 text-right !text-xs" />
                          </td>
                          <td className="py-2 text-right font-semibold">{formatCurrency(lineTotal)}</td>
                          <td className="py-2"><button onClick={() => removeItem(item.productId)} className="text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">No items added yet</p>
            )}

            {/* Totals */}
            <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal</span><span>{formatCurrency(totals.subtotal)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Discount</span><span className="text-red-500">-{formatCurrency(totals.totalDiscount)}</span></div>
              <div className="flex justify-between border-t border-slate-100 pt-2 text-lg font-bold dark:border-slate-800">
                <span>Grand Total</span><span className="text-primary-600">{formatCurrency(totals.grandTotal)}</span>
              </div>
              {paymentMethod === 'Credit' && (
                <div className="rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-950/30">
                  <p className="text-sm font-bold text-amber-900 dark:text-amber-300">
                    Immediate Payment: {CREDIT_PAYMENT_TERM_DAYS} days
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setCartItems([])} className="btn-secondary flex-1" disabled={cartItems.length === 0}>Clear</button>
              <button onClick={handleGenerateInvoice} className="btn-primary flex-1" disabled={cartItems.length === 0}>
                <Receipt className="h-4 w-4" /> Generate Invoice
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Preview Modal — A4 layout */}
      <Modal isOpen={showPreview} onClose={() => setShowPreview(false)} title="Invoice Preview — A4" size="xl">
        {generatedInvoice && (
          <div className="rounded-lg bg-slate-100 p-4 dark:bg-slate-950">
            <InvoicePrintView
              invoice={generatedInvoice}
              products={products}
              onClose={() => setShowPreview(false)}
              onPrint={handlePrint}
            />
          </div>
        )}
      </Modal>

      {/* Print layer — same markup as preview, portaled to body for PDF */}
      {generatedInvoice && showPreview && (
        <InvoicePrintView invoice={generatedInvoice} products={products} forPrint />
      )}

      <PreviousInvoicesDrawer
        isOpen={showPreviousInvoices}
        onClose={() => setShowPreviousInvoices(false)}
        invoices={invoices}
        customers={customers}
        onViewInvoice={openInvoicePreview}
      />
    </div>
  );
}
