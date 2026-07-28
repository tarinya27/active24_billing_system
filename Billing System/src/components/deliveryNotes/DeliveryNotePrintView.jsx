import BrandLogo from '../ui/BrandLogo';
import { formatWarrantyLabel } from '../../utils/warranty';

const COMPANY_NAME = 'Active24 (Pvt) Ltd';
const COMPANY_ADDRESS = 'No: 92, Jambugasmulla Road, Nugegoda';
const COMPANY_PHONE = '(011) 255 2245';
const COMPANY_EMAIL = 'active24.pvt.ltd@gmail.com';

function formatDnDate(date) {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function customerLines(customer) {
  if (!customer) return [];
  return [
    customer.name,
    customer.address,
    customer.mobile && customer.mobile !== '-' ? `Tel: ${customer.mobile}` : null,
  ].filter(Boolean);
}

function shortItemLabel(item) {
  if (item.category?.name) return item.category.name;
  const name = item.product?.name || '';
  if (!name) return item.product?.code || '—';
  const words = name.trim().split(/\s+/);
  if (words.length <= 2) return name;
  return words.slice(0, 2).join(' ');
}

function buildDescription(item, extraUnits = []) {
  const lines = [];
  const base = item.description?.trim() || item.product?.name || '—';
  lines.push(base);

  const warranty = formatWarrantyLabel(item.warrantyMonths);
  if (warranty) lines.push(`Warranty: ${warranty}`);

  const seen = new Set();
  const units = [...(item.productUnits || []), ...extraUnits];
  units.forEach((unit) => {
    if (!unit?.barcode || seen.has(unit.barcode)) return;
    seen.add(unit.barcode);
    lines.push(`S/N - ${unit.barcode}`);
  });

  return lines;
}

export default function DeliveryNotePrintView({ dn, onClose, onPrint }) {
  if (!dn) return null;

  const items = Array.isArray(dn.items) ? dn.items : [];
  const billToLines = customerLines(dn.customer);
  const shipToLines = billToLines;
  const invoiceNos = (dn.invoices || [])
    .map((inv) => inv.invoiceNumber)
    .filter(Boolean);
  const invNo = invoiceNos.length ? invoiceNos.join(', ') : '—';
  const remarks = dn.notes?.trim() || '';
  const metaRemarks = remarks || '—';
  const dnDate = formatDnDate(dn.receivedDate || dn.createdAt);

  return (
    <div id="dn-print-content" className="dn-a4 dn-a4-preview dn-print">
      <div className="dn-sheet">
        <header className="dn-header">
          <div className="dn-header-left">
            <div className="dn-logo-wrap">
              <BrandLogo className="dn-logo" alt="Active24 logo" />
            </div>
            <div className="dn-company-block">
              <div className="dn-company-name">{COMPANY_NAME}</div>
              <div className="dn-company-line">{COMPANY_ADDRESS}</div>
              <div className="dn-company-line">Telephone : {COMPANY_PHONE}</div>
              <div className="dn-company-line">E-mail : {COMPANY_EMAIL}</div>
            </div>
          </div>

          <div className="dn-header-right">
            <div className="dn-title">DELIVERY NOTE</div>
            <table className="dn-meta-table">
              <thead>
                <tr>
                  <th>D.N. No</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="dn-meta-value">{dn.dnNumber}</td>
                  <td className="dn-meta-value">{dnDate}</td>
                </tr>
                <tr>
                  <td className="dn-meta-label">INV No</td>
                  <td className="dn-meta-value">{invNo}</td>
                </tr>
                <tr>
                  <td className="dn-meta-label">Remarks</td>
                  <td className="dn-meta-value">{metaRemarks}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </header>

        <table className="dn-address-table">
          <thead>
            <tr>
              <th>Bill To</th>
              <th>Ship To</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div className="dn-address-body">
                  {billToLines.length
                    ? billToLines.map((line) => <div key={line}>{line}</div>)
                    : '—'}
                </div>
              </td>
              <td>
                <div className="dn-address-body">
                  {shipToLines.length
                    ? shipToLines.map((line) => <div key={line}>{line}</div>)
                    : '—'}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="dn-items-block">
          <table className="dn-items-table">
            <colgroup>
              <col className="dn-col-item" />
              <col className="dn-col-desc" />
              <col className="dn-col-qty" />
            </colgroup>
            <thead>
              <tr>
                <th>Item</th>
                <th>Description</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const pendingUnits = (dn.units || []).filter((u) => u.productId === item.productId);
                const descLines = buildDescription(item, pendingUnits);
                return (
                  <tr key={item.id || index} className="dn-row-item">
                    <td className="dn-cell-item">{shortItemLabel(item)}</td>
                    <td className="dn-cell-desc">
                      {descLines.map((line) => (
                        <div key={line}>{line}</div>
                      ))}
                    </td>
                    <td className="dn-cell-qty">{item.units}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* Single blank region — keeps A4 table height without extra horizontal rules */}
          <div className="dn-items-blank" aria-hidden="true">
            <div className="dn-blank-col dn-blank-item" />
            <div className="dn-blank-col dn-blank-desc" />
            <div className="dn-blank-col dn-blank-qty" />
          </div>
        </div>

        <div className="dn-remarks-row">
          <span className="dn-remarks-label">Remarks</span>
          <span className="dn-remarks-value">{remarks}</span>
        </div>

        <div className="dn-signature-row">
          <div className="dn-sig-left">
            <div className="dn-sig-field">
              <span className="dn-sig-label">Signature of Recipient</span>
              <div className="dn-sig-line" />
            </div>
            <div className="dn-sig-field">
              <span className="dn-sig-label">Name</span>
              <div className="dn-sig-line" />
            </div>
          </div>
          <div className="dn-sig-right">
            <div className="dn-sig-behalf">For &amp; On Behalf Of</div>
            <div className="dn-sig-company">{COMPANY_NAME}</div>
            <div className="dn-sig-space" />
          </div>
        </div>
      </div>

      {onClose && onPrint ? (
        <div className="no-print dn-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
          <button type="button" className="btn-primary" onClick={onPrint}>Print Delivery Note</button>
        </div>
      ) : null}
    </div>
  );
}
