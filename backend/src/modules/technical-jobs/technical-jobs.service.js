import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { parsePagination, listResult } from '../../utils/pagination.js';
import { nextSofNumber, nextEstimateNumber } from '../../utils/documentNumbers.js';

const customerSelect = { id: true, salutation: true, name: true, mobile: true, address: true };
const userSelect = { id: true, name: true };

function serializeEstimate(item) {
  return { ...item, amount: Number(item.amount ?? 0) };
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

export async function createServiceOrder(data, userId) {
  await assertCustomer(data.customerId);
  const sofNumber = await nextSofNumber();
  return prisma.serviceOrder.create({
    data: {
      sofNumber,
      customerId: data.customerId,
      description: data.description ?? null,
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
  return prisma.serviceOrder.update({
    where: { id },
    data: {
      ...(data.customerId ? { customerId: data.customerId } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.status ? { status: data.status } : {}),
    },
    include: { customer: { select: customerSelect }, createdBy: { select: userSelect } },
  });
}

export async function listEstimates(query) {
  const { skip, take, page, pageSize } = parsePagination(query);
  const where = {};
  if (query.search) {
    where.OR = [
      { estimateNumber: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
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

export async function createEstimate(data, userId) {
  await assertCustomer(data.customerId);
  const estimateNumber = await nextEstimateNumber();
  const created = await prisma.estimate.create({
    data: {
      estimateNumber,
      customerId: data.customerId,
      description: data.description ?? null,
      notes: data.notes ?? null,
      amount: data.amount ?? 0,
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
  const updated = await prisma.estimate.update({
    where: { id },
    data: {
      ...(data.customerId ? { customerId: data.customerId } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.amount !== undefined ? { amount: data.amount } : {}),
      ...(data.status ? { status: data.status } : {}),
    },
    include: { customer: { select: customerSelect }, createdBy: { select: userSelect } },
  });
  return serializeEstimate(updated);
}
