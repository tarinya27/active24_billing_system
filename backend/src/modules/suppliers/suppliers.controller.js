import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './suppliers.service.js';

export const list = asyncHandler(async (req, res) => {
  const result = await service.listSuppliers(req.query);
  res.json({ data: result, error: null });
});

export const getOne = asyncHandler(async (req, res) => {
  const supplier = await service.getSupplier(req.params.id);
  res.json({ data: supplier, error: null });
});

export const create = asyncHandler(async (req, res) => {
  const supplier = await service.createSupplier(req.body);
  res.status(201).json({ data: supplier, error: null });
});

export const update = asyncHandler(async (req, res) => {
  const supplier = await service.updateSupplier(req.params.id, req.body);
  res.json({ data: supplier, error: null });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const supplier = await service.updateSupplierStatus(req.params.id, req.body.isActive);
  res.json({ data: supplier, error: null });
});

export const remove = asyncHandler(async (req, res) => {
  const result = await service.deleteSupplier(req.params.id);
  res.json({ data: result, error: null });
});
