import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './purchase-orders.service.js';

export const list = asyncHandler(async (req, res) => {
  const result = await service.listPurchaseOrders(req.query);
  res.json({ data: result, error: null });
});

export const getOne = asyncHandler(async (req, res) => {
  const po = await service.getPurchaseOrder(req.params.id);
  res.json({ data: po, error: null });
});

export const tally = asyncHandler(async (req, res) => {
  const result = await service.getPurchaseOrderTally(req.params.id);
  res.json({ data: result, error: null });
});

export const create = asyncHandler(async (req, res) => {
  const po = await service.createPurchaseOrder(req.body);
  res.status(201).json({ data: po, error: null });
});

export const update = asyncHandler(async (req, res) => {
  const po = await service.updatePurchaseOrder(req.params.id, req.body);
  res.json({ data: po, error: null });
});

export const remove = asyncHandler(async (req, res) => {
  const result = await service.deletePurchaseOrder(req.params.id);
  res.json({ data: result, error: null });
});
