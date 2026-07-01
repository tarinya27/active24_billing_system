import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

/** Stock is derived from serialized units — never stored on the product row. */
export async function getProductStockCount(productId, tx = prisma) {
  return tx.productUnit.count({
    where: { productId, status: 'IN_STOCK' },
  });
}

export async function getProductStockMap(productIds, tx = prisma) {
  if (!productIds.length) return new Map();
  const counts = await tx.productUnit.groupBy({
    by: ['productId'],
    where: { productId: { in: productIds }, status: 'IN_STOCK' },
    _count: { _all: true },
  });
  return new Map(counts.map((c) => [c.productId, c._count._all]));
}

export function computeProfit(purchasePrice, sellingPrice) {
  return Math.round((Number(sellingPrice) - Number(purchasePrice)) * 100) / 100;
}

export function computeStockStatus(currentStock, reorderLevel) {
  if (currentStock <= 0) return 'out_of_stock';
  if (currentStock <= reorderLevel) return 'low_stock';
  return 'in_stock';
}

export async function assertActiveCategory(categoryId, tx = prisma) {
  if (!categoryId) throw ApiError.badRequest('Category is required');
  const category = await tx.category.findUnique({ where: { id: categoryId } });
  if (!category) throw ApiError.badRequest('Category not found');
  if (!category.isActive) throw ApiError.badRequest('Cannot use an inactive category');
  return category;
}

export async function assertActiveSupplier(supplierId, tx = prisma) {
  if (!supplierId) throw ApiError.badRequest('Supplier is required');
  const supplier = await tx.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) throw ApiError.badRequest('Supplier not found');
  if (!supplier.isActive) throw ApiError.badRequest('Cannot use an inactive supplier');
  return supplier;
}

/** Strip fields that must never be written from the API. */
export function stripReadOnlyProductFields(data) {
  const out = { ...data };
  delete out.currentStock;
  delete out.profit;
  delete out.productCode;
  delete out.productName;
  delete out.sellingPrice;
  delete out.status;
  return out;
}
