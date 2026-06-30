import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { parsePagination, listResult } from '../../utils/pagination.js';
import { nextInvoiceNumber } from '../../utils/documentNumbers.js';
import { CREDIT_TERM_DAYS } from '../../utils/enums.js';

const invoiceInclude = {
  customer: true,
  cashier: { select: { id: true, name: true } },
  items: {
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
      unitPrice: Number(item.unitPrice),
      discount: Number(item.discount),
    })),
    payments: inv.payments?.map((p) => ({ ...p, amount: Number(p.amount) })) || [],
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

  return serializeInvoice(invoice);
}

export async function createInvoice(payload, userId) {
  const barcodes = payload.items.map((i) => i.barcode);
  const dupBarcodes = barcodes.filter((b, i) => barcodes.indexOf(b) !== i);
  if (dupBarcodes.length) {
    throw ApiError.badRequest(`Duplicate barcodes in cart: ${[...new Set(dupBarcodes)].join(', ')}`);
  }

  const customer = await prisma.customer.findUnique({ where: { id: payload.customerId } });
  if (!customer) throw ApiError.notFound('Customer not found');

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const vatRate = settings?.vatEnabled ? Number(settings.vatRate || 0) / 100 : 0;

  return prisma.$transaction(async (tx) => {
    const units = await tx.productUnit.findMany({
      where: { barcode: { in: barcodes } },
      include: { product: { select: { id: true, code: true, name: true } } },
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
    const lineItems = payload.items.map((item) => {
      const unit = unitByBarcode[item.barcode];
      return {
        unit,
        discount: Number(item.discount || 0),
        unitPrice: Number(unit.sellingPrice),
      };
    });

    const subtotal = lineItems.reduce((s, l) => s + l.unitPrice, 0);
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
        paymentMethod: payload.paymentMethod,
        status: 'COMPLETED',
        creditStatus: isCredit ? 'OUTSTANDING' : null,
        dueDate,
        subtotal,
        totalDiscount,
        vatAmount,
        grandTotal,
        items: {
          create: lineItems.map((l) => ({
            productUnitId: l.unit.id,
            productId: l.unit.productId,
            unitPrice: l.unitPrice,
            discount: l.discount,
          })),
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

    for (const line of lineItems) {
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
        description: `${lineItems.length} item(s) — ${customer.name}`,
        amount: grandTotal,
        userId,
      },
    });

    return serializeInvoice(invoice);
  });
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
