import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { parsePagination, listResult } from '../../utils/pagination.js';
import { allocateInvoiceNumber } from '../../utils/documentNumbers.js';
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
      units: {
        orderBy: { id: 'asc' },
        include: { productUnit: { select: { id: true, barcode: true } } },
      },
    },
  },
  payments: {
    include: { receivedBy: { select: { name: true } } },
    orderBy: { paidAt: 'asc' },
  },
};

function itemBarcodes(item) {
  const fromUnits = (item.units || [])
    .map((u) => u.productUnit?.barcode)
    .filter(Boolean);
  if (fromUnits.length) return fromUnits;
  if (item.productUnit?.barcode) return [item.productUnit.barcode];
  return [];
}

function itemUnitIds(item) {
  const fromUnits = (item.units || []).map((u) => u.productUnitId).filter(Boolean);
  if (fromUnits.length) return fromUnits;
  if (item.productUnitId) return [item.productUnitId];
  return [];
}

function optionalTextField(value) {
  const text = value != null ? String(value).trim() : '';
  return text || null;
}

function normalizeProductLines(productItems) {
  const lines = [];
  for (const item of productItems) {
    const extras = {
      discount: Number(item.discount || 0),
      unitPrice: item.unitPrice,
      warrantyMonths: item.warrantyMonths,
      hasUnitPrice: item.unitPrice !== undefined && item.unitPrice !== null && item.unitPrice !== '',
      hasWarranty: Object.prototype.hasOwnProperty.call(item, 'warrantyMonths'),
    };
    if (Array.isArray(item.barcodes) && item.barcodes.length) {
      for (const barcode of item.barcodes) {
        lines.push({ barcode: String(barcode).trim(), ...extras });
      }
      continue;
    }
    if (item.barcode) {
      lines.push({ barcode: String(item.barcode).trim(), ...extras });
    }
  }
  return lines;
}

function productUnitInclude() {
  return {
    product: { select: { id: true, code: true, name: true } },
    grnItem: { select: { warrantyMonths: true } },
    deliveryNoteItem: { select: { warrantyMonths: true } },
  };
}

function buildProductGroups(normalizedProductLines, units, {
  allowSoldUnitIds = new Set(),
  groupByWarranty = false,
} = {}) {
  const barcodes = normalizedProductLines.map((i) => i.barcode);
  if (units.length !== barcodes.length) {
    const found = new Set(units.map((u) => u.barcode));
    const missing = barcodes.filter((b) => !found.has(b));
    throw ApiError.notFound(`Units not found: ${missing.join(', ')}`);
  }

  const unavailable = units.filter((u) => u.status !== 'IN_STOCK' && !allowSoldUnitIds.has(u.id));
  if (unavailable.length) {
    throw ApiError.conflict(
      `Cannot sell — units not in stock: ${unavailable.map((u) => `${u.barcode} (${u.status})`).join(', ')}`
    );
  }

  const unitByBarcode = Object.fromEntries(units.map((u) => [u.barcode, u]));
  const resolvedLines = normalizedProductLines.map((item) => {
    const unit = unitByBarcode[item.barcode];
    const unitPrice = item.hasUnitPrice
      ? Number(item.unitPrice)
      : Number(unit.sellingPrice);
    if (Number.isNaN(unitPrice) || unitPrice < 0) {
      throw ApiError.badRequest('Unit price must be 0 or more');
    }
    const warrantyMonths = item.hasWarranty
      ? normalizeWarrantyMonths(item.warrantyMonths)
      : normalizeWarrantyMonths(
        unit.warrantyMonths ?? unit.grnItem?.warrantyMonths ?? unit.deliveryNoteItem?.warrantyMonths
      );
    return {
      unit,
      discount: Number(item.discount || 0),
      unitPrice,
      warrantyMonths,
    };
  });

  const groupMap = new Map();
  for (const line of resolvedLines) {
    const key = groupByWarranty
      ? `${line.unit.productId}:${line.unitPrice}:${line.discount}:${line.warrantyMonths ?? ''}`
      : `${line.unit.productId}:${line.unitPrice}:${line.discount}`;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key).push(line);
  }
  return [...groupMap.values()];
}

function mapInvoiceItemCreates(productGroups, serviceItems) {
  const serviceLines = serviceItems.map((service) => ({
    itemType: 'SERVICE',
    description: String(service.description).replace(/^\s+|\s+$/g, ''),
    unitPrice: Number(service.unitPrice),
    discount: Number(service.discount || 0),
    quantity: Math.max(1, Number.parseInt(String(service.quantity ?? 1), 10) || 1),
    warrantyMonths: null,
  }));

  const productLineItems = productGroups.map((group) => ({
    itemType: 'PRODUCT',
    units: group.map((g) => g.unit),
    unitPrice: group[0].unitPrice,
    discount: group[0].discount,
    quantity: group.length,
    warrantyMonths: group[0].warrantyMonths,
    description: null,
  }));

  const lineItems = [...productLineItems, ...serviceLines];
  const subtotal = lineItems.reduce((s, l) => s + (l.unitPrice * l.quantity), 0);
  const totalDiscount = lineItems.reduce((s, l) => s + l.discount, 0);
  const afterDiscount = subtotal - totalDiscount;

  return { lineItems, subtotal, totalDiscount, afterDiscount };
}

function invoiceItemCreateData(lineItems) {
  return lineItems.map((l) => (
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
          quantity: l.quantity,
          productUnitId: l.units[0].id,
          productId: l.units[0].productId,
          unitPrice: l.unitPrice,
          discount: l.discount,
          warrantyMonths: l.warrantyMonths,
          units: {
            create: l.units.map((unit) => ({ productUnitId: unit.id })),
          },
        }
  ));
}

function serializeInvoice(inv) {
  return {
    ...inv,
    poNo: inv.poNo ?? null,
    sofNo: inv.sofNo ?? null,
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
      barcodes: itemBarcodes(item),
      units: (item.units || []).map((u) => ({
        id: u.id,
        productUnitId: u.productUnitId,
        barcode: u.productUnit?.barcode || null,
      })),
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
  const unitIds = invoice.items.flatMap((item) => {
    if (item.itemType === 'SERVICE') return [];
    return itemUnitIds(item);
  }).filter(Boolean);

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
            barcodes: [],
          };
        }
        return {
          ...item,
          categoryName: null,
          itemDescription: item.description?.trim() || item.product?.name || null,
          barcodes: itemBarcodes(item),
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
          barcodes: [],
        };
      }

      const linkedUnits = itemUnitIds(item)
        .map((id) => unitById[id])
        .filter(Boolean);
      const unit = linkedUnits[0];
      const fallbackName = item.product?.name || unit?.product?.name;
      const barcodes = linkedUnits.map((u) => u.barcode).filter(Boolean);

      return {
        ...item,
        barcodes,
        categoryName: unit ? resolveCategoryNameFromUnit(unit) : null,
        itemDescription: item.description?.replace(/^\s+|\s+$/g, '')
          || (unit ? resolveItemDescriptionFromUnit(unit, fallbackName) : (fallbackName || null)),
      };
    }),
  };
}

async function addZeroValueProductLines(tx, {
  invoiceId,
  invoiceNumber,
  items,
  userId,
}) {
  const created = [];

  for (const item of items) {
    const description = String(item.description || '').replace(/^\s+|\s+$/g, '');
    const quantity = Number(item.quantity);
    if (!description) throw ApiError.badRequest('Description is required');
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw ApiError.badRequest('Quantity must be a whole number of at least 1');
    }

    const category = await tx.category.findUnique({
      where: { id: item.categoryId },
      select: { id: true, name: true, isActive: true },
    });
    if (!category) throw ApiError.notFound('Category not found');
    if (!category.isActive) throw ApiError.badRequest(`${category.name} is not active`);

    const units = await tx.productUnit.findMany({
      where: {
        status: 'IN_STOCK',
        product: { categoryId: category.id, isActive: true },
      },
      include: {
        grnItem: { select: { warrantyMonths: true } },
        deliveryNoteItem: { select: { warrantyMonths: true } },
        product: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: quantity,
    });

    if (units.length < quantity) {
      throw ApiError.conflict(
        `Not enough stock in ${category.name} (need ${quantity}, available ${units.length})`
      );
    }

    const warrantyMonths = normalizeWarrantyMonths(
      units[0].warrantyMonths ?? units[0].grnItem?.warrantyMonths ?? units[0].deliveryNoteItem?.warrantyMonths
    );

    const invoiceItem = await tx.invoiceItem.create({
      data: {
        invoiceId,
        itemType: 'PRODUCT',
        description,
        quantity,
        productUnitId: units[0].id,
        productId: units[0].productId,
        unitPrice: 0,
        discount: 0,
        warrantyMonths,
        units: {
          create: units.map((unit) => ({ productUnitId: unit.id })),
        },
      },
    });

    for (const unit of units) {
      await tx.productUnit.update({
        where: { id: unit.id },
        data: { status: 'SOLD' },
      });
      await tx.stockMovement.create({
        data: {
          productId: unit.productId,
          productUnitId: unit.id,
          type: 'SALE_OUT',
          quantity: -1,
          reference: invoiceNumber,
          userId,
        },
      });
    }

    created.push(invoiceItem);
  }

  return created;
}

function parseDateBoundary(value, endOfDay) {
  if (!value) return null;
  const raw = String(value).trim();
  const date = new Date(endOfDay ? `${raw}T23:59:59.999` : `${raw}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function listInvoices(query, user) {
  const { skip, take, page, pageSize } = parsePagination(query);
  const where = {};

  const canViewAll = user.role === 'MANAGER' || user.role === 'ADMIN';
  if (!canViewAll) {
    where.cashierId = user.id;
  }

  const search = String(query.search || '').trim();
  if (search) {
    const or = [
      { invoiceNumber: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
      { customer: { mobile: { contains: search, mode: 'insensitive' } } },
    ];
    const numeric = Number(String(search).replace(/,/g, ''));
    if (Number.isFinite(numeric) && /^\d+(\.\d+)?$/.test(String(search).replace(/,/g, ''))) {
      or.push({ grandTotal: numeric });
    }
    where.OR = or;
  }

  if (query.paymentMethod) where.paymentMethod = query.paymentMethod;
  if (query.status) where.status = query.status;
  if (query.customerId) where.customerId = query.customerId;

  const dateFrom = parseDateBoundary(query.dateFrom, false);
  const dateTo = parseDateBoundary(query.dateTo, true);
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = dateFrom;
    if (dateTo) where.createdAt.lte = dateTo;
  }

  const [items, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        customer: { select: { id: true, salutation: true, name: true, mobile: true, address: true } },
        cashier: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.invoice.count({ where }),
  ]);

  return listResult(
    items.map((inv) => ({
      ...inv,
      subtotal: Number(inv.subtotal),
      totalDiscount: Number(inv.totalDiscount),
      vatAmount: Number(inv.vatAmount),
      grandTotal: Number(inv.grandTotal),
    })),
    total,
    { page, pageSize }
  );
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

  const normalizedProductLines = normalizeProductLines(productItems);
  const barcodes = normalizedProductLines.map((i) => i.barcode);
  const dupBarcodes = barcodes.filter((b, i) => barcodes.indexOf(b) !== i);
  if (dupBarcodes.length) {
    throw ApiError.badRequest(`Duplicate barcodes in cart: ${[...new Set(dupBarcodes)].join(', ')}`);
  }

  for (const service of serviceItems) {
    const description = String(service.description || '').replace(/^\s+|\s+$/g, '');
    const unitPrice = Number(service.unitPrice);
    if (!description) throw ApiError.badRequest('Service description is required');
    if (!(unitPrice > 0)) throw ApiError.badRequest('Service amount must be greater than 0');
  }

  const customer = await prisma.customer.findUnique({ where: { id: payload.customerId } });
  if (!customer) throw ApiError.notFound('Customer not found');

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const vatRate = settings?.vatEnabled ? Number(settings.vatRate || 0) / 100 : 0;

  const invoice = await prisma.$transaction(async (tx) => {
    let productGroups = [];

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
      const resolvedLines = normalizedProductLines.map((item) => {
        const unit = unitByBarcode[item.barcode];
        const warrantyMonths = normalizeWarrantyMonths(
          unit.warrantyMonths ?? unit.grnItem?.warrantyMonths ?? unit.deliveryNoteItem?.warrantyMonths
        );
        return {
          unit,
          discount: Number(item.discount || 0),
          unitPrice: Number(unit.sellingPrice),
          warrantyMonths,
        };
      });

      const groupMap = new Map();
      for (const line of resolvedLines) {
        const key = `${line.unit.productId}:${line.unitPrice}:${line.discount}`;
        if (!groupMap.has(key)) groupMap.set(key, []);
        groupMap.get(key).push(line);
      }
      productGroups = [...groupMap.values()];
    }

    const serviceLines = serviceItems.map((service) => ({
      itemType: 'SERVICE',
      description: String(service.description).replace(/^\s+|\s+$/g, ''),
      unitPrice: Number(service.unitPrice),
      discount: Number(service.discount || 0),
      quantity: Math.max(1, Number.parseInt(String(service.quantity ?? 1), 10) || 1),
      warrantyMonths: null,
    }));

    const productLineItems = productGroups.map((group) => ({
      itemType: 'PRODUCT',
      units: group.map((g) => g.unit),
      unitPrice: group[0].unitPrice,
      discount: group[0].discount,
      quantity: group.length,
      warrantyMonths: group[0].warrantyMonths,
      description: null,
    }));

    const lineItems = [...productLineItems, ...serviceLines];
    const subtotal = lineItems.reduce((s, l) => s + (l.unitPrice * l.quantity), 0);
    const totalDiscount = lineItems.reduce((s, l) => s + l.discount, 0);
    const afterDiscount = subtotal - totalDiscount;
    const vatAmount = afterDiscount * vatRate;
    const grandTotal = afterDiscount + vatAmount;

    const invoiceNumber = await allocateInvoiceNumber(tx);
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
        poNo: optionalTextField(payload.poNo),
        sofNo: optionalTextField(payload.sofNo),
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
                  quantity: l.quantity,
                  productUnitId: l.units[0].id,
                  productId: l.units[0].productId,
                  unitPrice: l.unitPrice,
                  discount: l.discount,
                  warrantyMonths: l.warrantyMonths,
                  units: {
                    create: l.units.map((unit) => ({ productUnitId: unit.id })),
                  },
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
    for (const group of productGroups) {
      for (const line of group) {
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

function paymentCreateForUpdate({ isCredit, wasPaidCredit, grandTotal, paymentMethod, existingPayments, userId }) {
  if (!isCredit) {
    return {
      create: {
        amount: grandTotal,
        method: paymentMethod,
        receivedById: userId,
      },
    };
  }
  if (wasPaidCredit) {
    return {
      create: {
        amount: grandTotal,
        method: existingPayments[0]?.method || 'CASH',
        receivedById: userId,
      },
    };
  }
  return undefined;
}

export async function updateInvoice(id, payload, user) {
  const existing = await prisma.invoice.findUnique({
    where: { id },
    include: {
      payments: true,
      items: {
        include: {
          units: true,
        },
      },
    },
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
  const dueDate = isCredit
    ? (existing.dueDate || new Date(Date.now() + CREDIT_TERM_DAYS * 24 * 60 * 60 * 1000))
    : null;
  const zeroValueItems = Array.isArray(payload.zeroValueItems) ? payload.zeroValueItems : [];
  const replaceLines = payload.items !== undefined || payload.services !== undefined;

  if (replaceLines) {
    const productItems = Array.isArray(payload.items) ? payload.items : [];
    const serviceItems = Array.isArray(payload.services) ? payload.services : [];
    if (productItems.length + serviceItems.length + zeroValueItems.length < 1) {
      throw ApiError.badRequest('Add at least one product or service line');
    }

    const normalizedProductLines = normalizeProductLines(productItems);
    const barcodes = normalizedProductLines.map((i) => i.barcode);
    const dupBarcodes = barcodes.filter((b, i) => barcodes.indexOf(b) !== i);
    if (dupBarcodes.length) {
      throw ApiError.badRequest(`Duplicate barcodes in cart: ${[...new Set(dupBarcodes)].join(', ')}`);
    }

    for (const service of serviceItems) {
      const description = String(service.description || '').replace(/^\s+|\s+$/g, '');
      const unitPrice = Number(service.unitPrice);
      if (!description) throw ApiError.badRequest('Service description is required');
      if (!(unitPrice > 0)) throw ApiError.badRequest('Service amount must be greater than 0');
    }

    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const vatRate = settings?.vatEnabled ? Number(settings.vatRate || 0) / 100 : 0;
    const existingUnitIds = new Set(existing.items.flatMap((item) => itemUnitIds(item)));

    const invoice = await prisma.$transaction(async (tx) => {
      let productGroups = [];
      if (barcodes.length) {
        const units = await tx.productUnit.findMany({
          where: { barcode: { in: barcodes } },
          include: productUnitInclude(),
        });
        productGroups = buildProductGroups(normalizedProductLines, units, {
          allowSoldUnitIds: existingUnitIds,
          groupByWarranty: true,
        });
      }

      const newUnitIds = new Set(productGroups.flatMap((group) => group.map((line) => line.unit.id)));
      const releaseIds = [...existingUnitIds].filter((unitId) => !newUnitIds.has(unitId));
      const acquireIds = [...newUnitIds].filter((unitId) => !existingUnitIds.has(unitId));
      const acquireById = Object.fromEntries(
        productGroups.flatMap((group) => group.map((line) => [line.unit.id, line.unit]))
      );

      const { lineItems, subtotal, totalDiscount, afterDiscount } = mapInvoiceItemCreates(productGroups, serviceItems);
      const vatAmount = afterDiscount * vatRate;
      const grandTotal = afterDiscount + vatAmount;

      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });

      for (const productUnitId of releaseIds) {
        const unit = await tx.productUnit.findUnique({ where: { id: productUnitId } });
        if (!unit) continue;
        await tx.productUnit.update({
          where: { id: productUnitId },
          data: { status: 'IN_STOCK' },
        });
        await tx.stockMovement.create({
          data: {
            productId: unit.productId,
            productUnitId,
            type: 'RETURN',
            quantity: 1,
            reference: `Edit ${existing.invoiceNumber}`,
            userId,
          },
        });
      }

      await tx.invoicePayment.deleteMany({ where: { invoiceId: id } });

      await tx.invoice.update({
        where: { id },
        data: {
          customerId: payload.customerId,
          paymentMethod: payload.paymentMethod,
          poNo: payload.poNo !== undefined ? optionalTextField(payload.poNo) : existing.poNo,
          sofNo: payload.sofNo !== undefined ? optionalTextField(payload.sofNo) : existing.sofNo,
          creditStatus: isCredit
            ? (wasPaidCredit ? 'PAID' : 'OUTSTANDING')
            : null,
          dueDate,
          subtotal,
          totalDiscount,
          vatAmount,
          grandTotal,
          items: { create: invoiceItemCreateData(lineItems) },
          payments: paymentCreateForUpdate({
            isCredit,
            wasPaidCredit,
            grandTotal,
            paymentMethod: payload.paymentMethod,
            existingPayments: existing.payments,
            userId,
          }),
        },
      });

      for (const productUnitId of acquireIds) {
        const unit = acquireById[productUnitId];
        await tx.productUnit.update({
          where: { id: productUnitId },
          data: { status: 'SOLD' },
        });
        await tx.stockMovement.create({
          data: {
            productId: unit.productId,
            productUnitId,
            type: 'SALE_OUT',
            quantity: -1,
            reference: existing.invoiceNumber,
            userId,
          },
        });
      }

      if (zeroValueItems.length) {
        await addZeroValueProductLines(tx, {
          invoiceId: id,
          invoiceNumber: existing.invoiceNumber,
          items: zeroValueItems,
          userId,
        });
      }

      const updated = await tx.invoice.findUnique({
        where: { id },
        include: invoiceInclude,
      });

      const zeroNote = zeroValueItems.length ? `; ${zeroValueItems.length} 0.00 product line(s) added` : '';
      await tx.activity.create({
        data: {
          type: 'invoice',
          title: `Invoice ${existing.invoiceNumber} updated`,
          description: `Items/prices updated${zeroNote} — ${customer.name}`,
          amount: Number(updated.grandTotal),
          userId,
        },
      });

      return updated;
    });

    return enrichInvoicePrintMeta(serializeInvoice(invoice));
  }

  const grandTotal = Number(existing.grandTotal);

  const invoice = await prisma.$transaction(async (tx) => {
    await tx.invoicePayment.deleteMany({ where: { invoiceId: id } });

    await tx.invoice.update({
      where: { id },
      data: {
        customerId: payload.customerId,
        paymentMethod: payload.paymentMethod,
        poNo: payload.poNo !== undefined ? optionalTextField(payload.poNo) : existing.poNo,
        sofNo: payload.sofNo !== undefined ? optionalTextField(payload.sofNo) : existing.sofNo,
        creditStatus: isCredit
          ? (wasPaidCredit ? 'PAID' : 'OUTSTANDING')
          : null,
        dueDate,
        payments: paymentCreateForUpdate({
          isCredit,
          wasPaidCredit,
          grandTotal,
          paymentMethod: payload.paymentMethod,
          existingPayments: existing.payments,
          userId,
        }),
      },
    });

    if (zeroValueItems.length) {
      await addZeroValueProductLines(tx, {
        invoiceId: id,
        invoiceNumber: existing.invoiceNumber,
        items: zeroValueItems,
        userId,
      });
    }

    const updated = await tx.invoice.findUnique({
      where: { id },
      include: invoiceInclude,
    });

    const activityDetail = zeroValueItems.length
      ? `Customer/payment updated; ${zeroValueItems.length} product line(s) added — ${customer.name}`
      : `Customer/payment updated — ${customer.name}`;

    await tx.activity.create({
      data: {
        type: 'invoice',
        title: `Invoice ${existing.invoiceNumber} updated`,
        description: activityDetail,
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
    include: {
      items: {
        include: {
          productUnit: true,
          units: { include: { productUnit: true } },
        },
      },
    },
  });
  if (!invoice) throw ApiError.notFound('Invoice not found');
  if (invoice.status === 'CANCELLED') throw ApiError.conflict('Invoice already cancelled');

  return prisma.$transaction(async (tx) => {
    for (const item of invoice.items) {
      if (item.itemType === 'SERVICE') continue;

      const unitIds = itemUnitIds(item);
      for (const productUnitId of unitIds) {
        const linked = (item.units || []).find((u) => u.productUnitId === productUnitId);
        const productId = linked?.productUnit?.productId || item.productId;
        await tx.productUnit.update({
          where: { id: productUnitId },
          data: { status: 'IN_STOCK' },
        });
        await tx.stockMovement.create({
          data: {
            productId,
            productUnitId,
            type: 'RETURN',
            quantity: 1,
            reference: `Cancel ${invoice.invoiceNumber}`,
            userId,
          },
        });
      }
    }

    const updated = await tx.invoice.update({
      where: { id },
      data: { status: 'CANCELLED', creditStatus: null },
      include: invoiceInclude,
    });

    return serializeInvoice(updated);
  });
}
