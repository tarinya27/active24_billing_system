import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './purchase-invoices.service.js';

export const list = asyncHandler(async (req, res) => {
  const result = await service.listPurchaseInvoices(req.query);
  res.json({ data: result, error: null });
});

export const getOne = asyncHandler(async (req, res) => {
  const invoice = await service.getPurchaseInvoice(req.params.id);
  res.json({ data: invoice, error: null });
});

export const tally = asyncHandler(async (req, res) => {
  const result = await service.getPurchaseInvoiceTally(req.params.id);
  res.json({ data: result, error: null });
});

export const create = asyncHandler(async (req, res) => {
  const invoice = await service.createPurchaseInvoice(req.body, req.user.id);
  res.status(201).json({ data: invoice, error: null });
});

export const update = asyncHandler(async (req, res) => {
  const invoice = await service.updatePurchaseInvoice(req.params.id, req.body);
  res.json({ data: invoice, error: null });
});

export const remove = asyncHandler(async (req, res) => {
  const result = await service.deletePurchaseInvoice(req.params.id);
  res.json({ data: result, error: null });
});
