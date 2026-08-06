import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './delivery-notes.service.js';

export const list = asyncHandler(async (req, res) => {
  const result = await service.listDeliveryNotes(req.query);
  res.json({ data: result, error: null });
});

export const getOne = asyncHandler(async (req, res) => {
  const dn = await service.getDeliveryNote(req.params.id);
  res.json({ data: dn, error: null });
});

export const create = asyncHandler(async (req, res) => {
  const dn = await service.createDeliveryNote(req.body, req.user.id);
  res.status(201).json({ data: dn, error: null });
});

export const reserveBarcode = asyncHandler(async (req, res) => {
  const unit = await service.reserveDnBarcode(req.body);
  res.status(201).json({ data: unit, error: null });
});

export const removePendingUnit = asyncHandler(async (req, res) => {
  const result = await service.removePendingDnUnit(req.params.id);
  res.json({ data: result, error: null });
});

export const complete = asyncHandler(async (req, res) => {
  const dn = await service.completeDeliveryNote(req.body.deliveryNoteId, req.user.id);
  res.json({ data: dn, error: null });
});

export const update = asyncHandler(async (req, res) => {
  const dn = await service.updateDeliveryNote(req.params.id, req.body, req.user.id);
  res.json({ data: dn, error: null });
});

export const cancel = asyncHandler(async (req, res) => {
  const dn = await service.cancelDeliveryNote(req.params.id, req.user.id, req.body?.reason);
  res.json({ data: dn, error: null });
});

export const createInvoice = asyncHandler(async (req, res) => {
  const invoice = await service.createInvoiceFromDeliveryNote(req.params.id, req.body, req.user.id);
  res.status(201).json({ data: invoice, error: null });
});
