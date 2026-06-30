import { Router } from 'express';
import { authMiddleware, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { updateSettingsSchema } from './settings.validators.js';
import * as controller from './settings.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/', requirePermission('settings.view'), controller.get);
router.patch('/', requirePermission('settings.edit'), validate(updateSettingsSchema), controller.update);

export default router;
