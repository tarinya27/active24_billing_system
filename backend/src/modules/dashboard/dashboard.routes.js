import { Router } from 'express';
import { authMiddleware, requirePermission } from '../../middleware/auth.js';
import * as controller from './dashboard.controller.js';

const router = Router();

router.use(authMiddleware);
router.get('/stats', requirePermission('dashboard.view'), controller.stats);

export default router;
