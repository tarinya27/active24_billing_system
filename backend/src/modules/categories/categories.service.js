import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import {
  normalizeCodePrefix,
  maxSequenceForPrefix,
  reassignCategoryProductCodes,
} from '../products/products.utils.js';

function mapCategory(c) {
  return {
    id: c.id,
    name: c.name,
    codePrefix: c.codePrefix || null,
    codeSequence: c.codeSequence ?? 0,
    isActive: c.isActive,
    productCount: c._count?.products ?? c.productCount ?? 0,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    status: c.isActive ? 'Active' : 'Inactive',
  };
}

async function assertPrefixUnique(prefix, excludeId) {
  if (!prefix) return;
  const existing = await prisma.category.findFirst({
    where: {
      codePrefix: prefix,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true, name: true },
  });
  if (existing) {
    throw ApiError.conflict(`Inventory code prefix "${prefix}" is already used by category "${existing.name}"`);
  }
}

async function resolveSequenceForPrefix(prefix, currentSequence = 0, tx = prisma) {
  if (!prefix) return 0;
  const maxUsed = await maxSequenceForPrefix(prefix, tx);
  return Math.max(Number(currentSequence) || 0, maxUsed);
}

export async function listCategories(query = {}) {
  const where = {};
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { codePrefix: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.isActive === 'true') where.isActive = true;
  if (query.isActive === 'false') where.isActive = false;

  const categories = await prisma.category.findMany({
    where,
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true } } },
  });

  return categories.map(mapCategory);
}

export async function getCategory(id) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!category) throw ApiError.notFound('Category not found');
  return mapCategory(category);
}

export async function createCategory(data) {
  const name = data.name.trim();
  const codePrefix = normalizeCodePrefix(data.codePrefix ?? data.inventoryCodePrefix);
  await assertPrefixUnique(codePrefix);
  const codeSequence = await resolveSequenceForPrefix(codePrefix, 0);

  const category = await prisma.category.create({
    data: {
      name,
      codePrefix,
      codeSequence,
      isActive: data.isActive ?? true,
    },
    include: { _count: { select: { products: true } } },
  });
  return mapCategory(category);
}

export async function updateCategory(id, data) {
  const existing = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!existing) throw ApiError.notFound('Category not found');

  const name = data.name != null ? data.name.trim() : undefined;
  const isActive = data.isActive != null ? data.isActive : undefined;
  const prefixProvided = data.codePrefix !== undefined || data.inventoryCodePrefix !== undefined;
  const nextPrefix = prefixProvided
    ? normalizeCodePrefix(data.codePrefix ?? data.inventoryCodePrefix)
    : undefined;

  if (nextPrefix !== undefined) {
    await assertPrefixUnique(nextPrefix, id);
  }

  const shouldReassign = nextPrefix !== undefined && Boolean(nextPrefix);

  return prisma.$transaction(async (tx) => {
    let codeSequence = existing.codeSequence ?? 0;

    if (nextPrefix !== undefined) {
      if (!nextPrefix) {
        codeSequence = 0;
      } else if (shouldReassign) {
        codeSequence = await reassignCategoryProductCodes(tx, id, nextPrefix);
      } else {
        codeSequence = await resolveSequenceForPrefix(nextPrefix, existing.codeSequence, tx);
      }
    }

    const category = await tx.category.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(nextPrefix !== undefined ? { codePrefix: nextPrefix, codeSequence } : {}),
      },
      include: { _count: { select: { products: true } } },
    });

    return mapCategory(category);
  });
}

export async function updateCategoryStatus(id, isActive) {
  await getCategory(id);
  const category = await prisma.category.update({
    where: { id },
    data: { isActive },
    include: { _count: { select: { products: true } } },
  });
  return mapCategory(category);
}

export async function deleteCategory(id) {
  const existing = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!existing) throw ApiError.notFound('Category not found');
  if (existing._count.products > 0) {
    const category = await prisma.category.update({
      where: { id },
      data: { isActive: false },
      include: { _count: { select: { products: true } } },
    });
    return mapCategory(category);
  }
  await prisma.category.delete({ where: { id } });
  return { id, deleted: true };
}
