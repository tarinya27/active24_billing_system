import { Router } from 'express';
import { authMiddleware, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createPoSchema, updatePoSchema, syncPoSchema, importBackupSchema } from './purchase-orders.validators.js';
import * as controller from './purchase-orders.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/next-serial', requirePermission('purchase_orders.view'), controller.nextSerial);
router.get('/sync/test', requirePermission('purchase_orders.sync'), controller.syncTest);
router.post('/sync', requirePermission('purchase_orders.sync'), validate(syncPoSchema), controller.sync);
router.post('/import/backup', requirePermission('purchase_orders.sync'), validate(importBackupSchema), controller.importBackup);

router.get('/', requirePermission(['purchase_orders.view', 'purchase_orders.search']), controller.list);
router.get('/:id/tally', requirePermission('purchase_orders.view'), controller.tally);
router.get('/:id', requirePermission(['purchase_orders.view', 'purchase_orders.print']), controller.getOne);
router.post('/', requirePermission('purchase_orders.create'), validate(createPoSchema), controller.create);
router.patch('/:id', requirePermission('purchase_orders.edit'), validate(updatePoSchema), controller.update);
router.delete('/:id', requirePermission('purchase_orders.delete'), controller.remove);

export default router;
