import { Router } from 'express';
import { authMiddleware, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createCustomerSchema, updateCustomerSchema } from './customers.validators.js';
import * as controller from './customers.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/', requirePermission('customers.view'), controller.list);
router.get('/:id', requirePermission('customers.view'), controller.getOne);
router.post('/', requirePermission('customers.create'), validate(createCustomerSchema), controller.create);
router.patch('/:id', requirePermission('customers.edit'), validate(updateCustomerSchema), controller.update);
router.delete('/:id', requirePermission('customers.delete'), controller.remove);

export default router;
