import { Router } from 'express';
import { authMiddleware, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createProductSchema, updateProductSchema } from './products.validators.js';
import * as controller from './products.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/', requirePermission('products.view'), controller.list);
router.get('/:id', requirePermission('products.view'), controller.getOne);
router.post('/', requirePermission('products.create'), validate(createProductSchema), controller.create);
router.patch('/:id', requirePermission('products.edit'), validate(updateProductSchema), controller.update);
router.delete('/:id', requirePermission('products.delete'), controller.remove);

export default router;
