import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { parsePagination, listResult } from '../../utils/pagination.js';

// Empty strings -> null; turn '' code into undefined so the unique index isn't hit with ''.
function normalize(data) {
  const out = { ...data };
  for (const key of ['code', 'contactPerson', 'phone', 'email', 'address', 'city']) {
    if (out[key] === '') out[key] = key === 'code' ? null : null;
  }
  return out;
}

export async function listSuppliers(query) {
  const { skip, take, page, pageSize } = parsePagination(query);
  const where = {};

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { code: { contains: query.search, mode: 'insensitive' } },
      { contactPerson: { contains: query.search, mode: 'insensitive' } },
      { phone: { contains: query.search, mode: 'insensitive' } },
      { city: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.company) where.company = query.company;

  const [items, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
      skip,
      take,
      include: { _count: { select: { products: true } } },
    }),
    prisma.supplier.count({ where }),
  ]);

  return listResult(items, total, { page, pageSize });
}

export async function getSupplier(id) {
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) throw ApiError.notFound('Supplier not found');
  return supplier;
}

export async function createSupplier(data) {
  return prisma.supplier.create({ data: normalize(data) });
}

export async function updateSupplier(id, data) {
  await getSupplier(id);
  return prisma.supplier.update({ where: { id }, data: normalize(data) });
}

export async function deleteSupplier(id) {
  await getSupplier(id);
  // P2003 (FK constraint) is mapped to a friendly 409 by the error handler.
  await prisma.supplier.delete({ where: { id } });
  return { id };
}
