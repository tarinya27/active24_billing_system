// Purchase invoice & GRN pricing — keep in sync with backend/src/utils/pricing.js

export function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/** Per-line: VAT on top when enabled — VAT = (unitPrice × units × rate) / 100 */
export function calcPurchaseInvoiceLine(unitPrice, units, vatEnabled, vatRate = 0) {
  const price = Number(unitPrice) || 0;
  const qty = Number(units) || 0;
  const rate = vatEnabled ? Number(vatRate) || 0 : 0;
  const lineSubtotal = round2(price * qty);
  const vatAmount = rate > 0 ? round2((lineSubtotal * rate) / 100) : 0;
  const lineTotal = round2(lineSubtotal + vatAmount);
  return { lineSubtotal, vatAmount, lineTotal, unitPrice: price, units: qty };
}

export function calcPurchaseInvoiceTotals(items, vatEnabled, vatRate = 0) {
  let subtotal = 0;
  let vatAmount = 0;

  const lines = items.map((item) => {
    const calc = calcPurchaseInvoiceLine(item.unitPrice, item.units, vatEnabled, vatRate);
    subtotal = round2(subtotal + calc.lineSubtotal);
    vatAmount = round2(vatAmount + calc.vatAmount);
    return {
      ...item,
      ...calc,
      lineGrandTotal: calc.lineTotal,
    };
  });

  const total = round2(subtotal + vatAmount);
  return { lines, subtotal, vatAmount, total };
}

export function calcCostExVat(purchasePrice, vatEnabled, vatRate = 0) {
  const price = Number(purchasePrice) || 0;
  const rate = vatEnabled ? Number(vatRate) || 0 : 0;
  if (rate <= 0) return round2(price);
  return round2(price / (1 + rate / 100));
}

export function calcAutoSellingPrice(costExVat) {
  return round2(Number(costExVat) * 1.3);
}

/** GRN default: Selling Price = Purchase Price × 1.30 */
export function calcGrnAutoSellingPrice(purchasePrice) {
  return round2(Number(purchasePrice) * 1.3);
}
