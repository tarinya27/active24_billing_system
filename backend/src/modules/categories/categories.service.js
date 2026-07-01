import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

export async function listCategories(query = {}) {
  const where = {};
  if (query.search) {
    where.name = { contains: query.search, mode: 'insensitive' };
  }
  if (query.isActive === 'true') where.isActive = true;
  if (query.isActive === 'false') where.isActive = false;

  const categories = await prisma.category.findMany({
    where,
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true } } },
  });

  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    isActive: c.isActive,
    productCount: c._count.products,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    status: c.isActive ? 'Active' : 'Inactive',
  }));
}

export async function getCategory(id) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!category) throw ApiError.notFound('Category not found');
  return category;
}

export async function createCategory(data) {
  return prisma.category.create({
    data: { name: data.name.trim(), isActive: data.isActive ?? true },
  });
}

export async function updateCategory(id, data) {
  await getCategory(id);
  return prisma.category.update({
    where: { id },
    data: {
      ...(data.name != null ? { name: data.name.trim() } : {}),
      ...(data.isActive != null ? { isActive: data.isActive } : {}),
    },
  });
}

export async function updateCategoryStatus(id, isActive) {
  await getCategory(id);
  return prisma.category.update({ where: { id }, data: { isActive } });
}

export async function deleteCategory(id) {
  const existing = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!existing) throw ApiError.notFound('Category not found');
  if (existing._count.products > 0) {
    return prisma.category.update({ where: { id }, data: { isActive: false } });
  }
  await prisma.category.delete({ where: { id } });
  return { id, deleted: true };
}
