import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { parsePagination, listResult } from '../../utils/pagination.js';
import { calcPurchaseInvoiceTotals } from '../../utils/pricing.js';

const piInclude = {
  supplier: { select: { id: true, name: true, code: true } },
  po: { select: { id: true, poNumber: true, status: true } },
  createdBy: { select: { id: true, name: true } },
  items: {
    include: {
      product: { select: { id: true, code: true, name: true, categoryId: true } },
    },
  },
  grn: { select: { id: true, grnNumber: true, status: true } },
};

async function getDefaultVatRate(override) {
  if (override !== undefined) return Number(override);
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  return Number(settings?.vatRate || 0);
}

export async function listPurchaseInvoices(query) {
  const { skip, take, page, pageSize } = parsePagination(query);
  const where = {};

  if (query.search) {
    where.OR = [
      { supplierInvoiceNo: { contains: query.search, mode: 'insensitive' } },
      { supplier: { name: { contains: query.search, mode: 'insensitive' } } },
    ];
  }
  if (query.supplierId) where.supplierId = query.supplierId;
  if (query.poId) where.poId = query.poId;
  if (query.company) where.company = query.company;

  const [items, total] = await Promise.all([
    prisma.purchaseInvoice.findMany({ where, include: piInclude, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.purchaseInvoice.count({ where }),
  ]);

  return listResult(items, total, { page, pageSize });
}

export async function getPurchaseInvoice(id) {
  const invoice = await prisma.purchaseInvoice.findUnique({ where: { id }, include: piInclude });
  if (!invoice) throw ApiError.notFound('Purchase invoice not found');
  return invoice;
}

export async function getPurchaseInvoiceTally(id) {
  const invoice = await getPurchaseInvoice(id);

  const received = await prisma.grnItem.groupBy({
    by: ['productId'],
    where: { grn: { purchaseInvoiceId: id, status: 'COMPLETED' } },
    _sum: { units: true },
  });
  const receivedMap = Object.fromEntries(received.map((r) => [r.productId, r._sum.units || 0]));

  const poLines = invoice.poId
    ? (await prisma.poItem.findMany({ where: { poId: invoice.poId } })).reduce((acc, i) => {
        acc[i.productId] = (acc[i.productId] || 0) + i.quantity;
        return acc;
      }, {})
    : {};

  const lines = invoice.items.map((item) => {
    const invoicedQty = item.units;
    const receivedQty = receivedMap[item.productId] || 0;
    const orderedQty = poLines[item.productId] || null;
    return {
      productId: item.productId,
      productCode: item.product.code,
      productName: item.product.name,
      unitPrice: item.unitPrice,
      orderedQty,
      invoicedQty,
      receivedQty,
      remainingQty: Math.max(0, invoicedQty - receivedQty),
    };
  });

  return {
    purchaseInvoiceId: id,
    poId: invoice.poId,
    poNumber: invoice.po?.poNumber,
    lines,
  };
}

export async function createPurchaseInvoice(data, userId) {
  const vatRate = await getDefaultVatRate(data.vatRate);
  const { lines, subtotal, vatAmount, total } = calcPurchaseInvoiceTotals(
    data.items,
    data.purchaseWithVat,
    vatRate
  );

  if (data.poId) {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: data.poId } });
    if (!po) throw ApiError.badRequest('Linked PO not found');
  }

  return prisma.purchaseInvoice.create({
    data: {
      supplierInvoiceNo: data.supplierInvoiceNo || null,
      poId: data.poId || null,
      supplierId: data.supplierId,
      company: data.company,
      purchaseWithVat: data.purchaseWithVat,
      vatRate,
      subtotal,
      vatAmount,
      total,
      createdById: userId,
      items: {
        create: lines.map((l) => ({
          productId: l.productId,
          unitPrice: l.unitPrice,
          units: l.units,
          vatAmount: l.vatAmount,
          lineTotal: l.lineTotal,
        })),
      },
    },
    include: piInclude,
  });
}

export async function updatePurchaseInvoice(id, data) {
  const existing = await getPurchaseInvoice(id);
  if (existing.grn) throw ApiError.conflict('Cannot edit a purchase invoice that already has a GRN');

  const vatRate = await getDefaultVatRate(data.vatRate ?? existing.vatRate);
  const purchaseWithVat = data.purchaseWithVat ?? existing.purchaseWithVat;
  const items = data.items || existing.items.map((i) => ({
    productId: i.productId,
    unitPrice: Number(i.unitPrice),
    units: i.units,
  }));

  const { lines, subtotal, vatAmount, total } = calcPurchaseInvoiceTotals(items, purchaseWithVat, vatRate);

  await prisma.purchaseInvoiceItem.deleteMany({ where: { purchaseInvoiceId: id } });

  return prisma.purchaseInvoice.update({
    where: { id },
    data: {
      supplierInvoiceNo: data.supplierInvoiceNo !== undefined ? data.supplierInvoiceNo || null : undefined,
      poId: data.poId !== undefined ? data.poId || null : undefined,
      supplierId: data.supplierId,
      company: data.company,
      purchaseWithVat,
      vatRate,
      subtotal,
      vatAmount,
      total,
      items: {
        create: lines.map((l) => ({
          productId: l.productId,
          unitPrice: l.unitPrice,
          units: l.units,
          vatAmount: l.vatAmount,
          lineTotal: l.lineTotal,
        })),
      },
    },
    include: piInclude,
  });
}

export async function deletePurchaseInvoice(id) {
  const existing = await getPurchaseInvoice(id);
  if (existing.grn) throw ApiError.conflict('Cannot delete a purchase invoice linked to a GRN');
  await prisma.purchaseInvoice.delete({ where: { id } });
  return { id };
}
