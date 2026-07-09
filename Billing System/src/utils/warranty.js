export function formatWarrantyLabel(months) {
  const value = Number(months);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value === 1 ? '1 Month' : `${value} Months`;
}
