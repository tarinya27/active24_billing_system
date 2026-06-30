import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './invoices.service.js';

export const list = asyncHandler(async (req, res) => {
  const result = await service.listInvoices(req.query, req.user);
  res.json({ data: result, error: null });
});

export const get = asyncHandler(async (req, res) => {
  const invoice = await service.getInvoice(req.params.id, req.user);
  res.json({ data: invoice, error: null });
});

export const create = asyncHandler(async (req, res) => {
  const invoice = await service.createInvoice(req.body, req.user.id);
  res.status(201).json({ data: invoice, error: null });
});

export const settle = asyncHandler(async (req, res) => {
  const invoice = await service.settleCredit(req.params.id, req.body, req.user.id);
  res.json({ data: invoice, error: null });
});

export const cancel = asyncHandler(async (req, res) => {
  const invoice = await service.cancelInvoice(req.params.id, req.user.id);
  res.json({ data: invoice, error: null });
});
