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

export const syncTest = asyncHandler(async (req, res) => {
  const data = await service.testPurchaseOrderSync();
  res.json({ data, error: null });
});

export const sync = asyncHandler(async (req, res) => {
  const data = await service.syncPurchaseOrders(req.body);
  res.json({ data, error: null });
});

export const nextSerial = asyncHandler(async (req, res) => {
  const data = await service.previewNextPoSerial(req.query.company || 'ACTIVE24');
  res.json({ data, error: null });
});

export const importBackup = asyncHandler(async (req, res) => {
  const data = await service.importPurchaseOrdersFromBackup(req.body.backup, {
    company: req.body.company,
  });
  res.json({ data, error: null });
});
