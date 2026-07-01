import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { parsePagination, listResult } from '../../utils/pagination.js';

// Empty strings -> null; turn '' code into undefined so the unique index isn't hit with ''.
function normalize(data) {
  const out = { ...data };
  for (const key of ['code', 'contactPerson', 'phone', 'email', 'address', 'city', 'vatRegistrationNo']) {
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
  if (query.isActive === 'true') where.isActive = true;
  if (query.isActive === 'false') where.isActive = false;

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
  return prisma.supplier.create({ data: { ...normalize(data), isActive: data.isActive ?? true } });
}

export async function updateSupplier(id, data) {
  await getSupplier(id);
  return prisma.supplier.update({ where: { id }, data: normalize(data) });
}

export async function updateSupplierStatus(id, isActive) {
  await getSupplier(id);
  return prisma.supplier.update({ where: { id }, data: { isActive } });
}

export async function deleteSupplier(id) {
  const existing = await prisma.supplier.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!existing) throw ApiError.notFound('Supplier not found');
  if (existing._count.products > 0) {
    return prisma.supplier.update({ where: { id }, data: { isActive: false } });
  }
  await prisma.supplier.delete({ where: { id } });
  return { id, deleted: true };
}
