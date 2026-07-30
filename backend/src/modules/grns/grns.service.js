import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { parsePagination, listResult } from '../../utils/pagination.js';
import { calcCostExVat, calcGrnAutoSellingPrice } from '../../utils/pricing.js';
import { nextGrnNumber } from '../../utils/documentNumbers.js';
import { normalizeWarrantyMonths } from '../../utils/warranty.js';
import { resolvePoVatPercentage, syncProductVatFromPo } from '../../utils/productVat.js';
import { roleHasPermission } from '../../rbac/permissions.js';

const grnInclude = {
  supplier: { select: { id: true, name: true, code: true } },
  po: { select: { id: true, poNumber: true, status: true } },
  purchaseInvoice: { select: { id: true, supplierInvoiceNo: true, total: true, purchaseWithVat: true, poId: true, status: true } },
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

async function getLinkedPurchaseInvoice(purchaseInvoiceId) {
  const pi = await prisma.purchaseInvoice.findUnique({
    where: { id: purchaseInvoiceId },
    include: {
      grn: true,
      po: true,
      items: {
        include: {
          product: {
            select: {
              id: true,
              code: true,
              name: true,
              categoryId: true,
            },
          },
        },
      },
      units: {
        where: { status: 'PENDING_GRN' },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!pi) throw ApiError.badRequest('Linked purchase invoice not found');
  if (!pi.poId) throw ApiError.badRequest('Purchase invoice must be linked to a purchase order');
  if (!pi.po?.poNumber) throw ApiError.badRequest('Purchase invoice must be linked to a purchase order');
  if (!pi.supplierInvoiceNo?.trim()) {
    throw ApiError.badRequest('Purchase invoice number is required before GRN');
  }
  if (pi.grn) throw ApiError.conflict('This purchase invoice already has a GRN');
  return pi;
}

function getInvoiceLineMap(pi) {
  return Object.fromEntries(
    pi.items.map((item) => [
      item.productId,
      {
        ...item,
        unitPrice: Number(item.unitPrice),
      },
    ])
  );
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

export async function reserveGrnBarcode(data) {
  const trimmedBarcode = String(data.barcode || '').trim();
  if (!trimmedBarcode) throw ApiError.badRequest('Barcode is required');

  const existing = await prisma.productUnit.findUnique({
    where: { barcode: trimmedBarcode },
    select: { id: true },
  });
  if (existing) {
    throw ApiError.conflict('Barcode already exists.');
  }

  const pi = await getLinkedPurchaseInvoice(data.purchaseInvoiceId);
  const invoiceLines = getInvoiceLineMap(pi);
  const productId = data.productId || '';
  const invoiceLine = invoiceLines[productId];
  if (!invoiceLine) {
    throw ApiError.badRequest('Product is not on the linked purchase invoice');
  }

  const pendingCount = pi.units.filter((unit) => unit.productId === productId).length;
  if (pendingCount >= invoiceLine.units) {
    throw ApiError.badRequest('Invoice quantity exceeded.');
  }

  const vatRate = await getVatRate(data.vatRate);
  const costExVat = calcCostExVat(data.purchasePrice, data.purchaseWithVat, vatRate);
  const sellingPrice = data.sellingPriceMode === 'MANUAL'
    ? Number(data.sellingPrice)
    : calcGrnAutoSellingPrice(data.purchasePrice);

  if (data.sellingPriceMode === 'MANUAL' && Number.isNaN(sellingPrice)) {
    throw ApiError.badRequest(`Manual selling price required for ${invoiceLine.product.code}`);
  }

  const unit = await prisma.productUnit.create({
    data: {
      productId,
      barcode: trimmedBarcode,
      purchaseInvoiceId: pi.id,
      costPrice: costExVat,
      sellingPrice,
      warrantyMonths: normalizeWarrantyMonths(invoiceLine.warrantyMonths),
      status: 'PENDING_GRN',
    },
    select: {
      id: true,
      barcode: true,
      productId: true,
      status: true,
      costPrice: true,
      sellingPrice: true,
      createdAt: true,
    },
  });

  return unit;
}

export async function removePendingGrnUnit(id) {
  const unit = await prisma.productUnit.findUnique({
    where: { id },
    select: { id: true, status: true, grnItemId: true },
  });
  if (!unit) throw ApiError.notFound('Pending scanned unit not found');
  if (unit.status !== 'PENDING_GRN' || unit.grnItemId) {
    throw ApiError.conflict('Only pending scanned units can be removed');
  }
  await prisma.productUnit.delete({ where: { id } });
  return { id };
}

export async function completeGrn(data, userId) {
  if (!data.purchaseInvoiceId) {
    throw ApiError.badRequest('GRN must be linked to a purchase invoice');
  }
  if (!data.poId) {
    throw ApiError.badRequest('GRN must be linked to a purchase order');
  }

  const vatRate = await getVatRate(data.vatRate);
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: data.poId },
    include: { supplier: { select: { vatRate: true } } },
  });
  if (!po) throw ApiError.badRequest('Linked purchase order not found');

  const poVatPercentage = resolvePoVatPercentage(po.vatRate, po.supplier?.vatRate);
  if (poVatPercentage === null) {
    console.warn(`[VAT] GRN for PO ${po.poNumber}: no resolvable VAT; product VAT unchanged`);
  }

  const pi = await getLinkedPurchaseInvoice(data.purchaseInvoiceId);
  if (pi.poId !== data.poId) {
    throw ApiError.badRequest('GRN purchase order must match the purchase invoice');
  }

  const invoicedByProduct = getInvoiceLineMap(pi);
  const configByProduct = Object.fromEntries(data.lines.map((line) => [line.productId, line]));
  const pendingUnitsByProduct = pi.units.reduce((acc, unit) => {
    acc[unit.productId] ||= [];
    acc[unit.productId].push(unit);
    return acc;
  }, {});

  for (const invoiceItem of pi.items) {
    const config = configByProduct[invoiceItem.productId];
    const pendingUnits = pendingUnitsByProduct[invoiceItem.productId] || [];
    if (!config) {
      throw ApiError.badRequest(`GRN configuration missing for ${invoiceItem.product.code}`);
    }
    if (pendingUnits.length !== invoiceItem.units) {
      throw ApiError.badRequest('Received quantity must match invoice quantity before confirming GRN');
    }
    if (Number(config.purchasePrice) !== Number(invoiceItem.unitPrice)) {
      throw ApiError.badRequest('Purchase price must match purchase invoice unit price');
    }
  }

  const grnNumber = await nextGrnNumber();

  return prisma.$transaction(async (tx) => {
    const grn = await tx.grn.create({
      data: {
        grnNumber,
        poId: data.poId,
        purchaseInvoiceId: data.purchaseInvoiceId,
        supplierId: data.supplierId,
        purchaseWithVat: data.purchaseWithVat,
        status: 'COMPLETED',
        receivedById: userId,
        notes: data.notes || null,
      },
    });

    for (const line of data.lines) {
      const pendingUnits = pendingUnitsByProduct[line.productId] || [];
      const product = await tx.product.findUnique({
        where: { id: line.productId },
        include: { category: true },
      });
      if (!product) throw ApiError.badRequest(`Product not found: ${line.productId}`);

      await syncProductVatFromPo(
        tx,
        line.productId,
        poVatPercentage,
        `GRN ${grnNumber} / PO ${po.poNumber}`
      );

      if (pendingUnits.length === 0) {
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
        sellingPrice = calcGrnAutoSellingPrice(line.purchasePrice);
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
          units: pendingUnits.length,
          warrantyMonths: normalizeWarrantyMonths(
            line.warrantyMonths ?? invoicedByProduct[line.productId]?.warrantyMonths
          ),
        },
      });

      const lineWarrantyMonths = normalizeWarrantyMonths(
        line.warrantyMonths ?? invoicedByProduct[line.productId]?.warrantyMonths
      );

      for (const pendingUnit of pendingUnits) {
        const unit = await tx.productUnit.update({
          where: { id: pendingUnit.id },
          data: {
            grnItemId: grnItem.id,
            costPrice: costExVat,
            sellingPrice,
            warrantyMonths: lineWarrantyMonths,
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

    await updatePoStatusAfterGrn(tx, data.poId);
    await tx.purchaseInvoice.update({
      where: { id: data.purchaseInvoiceId },
      data: { status: 'RECEIVED' },
    });

    return tx.grn.findUnique({ where: { id: grn.id }, include: grnInclude });
  });
}

/**
 * Edit a completed GRN: notes, line descriptions, and selling prices.
 * Selling price changes sync to linked ProductUnits that are still IN_STOCK.
 */
export async function updateGrn(id, data, user) {
  const grn = await getGrn(id);
  if (grn.status === 'CANCELLED') {
    throw ApiError.badRequest('Cancelled GRNs cannot be edited');
  }
  if (grn.status !== 'COMPLETED' && grn.status !== 'DRAFT') {
    throw ApiError.badRequest('Only completed or draft GRNs can be edited');
  }

  const canEditDescription = roleHasPermission(user.role, 'grn.edit_description');
  const canSetPrice = roleHasPermission(user.role, 'grn.set_price');
  if (!canEditDescription && !canSetPrice) {
    throw ApiError.forbidden('You do not have permission to edit this GRN');
  }

  const itemsById = Object.fromEntries(grn.items.map((item) => [item.id, item]));
  const lineUpdates = Array.isArray(data.items) ? data.items : [];

  for (const line of lineUpdates) {
    if (!itemsById[line.id]) {
      throw ApiError.badRequest(`GRN line not found: ${line.id}`);
    }
  }

  return prisma.$transaction(async (tx) => {
    if (data.notes !== undefined && canEditDescription) {
      await tx.grn.update({
        where: { id },
        data: { notes: data.notes?.trim() ? data.notes.trim() : null },
      });
    }

    for (const line of lineUpdates) {
      const existing = itemsById[line.id];
      const patch = {};

      if (line.description !== undefined && canEditDescription) {
        const desc = String(line.description || '').trim();
        patch.description = desc || null;
      }

      if (canSetPrice && (line.sellingPriceMode !== undefined || line.sellingPrice !== undefined)) {
        const mode = line.sellingPriceMode || existing.sellingPriceMode || 'AUTO';
        const sellingPrice = mode === 'MANUAL'
          ? Number(line.sellingPrice ?? existing.sellingPrice)
          : calcGrnAutoSellingPrice(existing.purchasePrice);

        if (Number.isNaN(sellingPrice) || sellingPrice < 0) {
          throw ApiError.badRequest(`Invalid selling price for ${existing.product?.code || existing.id}`);
        }

        patch.sellingPriceMode = mode;
        patch.sellingPrice = sellingPrice;
      }

      if (!Object.keys(patch).length) continue;

      await tx.grnItem.update({ where: { id: line.id }, data: patch });

      if (patch.sellingPrice !== undefined) {
        await tx.productUnit.updateMany({
          where: {
            grnItemId: line.id,
            status: 'IN_STOCK',
          },
          data: { sellingPrice: patch.sellingPrice },
        });
      }
    }

    return tx.grn.findUnique({ where: { id }, include: grnInclude });
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

    if (grn.purchaseInvoiceId) {
      await tx.purchaseInvoice.update({
        where: { id: grn.purchaseInvoiceId },
        data: { status: 'PENDING' },
      });
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
