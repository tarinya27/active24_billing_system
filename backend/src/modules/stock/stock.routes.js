import { Router } from 'express';
import { authMiddleware, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { adjustStockSchema } from './stock.validators.js';
import * as controller from './stock.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/summary', requirePermission('stock.view'), controller.summary);
router.get('/units', requirePermission('stock.view'), controller.listUnits);
router.get('/units/lookup/:barcode', requirePermission('stock.view'), controller.lookup);
router.get('/movements', requirePermission('stock.view_movements'), controller.movements);
router.post('/adjust', requirePermission('stock.adjust'), validate(adjustStockSchema), controller.adjust);

export default router;
