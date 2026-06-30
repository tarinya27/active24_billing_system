import { Router } from 'express';
import { authMiddleware, requirePermission } from '../../middleware/auth.js';
import * as controller from './reports.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/sales', requirePermission('reports.sales'), controller.sales);
router.get('/stock', requirePermission('reports.stock'), controller.stock);
router.get('/purchase', requirePermission('reports.purchase'), controller.purchase);
router.get('/grn', requirePermission('reports.grn'), controller.grn);
router.get('/debtors', requirePermission('reports.debtors'), controller.debtors);
router.get('/export/:type', requirePermission('reports.export'), controller.exportCsv);

export default router;
