// cost-ex-VAT from purchase price when "Purchase with VAT?" is enabled.
export function calcCostExVat(purchasePrice, purchaseWithVat, vatRate = 0) {
  const price = Number(purchasePrice) || 0;
  const rate = Number(vatRate) || 0;
  if (!purchaseWithVat || rate <= 0) return round2(price);
  return round2(price / (1 + rate / 100));
}

export function calcAutoSellingPrice(costExVat) {
  return round2(Number(costExVat) * 1.3);
}

export function calcPurchaseInvoiceTotals(items, purchaseWithVat, vatRate = 0) {
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
    };
  });

  const total = purchaseWithVat ? subtotal : round2(subtotal + vatAmount);
  return { lines, subtotal, vatAmount, total };
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}
