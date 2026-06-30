import { verifyAccessToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';
import { roleHasPermission } from '../rbac/permissions.js';

// Verifies the Bearer access token and attaches req.user = { id, role, name, email }.
export function authMiddleware(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(ApiError.unauthorized('Missing or malformed Authorization header'));
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
      name: payload.name,
      email: payload.email,
    };
    return next();
  } catch {
    return next(ApiError.unauthorized('Invalid or expired access token'));
  }
}

// Guards a route by RBAC permission key (e.g. 'products.create').
export function requirePermission(permission) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    const keys = Array.isArray(permission) ? permission : [permission];
    const allowed = keys.some((key) => roleHasPermission(req.user.role, key));
    if (!allowed) {
      return next(ApiError.forbidden(`You do not have permission: ${keys.join(' or ')}`));
    }
    return next();
  };
}

// Optional convenience: guard by one or more roles directly.
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('Insufficient role'));
    }
    return next();
  };
}
