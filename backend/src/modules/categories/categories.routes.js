import { Router } from 'express';
import { authMiddleware, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createCategorySchema, updateCategorySchema } from './categories.validators.js';
import * as controller from './categories.controller.js';

const router = Router();

router.use(authMiddleware);

// Read is allowed to anyone who can view products (needed in product forms).
router.get('/', requirePermission('products.view'), controller.list);
router.post('/', requirePermission('categories.manage'), validate(createCategorySchema), controller.create);
router.patch('/:id', requirePermission('categories.manage'), validate(updateCategorySchema), controller.update);
router.delete('/:id', requirePermission('categories.manage'), controller.remove);

export default router;
