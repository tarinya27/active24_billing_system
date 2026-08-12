import BrandLogo from '../ui/BrandLogo';
import { formatWarrantyLabel } from '../../utils/warranty';
import { displayTaxInvoiceField } from '../../utils/invoicePrintMeta';

const COMPANY_NAME = 'Active24 (Pvt) Ltd';
const COMPANY_ADDRESS = 'No: 92, Jambugasmulla Road, Nugegoda';
const COMPANY_PHONE = '(011) 255 2245';
const COMPANY_EMAIL = 'active24.pvt.ltd@gmail.com';
const COMPANY_BANK = 'ACTIVE24 (PVT) LTD. Bank of Ceylon, Thimbirigasyay Branch Current A/C No: 085063686';
const COMPANY_VAT_REG = '—';

function formatShortDate(date) {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function formatNumber(amount) {
  const n = Number(amount ?? 0);
  return new Intl.NumberFormat('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatRs(amount) {
  return `Rs${formatNumber(amount)}`;
}

function numberToWordsEnglish(n) {
  const ones = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const under1000 = (x) => {
    if (x === 0) return '';
    const parts = [];
    const hundreds = Math.floor(x / 100);
    const rest = x % 100;
    if (hundreds > 0) parts.push(`${ones[hundreds]} Hundred`);
    if (rest > 0) {
      if (rest < 10) parts.push(ones[rest]);
      else if (rest < 20) parts.push(teens[rest - 10]);
      else {
        const t = Math.floor(rest / 10);
        const o = rest % 10;
        parts.push(tens[t] + (o ? ` ${ones[o]}` : ''));
      }
    }
    return parts.join(' ');
  };

  const million = Math.floor(n / 1_000_000);
  const thousand = Math.floor((n % 1_000_000) / 1_000);
  const rest = n % 1_000;
  const segments = [];
  if (million) segments.push(`${under1000(million)} Million`);
  if (thousand) segments.push(`${under1000(thousand)} Thousand`);
  if (rest) segments.push(under1000(rest));
  return segments.length ? segments.join(' ') : 'Zero';
}

function amountInWords(amount) {
  return `${numberToWordsEnglish(Math.floor(Number(amount ?? 0)))}.`;
}

export default function InvoicePrintView({ invoice, settings: _settings, onClose, onPrint, onEdit }) {
  if (!invoice) return null;

  const invoiceDate = formatShortDate(invoice.date || invoice.createdAt);
  const dateOfSupply = invoiceDate;

  const poNo = displayTaxInvoiceField(invoice.poNumber || invoice.po?.poNumber);
  const sofNo = invoice.sofNo || '—';

  const placeOfSupplyLines = [
    invoice.customer?.name,
    invoice.customer?.address,
  ].filter(Boolean);

  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const emptyRowCount = Math.max(0, 10 - items.length);

  const paymentModeLabel = (() => {
    const m = (invoice.paymentMethod || '').toLowerCase();
    if (!m) return '—';
    if (m.includes('cash') || m.includes('card')) return 'Immidiatly';
    if (m.includes('bank')) return 'Bank Transfer';
    if (m.includes('credit')) return 'Credit';
    return invoice.paymentMethod;
  })();

  const customerName = invoice.customer?.name || '—';
  const preparedBy = invoice.cashier?.name || invoice.cashier || '—';

  return (
    <div id="invoice-print-content" className="invoice-a4 invoice-a4-preview invoice-print tax-invoice-legacy">
      <div className="tax-header">
        <div className="tax-header-left">
          <div className="tax-logo-wrap">
            <BrandLogo className="tax-logo" alt="Active24 logo" />
          </div>
          <div className="tax-company-block">
            <div className="tax-company-name">{COMPANY_NAME}</div>
            <div className="tax-company-address">{COMPANY_ADDRESS}</div>
          </div>
        </div>

        <div className="tax-header-right">
          <div className="tax-title">Invoice</div>
          <div className="tax-vat-reg">VAT Reg No. {COMPANY_VAT_REG}</div>
          <table className="tax-info-table">
            <tbody>
              <tr>
                <td className="tax-info-label">P.O No.</td>
                <td className="tax-info-value">{poNo}</td>
              </tr>
              <tr>
                <td className="tax-info-label">SOF No.</td>
                <td className="tax-info-value">{sofNo}</td>
              </tr>
              <tr>
                <td className="tax-info-label">Invoice #</td>
                <td className="tax-info-value">{invoice.invoiceNumber}</td>
              </tr>
              <tr>
                <td className="tax-info-label tax-info-label-top">Place of Supply</td>
                <td className="tax-info-value tax-info-value-multiline">
                  {placeOfSupplyLines.length > 0
                    ? placeOfSupplyLines.map((line) => <div key={line}>{line}</div>)
                    : 'Sri Lanka'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="tax-left-info">
        <div className="tax-left-info-row">
          <span className="tax-left-info-label">Date of Invoice</span>
          <span className="tax-left-info-value">{invoiceDate}</span>
        </div>
        <div className="tax-left-info-row">
          <span className="tax-left-info-label">Telephone</span>
          <span className="tax-left-info-value">{COMPANY_PHONE}</span>
        </div>
        <div className="tax-left-info-row">
          <span className="tax-left-info-label">E-mail</span>
          <span className="tax-left-info-value">{COMPANY_EMAIL}</span>
        </div>
        <div className="tax-left-info-row">
          <span className="tax-left-info-label">Date of Supply</span>
          <span className="tax-left-info-value">{dateOfSupply}</span>
        </div>
      </div>

      <table className="tax-main-table">
        <colgroup>
          <col className="tax-col-item" />
          <col className="tax-col-desc" />
          <col className="tax-col-qty" />
          <col className="tax-col-price" />
          <col className="tax-col-amount" />
        </colgroup>
        <thead>
          <tr>
            <th className="tax-col-item">Item</th>
            <th className="tax-col-desc">Description</th>
            <th className="tax-col-qty">Qty</th>
            <th className="tax-col-price">Unit Price</th>
            <th className="tax-col-amount">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => {
            const qty = it.quantity ?? 1;
            const discount = Number(it.discount ?? 0);
            const lineBase = Number(it.unitPrice ?? 0) * Number(qty);
            const amountExVat = lineBase - discount;
            const itemLabel = it.itemType === 'SERVICE'
              ? (it.categoryName === 'Item' || it.chargeKind === 'ITEM' ? 'Item' : 'Service')
              : (it.categoryName || it.category || 'Others');
            const productName = it.itemDescription || it.description || it.productName || it.product?.name || '—';
            const serialOrBarcode = it.itemType === 'SERVICE' ? '' : (it.barcode || it.serialNumber || '');
            const warrantyLabel = it.itemType === 'SERVICE' ? null : formatWarrantyLabel(it.warrantyMonths);

            return (
              <tr key={it.id || it.barcode || `${it.productId || 'item'}-${i}`}>
                <td className="tax-col-item">{itemLabel}</td>
                <td className="tax-col-desc">
                  <div>{productName}</div>
                  {serialOrBarcode && <div>S/N - {serialOrBarcode}</div>}
                  {warrantyLabel && <div>Warranty: {warrantyLabel}</div>}
                </td>
                <td className="tax-col-qty">{qty}</td>
                <td className="tax-col-price">{formatNumber(it.unitPrice)}</td>
                <td className="tax-col-amount">{formatNumber(amountExVat)}</td>
              </tr>
            );
          })}

          {Array.from({ length: emptyRowCount }).map((_, i) => (
            <tr key={`empty-${i}`} className="tax-row-empty">
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
            </tr>
          ))}

          <tr className="tax-row-total">
            <td colSpan={2} className="tax-cheque-cell">
              Please draw cheques in favour of &apos;{COMPANY_NAME}&apos;
            </td>
            <td colSpan={2} className="tax-total-label-cell">
              Total Amount Including VAT
            </td>
            <td className="tax-total-value-cell">{formatRs(invoice.grandTotal)}</td>
          </tr>

          <tr className="tax-row-payment">
            <td colSpan={2} className="tax-payment-label-cell">Mode of Payments</td>
            <td colSpan={3} className="tax-payment-value-cell">{paymentModeLabel}</td>
          </tr>

          <tr className="tax-row-payment">
            <td colSpan={2} className="tax-payment-label-cell">Total Amounts in Words</td>
            <td colSpan={3} className="tax-payment-value-cell">{amountInWords(invoice.grandTotal)}</td>
          </tr>
        </tbody>
      </table>

      <div className="tax-bank-row">
        {COMPANY_BANK}
      </div>

      <table className="tax-signature-table">
        <tbody>
          <tr className="tax-sig-header-row">
            <td colSpan={2} className="tax-sig-customer-block">
              <div className="tax-sig-customer-inner">
                <div className="tax-sig-customer-name-area">
                  <div className="tax-sig-label">Customer Name</div>
                  <div className="tax-sig-name">{customerName}</div>
                </div>
                <div className="tax-sig-customer-sign-area">
                  <div className="tax-sig-label">Signature</div>
                  <div className="tax-sig-line" />
                </div>
              </div>
            </td>
            <td colSpan={3} className="tax-sig-company-block">
              <div className="tax-sig-company-title">On behalf of {COMPANY_NAME}</div>
              <div className="tax-sig-company-cols">
                <div className="tax-sig-company-col">
                  <div className="tax-sig-label">Prepared by</div>
                  <div className="tax-sig-name">{preparedBy}</div>
                  <div className="tax-sig-line" />
                </div>
                <div className="tax-sig-company-col">
                  <div className="tax-sig-label">Checked by</div>
                  <div className="tax-sig-name">&nbsp;</div>
                  <div className="tax-sig-line" />
                </div>
                <div className="tax-sig-company-col">
                  <div className="tax-sig-label">Authorized by</div>
                  <div className="tax-sig-name">&nbsp;</div>
                  <div className="tax-sig-line" />
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {!onClose && !onPrint && !onEdit ? null : (
        <div className="no-print invoice-actions">
          {onClose && (
            <button type="button" onClick={onClose} className="btn-secondary">Close</button>
          )}
          {onEdit && (
            <button type="button" onClick={onEdit} className="btn-secondary">Edit Invoice</button>
          )}
          {onPrint && (
            <button type="button" onClick={onPrint} className="btn-primary">Print Invoice</button>
          )}
        </div>
      )}
    </div>
  );
}
