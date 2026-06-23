import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { signAccessToken, signRefreshToken } from '../../utils/jwt.js';
import { getPermissionsForRole } from '../../rbac/permissions.js';

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: getPermissionsForRole(user.role),
  };
}

function issueTokens(user) {
  const base = { sub: user.id, role: user.role, name: user.name, email: user.email };
  return {
    accessToken: signAccessToken(base),
    refreshToken: signRefreshToken({ sub: user.id }),
  };
}

export async function login(email, password) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  const tokens = issueTokens(user);
  return { user: toPublicUser(user), ...tokens };
}

export async function refresh(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Session is no longer valid');
  }
  const tokens = issueTokens(user);
  return { user: toPublicUser(user), ...tokens };
}

export async function getMe(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Session is no longer valid');
  }
  return toPublicUser(user);
}
