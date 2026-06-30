import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './customers.service.js';

export const list = asyncHandler(async (req, res) => {
  const result = await service.listCustomers(req.query);
  res.json({ data: result, error: null });
});

export const getOne = asyncHandler(async (req, res) => {
  const customer = await service.getCustomer(req.params.id);
  res.json({ data: customer, error: null });
});

export const create = asyncHandler(async (req, res) => {
  const customer = await service.createCustomer(req.body);
  res.status(201).json({ data: customer, error: null });
});

export const update = asyncHandler(async (req, res) => {
  const customer = await service.updateCustomer(req.params.id, req.body);
  res.json({ data: customer, error: null });
});

export const remove = asyncHandler(async (req, res) => {
  const result = await service.deleteCustomer(req.params.id);
  res.json({ data: result, error: null });
});
