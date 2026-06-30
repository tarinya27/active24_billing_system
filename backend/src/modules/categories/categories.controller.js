import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './categories.service.js';

export const list = asyncHandler(async (req, res) => {
  const items = await service.listCategories(req.query);
  res.json({ data: items, error: null });
});

export const create = asyncHandler(async (req, res) => {
  const category = await service.createCategory(req.body);
  res.status(201).json({ data: category, error: null });
});

export const update = asyncHandler(async (req, res) => {
  const category = await service.updateCategory(req.params.id, req.body);
  res.json({ data: category, error: null });
});

export const remove = asyncHandler(async (req, res) => {
  const result = await service.deleteCategory(req.params.id);
  res.json({ data: result, error: null });
});
