import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './dashboard.service.js';

export const stats = asyncHandler(async (_req, res) => {
  const data = await service.getDashboardStats();
  res.json({ data, error: null });
});
