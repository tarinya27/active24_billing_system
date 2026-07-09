/**
 * Resolve tax-invoice display fields from sold line items (read-only mapping).
 */
export function resolveTaxInvoicePoNumber(items = []) {
  const numbers = items
    .map((item) => item.poNumber)
    .filter((value) => value && value !== '—');
  const unique = [...new Set(numbers)];
  if (unique.length === 0) return null;
  return unique.length === 1 ? unique[0] : unique.join(', ');
}

export function resolveTaxInvoiceSupplierTin(items = []) {
  const tins = items
    .map((item) => item.supplierTin)
    .filter((value) => value && String(value).trim());
  const unique = [...new Set(tins.map((value) => String(value).trim()))];
  return unique[0] || null;
}

export function displayTaxInvoiceField(value) {
  const text = value != null ? String(value).trim() : '';
  return text || '—';
}
