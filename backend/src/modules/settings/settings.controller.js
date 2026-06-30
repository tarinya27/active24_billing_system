import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './settings.service.js';

export const get = asyncHandler(async (_req, res) => {
  const data = await service.getSettings();
  res.json({ data, error: null });
});

export const update = asyncHandler(async (req, res) => {
  const data = await service.updateSettings(req.body);
  res.json({ data, error: null });
});
