import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { parsePagination, listResult } from '../../utils/pagination.js';
import { nextPoNumber, nextPoSerialNumber } from '../../utils/documentNumbers.js';
import {
  fetchExternalPurchaseOrders,
  testExternalPoConnection,
  PO_SYNC_COMPANY,
} from '../../integrations/po/index.js';
import { parsePoBackup } from '../../integrations/po/backupParser.js';
import { normalizeWarrantyMonths } from '../../utils/warranty.js';
import {
  resolvePoVatPercentage,
  vatForNewProduct,
  syncProductVatFromPo,
} from '../../utils/productVat.js';
import { generateInventoryCode } from '../products/products.utils.js';

const poInclude = {
  supplier: { select: { id: true, name: true, code: true, company: true, contactPerson: true, vatRate: true } },
  items: {
    include: {
      product: {
        select: {
          id: true,
          code: true,
          name: true,
          categoryId: true,
          defaultSellingPrice: true,
          category: { select: { id: true, name: true } },
        },
      },
    },
  },
  _count: { select: { grns: true, purchaseInvoices: true } },
};

function calcSubTotal(items) {
  return items.reduce((sum, i) => sum + Number(i.costPrice) * i.quantity, 0);
}

function calcPoTotals(items, vatRate = 0) {
  const subTotal = calcSubTotal(items);
  const vatAmount = Math.round(subTotal * Number(vatRate) / 100 * 100) / 100;
  const totalAmount = subTotal + vatAmount;
  return { subTotal, vatAmount, totalAmount };
}

async function getSupplierVatRate(supplierId) {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: { vatRate: true },
  });
  return Number(supplier?.vatRate ?? 0);
}

function buildPoMeta(data, totals) {
  return {
    supplierRefNo: data.supplierRefNo || null,
    attn: data.attn || null,
    paymentTerms: data.paymentTerms || '30 days',
    fulfillmentType: data.fulfillmentType || 'DELIVERY',
    deliveryAddress: data.fulfillmentType === 'COLLECTION' ? null : data.deliveryAddress || null,
    collectedBy: data.fulfillmentType === 'DELIVERY' ? null : data.collectedBy || null,
    subTotal: totals.subTotal,
    vatRate: totals.vatRate,
    vatAmount: totals.vatAmount,
    totalAmount: totals.totalAmount,
  };
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
  if (query.serialNo) {
    where.poNumber = { contains: String(query.serialNo).trim(), mode: 'insensitive' };
  }
  if (query.supplier) {
    where.supplier = { name: { contains: String(query.supplier).trim(), mode: 'insensitive' } };
  }
  if (query.dateFrom || query.dateTo) {
    where.orderDate = {};
    if (query.dateFrom) where.orderDate.gte = new Date(query.dateFrom);
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setHours(23, 59, 59, 999);
      where.orderDate.lte = end;
    }
  }
  if (query.status) where.status = query.status;
  if (query.company && query.company !== 'BOTH') where.company = query.company;

  const [items, total] = await Promise.all([
    prisma.purchaseOrder.findMany({ where, include: poInclude, orderBy: [{ orderDate: 'desc' }, { createdAt: 'desc' }], skip, take }),
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

export async function previewNextPoSerial(company = PO_SYNC_COMPANY) {
  const serial = await nextPoSerialNumber(company);
  return {
    company,
    serial,
    companyLabel: company === 'ACTIVE24' ? 'Active24 (Pvt) Ltd' : 'Genius Associates',
  };
}

export async function createPurchaseOrder(data) {
  const poNumber = data.poNumber || (await nextPoNumber(data.company));
  const vatRate = data.vatRate ?? (await getSupplierVatRate(data.supplierId));
  const resolvedItems = await resolvePoItems(data.items, data.supplierId, data.company, vatRate);
  const totals = { ...calcPoTotals(resolvedItems, vatRate), vatRate };

  return prisma.purchaseOrder.create({
    data: {
      poNumber,
      company: data.company,
      supplierId: data.supplierId,
      orderDate: data.orderDate || new Date(),
      expectedDelivery: data.expectedDelivery,
      status: data.status,
      notes: data.notes || null,
      ...buildPoMeta(data, totals),
      items: {
        create: resolvedItems.map((item) => ({
          productId: item.productId,
          description: item.description || null,
          quantity: item.quantity,
          costPrice: item.costPrice,
          warrantyMonths: item.warrantyMonths,
        })),
      },
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

  if (data.supplierRefNo !== undefined) update.supplierRefNo = data.supplierRefNo || null;
  if (data.attn !== undefined) update.attn = data.attn || null;
  if (data.paymentTerms !== undefined) update.paymentTerms = data.paymentTerms || '30 days';
  if (data.fulfillmentType !== undefined) update.fulfillmentType = data.fulfillmentType;
  if (data.deliveryAddress !== undefined) update.deliveryAddress = data.deliveryAddress || null;
  if (data.collectedBy !== undefined) update.collectedBy = data.collectedBy || null;

  const supplierId = data.supplierId || (await prisma.purchaseOrder.findUnique({ where: { id }, select: { supplierId: true } }))?.supplierId;

  if (data.items) {
    const vatRate = data.vatRate ?? (supplierId ? await getSupplierVatRate(supplierId) : 0);
    const resolvedItems = await resolvePoItems(data.items, supplierId, data.company || 'ACTIVE24', vatRate);
    const totals = { ...calcPoTotals(resolvedItems, vatRate), vatRate };
    Object.assign(update, buildPoMeta({ ...data, fulfillmentType: data.fulfillmentType || update.fulfillmentType }, totals));
    await prisma.poItem.deleteMany({ where: { poId: id } });
    update.items = {
      create: resolvedItems.map((item) => ({
        productId: item.productId,
        description: item.description || null,
        quantity: item.quantity,
        costPrice: item.costPrice,
        warrantyMonths: item.warrantyMonths,
      })),
    };
  } else if (data.vatRate !== undefined && supplierId) {
    const po = await getPurchaseOrder(id);
    const totals = { ...calcPoTotals(po.items, data.vatRate), vatRate: data.vatRate };
    Object.assign(update, buildPoMeta(data, totals));
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

async function resolvePoItems(items, supplierId, company, vatRate) {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: { vatRate: true },
  });
  const resolvedVat = resolvePoVatPercentage(vatRate, supplier?.vatRate);
  if (resolvedVat === null) {
    console.warn(`[VAT] PO for supplier ${supplierId}: no VAT resolved from PO or supplier`);
  }

  const resolved = [];
  for (const line of items) {
    let productId = line.productId;
    let description = line.description?.trim() || '';

    if (!productId) {
      const product = await findOrCreateProduct(
        {
          description: description || 'PO line item',
          costPrice: line.costPrice,
          categoryId: line.categoryId || null,
        },
        supplierId,
        company,
        resolvedVat
      );
      productId = product.id;
      description = description || product.name;
    } else {
      await syncProductVatFromPo(
        prisma,
        productId,
        resolvedVat,
        `PO line product ${productId}`
      );
      if (line.categoryId) {
        await prisma.product.update({
          where: { id: productId },
          data: { categoryId: line.categoryId },
        });
      }
    }

    resolved.push({
      productId,
      description,
      quantity: line.quantity,
      costPrice: line.costPrice,
      warrantyMonths: normalizeWarrantyMonths(line.warrantyMonths),
    });
  }
  return resolved;
}

function slugCode(text, max = 20) {
  return text
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, max);
}

async function uniqueProductCode(base) {
  let code = base || 'PO-ITEM';
  let n = 1;
  while (await prisma.product.findUnique({ where: { code } })) {
    code = `${base}-${n++}`;
  }
  return code;
}

async function getOrCreateImportCategory() {
  const existing = await prisma.category.findFirst({
    where: { name: { equals: 'Imported', mode: 'insensitive' } },
  });
  if (existing) return existing;

  return prisma.category.create({
    data: { name: 'Imported', isActive: true },
  });
}

async function findOrCreateSupplier(name, company) {
  const trimmed = name.trim();
  let supplier = await prisma.supplier.findFirst({
    where: { name: { equals: trimmed, mode: 'insensitive' }, company },
  });
  if (supplier) return supplier;

  const baseCode = slugCode(trimmed, 16);
  let code = baseCode;
  let n = 1;
  while (await prisma.supplier.findUnique({ where: { code } })) {
    code = `${baseCode}-${n++}`;
  }

  return prisma.supplier.create({
    data: { name: trimmed, code, company, isActive: true },
  });
}

async function findOrCreateProduct(line, supplierId, company, resolvedVat) {
  const description = (line.description || line.productCode || 'Imported item').trim();

  if (line.productCode) {
    const byCode = await prisma.product.findUnique({ where: { code: line.productCode } });
    if (byCode) {
      await syncProductVatFromPo(prisma, byCode.id, resolvedVat, `PO import product ${byCode.code}`);
      return byCode;
    }
  }

  const categoryFilter = line.categoryId ? { categoryId: line.categoryId } : {};

  let product = await prisma.product.findFirst({
    where: { name: { equals: description, mode: 'insensitive' }, company, ...categoryFilter },
  });
  if (product) {
    await syncProductVatFromPo(prisma, product.id, resolvedVat, `PO import product ${product.code}`);
    return product;
  }

  product = await prisma.product.findFirst({
    where: { name: { contains: description.slice(0, 40), mode: 'insensitive' }, company, ...categoryFilter },
  });
  if (product) {
    await syncProductVatFromPo(prisma, product.id, resolvedVat, `PO import product ${product.code}`);
    return product;
  }

  let categoryId = line.categoryId || null;
  let categoryMeta = null;
  if (categoryId) {
    categoryMeta = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, codePrefix: true },
    });
    if (!categoryMeta) throw ApiError.badRequest('Selected category not found');
  } else {
    categoryId = (await getOrCreateImportCategory()).id;
    categoryMeta = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, codePrefix: true },
    });
  }

  // Prefer category inventory-code prefix (e.g. NB01) over PO slug codes
  const code = categoryMeta?.codePrefix
    ? await generateInventoryCode(prisma, categoryId)
    : (line.productCode
      ? await uniqueProductCode(line.productCode)
      : await generateInventoryCode(prisma, categoryId));
  const costPrice = Number(line.costPrice) || 0;
  const vatPercentage = vatForNewProduct(resolvedVat, `new product ${code}`);

  return prisma.product.create({
    data: {
      code,
      name: description,
      categoryId,
      supplierId,
      company,
      purchasePrice: costPrice,
      defaultSellingPrice: Math.round(costPrice * 1.3 * 100) / 100,
      vatPercentage,
      isActive: true,
    },
  });
}

async function importExternalPo(ext) {
  const existing = await prisma.purchaseOrder.findFirst({
    where: { externalRef: ext.externalRef, company: ext.company },
  });
  if (existing) {
    return { action: 'skipped', poNumber: existing.poNumber, reason: 'Already imported' };
  }

  const poNumberExists = await prisma.purchaseOrder.findUnique({ where: { poNumber: ext.poNumber } });
  const poNumber = poNumberExists ? await nextPoNumber(ext.company) : ext.poNumber;

  const supplier = await findOrCreateSupplier(ext.supplierName, ext.company);
  const importVat = resolvePoVatPercentage(ext.vatRate, supplier.vatRate);
  const items = [];

  for (const line of ext.items) {
    const product = await findOrCreateProduct(line, supplier.id, ext.company, importVat);
    items.push({
      productId: product.id,
      description: line.description || product.name,
      quantity: Math.max(1, Math.round(Number(line.quantity) || 1)),
      costPrice: Number(line.costPrice) || 0,
    });
  }

  if (items.length === 0) {
    return { action: 'error', poNumber: ext.poNumber, reason: 'No line items' };
  }

  const totalAmount = items.reduce((sum, i) => sum + i.costPrice * i.quantity, 0);
  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber,
      externalRef: ext.externalRef,
      company: ext.company,
      supplierId: supplier.id,
      orderDate: new Date(ext.orderDate),
      expectedDelivery: ext.expectedDelivery ? new Date(ext.expectedDelivery) : null,
      status: ext.status,
      notes: ext.notes || null,
      subTotal: totalAmount,
      vatRate: importVat ?? Number(supplier.vatRate ?? 0),
      vatAmount: 0,
      totalAmount,
      items: { create: items },
    },
    include: { supplier: { select: { name: true } } },
  });

  return {
    action: 'created',
    poNumber: po.poNumber,
    supplier: po.supplier?.name,
    totalAmount: Number(po.totalAmount),
  };
}

export async function syncPurchaseOrders({ company = PO_SYNC_COMPANY } = {}) {
  const companies = company === 'BOTH' ? ['GENIUS', 'ACTIVE24'] : [company];
  const summary = { created: 0, skipped: 0, errors: 0, details: [], source: 'sync' };

  for (const co of companies) {
    const external = await fetchExternalPurchaseOrders(co);
    await importPurchaseOrderBatch(external, co, summary);
  }

  return summary;
}

async function importPurchaseOrderBatch(orders, company, summary = { created: 0, skipped: 0, errors: 0, details: [] }) {
  for (const ext of orders) {
    if (ext.company !== company) continue;

    try {
      const result = await importExternalPo(ext);
      if (result.action === 'created') summary.created += 1;
      else if (result.action === 'skipped') summary.skipped += 1;
      else summary.errors += 1;
      summary.details.push({ company, ...result });
    } catch (err) {
      summary.errors += 1;
      summary.details.push({
        company,
        action: 'error',
        poNumber: ext.poNumber,
        reason: err.message || 'Import failed',
      });
    }
  }

  return summary;
}

export async function importPurchaseOrdersFromBackup(backup, { company = PO_SYNC_COMPANY } = {}) {
  const orders = parsePoBackup(backup, company);
  if (!orders.length) {
    throw ApiError.badRequest('No purchase orders found in backup file. Expected a JSON array or object with purchase_orders.');
  }

  const companies = company === 'BOTH' ? ['GENIUS', 'ACTIVE24'] : [company];
  const summary = {
    created: 0,
    skipped: 0,
    errors: 0,
    details: [],
    source: 'backup',
    totalInFile: orders.length,
  };

  for (const co of companies) {
    const filtered = orders.filter((o) => o.company === co);
    await importPurchaseOrderBatch(filtered, co, summary);
  }

  return summary;
}

export async function testPurchaseOrderSync() {
  return testExternalPoConnection();
}
