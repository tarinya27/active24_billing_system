import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { verifyRefreshToken } from '../../utils/jwt.js';
import { env } from '../../config/env.js';
import * as authService from './auth.service.js';

const REFRESH_COOKIE = 'refreshToken';

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? 'strict' : 'lax',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
}

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { user, accessToken, refreshToken } = await authService.login(email, password);
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  res.json({ data: { user, accessToken }, error: null });
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw ApiError.unauthorized('No refresh token');

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const { user, accessToken, refreshToken } = await authService.refresh(payload.sub);
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  res.json({ data: { user, accessToken }, error: null });
});

export const logout = asyncHandler(async (_req, res) => {
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
  res.json({ data: { success: true }, error: null });
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user.id);
  res.json({ data: { user }, error: null });
});
