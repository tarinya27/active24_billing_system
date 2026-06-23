export const VAT_RATE = 0;

export function calculateLineTotal(unitPrice, quantity) {
  return unitPrice * quantity;
}

export function calculateLineFinal(lineTotal, discount = 0) {
  return Math.max(0, lineTotal - discount);
}

export function calculateInvoiceTotals(items) {
  const subtotal = items.reduce((sum, item) => {
    return sum + calculateLineTotal(item.unitPrice, item.quantity);
  }, 0);

  const totalDiscount = items.reduce((sum, item) => {
    return sum + (item.discount || 0);
  }, 0);

  const afterDiscount = subtotal - totalDiscount;
  const vatAmount = afterDiscount * VAT_RATE;
  const grandTotal = afterDiscount + vatAmount;

  return {
    subtotal,
    totalDiscount,
    vatRate: VAT_RATE,
    vatAmount,
    grandTotal,
  };
}
