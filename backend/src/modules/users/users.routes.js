import { Router } from 'express';
import { authMiddleware, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createUserSchema, updateUserSchema } from './users.validators.js';
import * as controller from './users.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/', requirePermission('users.view_all'), controller.list);
router.get('/:id', requirePermission('users.view_all'), controller.getOne);
router.post('/', requirePermission('users.create'), validate(createUserSchema), controller.create);
router.patch('/:id', requirePermission('users.edit'), validate(updateUserSchema), controller.update);
router.delete('/:id', requirePermission('users.delete'), controller.remove);

export default router;
