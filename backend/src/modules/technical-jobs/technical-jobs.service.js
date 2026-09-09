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

  return listResult(items, total, { page, pageSize });
}

export async function getServiceOrder(id) {
  const item = await prisma.serviceOrder.findUnique({
    where: { id },
    include: { customer: { select: customerSelect }, createdBy: { select: userSelect } },
  });
  if (!item) throw ApiError.notFound('Service order not found');
  return item;
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
  await getServiceOrder(id);
  if (data.customerId) await assertCustomer(data.customerId);
  const lines = data.lines !== undefined ? normalizeLines(data.lines) : undefined;
  return prisma.serviceOrder.update({
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
    },
    include: { customer: { select: customerSelect }, createdBy: { select: userSelect } },
  });
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

export async function peekNextEstimateNumber() {
  return { estimateNumber: await peekEstimateNumber() };
}

export async function createEstimate(data, userId) {
  await assertCustomer(data.customerId);
  const estimateNumber = await nextEstimateNumber();
  const lines = normalizeEstimateLines(data.lines);
  const vatEnabled = Boolean(data.vatEnabled);
  const vatRate = vatEnabled ? Number(data.vatRate) || 0 : 0;
  const totals = estimateTotals(lines, vatEnabled, vatRate);
  const created = await prisma.estimate.create({
    data: {
      estimateNumber,
      customerId: data.customerId,
      jobDate: parseJobDate(data.jobDate) || new Date(),
      sofRef: data.sofRef ?? null,
      machineModel: data.machineModel ?? null,
      serialNo: data.serialNo ?? null,
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
  await getEstimate(id);
  if (data.customerId) await assertCustomer(data.customerId);
  const lines = data.lines !== undefined ? normalizeEstimateLines(data.lines) : undefined;
  const vatEnabled = data.vatEnabled !== undefined ? Boolean(data.vatEnabled) : undefined;
  const vatRate = data.vatRate !== undefined ? Number(data.vatRate) || 0 : undefined;
  const amount = lines
    ? estimateTotals(
      lines,
      vatEnabled ?? false,
      vatRate ?? 0
    ).total
    : data.amount;

  const updated = await prisma.estimate.update({
    where: { id },
    data: {
      ...(data.customerId ? { customerId: data.customerId } : {}),
      ...(data.jobDate !== undefined ? { jobDate: parseJobDate(data.jobDate) } : {}),
      ...(data.sofRef !== undefined ? { sofRef: data.sofRef } : {}),
      ...(data.machineModel !== undefined ? { machineModel: data.machineModel } : {}),
      ...(data.serialNo !== undefined ? { serialNo: data.serialNo } : {}),
      ...(lines ? { lines, description: summaryFromLines(lines, data.description ?? null) } : {}),
      ...(data.description !== undefined && !lines ? { description: data.description } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(amount !== undefined ? { amount } : {}),
      ...(vatRate !== undefined ? { vatRate } : {}),
      ...(vatEnabled !== undefined ? { vatEnabled } : {}),
      ...(data.preparedBy !== undefined ? { preparedBy: data.preparedBy } : {}),
      ...(data.customerSignature !== undefined ? { customerSignature: data.customerSignature } : {}),
      ...(data.status ? { status: data.status } : {}),
    },
    include: { customer: { select: customerSelect }, createdBy: { select: userSelect } },
  });
  return serializeEstimate(updated);
}
