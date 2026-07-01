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
    orderBy: { id: 'asc' },
  },
  grn: { select: { id: true, grnNumber: true, status: true } },
};

async function getDefaultVatRate(override) {
  if (override !== undefined) return Number(override);
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  return Number(settings?.vatRate || 0);
}

function resolveVatFlags(data, existing = null) {
  const vatEnabled = data.vatEnabled ?? existing?.vatEnabled ?? false;
  const purchaseWithVat = data.purchaseWithVat ?? existing?.purchaseWithVat ?? false;
  return { vatEnabled, purchaseWithVat };
}

function computeTotals(items, vatEnabled, purchaseWithVat, vatRate) {
  const effectiveRate = vatEnabled && !purchaseWithVat ? vatRate : (purchaseWithVat ? vatRate : 0);
  return calcPurchaseInvoiceTotals(items, purchaseWithVat, effectiveRate, vatEnabled);
}

function mapItemsForCreate(lines) {
  return lines.map((l) => ({
    productId: l.productId,
    description: l.description?.trim() || null,
    unitPrice: l.unitPrice,
    units: l.units,
    vatAmount: l.vatAmount,
    lineTotal: l.lineGrandTotal ?? l.lineTotal,
  }));
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
      description: item.description,
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

export async function calculatePurchaseInvoicePreview(data) {
  const vatRate = await getDefaultVatRate(data.vatRate);
  const { vatEnabled, purchaseWithVat } = resolveVatFlags(data);
  return computeTotals(data.items, vatEnabled, purchaseWithVat, vatRate);
}

export async function createPurchaseInvoice(data, userId) {
  const vatRate = await getDefaultVatRate(data.vatRate);
  const { vatEnabled, purchaseWithVat } = resolveVatFlags(data);
  const { lines, subtotal, vatAmount, total } = computeTotals(data.items, vatEnabled, purchaseWithVat, vatRate);

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
      vatEnabled,
      purchaseWithVat,
      vatRate: vatEnabled ? vatRate : 0,
      subtotal,
      vatAmount,
      total,
      createdById: userId,
      items: { create: mapItemsForCreate(lines) },
    },
    include: piInclude,
  });
}

export async function updatePurchaseInvoice(id, data) {
  const existing = await getPurchaseInvoice(id);
  if (existing.grn) throw ApiError.conflict('Cannot edit a purchase invoice that already has a GRN');

  const vatRate = await getDefaultVatRate(data.vatRate ?? existing.vatRate);
  const { vatEnabled, purchaseWithVat } = resolveVatFlags(data, existing);
  const items = data.items || existing.items.map((i) => ({
    productId: i.productId,
    description: i.description || '',
    unitPrice: Number(i.unitPrice),
    units: i.units,
  }));

  const { lines, subtotal, vatAmount, total } = computeTotals(items, vatEnabled, purchaseWithVat, vatRate);

  await prisma.purchaseInvoiceItem.deleteMany({ where: { purchaseInvoiceId: id } });

  return prisma.purchaseInvoice.update({
    where: { id },
    data: {
      supplierInvoiceNo: data.supplierInvoiceNo !== undefined ? data.supplierInvoiceNo || null : undefined,
      poId: data.poId !== undefined ? data.poId || null : undefined,
      supplierId: data.supplierId ?? existing.supplierId,
      company: data.company ?? existing.company,
      vatEnabled,
      purchaseWithVat,
      vatRate: vatEnabled ? vatRate : 0,
      subtotal,
      vatAmount,
      total,
      items: { create: mapItemsForCreate(lines) },
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
