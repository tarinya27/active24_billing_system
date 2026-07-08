import { createPortal } from 'react-dom';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { CREDIT_PAYMENT_TERM_DAYS } from '../../utils/constants';
import { companyInfo as fallbackCompany } from '../../data';
import BrandLogo from '../ui/BrandLogo';

export default function InvoicePrintView({ invoice, settings, forPrint = false, onClose, onPrint }) {
  if (!invoice) return null;

  const company = settings
    ? {
        name: settings.companyName,
        tagline: 'Billing & Inventory',
        address: settings.companyAddress,
        phone: settings.companyPhone,
        email: settings.companyEmail,
        website: 'active24.lk',
        registrationNo: '—',
        vatNo: '—',
      }
    : fallbackCompany;

  const content = (
    <div
      id={forPrint ? 'invoice-print-content' : undefined}
      className={`invoice-a4 invoice-a4-preview${forPrint ? ' invoice-print-layer hidden print:block' : ''}`}
    >
      <header className="invoice-header">
        <div className="invoice-header-left">
          <div className="invoice-brand">
            <div className="invoice-logo-wrap">
              <BrandLogo className="invoice-logo" alt={`${company.name} logo`} />
            </div>
            <div className="invoice-company-info">
              <h1 className="invoice-company-name">{company.name}</h1>
              <p className="invoice-company-address">{company.address}</p>
              <p className="invoice-company-phone">{company.phone}</p>
              {company.email && (
                <p className="invoice-company-email">{company.email}</p>
              )}
            </div>
          </div>
        </div>
        <div className="invoice-title-block">
          <p className="invoice-title">TAX INVOICE</p>
          <p className="invoice-number">{invoice.invoiceNumber}</p>
          <div className="invoice-details-block">
            <p className="invoice-label">Invoice Details</p>
            <div className="invoice-details-grid">
              <p className="invoice-detail-line">
                <span className="invoice-detail-label">Date</span>
                <span className="invoice-detail-value">{formatDate(invoice.date || invoice.createdAt)}</span>
              </p>
              <p className="invoice-detail-line">
                <span className="invoice-detail-label">Cashier</span>
                <span className="invoice-detail-value">{invoice.cashier?.name || invoice.cashier || '—'}</span>
              </p>
              <p className="invoice-detail-line">
                <span className="invoice-detail-label">Payment</span>
                <span className="invoice-detail-value">{invoice.paymentMethod}</span>
              </p>
            </div>
            {invoice.paymentMethod === 'Credit' && (
              <p className="invoice-credit-note">Payment due within {CREDIT_PAYMENT_TERM_DAYS} days</p>
            )}
          </div>
        </div>
      </header>

      <div className="invoice-meta-grid invoice-meta-grid--bill-to">
        <div className="invoice-meta-card invoice-meta-card--bill">
          <p className="invoice-label">Bill To</p>
          <p className="invoice-meta-value">{invoice.customer?.name}</p>
          <p className="invoice-meta-muted">{invoice.customer?.mobile}</p>
          <p className="invoice-meta-muted">{invoice.customer?.address}</p>
        </div>
        <div className="invoice-meta-card invoice-meta-card--company">
          <p className="invoice-label">Company Details</p>
          <p className="invoice-meta-row"><span>Registration No.</span><span>{company.registrationNo || '—'}</span></p>
          <p className="invoice-meta-row"><span>VAT No.</span><span>{company.vatNo || '—'}</span></p>
          <p className="invoice-meta-row"><span>Reference</span><span>{invoice.invoiceNumber}</span></p>
        </div>
      </div>

      <table className="invoice-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Product</th>
            <th>Barcode</th>
            <th className="text-right">Unit Price</th>
            <th className="text-right">Discount</th>
            <th className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, index) => {
            const name = item.productName || item.product?.name;
            const code = item.productCode || item.product?.code;
            const lineTotal = item.unitPrice * (item.quantity || 1);
            const finalTotal = lineTotal - (item.discount || 0);
            return (
              <tr key={item.barcode || item.productId || index}>
                <td>{index + 1}</td>
                <td>
                  <span className="invoice-product-name">{name}</span>
                  <span className="invoice-product-code">{code}</span>
                </td>
                <td className="font-mono text-xs">{item.barcode || item.productUnit?.barcode || '—'}</td>
                <td className="text-right">{formatCurrency(item.unitPrice)}</td>
                <td className="text-right">{item.discount ? formatCurrency(item.discount) : '—'}</td>
                <td className="text-right invoice-amount">{formatCurrency(finalTotal)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="invoice-bottom">
        <div className="invoice-notes invoice-notice-box">
          <p className="invoice-notice-heading">Important Notice</p>
          <p className="invoice-notice-body">
            This invoice serves as your official warranty document. Please keep this invoice in a safe place,
            as it is required for any warranty claims, exchanges, or after-sales service. We recommend
            retaining it for future reference.
          </p>
          <p className="invoice-notice-thanks">
            Thank you for choosing Active24 (Pvt) Ltd. We sincerely appreciate your business and look forward
            to serving you again.
          </p>
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
          {invoice.vatAmount > 0 && (
            <div className="invoice-total-row">
              <span>VAT</span>
              <span>{formatCurrency(invoice.vatAmount)}</span>
            </div>
          )}
          <div className="invoice-total-row invoice-grand-total">
            <span>Grand Total</span>
            <span>{formatCurrency(invoice.grandTotal)}</span>
          </div>
        </div>
      </div>

      <footer className="invoice-footer">
        <p>{company.name}</p>
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

  if (forPrint) return createPortal(content, document.body);
  return content;
}
