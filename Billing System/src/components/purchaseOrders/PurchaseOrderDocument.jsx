import {
  PO_PRINT_ACKNOWLEDGEMENT,
  PO_PRINT_ISSUER,
  PO_DELIVERY_ADDRESS,
} from '../../utils/poConstants';

export function formatPoDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

export function formatPoAmount(amount) {
  return new Intl.NumberFormat('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

function supplierAddress(supplier) {
  if (!supplier) return '—';
  return [supplier.address, supplier.city].filter(Boolean).join(', ') || '—';
}


export default function PurchaseOrderDocument({ po }) {
  if (!po) return null;

  const items = po.items || [];
  const subTotal = Number(
    po.subTotal ?? items.reduce((sum, item) => sum + Number(item.costPrice) * Number(item.quantity), 0)
  );
  const vatRate = Number(po.vatRate ?? 0);
  const vatAmount = Number(po.vatAmount ?? subTotal * (vatRate / 100));
  const totalValue = Number(po.totalAmount ?? subTotal + vatAmount);
  const attn = po.attn || po.supplier?.contactPerson || '';
  const isCollection = po.fulfillmentType === 'COLLECTION';

  return (
    <div id="po-print-content" className="po-print-document">
      <h1 className="po-print-title">Purchase Order</h1>
      <hr className="po-print-title-rule" />

      <div className="po-print-header">
        <div className="po-print-issuer">
          <img src="/active24-logo.png" alt="" className="po-print-logo" />
          <div>
            <p className="po-print-issuer-name">{PO_PRINT_ISSUER.name}</p>
            <p>{PO_PRINT_ISSUER.address}</p>
            <p>Tel: {PO_PRINT_ISSUER.tel}</p>
            <p>Email: {PO_PRINT_ISSUER.email}</p>
          </div>
        </div>

        <div className="po-print-vendor">
          <p className="po-print-vendor-name">{po.supplier?.name || '—'}</p>
          {attn && (
            <p className="po-print-vendor-sales">
              Sales Person: <em>{attn}</em>
            </p>
          )}
          <p>{supplierAddress(po.supplier)}</p>
          {po.supplier?.phone && <p>Tel: {po.supplier.phone}</p>}
          <hr className="po-print-vendor-rule" />
          <div className="po-print-meta-line">
            <span>No:</span>
            <span>{po.poNumber}</span>
          </div>
          <div className="po-print-meta-line">
            <span>Date:</span>
            <span>{formatPoDate(po.orderDate)}</span>
          </div>
        </div>
      </div>

      <div className="po-print-table-wrap">
        <table className="po-print-table">
        <thead>
          <tr>
            <th style={{ width: '6%' }}>No</th>
            <th className="po-print-th-desc">Description of Goods</th>
            <th style={{ width: '12%' }}>Quantity</th>
            <th style={{ width: '16%' }}>Unit Rate (Rs)</th>
            <th style={{ width: '16%' }}>Total (Rs)</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const lineTotal = Number(item.costPrice) * Number(item.quantity);
            return (
              <tr key={item.id || index}>
                <td className="text-center">{index + 1}</td>
                <td>{item.description || item.product?.name || '—'}</td>
                <td className="text-center">{item.quantity}</td>
                <td className="text-right">{formatPoAmount(item.costPrice)}</td>
                <td className="text-right">{formatPoAmount(lineTotal)}</td>
              </tr>
            );
          })}
          <tr>
            <td colSpan={3} />
            <td className="po-print-summary-label text-right">Sub Total</td>
            <td className="po-print-summary-value text-right">{formatPoAmount(subTotal)}</td>
          </tr>
          <tr>
            <td colSpan={3} />
            <td className="po-print-summary-label text-right">VAT {vatRate}</td>
            <td className="po-print-summary-value text-right">{formatPoAmount(vatAmount)}</td>
          </tr>
          <tr className="po-print-total-value">
            <td colSpan={3} />
            <td className="po-print-summary-label text-right">Total Value</td>
            <td className="text-right">{formatPoAmount(totalValue)}</td>
          </tr>
        </tbody>
      </table>
      </div>

      <p className="po-print-ack">{PO_PRINT_ACKNOWLEDGEMENT}</p>

      <div className="po-print-footer">
        <div className="po-print-footer-left">
          <p>
            <strong>Terms:</strong> {po.paymentTerms || '—'}
          </p>
          {isCollection ? (
            <p>
              <strong>Collected by:</strong> {po.collectedBy?.trim() || 'Self'}
            </p>
          ) : (
            <p>
              <strong>Delivery:</strong> {po.deliveryAddress?.trim() || PO_DELIVERY_ADDRESS}
            </p>
          )}
          <div className="po-print-signature-line" />
        </div>
        <div className="po-print-footer-right">
          <p className="po-print-issuer-name">{PO_PRINT_ISSUER.name}</p>
          <p className="po-print-footer-note">{PO_PRINT_ISSUER.signatureNote}</p>
        </div>
      </div>
    </div>
  );
}
