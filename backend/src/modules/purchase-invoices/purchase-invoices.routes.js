import { Router } from 'express';
import { authMiddleware, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createPurchaseInvoiceSchema, updatePurchaseInvoiceSchema, calculatePurchaseInvoiceSchema } from './purchase-invoices.validators.js';
import * as controller from './purchase-invoices.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/', requirePermission('purchase_invoices.view'), controller.list);
router.post('/calculate', requirePermission('purchase_invoices.view'), validate(calculatePurchaseInvoiceSchema), controller.calculate);
router.get('/:id/tally', requirePermission('purchase_invoices.view'), controller.tally);
router.get('/:id', requirePermission('purchase_invoices.view'), controller.getOne);
router.post('/', requirePermission('purchase_invoices.create'), validate(createPurchaseInvoiceSchema), controller.create);
router.patch('/:id', requirePermission('purchase_invoices.edit'), validate(updatePurchaseInvoiceSchema), controller.update);
router.delete('/:id', requirePermission('purchase_invoices.delete'), controller.remove);

export default router;
