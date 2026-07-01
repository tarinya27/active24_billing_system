import { Router } from 'express';
import { authMiddleware, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  buildCreateProductSchema,
  buildUpdateProductSchema,
  statusSchema,
  duplicateSchema,
  importSchema,
} from './products.validators.js';
import * as controller from './products.controller.js';
import * as service from './products.service.js';

const router = Router();

router.use(authMiddleware);

async function validateCreate(req, res, next) {
  const maxVat = await service.getMaxVatForValidation();
  return validate(buildCreateProductSchema(maxVat))(req, res, next);
}

async function validateUpdate(req, res, next) {
  const maxVat = await service.getMaxVatForValidation();
  return validate(buildUpdateProductSchema(maxVat))(req, res, next);
}

router.get('/export', requirePermission('products.view'), controller.exportProducts);
router.get('/brands', requirePermission('products.view'), controller.brands);
router.get('/meta', requirePermission('products.view'), controller.meta);
router.post('/import', requirePermission('products.create'), validate(importSchema), controller.importProducts);
router.post('/duplicate', requirePermission('products.create'), validate(duplicateSchema), controller.duplicate);

router.get('/', requirePermission('products.view'), controller.list);
router.get('/:id/supplier-history', requirePermission('products.view'), controller.supplierHistory);
router.get('/:id', requirePermission('products.view'), controller.getOne);
router.post('/', requirePermission('products.create'), validateCreate, controller.create);
router.put('/:id', requirePermission('products.edit'), validateUpdate, controller.update);
router.patch('/:id', requirePermission('products.edit'), validateUpdate, controller.update);
router.patch('/:id/status', requirePermission('products.edit'), validate(statusSchema), controller.updateStatus);
router.delete('/:id', requirePermission('products.delete'), controller.remove);

export default router;
