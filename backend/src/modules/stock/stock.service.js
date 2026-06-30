import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { parsePagination, listResult } from '../../utils/pagination.js';

const unitInclude = {
  product: {
    select: {
      id: true,
      code: true,
      name: true,
      company: true,
      reorderLevel: true,
      category: { select: { id: true, name: true } },
    },
  },
};

export async function listStockSummary(query) {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      category: { select: { name: true } },
      _count: { select: { units: { where: { status: 'IN_STOCK' } } } },
    },
    orderBy: { name: 'asc' },
  });

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const threshold = Number(query.lowStockThreshold ?? settings?.lowStockThreshold ?? 10);

  let items = products.map((p) => {
    const quantity = p._count.units;
    let status = 'In Stock';
    if (quantity <= 0) status = 'Out of Stock';
    else if (quantity <= (p.reorderLevel || threshold)) status = 'Low Stock';
    return {
      productId: p.id,
      code: p.code,
      name: p.name,
      category: p.category?.name || '—',
      company: p.company,
      quantity,
      reorderLevel: p.reorderLevel,
      status,
    };
  });

  if (query.search) {
    const q = query.search.toLowerCase();
    items = items.filter(
      (i) => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)
    );
  }
  if (query.status && query.status !== 'All') {
    items = items.filter((i) => i.status === query.status);
  }
  if (query.company && query.company !== 'All') {
    items = items.filter((i) => i.company === query.company);
  }

  return items;
}

export async function listUnits(query) {
  const { skip, take, page, pageSize } = parsePagination(query);
  const where = {};

  if (query.status) where.status = query.status;
  if (query.productId) where.productId = query.productId;
  if (query.search) {
    where.OR = [
      { barcode: { contains: query.search, mode: 'insensitive' } },
      { product: { name: { contains: query.search, mode: 'insensitive' } } },
      { product: { code: { contains: query.search, mode: 'insensitive' } } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.productUnit.findMany({
      where,
      include: unitInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.productUnit.count({ where }),
  ]);

  return listResult(items, total, { page, pageSize });
}

export async function lookupUnitByBarcode(barcode) {
  const unit = await prisma.productUnit.findUnique({
    where: { barcode },
    include: unitInclude,
  });
  if (!unit) throw ApiError.notFound('Unit not found for this barcode');
  if (unit.status !== 'IN_STOCK') {
    throw ApiError.conflict(`Unit is not available for sale (status: ${unit.status})`);
  }
  return unit;
}

export async function listMovements(query) {
  const { skip, take, page, pageSize } = parsePagination(query);
  const where = {};
  if (query.productId) where.productId = query.productId;
  if (query.type) where.type = query.type;

  const [items, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { code: true, name: true } },
        productUnit: { select: { barcode: true } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return listResult(items, total, { page, pageSize });
}

export async function adjustUnit(productUnitId, userId, reason) {
  const unit = await prisma.productUnit.findUnique({ where: { id: productUnitId } });
  if (!unit) throw ApiError.notFound('Unit not found');
  if (unit.status !== 'IN_STOCK') {
    throw ApiError.conflict('Only IN_STOCK units can be adjusted');
  }

  return prisma.$transaction(async (tx) => {
    await tx.productUnit.update({ where: { id: productUnitId }, data: { status: 'VOID' } });
    await tx.stockMovement.create({
      data: {
        productId: unit.productId,
        productUnitId: unit.id,
        type: 'ADJUSTMENT',
        quantity: -1,
        reference: reason || 'Manual adjustment',
        userId,
      },
    });
    return tx.productUnit.findUnique({ where: { id: productUnitId }, include: unitInclude });
  });
}
