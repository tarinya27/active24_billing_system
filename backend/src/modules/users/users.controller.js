import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './users.service.js';

export const list = asyncHandler(async (req, res) => {
  const result = await service.listUsers(req.query);
  res.json({ data: result, error: null });
});

export const getOne = asyncHandler(async (req, res) => {
  const user = await service.getUser(req.params.id);
  res.json({ data: user, error: null });
});

export const create = asyncHandler(async (req, res) => {
  const user = await service.createUser(req.body);
  res.status(201).json({ data: user, error: null });
});

export const update = asyncHandler(async (req, res) => {
  const user = await service.updateUser(req.params.id, req.body, req.user.role);
  res.json({ data: user, error: null });
});

export const remove = asyncHandler(async (req, res) => {
  const user = await service.deactivateUser(req.params.id, req.user.id);
  res.json({ data: user, error: null });
});
