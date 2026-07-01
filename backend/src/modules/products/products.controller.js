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

export const updateStatus = asyncHandler(async (req, res) => {
  const product = await service.updateProductStatus(req.params.id, req.body.isActive);
  res.json({ data: product, error: null });
});

export const duplicate = asyncHandler(async (req, res) => {
  const product = await service.duplicateProduct(req.body.id);
  res.status(201).json({ data: product, error: null });
});

export const importProducts = asyncHandler(async (req, res) => {
  const summary = await service.importProducts(req.body.rows);
  res.json({ data: summary, error: null });
});

export const exportProducts = asyncHandler(async (req, res) => {
  const file = await service.exportProducts(req.query);
  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.send(file.body);
});

export const brands = asyncHandler(async (req, res) => {
  const items = await service.listBrands();
  res.json({ data: items, error: null });
});

export const meta = asyncHandler(async (req, res) => {
  const maxVat = await service.getMaxVatForValidation();
  res.json({ data: { maxVat }, error: null });
});

export const supplierHistory = asyncHandler(async (req, res) => {
  const history = await service.getProductSupplierHistory(req.params.id);
  res.json({ data: history, error: null });
});
