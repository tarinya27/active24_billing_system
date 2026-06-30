import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './products.service.js';

export const list = asyncHandler(async (req, res) => {
  const result = await service.listProducts(req.query);
  res.json({ data: result, error: null });
});

export const getOne = asyncHandler(async (req, res) => {
  const product = await service.getProduct(req.params.id);
  res.json({ data: product, error: null });
});

export const create = asyncHandler(async (req, res) => {
  const product = await service.createProduct(req.body);
  res.status(201).json({ data: product, error: null });
});

export const update = asyncHandler(async (req, res) => {
  const product = await service.updateProduct(req.params.id, req.body);
  res.json({ data: product, error: null });
});

export const remove = asyncHandler(async (req, res) => {
  const product = await service.deleteProduct(req.params.id);
  res.json({ data: product, error: null });
});
