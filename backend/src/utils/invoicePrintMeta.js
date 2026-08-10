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
        unit.deliveryNote?.supplier?.vatRegistrationNo
        || grn?.supplier?.vatRegistrationNo
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

function poLineForUnit(unit) {
  const grn = unit.grnItem?.grn;
  const pi = unit.purchaseInvoice || grn?.purchaseInvoice;
  const po = grn?.po || pi?.po;
  if (!po?.items?.length) return null;
  return po.items.find((line) => line.productId === unit.productId) || null;
}

export function resolveCategoryNameFromUnit(unit) {
  if (unit.deliveryNoteItem?.category?.name) return unit.deliveryNoteItem.category.name;
  const poLine = poLineForUnit(unit);
  if (poLine?.product?.category?.name) return poLine.product.category.name;
  if (unit.grnItem?.category?.name) return unit.grnItem.category.name;
  if (unit.product?.category?.name) return unit.product.category.name;
  return null;
}

export function resolveItemDescriptionFromUnit(unit, fallbackName) {
  if (unit.deliveryNoteItem?.description?.trim()) return unit.deliveryNoteItem.description.trim();
  const poLine = poLineForUnit(unit);
  if (poLine?.description?.trim()) return poLine.description.trim();
  if (unit.grnItem?.description?.trim()) return unit.grnItem.description.trim();
  return fallbackName || unit.product?.name || null;
}
