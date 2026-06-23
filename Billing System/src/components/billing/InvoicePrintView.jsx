import { createPortal } from 'react-dom';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { CREDIT_PAYMENT_TERM_DAYS } from '../../utils/constants';
import { companyInfo } from '../../data';

export default function InvoicePrintView({ invoice, products, forPrint = false, onClose, onPrint }) {
  if (!invoice) return null;

  const content = (
    <div
      id={forPrint ? 'invoice-print-content' : undefined}
      className={`invoice-a4 invoice-a4-preview${forPrint ? ' invoice-print-layer hidden print:block' : ''}`}
    >
      {/* Header band */}
      <header className="invoice-header">
        <div className="invoice-header-left">
          <div className="invoice-brand">
            <div className="invoice-logo">A24</div>
            <div>
              <h1 className="invoice-company-name">{companyInfo.name}</h1>
              <p className="invoice-tagline">{companyInfo.tagline}</p>
            </div>
          </div>
          <div className="invoice-company-details">
            <p className="invoice-meta-muted">{companyInfo.address}</p>
            <p className="invoice-meta-muted">{companyInfo.phone} • {companyInfo.email}</p>
            <p className="invoice-meta-muted">Reg: {companyInfo.registrationNo}</p>
          </div>
        </div>
        <div className="invoice-title-block">
          <p className="invoice-title">TAX INVOICE</p>
          <p className="invoice-number">{invoice.invoiceNumber}</p>
          <div className="invoice-details-block">
            <p className="invoice-label">Invoice Details</p>
            <p className="invoice-detail-line"><span>Date</span><span>{formatDate(invoice.date)}</span></p>
            <p className="invoice-detail-line"><span>Cashier</span><span>{invoice.cashier}</span></p>
            <p className="invoice-detail-line"><span>Payment</span><span>{invoice.paymentMethod}</span></p>
            {invoice.paymentMethod === 'Credit' && (
              <p className="invoice-credit-note">Immediate Payment: {CREDIT_PAYMENT_TERM_DAYS} days</p>
            )}
          </div>
        </div>
      </header>

      <div className="invoice-meta-grid invoice-meta-grid--bill-to">
        <div className="invoice-meta-card">
          <p className="invoice-label">Bill To</p>
          <p className="invoice-meta-value">{invoice.customer?.name}</p>
          <p className="invoice-meta-muted">{invoice.customer?.mobile}</p>
          <p className="invoice-meta-muted">{invoice.customer?.address}</p>
        </div>
      </div>

      {/* Items table */}
      <table className="invoice-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Product</th>
            <th className="text-center">Qty</th>
            <th className="text-right">Unit Price</th>
            <th className="text-right">Line Total</th>
            <th className="text-right">Discount</th>
            <th className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, index) => {
            const product = products.find((p) => p.id === item.productId);
            const lineTotal = item.unitPrice * item.quantity;
            const finalTotal = lineTotal - (item.discount || 0);
            return (
              <tr key={item.productId}>
                <td>{index + 1}</td>
                <td>
                  <span className="invoice-product-name">{product?.name}</span>
                  <span className="invoice-product-code">{product?.code}</span>
                </td>
                <td className="text-center">{item.quantity}</td>
                <td className="text-right">{formatCurrency(item.unitPrice)}</td>
                <td className="text-right">{formatCurrency(lineTotal)}</td>
                <td className="text-right">{item.discount ? formatCurrency(item.discount) : '—'}</td>
                <td className="text-right invoice-amount">{formatCurrency(finalTotal)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals + footer */}
      <div className="invoice-bottom">
        <div className="invoice-notes">
          <p className="invoice-label">Notes</p>
          <p className="invoice-meta-muted">Thank you for your business. Please retain this invoice for your records.</p>
          <p className="invoice-meta-muted">Goods once sold are subject to company return policy.</p>
        </div>
        <div className="invoice-totals">
          <div className="invoice-total-row">
            <span>Subtotal</span>
            <span>{formatCurrency(invoice.subtotal)}</span>
          </div>
          <div className="invoice-total-row invoice-discount">
            <span>Discount</span>
            <span>-{formatCurrency(invoice.totalDiscount)}</span>
          </div>
          <div className="invoice-total-row invoice-grand-total">
            <span>Grand Total</span>
            <span>{formatCurrency(invoice.grandTotal)}</span>
          </div>
        </div>
      </div>

      <div className="invoice-signatures">
        <div className="invoice-signature-col">
          <div className="invoice-signature-line" />
          <p className="invoice-signature-label">Customer Signature</p>
          <p className="invoice-signature-name-field">Name:</p>
        </div>
        <div className="invoice-signature-col">
          <div className="invoice-signature-line" />
          <p className="invoice-signature-label">Prepared By</p>
        </div>
        <div className="invoice-signature-col">
          <div className="invoice-signature-line" />
          <p className="invoice-signature-label">Checked By</p>
        </div>
      </div>

      <footer className="invoice-footer">
        <p>{companyInfo.website} • {companyInfo.name}</p>
        <p>Computer Generated Invoice</p>
      </footer>

      {!forPrint && onClose && onPrint && (
        <div className="no-print invoice-actions">
          <button type="button" onClick={onClose} className="btn-secondary">Close</button>
          <button type="button" onClick={onPrint} className="btn-primary">Print Invoice</button>
        </div>
      )}
    </div>
  );

  if (forPrint) {
    return createPortal(content, document.body);
  }

  return content;
}
