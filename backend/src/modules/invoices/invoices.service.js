import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { parsePagination, listResult } from '../../utils/pagination.js';
import { nextInvoiceNumber } from '../../utils/documentNumbers.js';
import { CREDIT_TERM_DAYS } from '../../utils/enums.js';
import { normalizeWarrantyMonths } from '../../utils/warranty.js';
import { resolvePoNumberFromUnits, resolveSupplierTinFromUnits, resolveCategoryNameFromUnit, resolveItemDescriptionFromUnit } from '../../utils/invoicePrintMeta.js';

const invoiceInclude = {
  customer: true,
  cashier: { select: { id: true, name: true } },
  items: {
    orderBy: { id: 'asc' },
    include: {
      product: { select: { id: true, code: true, name: true } },
      productUnit: { select: { id: true, barcode: true } },
    },
  },
  payments: {
    include: { receivedBy: { select: { name: true } } },
    orderBy: { paidAt: 'asc' },
  },
};

function serializeInvoice(inv) {
  return {
    ...inv,
    subtotal: Number(inv.subtotal),
    totalDiscount: Number(inv.totalDiscount),
    vatAmount: Number(inv.vatAmount),
    grandTotal: Number(inv.grandTotal),
    items: inv.items.map((item) => ({
      ...item,
      itemType: item.itemType || 'PRODUCT',
      description: item.description || null,
      quantity: Number(item.quantity ?? 1),
      unitPrice: Number(item.unitPrice),
      discount: Number(item.discount),
      warrantyMonths: item.warrantyMonths ?? null,
    })),
    payments: inv.payments?.map((p) => ({ ...p, amount: Number(p.amount) })) || [],
  };
}

const invoicePrintUnitInclude = {
  product: {
    select: {
      name: true,
      supplier: { select: { vatRegistrationNo: true } },
      category: { select: { name: true } },
    },
  },
  grnItem: {
    select: {
      description: true,
      category: { select: { name: true } },
      grn: {
        select: {
          po: {
            select: {
              poNumber: true,
              items: {
                select: {
                  productId: true,
                  description: true,
                  product: { select: { category: { select: { name: true } } } },
                },
              },
            },
          },
          supplier: { select: { vatRegistrationNo: true } },
          purchaseInvoice: {
            select: {
              po: {
                select: {
                  poNumber: true,
                  items: {
                    select: {
                      productId: true,
                      description: true,
                      product: { select: { category: { select: { name: true } } } },
                    },
                  },
                },
              },
              supplier: { select: { vatRegistrationNo: true } },
            },
          },
        },
      },
    },
  },
  purchaseInvoice: {
    select: {
      po: {
        select: {
          poNumber: true,
          items: {
            select: {
              productId: true,
              description: true,
              product: { select: { category: { select: { name: true } } } },
            },
          },
        },
      },
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
      category: { select: { name: true } },
      warrantyMonths: true,
    },
  },
};

async function enrichInvoicePrintMeta(invoice) {
  const unitIds = invoice.items
    .filter((item) => item.itemType !== 'SERVICE' && item.productUnitId)
    .map((item) => item.productUnitId)
    .filter(Boolean);
  if (!unitIds.length) {
    return {
      ...invoice,
      poNumber: null,
      supplierTin: null,
      items: invoice.items.map((item) => {
        if (item.itemType === 'SERVICE') {
          return {
            ...item,
            categoryName: 'Service',
            itemDescription: item.description || 'Service',
          };
        }
        return {
          ...item,
          categoryName: null,
          itemDescription: item.description?.trim() || item.product?.name || null,
        };
      }),
    };
  }

  const units = await prisma.productUnit.findMany({
    where: { id: { in: unitIds } },
    include: invoicePrintUnitInclude,
  });
  const unitById = Object.fromEntries(units.map((u) => [u.id, u]));

  return {
    ...invoice,
    poNumber: resolvePoNumberFromUnits(units),
    supplierTin: resolveSupplierTinFromUnits(units),
    items: invoice.items.map((item) => {
      if (item.itemType === 'SERVICE') {
        return {
          ...item,
          categoryName: 'Service',
          itemDescription: item.description || 'Service',
        };
      }
      const unit = unitById[item.productUnitId];
      const fallbackName = item.product?.name || unit?.product?.name;
      return {
        ...item,
        categoryName: unit ? resolveCategoryNameFromUnit(unit) : null,
        itemDescription: unit
          ? resolveItemDescriptionFromUnit(unit, fallbackName)
          : (item.description?.trim() || fallbackName || null),
      };
    }),
  };
}

export async function listInvoices(query, user) {
  const { skip, take, page, pageSize } = parsePagination(query);
  const where = {};

  const canViewAll = user.role === 'MANAGER' || user.role === 'ADMIN';
  if (!canViewAll) {
    where.cashierId = user.id;
  }

  if (query.search) {
    where.OR = [
      { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
      { customer: { name: { contains: query.search, mode: 'insensitive' } } },
    ];
  }
  if (query.paymentMethod) where.paymentMethod = query.paymentMethod;
  if (query.status) where.status = query.status;

  const [items, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, mobile: true } },
        cashier: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.invoice.count({ where }),
  ]);

  return listResult(items, total, { page, pageSize });
}

export async function getInvoice(id, user) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: invoiceInclude,
  });
  if (!invoice) throw ApiError.notFound('Invoice not found');

  const canViewAll = user.role === 'MANAGER' || user.role === 'ADMIN';
  if (!canViewAll && invoice.cashierId !== user.id) {
    throw ApiError.forbidden('You can only view your own invoices');
  }

  return enrichInvoicePrintMeta(serializeInvoice(invoice));
}

export async function createInvoice(payload, userId) {
  const productItems = Array.isArray(payload.items) ? payload.items : [];
  const serviceItems = Array.isArray(payload.services) ? payload.services : [];

  if (productItems.length + serviceItems.length < 1) {
    throw ApiError.badRequest('Add at least one product or service line');
  }

  const barcodes = productItems.map((i) => i.barcode);
  const dupBarcodes = barcodes.filter((b, i) => barcodes.indexOf(b) !== i);
  if (dupBarcodes.length) {
    throw ApiError.badRequest(`Duplicate barcodes in cart: ${[...new Set(dupBarcodes)].join(', ')}`);
  }

  for (const service of serviceItems) {
    const description = String(service.description || '').trim();
    const unitPrice = Number(service.unitPrice);
    if (!description) throw ApiError.badRequest('Service description is required');
    if (!(unitPrice > 0)) throw ApiError.badRequest('Service amount must be greater than 0');
  }

  const customer = await prisma.customer.findUnique({ where: { id: payload.customerId } });
  if (!customer) throw ApiError.notFound('Customer not found');

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const vatRate = settings?.vatEnabled ? Number(settings.vatRate || 0) / 100 : 0;

  const invoice = await prisma.$transaction(async (tx) => {
    let productLines = [];

    if (barcodes.length) {
      const units = await tx.productUnit.findMany({
        where: { barcode: { in: barcodes } },
        include: {
          product: { select: { id: true, code: true, name: true } },
          grnItem: { select: { warrantyMonths: true } },
          deliveryNoteItem: { select: { warrantyMonths: true } },
        },
      });

      if (units.length !== barcodes.length) {
        const found = new Set(units.map((u) => u.barcode));
        const missing = barcodes.filter((b) => !found.has(b));
        throw ApiError.notFound(`Units not found: ${missing.join(', ')}`);
      }

      const unavailable = units.filter((u) => u.status !== 'IN_STOCK');
      if (unavailable.length) {
        throw ApiError.conflict(
          `Cannot sell — units not in stock: ${unavailable.map((u) => `${u.barcode} (${u.status})`).join(', ')}`
        );
      }

      const unitByBarcode = Object.fromEntries(units.map((u) => [u.barcode, u]));
      productLines = productItems.map((item) => {
        const unit = unitByBarcode[item.barcode];
        const warrantyMonths = normalizeWarrantyMonths(
          unit.warrantyMonths ?? unit.grnItem?.warrantyMonths ?? unit.deliveryNoteItem?.warrantyMonths
        );
        return {
          itemType: 'PRODUCT',
          unit,
          discount: Number(item.discount || 0),
          unitPrice: Number(unit.sellingPrice),
          quantity: 1,
          warrantyMonths,
          description: null,
        };
      });
    }

    const serviceLines = serviceItems.map((service) => ({
      itemType: 'SERVICE',
      unit: null,
      description: String(service.description).trim(),
      unitPrice: Number(service.unitPrice),
      discount: Number(service.discount || 0),
      quantity: 1,
      warrantyMonths: null,
    }));

    const lineItems = [...productLines, ...serviceLines];
    const subtotal = lineItems.reduce((s, l) => s + (l.unitPrice * l.quantity), 0);
    const totalDiscount = lineItems.reduce((s, l) => s + l.discount, 0);
    const afterDiscount = subtotal - totalDiscount;
    const vatAmount = afterDiscount * vatRate;
    const grandTotal = afterDiscount + vatAmount;

    const invoiceNumber = await nextInvoiceNumber(settings?.invoicePrefix || 'INV-2026-');
    const isCredit = payload.paymentMethod === 'CREDIT';
    const dueDate = isCredit
      ? new Date(Date.now() + CREDIT_TERM_DAYS * 24 * 60 * 60 * 1000)
      : null;

    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        customerId: payload.customerId,
        cashierId: userId,
        deliveryNoteId: payload.deliveryNoteId || null,
        paymentMethod: payload.paymentMethod,
        status: 'COMPLETED',
        creditStatus: isCredit ? 'OUTSTANDING' : null,
        dueDate,
        subtotal,
        totalDiscount,
        vatAmount,
        grandTotal,
        items: {
          create: lineItems.map((l) => (
            l.itemType === 'SERVICE'
              ? {
                  itemType: 'SERVICE',
                  description: l.description,
                  quantity: l.quantity,
                  productUnitId: null,
                  productId: null,
                  unitPrice: l.unitPrice,
                  discount: l.discount,
                  warrantyMonths: null,
                }
              : {
                  itemType: 'PRODUCT',
                  description: null,
                  quantity: 1,
                  productUnitId: l.unit.id,
                  productId: l.unit.productId,
                  unitPrice: l.unitPrice,
                  discount: l.discount,
                  warrantyMonths: l.warrantyMonths,
                }
          )),
        },
        payments: isCredit
          ? undefined
          : {
              create: {
                amount: grandTotal,
                method: payload.paymentMethod,
                receivedById: userId,
              },
            },
      },
      include: invoiceInclude,
    });

    // Stock OUT only for product units — services never touch inventory
    for (const line of productLines) {
      await tx.productUnit.update({
        where: { id: line.unit.id },
        data: { status: 'SOLD' },
      });
      await tx.stockMovement.create({
        data: {
          productId: line.unit.productId,
          productUnitId: line.unit.id,
          type: 'SALE_OUT',
          quantity: -1,
          reference: invoiceNumber,
          userId,
        },
      });
    }

    await tx.activity.create({
      data: {
        type: 'invoice',
        title: `Invoice ${invoiceNumber}`,
        description: `${lineItems.length} line(s) — ${customer.name}`,
        amount: grandTotal,
        userId,
      },
    });

    return invoice;
  });

  return enrichInvoicePrintMeta(serializeInvoice(invoice));
}

export async function updateInvoice(id, payload, user) {
  const existing = await prisma.invoice.findUnique({
    where: { id },
    include: { payments: true },
  });
  if (!existing) throw ApiError.notFound('Invoice not found');
  if (existing.status === 'CANCELLED') {
    throw ApiError.conflict('Cancelled invoices cannot be edited');
  }

  const canViewAll = user.role === 'MANAGER' || user.role === 'ADMIN';
  if (!canViewAll && existing.cashierId !== user.id) {
    throw ApiError.forbidden('You can only edit your own invoices');
  }

  const customer = await prisma.customer.findUnique({ where: { id: payload.customerId } });
  if (!customer) throw ApiError.notFound('Customer not found');

  const userId = user.id;
  const isCredit = payload.paymentMethod === 'CREDIT';
  const wasPaidCredit = existing.paymentMethod === 'CREDIT' && existing.creditStatus === 'PAID';
  const grandTotal = Number(existing.grandTotal);
  const dueDate = isCredit
    ? (existing.dueDate || new Date(Date.now() + CREDIT_TERM_DAYS * 24 * 60 * 60 * 1000))
    : null;

  const invoice = await prisma.$transaction(async (tx) => {
    await tx.invoicePayment.deleteMany({ where: { invoiceId: id } });

    const paymentCreate = (() => {
      if (!isCredit) {
        return {
          create: {
            amount: grandTotal,
            method: payload.paymentMethod,
            receivedById: userId,
          },
        };
      }
      if (wasPaidCredit) {
        return {
          create: {
            amount: grandTotal,
            method: existing.payments[0]?.method || 'CASH',
            receivedById: userId,
          },
        };
      }
      return undefined;
    })();

    const updated = await tx.invoice.update({
      where: { id },
      data: {
        customerId: payload.customerId,
        paymentMethod: payload.paymentMethod,
        creditStatus: isCredit
          ? (wasPaidCredit ? 'PAID' : 'OUTSTANDING')
          : null,
        dueDate,
        payments: paymentCreate,
      },
      include: invoiceInclude,
    });

    await tx.activity.create({
      data: {
        type: 'invoice',
        title: `Invoice ${existing.invoiceNumber} updated`,
        description: `Customer/payment updated — ${customer.name}`,
        amount: grandTotal,
        userId,
      },
    });

    return updated;
  });

  return enrichInvoicePrintMeta(serializeInvoice(invoice));
}

export async function settleCredit(id, payload, userId) {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) throw ApiError.notFound('Invoice not found');
  if (invoice.paymentMethod !== 'CREDIT') {
    throw ApiError.badRequest('Invoice is not a credit sale');
  }
  if (invoice.creditStatus === 'PAID') {
    throw ApiError.conflict('Credit already settled');
  }

  const amount = payload.amount ?? Number(invoice.grandTotal);

  return prisma.$transaction(async (tx) => {
    await tx.invoicePayment.create({
      data: {
        invoiceId: id,
        amount,
        method: payload.method,
        receivedById: userId,
      },
    });
    const updated = await tx.invoice.update({
      where: { id },
      data: { creditStatus: 'PAID' },
      include: invoiceInclude,
    });
    return serializeInvoice(updated);
  });
}

export async function cancelInvoice(id, userId) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { items: { include: { productUnit: true } } },
  });
  if (!invoice) throw ApiError.notFound('Invoice not found');
  if (invoice.status === 'CANCELLED') throw ApiError.conflict('Invoice already cancelled');

  return prisma.$transaction(async (tx) => {
    for (const item of invoice.items) {
      if (item.itemType === 'SERVICE' || !item.productUnitId) continue;

      await tx.productUnit.update({
        where: { id: item.productUnitId },
        data: { status: 'IN_STOCK' },
      });
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          productUnitId: item.productUnitId,
          type: 'RETURN',
          quantity: 1,
          reference: `Cancel ${invoice.invoiceNumber}`,
          userId,
        },
      });
    }

    const updated = await tx.invoice.update({
      where: { id },
      data: { status: 'CANCELLED', creditStatus: null },
      include: invoiceInclude,
    });

    return serializeInvoice(updated);
  });
}
