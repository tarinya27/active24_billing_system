import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { roleHasPermission } from '../../rbac/permissions.js';
import { parsePagination, listResult } from '../../utils/pagination.js';

const publicSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

export async function listUsers(query) {
  const { skip, take, page, pageSize } = parsePagination(query);
  const where = {};

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.role) where.role = query.role;
  if (query.isActive === 'true') where.isActive = true;
  if (query.isActive === 'false') where.isActive = false;

  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, select: publicSelect, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.user.count({ where }),
  ]);

  return listResult(items, total, { page, pageSize });
}

export async function getUser(id) {
  const user = await prisma.user.findUnique({ where: { id }, select: publicSelect });
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

export async function createUser(data) {
  const passwordHash = await bcrypt.hash(data.password, 10);
  return prisma.user.create({
    data: { name: data.name, email: data.email, role: data.role, passwordHash },
    select: publicSelect,
  });
}

export async function updateUser(id, data, actorRole) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('User not found');

  if (data.role && data.role !== existing.role && !roleHasPermission(actorRole, 'users.change_role')) {
    throw ApiError.forbidden('You do not have permission to change roles');
  }

  const update = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.email !== undefined) update.email = data.email;
  if (data.role !== undefined) update.role = data.role;
  if (data.isActive !== undefined) update.isActive = data.isActive;
  if (data.password) update.passwordHash = await bcrypt.hash(data.password, 10);

  return prisma.user.update({ where: { id }, data: update, select: publicSelect });
}

// Users are referenced by invoices/GRNs, so "delete" deactivates the account.
export async function deactivateUser(id, actorId) {
  if (id === actorId) throw ApiError.badRequest('You cannot deactivate your own account');
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('User not found');
  return prisma.user.update({ where: { id }, data: { isActive: false }, select: publicSelect });
}
