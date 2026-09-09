import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './technical-jobs.service.js';

export const listSof = asyncHandler(async (req, res) => {
  const result = await service.listServiceOrders(req.query);
  res.json({ data: result, error: null });
});

export const nextSof = asyncHandler(async (_req, res) => {
  const item = await service.peekNextSofNumber();
  res.json({ data: item, error: null });
});

export const getSof = asyncHandler(async (req, res) => {
  const item = await service.getServiceOrder(req.params.id);
  res.json({ data: item, error: null });
});

export const createSof = asyncHandler(async (req, res) => {
  const item = await service.createServiceOrder(req.body, req.user?.id);
  res.status(201).json({ data: item, error: null });
});

export const updateSof = asyncHandler(async (req, res) => {
  const item = await service.updateServiceOrder(req.params.id, req.body);
  res.json({ data: item, error: null });
});

export const listEstimates = asyncHandler(async (req, res) => {
  const result = await service.listEstimates(req.query);
  res.json({ data: result, error: null });
});

export const getEstimate = asyncHandler(async (req, res) => {
  const item = await service.getEstimate(req.params.id);
  res.json({ data: item, error: null });
});

export const createEstimate = asyncHandler(async (req, res) => {
  const item = await service.createEstimate(req.body, req.user?.id);
  res.status(201).json({ data: item, error: null });
});

export const updateEstimate = asyncHandler(async (req, res) => {
  const item = await service.updateEstimate(req.params.id, req.body);
  res.json({ data: item, error: null });
});
