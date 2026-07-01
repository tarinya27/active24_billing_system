import { prisma } from '../../config/prisma.js';

const CODE_PREFIX = 'PRD';

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
