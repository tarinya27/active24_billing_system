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

const poItemsSelect = {
  productId: true,
  description: true,
  product: { select: { category: { select: { id: true, name: true } } } },
};

const unitLookupInclude = {
  product: {
    select: {
      id: true,
      code: true,
      name: true,
      company: true,
      category: { select: { id: true, name: true } },
      supplier: { select: { vatRegistrationNo: true } },
    },
  },
  grnItem: {
    select: {
      description: true,
      purchasePrice: true,
      sellingPrice: true,
      warrantyMonths: true,
      category: { select: { id: true, name: true } },
      grn: {
        select: {
          grnNumber: true,
          po: { select: { poNumber: true, items: { select: poItemsSelect } } },
          supplier: { select: { vatRegistrationNo: true } },
          purchaseInvoice: {
            select: {
              id: true,
              supplierInvoiceNo: true,
              po: { select: { poNumber: true, items: { select: poItemsSelect } } },
            },
          },
        },
      },
    },
  },
  purchaseInvoice: {
    select: {
      id: true,
      supplierInvoiceNo: true,
      po: { select: { poNumber: true, items: { select: poItemsSelect } } },
      supplier: { select: { vatRegistrationNo: true } },
    },
  },
  deliveryNote: {
    select: {
      dnNumber: true,
      supplier: { select: { vatRegistrationNo: true } },
    },
  },
  deliveryNoteItem: {
    select: {
      description: true,
      purchasePrice: true,
      sellingPrice: true,
      warrantyMonths: true,
      category: { select: { id: true, name: true } },
    },
  },
};

function resolveStockSource(unit) {
  if (unit.deliveryNoteId || unit.deliveryNoteItemId) return 'DN';
  return 'GRN';
}

function poLineForUnit(unit) {
  const grn = unit.grnItem?.grn;
  const pi = unit.purchaseInvoice || grn?.purchaseInvoice;
  const po = grn?.po || pi?.po;
  if (!po?.items?.length) return null;
  return po.items.find((line) => line.productId === unit.productId) || null;
}

function mapUnitForSale(unit) {
  const stockSource = resolveStockSource(unit);

  if (stockSource === 'DN') {
    const dnItem = unit.deliveryNoteItem;
    const warrantyMonths = unit.warrantyMonths ?? dnItem?.warrantyMonths ?? null;
    const supplierTin = unit.deliveryNote?.supplier?.vatRegistrationNo || null;
    return {
      ...unit,
      saleDetails: {
        stockSource: 'DN',
        category: dnItem?.category?.name || unit.product?.category?.name || null,
        description: dnItem?.description?.trim() || unit.product?.name || null,
        purchasePrice: Number(dnItem?.purchasePrice ?? unit.costPrice ?? 0),
        sellingPrice: Number(unit.sellingPrice ?? dnItem?.sellingPrice ?? 0),
        grnNumber: null,
        poNumber: null,
        purchaseInvoiceNo: null,
        warrantyMonths,
        supplierTin: supplierTin ? String(supplierTin).trim() : null,
      },
    };
  }

  const grn = unit.grnItem?.grn;
  const pi = unit.purchaseInvoice || grn?.purchaseInvoice;
  const poLine = poLineForUnit(unit);
  const warrantyMonths = unit.warrantyMonths ?? unit.grnItem?.warrantyMonths ?? null;
  const supplierTin = (
    grn?.supplier?.vatRegistrationNo
    || pi?.supplier?.vatRegistrationNo
    || unit.product?.supplier?.vatRegistrationNo
    || null
  );
  return {
    ...unit,
    saleDetails: {
      stockSource: 'GRN',
      category: poLine?.product?.category?.name
        || unit.grnItem?.category?.name
        || unit.product?.category?.name
        || null,
      description: poLine?.description?.trim()
        || unit.grnItem?.description
        || unit.product?.name
        || null,
      purchasePrice: Number(unit.grnItem?.purchasePrice ?? unit.costPrice ?? 0),
      sellingPrice: Number(unit.sellingPrice ?? unit.grnItem?.sellingPrice ?? 0),
      grnNumber: grn?.grnNumber || null,
      poNumber: grn?.po?.poNumber || pi?.po?.poNumber || null,
      purchaseInvoiceNo: pi?.supplierInvoiceNo || null,
      warrantyMonths,
      supplierTin: supplierTin ? String(supplierTin).trim() : null,
    },
  };
}

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

export async function lookupUnitByBarcode(barcode, { forInvoiceId } = {}) {
  const unit = await prisma.productUnit.findUnique({
    where: { barcode },
    include: {
      ...unitLookupInclude,
      invoiceItem: { select: { invoiceId: true } },
    },
  });
  if (!unit) throw ApiError.notFound('Unit not found for this barcode');

  const linkedToEditingInvoice = Boolean(
    forInvoiceId && unit.invoiceItem?.invoiceId === forInvoiceId
  );
  if (unit.status !== 'IN_STOCK' && !linkedToEditingInvoice) {
    throw ApiError.conflict(`Unit is not available for sale (status: ${unit.status})`);
  }
  return mapUnitForSale(unit);
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
