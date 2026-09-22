import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { parsePagination, listResult } from '../../utils/pagination.js';
import { nextSofNumber, nextEstimateNumber, peekSofNumber, peekEstimateNumber } from '../../utils/documentNumbers.js';

const customerSelect = { id: true, salutation: true, name: true, mobile: true, address: true };
const userSelect = { id: true, name: true };

function serializeEstimate(item) {
  const lines = Array.isArray(item.lines) ? item.lines : [];
  return {
    ...item,
    amount: Number(item.amount ?? 0),
    vatRate: Number(item.vatRate ?? 0),
    lines,
  };
}

async function assertCustomer(customerId) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
  if (!customer) throw ApiError.notFound('Customer not found');
}

export async function listServiceOrders(query) {
  const { skip, take, page, pageSize } = parsePagination(query);
  const where = {};
  if (query.search) {
    where.OR = [
      { sofNumber: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
      { createdPerson: { contains: query.search, mode: 'insensitive' } },
      { billingDocNumber: { contains: query.search, mode: 'insensitive' } },
      { customer: { name: { contains: query.search, mode: 'insensitive' } } },
    ];
  }
  if (query.status) where.status = query.status;
  if (query.customerId) where.customerId = query.customerId;

  const [items, total] = await Promise.all([
    prisma.serviceOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: { customer: { select: customerSelect }, createdBy: { select: userSelect } },
    }),
    prisma.serviceOrder.count({ where }),
  ]);

  return listResult(await attachInvoiceInfo(items), total, { page, pageSize });
}

function mergeSofBilling(item, autoInvoiceNumbers) {
  if (autoInvoiceNumbers.length > 0) {
    return {
      ...item,
      invoiced: true,
      billingSource: 'auto',
      invoiceNumber: autoInvoiceNumbers[0] || null,
      invoiceNumbers: autoInvoiceNumbers,
    };
  }

  const type = item.billingDocType === 'INVOICE' || item.billingDocType === 'DN'
    ? item.billingDocType
    : 'NONE';
  const number = String(item.billingDocNumber || '').trim() || null;
  return {
    ...item,
    invoiced: type !== 'NONE',
    billingSource: type === 'NONE' ? 'none' : 'manual',
    invoiceNumber: number,
    invoiceNumbers: number ? [number] : [],
  };
}

async function attachInvoiceInfo(items) {
  if (!items.length) return items;
  const numbers = [...new Set(items.map((item) => String(item.sofNumber || '').trim()).filter(Boolean))];
  if (!numbers.length) {
    return items.map((item) => mergeSofBilling(item, []));
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      status: { not: 'CANCELLED' },
      OR: numbers.map((sofNumber) => ({ sofNo: { equals: sofNumber, mode: 'insensitive' } })),
    },
    select: { sofNo: true, invoiceNumber: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  const bySof = new Map();
  invoices.forEach((invoice) => {
    const key = String(invoice.sofNo || '').trim().toLowerCase();
    if (!key) return;
    const list = bySof.get(key) || [];
    list.push(invoice.invoiceNumber);
    bySof.set(key, list);
  });

  return items.map((item) => {
    const invoiceNumbers = bySof.get(String(item.sofNumber || '').trim().toLowerCase()) || [];
    return mergeSofBilling(item, invoiceNumbers);
  });
}

export async function getServiceOrder(id) {
  const item = await prisma.serviceOrder.findUnique({
    where: { id },
    include: { customer: { select: customerSelect }, createdBy: { select: userSelect } },
  });
  if (!item) throw ApiError.notFound('Service order not found');
  return item;
}

export async function getServiceOrderByNumber(sofNumber) {
  const raw = String(sofNumber || '').trim();
  if (!raw) throw ApiError.badRequest('SOF number is required');

  const include = { customer: { select: customerSelect }, createdBy: { select: userSelect } };
  const exact = await prisma.serviceOrder.findUnique({
    where: { sofNumber: raw },
    include,
  });
  if (exact) return withSofMachine(exact);

  const match = await prisma.serviceOrder.findFirst({
    where: { sofNumber: { equals: raw, mode: 'insensitive' } },
    include,
  });
  if (match) return withSofMachine(match);

  throw ApiError.notFound('Service order not found');
}

function parseMachineFromSofLines(lines) {
  const descriptions = (Array.isArray(lines) ? lines : [])
    .map((line) => String(line?.description || '').trim())
    .filter(Boolean);
  if (!descriptions.length) return { machineModel: null, serialNo: null };

  const first = descriptions[0];
  const serialMatch = first.match(/(?:^|[\s,;/|(])(?:s\/?n|serial(?:\s*no\.?| number)?)[:\s#-]+([A-Za-z0-9][A-Za-z0-9\-_/]*)/i);
  if (serialMatch) {
    const serialNo = serialMatch[1].trim() || null;
    const machineModel = first
      .replace(/(?:^|[\s,;/|(])(?:s\/?n|serial(?:\s*no\.?| number)?)[:\s#-]+[A-Za-z0-9][A-Za-z0-9\-_/]*/i, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{2,}/g, '\n')
      .trim() || null;
    return { machineModel, serialNo };
  }

  const firstLines = first.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (firstLines.length >= 2) {
    return { machineModel: firstLines[0], serialNo: firstLines.slice(1).join(' ') };
  }
  return { machineModel: firstLines[0] || null, serialNo: null };
}

function withSofMachine(item) {
  return { ...item, ...parseMachineFromSofLines(item.lines) };
}

function parseJobDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeLines(lines) {
  if (!Array.isArray(lines)) return [];
  return lines
    .map((line) => ({
      categoryId: line.categoryId || null,
      item: line.item || null,
      description: line.description || null,
      qty: line.qty == null || line.qty === '' ? null : Number(line.qty),
      fault: line.fault || null,
    }))
    .filter((line) => line.item || line.description || line.qty || line.fault);
}

function summaryFromLines(lines, fallback) {
  if (fallback) return fallback;
  const first = (lines || []).find((line) => line.item || line.description || line.fault);
  if (!first) return null;
  return [first.item, first.description, first.fault].filter(Boolean).join(' — ');
}

export async function peekNextSofNumber() {
  return { sofNumber: await peekSofNumber() };
}

export async function createServiceOrder(data, userId) {
  await assertCustomer(data.customerId);
  const sofNumber = await nextSofNumber();
  const lines = normalizeLines(data.lines);
  return prisma.serviceOrder.create({
    data: {
      sofNumber,
      customerId: data.customerId,
      jobDate: parseJobDate(data.jobDate) || new Date(),
      shipTo: data.shipTo ?? null,
      technician: data.technician ?? null,
      createdPerson: data.createdPerson ?? null,
      jobStatus: data.jobStatus ?? null,
      receivedBy: data.receivedBy ?? null,
      customerSignature: data.customerSignature ?? null,
      lines,
      description: summaryFromLines(lines, data.description ?? null),
      notes: data.notes ?? null,
      status: data.status || 'OPEN',
      createdById: userId || null,
    },
    include: { customer: { select: customerSelect }, createdBy: { select: userSelect } },
  });
}

export async function updateServiceOrder(id, data) {
  const existing = await getServiceOrder(id);
  if (data.customerId) await assertCustomer(data.customerId);
  const wantsBillingChange = data.billingDocType !== undefined || data.billingDocNumber !== undefined;
  if (wantsBillingChange) {
    const [enriched] = await attachInvoiceInfo([existing]);
    const alreadySaved = Boolean(String(existing.billingDocNumber || '').trim());
    if (enriched.billingSource === 'auto' || alreadySaved) {
      throw ApiError.badRequest('Invoiced document cannot be changed after it is saved');
    }
  }
  const lines = data.lines !== undefined ? normalizeLines(data.lines) : undefined;
  const billingDocType = data.billingDocType;
  const billingDocNumber = billingDocType === 'NONE' ? null : data.billingDocNumber;
  const updated = await prisma.serviceOrder.update({
    where: { id },
    data: {
      ...(data.customerId ? { customerId: data.customerId } : {}),
      ...(data.jobDate !== undefined ? { jobDate: parseJobDate(data.jobDate) } : {}),
      ...(data.shipTo !== undefined ? { shipTo: data.shipTo } : {}),
      ...(data.technician !== undefined ? { technician: data.technician } : {}),
      ...(data.createdPerson !== undefined ? { createdPerson: data.createdPerson } : {}),
      ...(data.jobStatus !== undefined ? { jobStatus: data.jobStatus } : {}),
      ...(data.receivedBy !== undefined ? { receivedBy: data.receivedBy } : {}),
      ...(data.customerSignature !== undefined ? { customerSignature: data.customerSignature } : {}),
      ...(lines ? { lines, description: summaryFromLines(lines, data.description ?? null) } : {}),
      ...(data.description !== undefined && !lines ? { description: data.description } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(billingDocType !== undefined ? { billingDocType } : {}),
      ...(billingDocType === 'NONE' || data.billingDocNumber !== undefined ? { billingDocNumber } : {}),
    },
    include: { customer: { select: customerSelect }, createdBy: { select: userSelect } },
  });
  return (await attachInvoiceInfo([updated]))[0];
}

function normalizeEstimateLines(lines) {
  if (!Array.isArray(lines)) return [];
  return lines
    .map((line) => {
      const qty = line.qty == null || line.qty === '' ? null : Number(line.qty);
      const rate = line.rate == null || line.rate === '' ? null : Number(line.rate);
      const amount = (qty != null && rate != null) ? Math.round(qty * rate * 100) / 100 : (line.amount == null || line.amount === '' ? null : Number(line.amount));
      return {
        description: line.description || null,
        qty: Number.isFinite(qty) ? qty : null,
        rate: Number.isFinite(rate) ? rate : null,
        amount: Number.isFinite(amount) ? amount : null,
      };
    })
    .filter((line) => line.description || line.qty || line.rate || line.amount);
}

function resolveEstimateCompany(value) {
  return value === 'ACTIVE24' ? 'ACTIVE24' : 'GENIUS';
}

function vatFromCompany(company) {
  if (company === 'GENIUS') return { vatEnabled: true, vatRate: 18 };
  return { vatEnabled: false, vatRate: 0 };
}

function estimateTotals(lines, vatEnabled, vatRate) {
  const subTotal = (lines || []).reduce((sum, line) => sum + Number(line.amount || 0), 0);
  const rate = vatEnabled ? Number(vatRate) || 0 : 0;
  const vatAmount = Math.round(subTotal * rate / 100 * 100) / 100;
  return {
    subTotal: Math.round(subTotal * 100) / 100,
    vatAmount,
    total: Math.round((subTotal + vatAmount) * 100) / 100,
  };
}

export async function listEstimates(query) {
  const { skip, take, page, pageSize } = parsePagination(query);
  const where = {};
  if (query.search) {
    where.OR = [
      { estimateNumber: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
      { sofRef: { contains: query.search, mode: 'insensitive' } },
      { machineModel: { contains: query.search, mode: 'insensitive' } },
      { serialNo: { contains: query.search, mode: 'insensitive' } },
      { preparedBy: { contains: query.search, mode: 'insensitive' } },
      { customer: { name: { contains: query.search, mode: 'insensitive' } } },
    ];
  }
  if (query.status) where.status = query.status;
  if (query.customerId) where.customerId = query.customerId;

  const [items, total] = await Promise.all([
    prisma.estimate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: { customer: { select: customerSelect }, createdBy: { select: userSelect } },
    }),
    prisma.estimate.count({ where }),
  ]);

  return listResult(items.map(serializeEstimate), total, { page, pageSize });
}

export async function getEstimate(id) {
  const item = await prisma.estimate.findUnique({
    where: { id },
    include: { customer: { select: customerSelect }, createdBy: { select: userSelect } },
  });
  if (!item) throw ApiError.notFound('Estimate not found');
  return serializeEstimate(item);
}

export async function peekNextEstimateNumber(company) {
  return { estimateNumber: await peekEstimateNumber(company) };
}

export async function createEstimate(data, userId) {
  await assertCustomer(data.customerId);
  const company = resolveEstimateCompany(data.company);
  const estimateNumber = await nextEstimateNumber(company);
  const lines = normalizeEstimateLines(data.lines);
  const { vatEnabled, vatRate } = vatFromCompany(company);
  const totals = estimateTotals(lines, vatEnabled, vatRate);
  const created = await prisma.estimate.create({
    data: {
      estimateNumber,
      customerId: data.customerId,
      jobDate: parseJobDate(data.jobDate) || new Date(),
      sofRef: data.sofRef ?? null,
      machineModel: data.machineModel ?? null,
      serialNo: data.serialNo ?? null,
      company,
      lines,
      description: summaryFromLines(lines, data.description ?? null),
      notes: data.notes ?? null,
      amount: totals.total,
      vatRate,
      vatEnabled,
      preparedBy: data.preparedBy ?? null,
      customerSignature: data.customerSignature ?? null,
      status: data.status || 'OPEN',
      createdById: userId || null,
    },
    include: { customer: { select: customerSelect }, createdBy: { select: userSelect } },
  });
  return serializeEstimate(created);
}

export async function updateEstimate(id, data) {
  const existing = await getEstimate(id);
  if (data.customerId) await assertCustomer(data.customerId);
  const lines = data.lines !== undefined ? normalizeEstimateLines(data.lines) : existing.lines;
  const company = data.company !== undefined
    ? resolveEstimateCompany(data.company)
    : resolveEstimateCompany(existing.company);
  const { vatEnabled, vatRate } = vatFromCompany(company);
  const totals = estimateTotals(lines, vatEnabled, vatRate);

  const updated = await prisma.estimate.update({
    where: { id },
    data: {
      ...(data.customerId ? { customerId: data.customerId } : {}),
      ...(data.jobDate !== undefined ? { jobDate: parseJobDate(data.jobDate) } : {}),
      ...(data.sofRef !== undefined ? { sofRef: data.sofRef } : {}),
      ...(data.machineModel !== undefined ? { machineModel: data.machineModel } : {}),
      ...(data.serialNo !== undefined ? { serialNo: data.serialNo } : {}),
      company,
      ...(data.lines !== undefined ? { lines, description: summaryFromLines(lines, data.description ?? null) } : {}),
      ...(data.description !== undefined && data.lines === undefined ? { description: data.description } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      amount: totals.total,
      vatRate,
      vatEnabled,
      ...(data.preparedBy !== undefined ? { preparedBy: data.preparedBy } : {}),
      ...(data.customerSignature !== undefined ? { customerSignature: data.customerSignature } : {}),
      ...(data.status ? { status: data.status } : {}),
    },
    include: { customer: { select: customerSelect }, createdBy: { select: userSelect } },
  });
  return serializeEstimate(updated);
}
