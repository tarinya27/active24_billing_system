export function normalizeWarrantyMonths(value) {
  if (value === null || value === undefined || value === '') return null;
  const months = Number.parseInt(String(value), 10);
  if (!Number.isFinite(months) || months <= 0) return null;
  return months;
}

export function formatWarrantyLabel(months) {
  const normalized = normalizeWarrantyMonths(months);
  if (!normalized) return null;
  return normalized === 1 ? '1 Month' : `${normalized} Months`;
}
