import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { parsePagination, listResult } from '../../utils/pagination.js';
import { toCsv } from '../../utils/csv.js';
import {
  generateInventoryCode,
  mapProductResponse,
  PRODUCT_EXPORT_COLUMNS,
  normalizeImportRow,
} from './products.utils.js';
import {
  getProductStockMap,
  getProductUnitBarcodesMap,
  formatUnitBarcodes,
  assertActiveCategory,
  assertActiveSupplier,
  stripReadOnlyProductFields,
} from './products.stock.js';

const includeRelations = {
  category: { select: { id: true, name: true, isActive: true } },
  supplier: { select: { id: true, name: true, code: true, phone: true, email: true, address: true, city: true, isActive: true } },
  _count: { select: { units: { where: { status: 'IN_STOCK' } } } },
};

async function getMaxVatRate() {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  return Number(settings?.vatRate ?? 100);
}

async function getStockMap(productIds) {
  return getProductStockMap(productIds);
}

function normalize(data) {
  const out = stripReadOnlyProductFields({ ...data });
  if (out.description === '') out.description = null;
  if (out.brand === '') out.brand = null;
  if (out.barcode === '') out.barcode = null;
  return out;
}

function buildWhere(query) {
  const where = {};

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { code: { contains: query.search, mode: 'insensitive' } },
      { barcode: { contains: query.search, mode: 'insensitive' } },
      { brand: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
      { units: { some: { barcode: { contains: query.search, mode: 'insensitive' } } } },
    ];
  }
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.brand) where.brand = { equals: query.brand, mode: 'insensitive' };
  if (query.supplierId) where.supplierId = query.supplierId;
  if (query.company) where.company = query.company;
  if (query.isActive === 'true') where.isActive = true;
  if (query.isActive === 'false') where.isActive = false;

  const priceField = query.priceField === 'purchase' ? 'purchasePrice' : 'defaultSellingPrice';
  if (query.minPrice != null || query.maxPrice != null) {
    where[priceField] = {};
    if (query.minPrice != null) where[priceField].gte = query.minPrice;
    if (query.maxPrice != null) where[priceField].lte = query.maxPrice;
  }

  if (query.stockAvailability === 'in_stock') {
    where.units = { some: { status: 'IN_STOCK' } };
  } else if (query.stockAvailability === 'out_of_stock') {
    where.NOT = { units: { some: { status: 'IN_STOCK' } } };
  }

  return where;
}

function enrichProduct(product, stockOrMap, unitBarcodesMap) {
  const currentStock = typeof stockOrMap === 'number'
    ? stockOrMap
    : (stockOrMap?.get?.(product.id) ?? product._count?.units ?? 0);
  const mapped = mapProductResponse(product, currentStock);
  if (!mapped.barcode?.trim()) {
    const unitBarcodes = unitBarcodesMap?.get?.(product.id) ?? [];
    mapped.barcode = formatUnitBarcodes(unitBarcodes);
  }
  return mapped;
}

async function enrichSingleProduct(product) {
  const [stockMap, unitBarcodesMap] = await Promise.all([
    getStockMap([product.id]),
    getProductUnitBarcodesMap([product.id]),
  ]);
  return enrichProduct(product, stockMap, unitBarcodesMap);
}

function sortProducts(items, sortBy = 'createdAt', sortOrder = 'desc') {
  const dir = sortOrder === 'asc' ? 1 : -1;
  const key = sortBy === 'sellingPrice' ? 'defaultSellingPrice' : sortBy;

  return [...items].sort((a, b) => {
    let av = a[key];
    let bv = b[key];
    if (key === 'currentStock' || key === 'purchasePrice' || key === 'defaultSellingPrice') {
      av = Number(av);
      bv = Number(bv);
    }
    if (av == null) av = '';
    if (bv == null) bv = '';
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

async function resolveCategoryIdForImport(name, tx = prisma) {
  if (!name) throw new Error('Category is required');
  const existing = await tx.category.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  });
  if (!existing) throw new Error(`Category not found: ${name}`);
  if (!existing.isActive) throw new Error(`Category is inactive: ${name}`);
  return existing.id;
}

async function resolveSupplierIdForImport(name, tx = prisma) {
  if (!name) throw new Error('Supplier is required');
  const existing = await tx.supplier.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  });
  if (!existing) throw new Error(`Supplier not found: ${name}`);
  if (!existing.isActive) throw new Error(`Supplier is inactive: ${name}`);
  return existing.id;
}

async function assertBarcodeUnique(barcode, excludeId) {
  if (!barcode) return;
  const existing = await prisma.product.findFirst({
    where: { barcode, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
  });
  if (existing) throw ApiError.conflict('Barcode already exists');
}

async function assertCodeUnique(code, excludeId) {
  if (!code) return;
  const existing = await prisma.product.findFirst({
    where: { code, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
  });
  if (existing) throw ApiError.conflict('Product code already exists');
}

export async function listProducts(query) {
  const { skip, take, page, pageSize } = parsePagination(query);
  const where = buildWhere(query);
  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder || 'desc';
  const needsStockSort = sortBy === 'currentStock';
  const needsLowStockFilter = query.stockAvailability === 'low_stock';

  if (needsStockSort || needsLowStockFilter) {
    const all = await prisma.product.findMany({ where, include: includeRelations });
    const productIds = all.map((p) => p.id);
    const [stockMap, unitBarcodesMap] = await Promise.all([
      getStockMap(productIds),
      getProductUnitBarcodesMap(productIds),
    ]);
    let items = all.map((p) => enrichProduct(p, stockMap, unitBarcodesMap));

    if (needsLowStockFilter) {
      items = items.filter((p) => p.currentStock > 0 && p.currentStock <= p.reorderLevel);
    }

    items = sortProducts(items, sortBy, sortOrder);
    const total = items.length;
    const paged = items.slice(skip, skip + take);
    return listResult(paged, total, { page, pageSize });
  }

  const orderBy = { [sortBy === 'sellingPrice' ? 'defaultSellingPrice' : sortBy]: sortOrder };
  const [rows, total] = await Promise.all([
    prisma.product.findMany({ where, include: includeRelations, orderBy, skip, take }),
    prisma.product.count({ where }),
  ]);

  const productIds = rows.map((p) => p.id);
  const [stockMap, unitBarcodesMap] = await Promise.all([
    getStockMap(productIds),
    getProductUnitBarcodesMap(productIds),
  ]);
  const items = rows.map((p) => enrichProduct(p, stockMap, unitBarcodesMap));
  return listResult(items, total, { page, pageSize });
}

export async function getProduct(id) {
  const product = await prisma.product.findUnique({ where: { id }, include: includeRelations });
  if (!product) throw ApiError.notFound('Product not found');
  return enrichSingleProduct(product);
}

/** Lookup active product by master barcode or product code (GRN scan). */
export async function lookupProductByBarcode(barcode) {
  const trimmed = String(barcode || '').trim();
  if (!trimmed) throw ApiError.badRequest('Barcode is required');

  const existingUnit = await prisma.productUnit.findUnique({
    where: { barcode: trimmed },
    select: { id: true, status: true, product: { select: { code: true, name: true } } },
  });
  if (existingUnit) {
    throw ApiError.conflict(
      `Barcode already assigned to unit (${existingUnit.product.code}) — status: ${existingUnit.status}`
    );
  }

  const product = await prisma.product.findFirst({
    where: {
      isActive: true,
      OR: [
        { barcode: { equals: trimmed, mode: 'insensitive' } },
        { code: { equals: trimmed, mode: 'insensitive' } },
      ],
    },
    include: includeRelations,
  });
  if (!product) throw ApiError.notFound(`No active product found for barcode: ${trimmed}`);

  return enrichSingleProduct(product);
}

export async function createProduct(data) {
  const payload = normalize(data);
  const maxVat = await getMaxVatRate();
  if (payload.vatPercentage > maxVat) {
    throw ApiError.badRequest(`VAT cannot exceed ${maxVat}%`);
  }
  if (payload.defaultSellingPrice < payload.purchasePrice) {
    throw ApiError.badRequest('Selling price must be greater than or equal to purchase price');
  }

  return prisma.$transaction(async (tx) => {
    await assertActiveCategory(payload.categoryId, tx);
    await assertActiveSupplier(payload.supplierId, tx);
    const code = payload.code || (await generateInventoryCode(tx, payload.categoryId));
    await assertCodeUnique(code);
    await assertBarcodeUnique(payload.barcode);

    const product = await tx.product.create({
      data: { ...payload, code },
      include: includeRelations,
    });
    return enrichProduct(product, 0);
  });
}

export async function updateProduct(id, data) {
  const existing = await getProduct(id);
  const payload = normalize(data);
  const merged = {
    purchasePrice: payload.purchasePrice ?? existing.purchasePrice,
    defaultSellingPrice: payload.defaultSellingPrice ?? existing.sellingPrice,
    vatPercentage: payload.vatPercentage ?? existing.vatPercentage,
    categoryId: payload.categoryId ?? existing.categoryId,
    supplierId: payload.supplierId ?? existing.supplierId,
  };

  const maxVat = await getMaxVatRate();
  if (merged.vatPercentage > maxVat) {
    throw ApiError.badRequest(`VAT cannot exceed ${maxVat}%`);
  }
  if (merged.defaultSellingPrice < merged.purchasePrice) {
    throw ApiError.badRequest('Selling price must be greater than or equal to purchase price');
  }

  if (payload.code && payload.code !== existing.code) await assertCodeUnique(payload.code, id);
  if (payload.barcode) await assertBarcodeUnique(payload.barcode, id);
  if (payload.categoryId) await assertActiveCategory(payload.categoryId);
  if (payload.supplierId) await assertActiveSupplier(payload.supplierId);

  const product = await prisma.product.update({
    where: { id },
    data: payload,
    include: includeRelations,
  });
  return enrichSingleProduct(product);
}

export async function deleteProduct(id) {
  await getProduct(id);
  const product = await prisma.product.update({
    where: { id },
    data: { isActive: false },
    include: includeRelations,
  });
  return enrichSingleProduct(product);
}

export async function updateProductStatus(id, isActive) {
  await getProduct(id);
  const product = await prisma.product.update({
    where: { id },
    data: { isActive },
    include: includeRelations,
  });
  return enrichSingleProduct(product);
}

export async function duplicateProduct(id) {
  const source = await getProduct(id);
  return prisma.$transaction(async (tx) => {
    const code = await generateInventoryCode(tx, source.categoryId);
    let barcode = source.barcode ? `${source.barcode}-COPY` : null;
    if (barcode) {
      const clash = await tx.product.findFirst({ where: { barcode } });
      if (clash) barcode = null;
    }

    const product = await tx.product.create({
      data: {
        code,
        barcode,
        name: `${source.name} (Copy)`,
        description: source.description,
        brand: source.brand,
        categoryId: source.categoryId,
        company: source.company,
        purchasePrice: source.purchasePrice,
        defaultSellingPrice: source.sellingPrice,
        vatPercentage: source.vatPercentage,
        reorderLevel: source.reorderLevel,
        supplierId: source.supplierId,
        isActive: true,
      },
      include: includeRelations,
    });
    return enrichProduct(product, 0);
  });
}

export async function importProducts(rows) {
  const maxVat = await getMaxVatRate();
  const summary = { created: 0, failed: 0, errors: [] };

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < rows.length; i += 1) {
      const rowNum = i + 1;
      try {
        const normalized = normalizeImportRow(rows[i]);
        if (!normalized.name) {
          throw new Error('Product name is required');
        }
        if (!normalized.categoryName) {
          throw new Error('Category is required');
        }
        if (!normalized.supplierName) {
          throw new Error('Supplier is required');
        }

        const purchasePrice = Number(normalized.purchasePrice) || 0;
        const sellingPrice = Number(normalized.defaultSellingPrice) || 0;
        const vatPercentage = Number(normalized.vatPercentage) || 0;

        if (sellingPrice < purchasePrice) {
          throw new Error('Selling price must be >= purchase price');
        }
        if (vatPercentage > maxVat) {
          throw new Error(`VAT cannot exceed ${maxVat}%`);
        }

        const categoryId = await resolveCategoryIdForImport(normalized.categoryName, tx);
        const supplierId = await resolveSupplierIdForImport(normalized.supplierName, tx);
        const code = normalized.code || (await generateInventoryCode(tx, categoryId));
        if (normalized.code) {
          const codeClash = await tx.product.findFirst({ where: { code: normalized.code } });
          if (codeClash) throw new Error(`Duplicate product code: ${normalized.code}`);
        }
        if (normalized.barcode) {
          const barcodeClash = await tx.product.findFirst({ where: { barcode: normalized.barcode } });
          if (barcodeClash) throw new Error(`Duplicate barcode: ${normalized.barcode}`);
        }

        await tx.product.create({
          data: {
            code,
            barcode: normalized.barcode,
            name: normalized.name,
            description: normalized.description,
            brand: normalized.brand,
            categoryId,
            supplierId,
            purchasePrice,
            defaultSellingPrice: sellingPrice,
            vatPercentage,
            reorderLevel: Number.parseInt(normalized.reorderLevel, 10) || 10,
            isActive: normalized.isActive,
          },
        });
        summary.created += 1;
      } catch (err) {
        summary.failed += 1;
        summary.errors.push({ row: rowNum, message: err.message || 'Import failed' });
      }
    }
  });

  return summary;
}

export async function exportProducts(query) {
  const result = await listProducts({ ...query, page: 1, pageSize: 10000 });
  const format = query.format || 'csv';

  if (format === 'json') {
    return { contentType: 'application/json', body: JSON.stringify(result.items, null, 2), filename: 'products.json' };
  }

  const csv = toCsv(result.items, PRODUCT_EXPORT_COLUMNS);
  return { contentType: 'text/csv; charset=utf-8', body: `\uFEFF${csv}`, filename: 'products.csv' };
}

export async function listBrands() {
  const rows = await prisma.product.findMany({
    where: { brand: { not: null } },
    select: { brand: true },
    distinct: ['brand'],
    orderBy: { brand: 'asc' },
  });
  return rows.map((r) => r.brand).filter(Boolean);
}

export async function getMaxVatForValidation() {
  return getMaxVatRate();
}

export async function getProductSupplierHistory(id) {
  const product = await getProduct(id);

  const [purchaseInvoices, grns, sales, movements] = await Promise.all([
    prisma.purchaseInvoiceItem.findMany({
      where: { productId: id },
      include: {
        purchaseInvoice: {
          select: {
            id: true,
            supplierInvoiceNo: true,
            createdAt: true,
            total: true,
            supplier: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { purchaseInvoice: { createdAt: 'desc' } },
      take: 50,
    }),
    prisma.grnItem.findMany({
      where: { productId: id },
      include: {
        grn: {
          select: {
            id: true,
            grnNumber: true,
            status: true,
            createdAt: true,
            supplier: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { grn: { createdAt: 'desc' } },
      take: 50,
    }),
    prisma.invoiceItem.findMany({
      where: { productId: id },
      include: {
        invoice: {
          select: { id: true, invoiceNumber: true, createdAt: true, grandTotal: true },
        },
      },
      orderBy: { invoice: { createdAt: 'desc' } },
      take: 50,
    }),
    prisma.stockMovement.findMany({
      where: { productId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { name: true } } },
    }),
  ]);

  return {
    product: { id: product.id, name: product.name, code: product.code, supplier: product.supplier },
    currentStock: product.currentStock,
    purchaseInvoices: purchaseInvoices.map((row) => ({
      type: 'PURCHASE_INVOICE',
      reference: row.purchaseInvoice.supplierInvoiceNo,
      supplier: row.purchaseInvoice.supplier?.name,
      quantity: row.units,
      unitPrice: Number(row.unitPrice),
      date: row.purchaseInvoice.createdAt,
      stockEffect: '+',
    })),
    grns: grns.map((row) => ({
      type: 'GRN',
      reference: row.grn.grnNumber,
      supplier: row.grn.supplier?.name,
      quantity: row.units,
      status: row.grn.status,
      date: row.grn.createdAt,
      stockEffect: '+',
    })),
    sales: sales.map((row) => ({
      type: 'SALE',
      reference: row.invoice.invoiceNumber,
      quantity: 1,
      unitPrice: Number(row.unitPrice),
      date: row.invoice.createdAt,
      stockEffect: '-',
    })),
    movements,
  };
}
