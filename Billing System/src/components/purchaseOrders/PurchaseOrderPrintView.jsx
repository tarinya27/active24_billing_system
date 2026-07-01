import { createPortal } from 'react-dom';
import { formatCurrency, formatDate } from '../../utils/helpers';

export default function PurchaseOrderPrintView({ po, onClose, onPrint }) {
  if (!po) return null;

  const content = (
    <div id="invoice-print-content" className="invoice-a4 invoice-a4-preview">
      <header className="invoice-header">
        <div className="invoice-header-left">
          <div className="invoice-brand">
            <div className="invoice-logo">A24</div>
            <div>
              <h1 className="invoice-company-name">Active24 (Pvt) Ltd</h1>
              <p className="invoice-tagline">Purchase Order</p>
            </div>
          </div>
        </div>
        <div className="invoice-title-block">
          <h2 className="invoice-doc-title">PURCHASE ORDER</h2>
          <p className="invoice-doc-number">{po.poNumber}</p>
          <p className="invoice-meta-muted">Date: {formatDate(po.orderDate)}</p>
          {po.expectedDelivery && (
            <p className="invoice-meta-muted">Expected: {formatDate(po.expectedDelivery)}</p>
          )}
        </div>
      </header>

      <section className="invoice-parties">
        <div>
          <p className="invoice-section-label">Supplier</p>
          <p className="font-semibold">{po.supplier?.name || '—'}</p>
          {po.attn && <p className="text-sm text-slate-500">Attn: {po.attn}</p>}
          {po.supplierRefNo && <p className="text-sm text-slate-500">Ref: {po.supplierRefNo}</p>}
        </div>
        <div>
          <p className="invoice-section-label">Terms</p>
          <p className="font-semibold">{po.paymentTerms || '—'}</p>
          {po.fulfillmentType === 'DELIVERY' && po.deliveryAddress && (
            <p className="mt-1 text-sm text-slate-500">Delivery: {po.deliveryAddress}</p>
          )}
          {po.fulfillmentType === 'COLLECTION' && po.collectedBy && (
            <p className="mt-1 text-sm text-slate-500">Collected by: {po.collectedBy}</p>
          )}
        </div>
      </section>

      <table className="invoice-lines-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Product</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Unit Cost</th>
            <th className="text-right">Line Total</th>
          </tr>
        </thead>
        <tbody>
          {(po.items || []).map((item, i) => (
            <tr key={item.id || i}>
              <td>{i + 1}</td>
              <td>
                <span className="font-medium">{item.description || item.product?.name || '—'}</span>
                {item.product?.code && <span className="block text-xs text-slate-500">{item.product.code}</span>}
              </td>
              <td className="text-right">{item.quantity}</td>
              <td className="text-right">{formatCurrency(Number(item.costPrice))}</td>
              <td className="text-right">{formatCurrency(Number(item.costPrice) * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="invoice-totals">
        <div className="invoice-total-row">
          <span>Sub Total</span>
          <span>{formatCurrency(Number(po.subTotal ?? po.totalAmount))}</span>
        </div>
        <div className="invoice-total-row">
          <span>VAT ({Number(po.vatRate ?? 0)}%)</span>
          <span>{formatCurrency(Number(po.vatAmount ?? 0))}</span>
        </div>
        <div className="invoice-total-row invoice-grand-total">
          <span>Grand Total</span>
          <span>{formatCurrency(Number(po.totalAmount))}</span>
        </div>
      </div>

      {po.notes && (
        <div className="mt-6 text-sm">
          <p className="font-semibold text-slate-600">Notes</p>
          <p className="mt-1 text-slate-500">{po.notes}</p>
        </div>
      )}
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 print:relative print:inset-auto print:block print:bg-white print:p-0">
      <div className="my-8 w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl print:my-0 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <div className="mb-4 flex justify-end gap-2 print:hidden">
          <button type="button" onClick={onClose} className="btn-secondary">Close</button>
          <button type="button" onClick={onPrint} className="btn-primary">Print</button>
        </div>
        {content}
      </div>
    </div>,
    document.body
  );
}
