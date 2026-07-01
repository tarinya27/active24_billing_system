import { Router } from 'express';
import { authMiddleware, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createSupplierSchema, updateSupplierSchema, supplierStatusSchema } from './suppliers.validators.js';
import * as controller from './suppliers.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/', requirePermission('suppliers.view'), controller.list);
router.get('/:id', requirePermission('suppliers.view'), controller.getOne);
router.post('/', requirePermission('suppliers.create'), validate(createSupplierSchema), controller.create);
router.patch('/:id/status', requirePermission('suppliers.edit'), validate(supplierStatusSchema), controller.updateStatus);
router.patch('/:id', requirePermission('suppliers.edit'), validate(updateSupplierSchema), controller.update);
router.delete('/:id', requirePermission('suppliers.delete'), controller.remove);

export default router;
