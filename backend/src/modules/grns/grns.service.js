import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { parsePagination, listResult } from '../../utils/pagination.js';
import { calcAutoSellingPrice, calcCostExVat } from '../../utils/pricing.js';
import { nextGrnNumber } from '../../utils/documentNumbers.js';

const grnInclude = {
  supplier: { select: { id: true, name: true, code: true } },
  po: { select: { id: true, poNumber: true, status: true } },
  purchaseInvoice: { select: { id: true, supplierInvoiceNo: true, total: true, purchaseWithVat: true } },
  receivedBy: { select: { id: true, name: true } },
  items: {
    include: {
      product: { select: { id: true, code: true, name: true } },
      category: { select: { id: true, name: true } },
      productUnits: { select: { id: true, barcode: true, status: true, sellingPrice: true, costPrice: true } },
    },
  },
};

async function getVatRate(override) {
  if (override !== undefined) return Number(override);
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  return Number(settings?.vatRate || 0);
}

async function assertUniqueBarcodes(barcodes) {
  const dupInPayload = barcodes.filter((b, i) => barcodes.indexOf(b) !== i);
  if (dupInPayload.length) {
    throw ApiError.badRequest(`Duplicate barcodes in request: ${[...new Set(dupInPayload)].join(', ')}`);
  }
  const existing = await prisma.productUnit.findMany({
    where: { barcode: { in: barcodes } },
    select: { barcode: true },
  });
  if (existing.length) {
    throw ApiError.conflict(`Barcodes already exist: ${existing.map((e) => e.barcode).join(', ')}`);
  }
}

async function updatePoStatusAfterGrn(tx, poId) {
  const po = await tx.purchaseOrder.findUnique({
    where: { id: poId },
    include: { items: true },
  });
  if (!po) return;

  const received = await tx.grnItem.groupBy({
    by: ['productId'],
    where: { grn: { poId, status: 'COMPLETED' } },
    _sum: { units: true },
  });
  const receivedMap = Object.fromEntries(received.map((r) => [r.productId, r._sum.units || 0]));

  const fullyReceived = po.items.every((item) => (receivedMap[item.productId] || 0) >= item.quantity);
  const anyReceived = po.items.some((item) => (receivedMap[item.productId] || 0) > 0);

  let status = po.status;
  if (fullyReceived) status = 'RECEIVED';
  else if (anyReceived && po.status === 'PENDING') status = 'APPROVED';

  if (status !== po.status) {
    await tx.purchaseOrder.update({ where: { id: poId }, data: { status } });
  }
}

export async function listGrns(query) {
  const { skip, take, page, pageSize } = parsePagination(query);
  const where = {};
  if (query.search) {
    where.OR = [
      { grnNumber: { contains: query.search, mode: 'insensitive' } },
      { notes: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.status) where.status = query.status;
  if (query.supplierId) where.supplierId = query.supplierId;

  const [items, total] = await Promise.all([
    prisma.grn.findMany({ where, include: grnInclude, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.grn.count({ where }),
  ]);

  return listResult(items, total, { page, pageSize });
}

export async function getGrn(id) {
  const grn = await prisma.grn.findUnique({ where: { id }, include: grnInclude });
  if (!grn) throw ApiError.notFound('GRN not found');
  return grn;
}

export async function completeGrn(data, userId) {
  const vatRate = await getVatRate(data.vatRate);
  const allBarcodes = data.lines.flatMap((l) => l.barcodes);
  await assertUniqueBarcodes(allBarcodes);

  if (data.poId) {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: data.poId } });
    if (!po) throw ApiError.badRequest('Linked PO not found');
  }
  if (data.purchaseInvoiceId) {
    const pi = await prisma.purchaseInvoice.findUnique({
      where: { id: data.purchaseInvoiceId },
      include: { grn: true },
    });
    if (!pi) throw ApiError.badRequest('Linked purchase invoice not found');
    if (pi.grn) throw ApiError.conflict('This purchase invoice already has a GRN');
  }

  const grnNumber = await nextGrnNumber();

  return prisma.$transaction(async (tx) => {
    const grn = await tx.grn.create({
      data: {
        grnNumber,
        poId: data.poId || null,
        purchaseInvoiceId: data.purchaseInvoiceId || null,
        supplierId: data.supplierId,
        purchaseWithVat: data.purchaseWithVat,
        status: 'COMPLETED',
        receivedById: userId,
        notes: data.notes || null,
      },
    });

    for (const line of data.lines) {
      const product = await tx.product.findUnique({
        where: { id: line.productId },
        include: { category: true },
      });
      if (!product) throw ApiError.badRequest(`Product not found: ${line.productId}`);

      if (line.barcodes.length === 0) {
        throw ApiError.badRequest(`At least one barcode required for ${product.code}`);
      }

      const costExVat = calcCostExVat(line.purchasePrice, data.purchaseWithVat, vatRate);
      let sellingPrice;
      if (line.sellingPriceMode === 'MANUAL') {
        if (line.sellingPrice === undefined) {
          throw ApiError.badRequest(`Manual selling price required for ${product.code}`);
        }
        sellingPrice = line.sellingPrice;
      } else {
        sellingPrice = calcAutoSellingPrice(costExVat);
      }

      const grnItem = await tx.grnItem.create({
        data: {
          grnId: grn.id,
          productId: line.productId,
          categoryId: line.categoryId || product.categoryId,
          description: line.description || product.description,
          purchasePrice: line.purchasePrice,
          costExVat,
          sellingPrice,
          sellingPriceMode: line.sellingPriceMode,
          units: line.barcodes.length,
        },
      });

      for (const barcode of line.barcodes) {
        const unit = await tx.productUnit.create({
          data: {
            productId: line.productId,
            barcode,
            grnItemId: grnItem.id,
            purchaseInvoiceId: data.purchaseInvoiceId || null,
            costPrice: costExVat,
            sellingPrice,
            status: 'IN_STOCK',
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: line.productId,
            productUnitId: unit.id,
            type: 'GRN_IN',
            quantity: 1,
            reference: grnNumber,
            userId,
          },
        });
      }
    }

    if (data.poId) await updatePoStatusAfterGrn(tx, data.poId);

    return tx.grn.findUnique({ where: { id: grn.id }, include: grnInclude });
  });
}

export async function cancelGrn(id, userId, reason) {
  const grn = await getGrn(id);
  if (grn.status === 'CANCELLED') throw ApiError.badRequest('GRN is already cancelled');
  if (grn.status !== 'COMPLETED') throw ApiError.badRequest('Only completed GRNs can be cancelled');

  const soldUnits = grn.items.flatMap((i) => i.productUnits).filter((u) => u.status === 'SOLD');
  if (soldUnits.length) throw ApiError.conflict('Cannot cancel GRN: some units have already been sold');

  return prisma.$transaction(async (tx) => {
    for (const item of grn.items) {
      for (const unit of item.productUnits) {
        await tx.productUnit.update({ where: { id: unit.id }, data: { status: 'VOID' } });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            productUnitId: unit.id,
            type: 'ADJUSTMENT',
            quantity: -1,
            reference: `${grn.grnNumber} CANCEL`,
            userId,
          },
        });
      }
    }

    return tx.grn.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        notes: reason ? `${grn.notes || ''}\nCancelled: ${reason}`.trim() : grn.notes,
      },
      include: grnInclude,
    });
  });
}
