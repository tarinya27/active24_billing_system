/**
 * Resolve the VAT % to apply to inventory products from a purchase order.
 * PO vatRate takes precedence; supplier vatRate is the fallback.
 */
export function resolvePoVatPercentage(vatRate, supplierVatRate) {
  if (vatRate !== undefined && vatRate !== null && vatRate !== '') {
    const fromPo = Number(vatRate);
    if (Number.isFinite(fromPo)) return fromPo;
  }

  if (supplierVatRate !== undefined && supplierVatRate !== null && supplierVatRate !== '') {
    const fromSupplier = Number(supplierVatRate);
    if (Number.isFinite(fromSupplier)) return fromSupplier;
  }

  return null;
}

export function vatForNewProduct(resolvedVat, context = 'product create') {
  if (resolvedVat === null) {
    console.warn(`[VAT] ${context}: no VAT resolved from PO or supplier; storing 0%`);
    return 0;
  }
  return resolvedVat;
}

export async function syncProductVatFromPo(prismaClient, productId, resolvedVat, context = 'PO sync') {
  if (resolvedVat === null) {
    console.warn(`[VAT] ${context}: product ${productId} — VAT missing on PO; keeping existing product VAT`);
    return;
  }

  await prismaClient.product.update({
    where: { id: productId },
    data: { vatPercentage: resolvedVat },
  });
}
