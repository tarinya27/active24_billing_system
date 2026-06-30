import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { parsePagination, listResult } from '../../utils/pagination.js';

const includeRelations = {
  category: { select: { id: true, name: true } },
  supplier: { select: { id: true, name: true, code: true } },
};

function normalize(data) {
  const out = { ...data };
  if (out.description === '') out.description = null;
  return out;
}

export async function listProducts(query) {
  const { skip, take, page, pageSize } = parsePagination(query);
  const where = {};

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { code: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.company) where.company = query.company;
  if (query.isActive === 'true') where.isActive = true;
  if (query.isActive === 'false') where.isActive = false;

  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, include: includeRelations, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.product.count({ where }),
  ]);

  return listResult(items, total, { page, pageSize });
}

export async function getProduct(id) {
  const product = await prisma.product.findUnique({ where: { id }, include: includeRelations });
  if (!product) throw ApiError.notFound('Product not found');
  return product;
}

export async function createProduct(data) {
  return prisma.product.create({ data: normalize(data), include: includeRelations });
}

export async function updateProduct(id, data) {
  await getProduct(id);
  return prisma.product.update({ where: { id }, data: normalize(data), include: includeRelations });
}

// Products are referenced by serialized units/invoices, so "delete" deactivates the catalog entry.
export async function deleteProduct(id) {
  await getProduct(id);
  return prisma.product.update({ where: { id }, data: { isActive: false }, include: includeRelations });
}
