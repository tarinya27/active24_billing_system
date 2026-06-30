import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './grns.service.js';

export const list = asyncHandler(async (req, res) => {
  const result = await service.listGrns(req.query);
  res.json({ data: result, error: null });
});

export const getOne = asyncHandler(async (req, res) => {
  const grn = await service.getGrn(req.params.id);
  res.json({ data: grn, error: null });
});

export const complete = asyncHandler(async (req, res) => {
  const grn = await service.completeGrn(req.body, req.user.id);
  res.status(201).json({ data: grn, error: null });
});

export const cancel = asyncHandler(async (req, res) => {
  const grn = await service.cancelGrn(req.params.id, req.user.id, req.body?.reason);
  res.json({ data: grn, error: null });
});
