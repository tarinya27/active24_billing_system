import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { parsePagination, listResult } from '../../utils/pagination.js';
import { calcGrnAutoSellingPrice } from '../../utils/pricing.js';
import { nextDnNumber } from '../../utils/documentNumbers.js';
import { normalizeWarrantyMonths } from '../../utils/warranty.js';
import { generateProductCode } from '../products/products.utils.js';
import { createInvoice } from '../invoices/invoices.service.js';

const dnInclude = {
  supplier: { select: { id: true, name: true, code: true, vatRegistrationNo: true } },
  customer: { select: { id: true, name: true, mobile: true, address: true, email: true, type: true } },
  receivedBy: { select: { id: true, name: true } },
  items: {
    include: {
      product: { select: { id: true, code: true, name: true } },
      category: { select: { id: true, name: true } },
      productUnits: {
        select: {
          id: true,
          barcode: true,
          status: true,
          sellingPrice: true,
          costPrice: true,
          warrantyMonths: true,
        },
      },
    },
  },
  units: {
    where: { status: 'PENDING_DN' },
    select: {
      id: true,
      barcode: true,
      productId: true,
      status: true,
      sellingPrice: true,
      costPrice: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  },
  invoices: {
    select: { id: true, invoiceNumber: true, grandTotal: true, createdAt: true, status: true },
    orderBy: { createdAt: 'desc' },
  },
};

function resolveSellingPrice(line) {
  if (line.sellingPriceMode === 'MANUAL') {
    if (line.sellingPrice === undefined || Number.isNaN(Number(line.sellingPrice))) {
      throw ApiError.badRequest('Manual selling price is required');
    }
    return Number(line.sellingPrice);
  }
  return calcGrnAutoSellingPrice(line.purchasePrice);
}

/**
 * Resolve inventory product for a DN line from category + description.
 * Reuses an existing product in that category with the same name, otherwise creates one.
 */
async function resolveDnProduct(tx, { categoryId, description, supplierId, purchasePrice, sellingPrice }) {
  const name = String(description || '').trim();
  if (!name) throw ApiError.badRequest('Description is required');

  const category = await tx.category.findUnique({ where: { id: categoryId }, select: { id: true, name: true, isActive: true } });
  if (!category) throw ApiError.badRequest('Category not found');
  if (category.isActive === false) throw ApiError.badRequest(`Category "${category.name}" is inactive`);

  const existing = await tx.product.findFirst({
    where: {
      categoryId,
      name: { equals: name, mode: 'insensitive' },
      isActive: true,
    },
  });
  if (existing) {
    return tx.product.update({
      where: { id: existing.id },
      data: {
        purchasePrice: Number(purchasePrice) || existing.purchasePrice,
        defaultSellingPrice: Number(sellingPrice) || existing.defaultSellingPrice,
        description: name,
        supplierId: supplierId || existing.supplierId,
      },
    });
  }

  const code = await generateProductCode(tx);
  return tx.product.create({
    data: {
      code,
      name,
      description: name,
      categoryId,
      supplierId,
      company: 'ACTIVE24',
      purchasePrice: Number(purchasePrice) || 0,
      defaultSellingPrice: Number(sellingPrice) || calcGrnAutoSellingPrice(purchasePrice),
      isActive: true,
    },
  });
}

export async function listDeliveryNotes(query) {
  const { skip, take, page, pageSize } = parsePagination(query);
  const where = {};
  if (query.search) {
    where.OR = [
      { dnNumber: { contains: query.search, mode: 'insensitive' } },
      { notes: { contains: query.search, mode: 'insensitive' } },
      { supplier: { name: { contains: query.search, mode: 'insensitive' } } },
    ];
  }
  if (query.status) where.status = query.status;
  if (query.supplierId) where.supplierId = query.supplierId;

  const [items, total] = await Promise.all([
    prisma.deliveryNote.findMany({
      where,
      include: dnInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.deliveryNote.count({ where }),
  ]);

  return listResult(items, total, { page, pageSize });
}

export async function getDeliveryNote(id) {
  const dn = await prisma.deliveryNote.findUnique({ where: { id }, include: dnInclude });
  if (!dn) throw ApiError.notFound('Delivery note not found');
  return dn;
}

export async function createDeliveryNote(data, userId) {
  const supplier = await prisma.supplier.findUnique({ where: { id: data.supplierId } });
  if (!supplier) throw ApiError.badRequest('Supplier not found');

  if (data.customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
    if (!customer) throw ApiError.badRequest('Customer not found');
  }

  for (const line of data.lines) {
    if (!line.categoryId) throw ApiError.badRequest('Select an item (category) for every line');
    if (!String(line.description || '').trim()) {
      throw ApiError.badRequest('Enter a description for every line');
    }
    if (!Array.isArray(line.barcodes) || line.barcodes.length === 0) {
      throw ApiError.badRequest('Scan barcodes for every item before creating the delivery note');
    }
  }

  const categoryIds = [...new Set(data.lines.map((l) => l.categoryId))];
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, isActive: true },
  });
  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c]));
  for (const id of categoryIds) {
    if (!categoryMap[id]) throw ApiError.badRequest(`Category not found: ${id}`);
  }

  const allBarcodes = data.lines.flatMap((line) =>
    line.barcodes.map((b) => String(b).trim()).filter(Boolean)
  );
  if (new Set(allBarcodes).size !== allBarcodes.length) {
    throw ApiError.badRequest('Duplicate barcodes on this delivery note');
  }

  const existingUnits = await prisma.productUnit.findMany({
    where: { barcode: { in: allBarcodes } },
    select: { barcode: true },
  });
  if (existingUnits.length) {
    throw ApiError.conflict(`Barcode already exists: ${existingUnits.map((u) => u.barcode).join(', ')}`);
  }

  const dnNumber = await nextDnNumber();

  // Create DN + items from scanned barcodes, stock in immediately (ready for billing)
  return prisma.$transaction(async (tx) => {
    const dn = await tx.deliveryNote.create({
      data: {
        dnNumber,
        supplierId: data.supplierId,
        customerId: data.customerId || null,
        status: 'DRAFT',
        receivedById: userId,
        invNo: data.invNo?.trim() || null,
        notes: data.notes?.trim() || null,
      },
    });

    for (const line of data.lines) {
      const sellingPrice = resolveSellingPrice(line);
      const purchasePrice = Number(line.purchasePrice);
      const barcodes = line.barcodes.map((b) => String(b).trim());
      const warrantyMonths = normalizeWarrantyMonths(line.warrantyMonths);
      const description = String(line.description).trim();

      const product = await resolveDnProduct(tx, {
        categoryId: line.categoryId,
        description,
        supplierId: data.supplierId,
        purchasePrice,
        sellingPrice,
      });

      const item = await tx.deliveryNoteItem.create({
        data: {
          deliveryNoteId: dn.id,
          productId: product.id,
          categoryId: line.categoryId,
          description,
          purchasePrice,
          costExVat: purchasePrice,
          sellingPrice,
          sellingPriceMode: line.sellingPriceMode || 'AUTO',
          units: barcodes.length,
          warrantyMonths,
        },
      });

      for (const barcode of barcodes) {
        const unit = await tx.productUnit.create({
          data: {
            productId: product.id,
            barcode,
            deliveryNoteId: dn.id,
            deliveryNoteItemId: item.id,
            costPrice: purchasePrice,
            sellingPrice,
            warrantyMonths,
            status: 'IN_STOCK',
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: product.id,
            productUnitId: unit.id,
            type: 'DN_IN',
            quantity: 1,
            reference: dnNumber,
            userId,
          },
        });
      }
    }

    return tx.deliveryNote.update({
      where: { id: dn.id },
      data: {
        status: 'COMPLETED',
        receivedById: userId,
        receivedDate: new Date(),
      },
      include: dnInclude,
    });
  });
}

export async function reserveDnBarcode(data) {
  const trimmedBarcode = String(data.barcode || '').trim();
  if (!trimmedBarcode) throw ApiError.badRequest('Barcode is required');

  const existing = await prisma.productUnit.findUnique({
    where: { barcode: trimmedBarcode },
    select: { id: true },
  });
  if (existing) throw ApiError.conflict('Barcode already exists.');

  const dn = await getDeliveryNote(data.deliveryNoteId);
  if (dn.status !== 'DRAFT') {
    throw ApiError.conflict('Barcodes can only be scanned on draft delivery notes');
  }

  const line = dn.items.find((item) => item.productId === data.productId);
  if (!line) throw ApiError.badRequest('Product is not on this delivery note');

  const pendingCount = dn.units.filter((unit) => unit.productId === data.productId).length;
  if (pendingCount >= line.units) {
    throw ApiError.badRequest('Delivery note quantity exceeded for this product');
  }

  const unit = await prisma.productUnit.create({
    data: {
      productId: data.productId,
      barcode: trimmedBarcode,
      deliveryNoteId: dn.id,
      costPrice: Number(line.costExVat),
      sellingPrice: Number(line.sellingPrice),
      warrantyMonths: line.warrantyMonths,
      status: 'PENDING_DN',
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

export async function removePendingDnUnit(id) {
  const unit = await prisma.productUnit.findUnique({
    where: { id },
    select: { id: true, status: true, deliveryNoteItemId: true },
  });
  if (!unit) throw ApiError.notFound('Pending scanned unit not found');
  if (unit.status !== 'PENDING_DN' || unit.deliveryNoteItemId) {
    throw ApiError.conflict('Only pending delivery-note units can be removed');
  }
  await prisma.productUnit.delete({ where: { id } });
  return { id };
}

export async function completeDeliveryNote(deliveryNoteId, userId) {
  const dn = await getDeliveryNote(deliveryNoteId);
  if (dn.status !== 'DRAFT') {
    throw ApiError.conflict('Only draft delivery notes can be completed');
  }

  for (const item of dn.items) {
    const pending = dn.units.filter((unit) => unit.productId === item.productId);
    if (pending.length !== item.units) {
      throw ApiError.badRequest(
        `Scan all units before confirming DN (${item.product?.code || item.productId}: ${pending.length}/${item.units})`
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    for (const item of dn.items) {
      const pending = dn.units.filter((unit) => unit.productId === item.productId);
      for (const pendingUnit of pending) {
        const unit = await tx.productUnit.update({
          where: { id: pendingUnit.id },
          data: {
            deliveryNoteItemId: item.id,
            costPrice: Number(item.costExVat),
            sellingPrice: Number(item.sellingPrice),
            warrantyMonths: item.warrantyMonths,
            status: 'IN_STOCK',
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            productUnitId: unit.id,
            type: 'DN_IN',
            quantity: 1,
            reference: dn.dnNumber,
            userId,
          },
        });
      }
    }

    return tx.deliveryNote.update({
      where: { id: dn.id },
      data: {
        status: 'COMPLETED',
        receivedById: userId,
        receivedDate: new Date(),
      },
      include: dnInclude,
    });
  });
}

export async function cancelDeliveryNote(id, userId, reason) {
  const dn = await getDeliveryNote(id);
  if (dn.status === 'CANCELLED') throw ApiError.badRequest('Delivery note is already cancelled');
  if (dn.status === 'INVOICED') throw ApiError.conflict('Cannot cancel an invoiced delivery note');

  if (dn.status === 'DRAFT') {
    return prisma.$transaction(async (tx) => {
      await tx.productUnit.deleteMany({
        where: { deliveryNoteId: id, status: 'PENDING_DN' },
      });
      return tx.deliveryNote.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          notes: [dn.notes, reason ? `Cancel: ${reason}` : null].filter(Boolean).join('\n'),
        },
        include: dnInclude,
      });
    });
  }

  const soldUnits = dn.items.flatMap((i) => i.productUnits).filter((u) => u.status === 'SOLD');
  if (soldUnits.length) {
    throw ApiError.conflict('Cannot cancel delivery note: some units have already been sold');
  }

  return prisma.$transaction(async (tx) => {
    for (const item of dn.items) {
      for (const unit of item.productUnits) {
        await tx.productUnit.update({ where: { id: unit.id }, data: { status: 'VOID' } });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            productUnitId: unit.id,
            type: 'ADJUSTMENT',
            quantity: -1,
            reference: `Cancel ${dn.dnNumber}${reason ? `: ${reason}` : ''}`,
            userId,
          },
        });
      }
    }

    return tx.deliveryNote.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        notes: [dn.notes, reason ? `Cancel: ${reason}` : null].filter(Boolean).join('\n'),
      },
      include: dnInclude,
    });
  });
}

/**
 * Create a sales invoice from completed DN stock units.
 * Reuses existing createInvoice by barcode — does not alter POS billing flow.
 */
export async function createInvoiceFromDeliveryNote(id, payload, userId) {
  const dn = await getDeliveryNote(id);
  if (dn.status !== 'COMPLETED' && dn.status !== 'INVOICED') {
    throw ApiError.conflict('Only completed delivery notes can be invoiced');
  }

  const inStockUnits = dn.items.flatMap((item) =>
    (item.productUnits || []).filter((u) => u.status === 'IN_STOCK')
  );
  if (!inStockUnits.length) {
    throw ApiError.badRequest('No in-stock units left on this delivery note to invoice');
  }

  const customerId = payload.customerId || dn.customerId;
  if (!customerId) {
    throw ApiError.badRequest('Customer is required to create an invoice from this delivery note');
  }

  const discountMap = Object.fromEntries(
    (payload.discounts || []).map((d) => [d.barcode, Number(d.discount || 0)])
  );

  const invoice = await createInvoice(
    {
      customerId,
      paymentMethod: payload.paymentMethod || 'CASH',
      deliveryNoteId: dn.id,
      items: inStockUnits.map((unit) => ({
        barcode: unit.barcode,
        discount: discountMap[unit.barcode] || 0,
      })),
    },
    userId
  );

  const remaining = await prisma.productUnit.count({
    where: {
      deliveryNoteItem: { deliveryNoteId: dn.id },
      status: 'IN_STOCK',
    },
  });

  if (remaining === 0) {
    await prisma.deliveryNote.update({
      where: { id: dn.id },
      data: { status: 'INVOICED' },
    });
  }

  return invoice;
}
