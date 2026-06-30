import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

export async function listCategories(query = {}) {
  const where = query.search
    ? { name: { contains: query.search, mode: 'insensitive' } }
    : {};

  const categories = await prisma.category.findMany({
    where,
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true } } },
  });

  return categories.map((c) => ({ id: c.id, name: c.name, productCount: c._count.products }));
}

export async function createCategory(data) {
  return prisma.category.create({ data });
}

export async function updateCategory(id, data) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Category not found');
  return prisma.category.update({ where: { id }, data });
}

export async function deleteCategory(id) {
  const existing = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!existing) throw ApiError.notFound('Category not found');
  if (existing._count.products > 0) {
    throw ApiError.conflict('Cannot delete a category that still has products. Reassign them first.');
  }
  await prisma.category.delete({ where: { id } });
  return { id };
}
