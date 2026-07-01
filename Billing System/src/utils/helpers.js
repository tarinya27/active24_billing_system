export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

export function formatDate(date) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-LK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-LK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function generateId(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

/** Purchase invoice is ready for GRN when linked to PO and has an invoice number. */
export function isInvoiceReadyForGrn(invoice) {
  return Boolean(
    invoice?.poId
    && invoice?.po?.poNumber
    && invoice?.supplierInvoiceNo?.trim()
    && !invoice?.grn
  );
}

export function generatePONumber(existingCount) {
  const num = String(existingCount + 1).padStart(4, '0');
  return `PO-2026-${num}`;
}

export function generateGRNNumber(existingCount) {
  const num = String(existingCount + 1).padStart(4, '0');
  return `GRN-2026-${num}`;
}

export function generateInvoiceNumber(existingCount) {
  const num = String(existingCount + 1).padStart(4, '0');
  return `INV-2026-${num}`;
}

export function getStockStatus(quantity, reorderLevel = 10) {
  if (quantity <= 0) return 'Out of Stock';
  if (quantity <= reorderLevel) return 'Low Stock';
  return 'In Stock';
}

export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}
