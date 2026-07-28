import { prisma } from '../../config/prisma.js';

const CODE_PREFIX = 'PRD';

export function normalizeCodePrefix(raw) {
  const cleaned = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return cleaned || null;
}

export function formatInventoryCode(prefix, sequence) {
  const n = Math.max(1, Number(sequence) || 1);
  const width = Math.max(2, String(n).length);
  return `${prefix}${String(n).padStart(width, '0')}`;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Highest numeric suffix already used for a given prefix (e.g. PRINT03 → 3). */
export async function maxSequenceForPrefix(prefix, tx = prisma) {
  if (!prefix) return 0;
  const products = await tx.product.findMany({
    where: { code: { startsWith: prefix } },
    select: { code: true },
  });
  const re = new RegExp(`^${escapeRegex(prefix)}(\\d+)$`, 'i');
  let max = 0;
  for (const product of products) {
    const match = product.code.match(re);
    if (match) max = Math.max(max, Number.parseInt(match[1], 10));
  }
  return max;
}

export async function generateProductCode(tx = prisma) {
  const latest = await tx.product.findFirst({
    where: { code: { startsWith: `${CODE_PREFIX}-` } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });

  let next = 1;
  if (latest?.code) {
    const match = latest.code.match(/-(\d+)$/);
    if (match) next = Number.parseInt(match[1], 10) + 1;
  }

  return `${CODE_PREFIX}-${String(next).padStart(5, '0')}`;
}

/**
 * Allocate next inventory code for a category.
 * Uses PREFIX + running number (PRINT01) when codePrefix is set;
 * otherwise falls back to legacy PRD-00001 style codes.
 * Concurrency-safe via atomic sequence update on the category row.
 */
export async function generateInventoryCode(tx, categoryId) {
  if (!categoryId) return generateProductCode(tx);

  const category = await tx.category.findUnique({
    where: { id: categoryId },
    select: { id: true, codePrefix: true },
  });
  if (!category?.codePrefix) {
    return generateProductCode(tx);
  }

  const prefix = category.codePrefix;

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const rows = await tx.$queryRaw`
      UPDATE "categories"
      SET "codeSequence" = "codeSequence" + 1, "updatedAt" = NOW()
      WHERE "id" = ${categoryId}
      RETURNING "codePrefix", "codeSequence"
    `;
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) throw new Error('Category not found while allocating inventory code');

    const code = formatInventoryCode(row.codePrefix, Number(row.codeSequence));
    const clash = await tx.product.findUnique({ where: { code }, select: { id: true } });
    if (!clash) return code;
  }

  throw new Error('Could not allocate a unique inventory code');
}

/**
 * Reassign inventory codes for all products in a category to PREFIX01, PREFIX02, …
 * Ordered by createdAt. Safe under unique code constraint (temp rename first).
 * Returns the highest sequence number assigned.
 */
export async function reassignCategoryProductCodes(tx, categoryId, prefix) {
  if (!categoryId || !prefix) return 0;

  const products = await tx.product.findMany({
    where: { categoryId },
    select: { id: true, code: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  if (!products.length) return 0;

  // Free current codes to avoid unique collisions during rename
  for (const product of products) {
    await tx.product.update({
      where: { id: product.id },
      data: { code: `__TMP_${product.id}` },
    });
  }

  let seq = 0;
  for (const product of products) {
    let code;
    do {
      seq += 1;
      code = formatInventoryCode(prefix, seq);
      // eslint-disable-next-line no-await-in-loop
    } while (await tx.product.findUnique({ where: { code }, select: { id: true } }));

    await tx.product.update({
      where: { id: product.id },
      data: { code },
    });
  }

  return seq;
}

export function mapProductResponse(product, currentStock = 0) {
  const purchasePrice = Number(product.purchasePrice ?? 0);
  const sellingPrice = Number(product.defaultSellingPrice);
  const profit = Math.round((sellingPrice - purchasePrice) * 100) / 100;
  let stockStatus = 'in_stock';
  if (currentStock <= 0) stockStatus = 'out_of_stock';
  else if (currentStock <= (product.reorderLevel ?? 10)) stockStatus = 'low_stock';

  return {
    ...product,
    productCode: product.code,
    productName: product.name,
    sellingPrice,
    purchasePrice,
    vatPercentage: Number(product.vatPercentage ?? 0),
    profit,
    currentStock,
    stockStatus,
    status: product.isActive ? 'Active' : 'Inactive',
  };
}

export const PRODUCT_EXPORT_COLUMNS = [
  { header: 'Product Code', value: (r) => r.code },
  { header: 'Barcode', value: (r) => r.barcode || '' },
  { header: 'Product Name', value: (r) => r.name },
  { header: 'Category', value: (r) => r.category?.name || '' },
  { header: 'Brand', value: (r) => r.brand || '' },
  { header: 'Supplier', value: (r) => r.supplier?.name || '' },
  { header: 'Purchase Price', value: (r) => Number(r.purchasePrice) },
  { header: 'Selling Price', value: (r) => Number(r.defaultSellingPrice ?? r.sellingPrice) },
  { header: 'Profit', value: (r) => Number(r.profit ?? 0) },
  { header: 'VAT %', value: (r) => Number(r.vatPercentage) },
  { header: 'Current Stock', value: (r) => r.currentStock ?? 0 },
  { header: 'Reorder Level', value: (r) => r.reorderLevel },
  { header: 'Status', value: (r) => (r.isActive ? 'Active' : 'Inactive') },
  { header: 'Description', value: (r) => r.description || '' },
];

export const IMPORT_HEADERS = [
  'productCode',
  'barcode',
  'productName',
  'category',
  'brand',
  'supplier',
  'purchasePrice',
  'sellingPrice',
  'vatPercentage',
  'reorderLevel',
  'description',
  'status',
];

export function normalizeImportRow(row) {
  const get = (...keys) => {
    for (const key of keys) {
      if (row[key] != null && String(row[key]).trim() !== '') return String(row[key]).trim();
    }
    return '';
  };

  return {
    code: get('productCode', 'code', 'Product Code'),
    barcode: get('barcode', 'Barcode') || null,
    name: get('productName', 'name', 'Product Name'),
    categoryName: get('category', 'Category'),
    brand: get('brand', 'Brand') || null,
    supplierName: get('supplier', 'Supplier'),
    purchasePrice: get('purchasePrice', 'Purchase Price') || '0',
    defaultSellingPrice: get('sellingPrice', 'Selling Price', 'defaultSellingPrice') || '0',
    vatPercentage: get('vatPercentage', 'VAT %', 'vat') || '0',
    reorderLevel: get('reorderLevel', 'Reorder Level') || '10',
    description: get('description', 'Description') || null,
    isActive: get('status', 'Status').toLowerCase() !== 'inactive',
  };
}
