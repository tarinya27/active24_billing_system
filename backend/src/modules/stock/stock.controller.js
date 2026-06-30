import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './stock.service.js';

export const summary = asyncHandler(async (req, res) => {
  const items = await service.listStockSummary(req.query);
  res.json({ data: items, error: null });
});

export const listUnits = asyncHandler(async (req, res) => {
  const result = await service.listUnits(req.query);
  res.json({ data: result, error: null });
});

export const lookup = asyncHandler(async (req, res) => {
  const unit = await service.lookupUnitByBarcode(req.params.barcode);
  res.json({ data: unit, error: null });
});

export const movements = asyncHandler(async (req, res) => {
  const result = await service.listMovements(req.query);
  res.json({ data: result, error: null });
});

export const adjust = asyncHandler(async (req, res) => {
  const unit = await service.adjustUnit(req.body.productUnitId, req.user.id, req.body.reason);
  res.json({ data: unit, error: null });
});
