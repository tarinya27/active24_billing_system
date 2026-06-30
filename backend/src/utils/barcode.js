// Generates a unique-looking unit barcode for serialized inventory.
export function generateUnitBarcode(prefix = 'A24') {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}${ts}${rand}`.slice(0, 32);
}
