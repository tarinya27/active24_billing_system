import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { parsePagination, listResult } from '../../utils/pagination.js';
import { nextPoNumber } from '../../utils/documentNumbers.js';

const poInclude = {
  supplier: { select: { id: true, name: true, code: true, company: true } },
  items: {
    include: {
      product: { select: { id: true, code: true, name: true, categoryId: true, defaultSellingPrice: true } },
    },
  },
  _count: { select: { grns: true, purchaseInvoices: true } },
};

function calcTotal(items) {
  return items.reduce((sum, i) => sum + Number(i.costPrice) * i.quantity, 0);
}

export async function listPurchaseOrders(query) {
  const { skip, take, page, pageSize } = parsePagination(query);
  const where = {};

  if (query.search) {
    where.OR = [
      { poNumber: { contains: query.search, mode: 'insensitive' } },
      { notes: { contains: query.search, mode: 'insensitive' } },
      { externalRef: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.status) where.status = query.status;
  if (query.company) where.company = query.company;

  const [items, total] = await Promise.all([
    prisma.purchaseOrder.findMany({ where, include: poInclude, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return listResult(items, total, { page, pageSize });
}

export async function getPurchaseOrder(id) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id }, include: poInclude });
  if (!po) throw ApiError.notFound('Purchase order not found');
  return po;
}

export async function getPurchaseOrderTally(id) {
  const po = await getPurchaseOrder(id);

  const received = await prisma.grnItem.groupBy({
    by: ['productId'],
    where: { grn: { poId: id, status: 'COMPLETED' } },
    _sum: { units: true },
  });
  const receivedMap = Object.fromEntries(received.map((r) => [r.productId, r._sum.units || 0]));

  const invoiced = await prisma.purchaseInvoiceItem.groupBy({
    by: ['productId'],
    where: { purchaseInvoice: { poId: id } },
    _sum: { units: true },
  });
  const invoicedMap = Object.fromEntries(invoiced.map((r) => [r.productId, r._sum.units || 0]));

  const lines = po.items.map((item) => {
    const orderedQty = item.quantity;
    const receivedQty = receivedMap[item.productId] || 0;
    const invoicedQty = invoicedMap[item.productId] || 0;
    return {
      productId: item.productId,
      productCode: item.product.code,
      productName: item.product.name,
      orderedQty,
      invoicedQty,
      receivedQty,
      remainingQty: Math.max(0, orderedQty - receivedQty),
    };
  });

  return { poId: id, poNumber: po.poNumber, lines };
}

export async function createPurchaseOrder(data) {
  const poNumber = data.poNumber || (await nextPoNumber(data.company));
  const totalAmount = calcTotal(data.items);
  return prisma.purchaseOrder.create({
    data: {
      poNumber,
      company: data.company,
      supplierId: data.supplierId,
      orderDate: data.orderDate || new Date(),
      expectedDelivery: data.expectedDelivery,
      status: data.status,
      notes: data.notes || null,
      totalAmount,
      items: { create: data.items },
    },
    include: poInclude,
  });
}

export async function updatePurchaseOrder(id, data) {
  await getPurchaseOrder(id);
  const update = {};
  if (data.company) update.company = data.company;
  if (data.supplierId) update.supplierId = data.supplierId;
  if (data.orderDate) update.orderDate = data.orderDate;
  if (data.expectedDelivery !== undefined) update.expectedDelivery = data.expectedDelivery;
  if (data.status) update.status = data.status;
  if (data.notes !== undefined) update.notes = data.notes || null;

  if (data.items) {
    update.totalAmount = calcTotal(data.items);
    await prisma.poItem.deleteMany({ where: { poId: id } });
    update.items = { create: data.items };
  }

  return prisma.purchaseOrder.update({ where: { id }, data: update, include: poInclude });
}

export async function deletePurchaseOrder(id) {
  await getPurchaseOrder(id);
  const linked = await prisma.grn.count({ where: { poId: id } });
  if (linked > 0) throw ApiError.conflict('Cannot delete a PO linked to GRNs');
  await prisma.purchaseOrder.delete({ where: { id } });
  return { id };
}
