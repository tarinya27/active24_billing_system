import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { parsePagination, listResult } from '../../utils/pagination.js';

function normalize(data) {
  const out = { ...data };
  for (const key of ['mobile', 'address', 'email']) {
    if (out[key] === '') out[key] = null;
  }
  return out;
}

export async function listCustomers(query) {
  const { skip, take, page, pageSize } = parsePagination(query);
  const where = {};

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { mobile: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.type) where.type = query.type;

  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: { _count: { select: { invoices: true } } },
    }),
    prisma.customer.count({ where }),
  ]);

  return listResult(items, total, { page, pageSize });
}

export async function getCustomer(id) {
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) throw ApiError.notFound('Customer not found');
  return customer;
}

export async function createCustomer(data) {
  return prisma.customer.create({ data: normalize(data) });
}

export async function updateCustomer(id, data) {
  await getCustomer(id);
  return prisma.customer.update({ where: { id }, data: normalize(data) });
}

export async function deleteCustomer(id) {
  await getCustomer(id);
  // P2003 (referenced by invoices) is mapped to a friendly 409 by the error handler.
  await prisma.customer.delete({ where: { id } });
  return { id };
}
