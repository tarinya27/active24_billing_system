import { Router } from 'express';
import { authMiddleware, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { completeGrnSchema, cancelGrnSchema } from './grns.validators.js';
import * as controller from './grns.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/', requirePermission('grn.view'), controller.list);
router.get('/:id', requirePermission('grn.view'), controller.getOne);
router.post('/complete', requirePermission('grn.create'), validate(completeGrnSchema), controller.complete);
router.post('/:id/cancel', requirePermission('grn.cancel'), validate(cancelGrnSchema), controller.cancel);

export default router;
