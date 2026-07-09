/**
 * Resolve tax-invoice display fields from sold inventory units (read-only mapping).
 */
export function resolvePoNumberFromUnits(units = []) {
  const numbers = units
    .map((unit) => {
      const grn = unit.grnItem?.grn;
      const pi = unit.purchaseInvoice || grn?.purchaseInvoice;
      return grn?.po?.poNumber || pi?.po?.poNumber || null;
    })
    .filter(Boolean);
  const unique = [...new Set(numbers)];
  if (unique.length === 0) return null;
  return unique.length === 1 ? unique[0] : unique.join(', ');
}

export function resolveSupplierTinFromUnits(units = []) {
  const tins = units
    .map((unit) => {
      const grn = unit.grnItem?.grn;
      const pi = unit.purchaseInvoice || grn?.purchaseInvoice;
      return (
        grn?.supplier?.vatRegistrationNo
        || pi?.supplier?.vatRegistrationNo
        || unit.product?.supplier?.vatRegistrationNo
        || null
      );
    })
    .map((value) => (value ? String(value).trim() : ''))
    .filter(Boolean);
  const unique = [...new Set(tins)];
  return unique[0] || null;
}
