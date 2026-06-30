import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './reports.service.js';
import { ApiError } from '../../utils/ApiError.js';

export const sales = asyncHandler(async (req, res) => {
  const data = await service.salesReport(req.query.period || 'daily');
  res.json({ data, error: null });
});

export const stock = asyncHandler(async (req, res) => {
  const data = await service.stockReport();
  res.json({ data, error: null });
});

export const purchase = asyncHandler(async (_req, res) => {
  const data = await service.purchaseReport();
  res.json({ data, error: null });
});

export const grn = asyncHandler(async (_req, res) => {
  const data = await service.grnReport();
  res.json({ data, error: null });
});

export const debtors = asyncHandler(async (_req, res) => {
  const data = await service.debtorsReport();
  res.json({ data, error: null });
});

export const exportCsv = asyncHandler(async (req, res) => {
  const result = await service.exportCsv(req.params.type, req.query.period || 'daily');
  if (!result) throw ApiError.notFound('Unknown export type');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.send(result.content);
});
