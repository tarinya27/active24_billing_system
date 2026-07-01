// cost-ex-VAT from purchase price when prices are VAT-inclusive (legacy purchaseWithVat).
export function calcCostExVat(purchasePrice, purchaseWithVat, vatRate = 0) {
  const price = Number(purchasePrice) || 0;
  const rate = Number(vatRate) || 0;
  if (!purchaseWithVat || rate <= 0) return round2(price);
  return round2(price / (1 + rate / 100));
}

export function calcAutoSellingPrice(costExVat) {
  return round2(Number(costExVat) * 1.3);
}

/** GRN default: Selling Price = Purchase Price × 1.30 */
export function calcGrnAutoSellingPrice(purchasePrice) {
  return round2(Number(purchasePrice) * 1.3);
}

/** Per-line VAT on top: VAT = (unitPrice × units × rate) / 100 */
export function calcPurchaseInvoiceLine(unitPrice, units, vatEnabled, vatRate = 0) {
  const price = Number(unitPrice) || 0;
  const qty = Number(units) || 0;
  const rate = vatEnabled ? Number(vatRate) || 0 : 0;
  const lineSubtotal = round2(price * qty);
  const vatAmount = rate > 0 ? round2((lineSubtotal * rate) / 100) : 0;
  const lineTotal = round2(lineSubtotal + vatAmount);
  return { lineSubtotal, vatAmount, lineTotal, unitPrice: price, units: qty };
}

/**
 * Invoice totals. Prefer vatEnabled (VAT added on top).
 * purchaseWithVat=true keeps legacy inclusive-pricing behaviour.
 */
export function calcPurchaseInvoiceTotals(items, purchaseWithVat, vatRate = 0, vatEnabled = null) {
  const useVatOnTop = vatEnabled != null ? vatEnabled : !purchaseWithVat;
  const effectiveRate = (vatEnabled || (!purchaseWithVat && Number(vatRate) > 0)) ? Number(vatRate) || 0 : 0;

  if (useVatOnTop && !purchaseWithVat) {
    let subtotal = 0;
    let vatAmount = 0;
    const lines = items.map((item) => {
      const enabled = vatEnabled != null ? vatEnabled : effectiveRate > 0;
      const calc = calcPurchaseInvoiceLine(item.unitPrice, item.units, enabled, effectiveRate);
      subtotal = round2(subtotal + calc.lineSubtotal);
      vatAmount = round2(vatAmount + calc.vatAmount);
      return {
        ...item,
        units: calc.units,
        unitPrice: calc.unitPrice,
        vatAmount: calc.vatAmount,
        lineTotal: calc.lineSubtotal,
        lineGrandTotal: calc.lineTotal,
      };
    });
    return { lines, subtotal, vatAmount, total: round2(subtotal + vatAmount) };
  }

  const rate = Number(vatRate) || 0;
  let subtotal = 0;
  let vatAmount = 0;

  const lines = items.map((item) => {
    const units = Number(item.units) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const lineTotal = round2(unitPrice * units);
    let lineVat = 0;

    if (purchaseWithVat && rate > 0) {
      lineVat = round2(lineTotal - lineTotal / (1 + rate / 100));
    } else if (!purchaseWithVat && rate > 0) {
      lineVat = round2(lineTotal * (rate / 100));
    }

    subtotal = round2(subtotal + lineTotal);
    vatAmount = round2(vatAmount + lineVat);

    return {
      ...item,
      units,
      unitPrice,
      vatAmount: lineVat,
      lineTotal,
      lineGrandTotal: purchaseWithVat ? lineTotal : round2(lineTotal + lineVat),
    };
  });

  const total = purchaseWithVat ? subtotal : round2(subtotal + vatAmount);
  return { lines, subtotal, vatAmount, total };
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}
