import { Router } from 'express';
import { authMiddleware, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createInvoiceSchema, settleCreditSchema } from './invoices.validators.js';
import { invoiceCreateLimiter } from '../../middleware/rateLimit.js';
import * as controller from './invoices.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/', requirePermission(['invoices.view_all', 'invoices.view_own']), controller.list);
router.get('/:id', requirePermission(['invoices.view_all', 'invoices.view_own']), controller.get);
router.post('/', requirePermission('invoices.create'), invoiceCreateLimiter, validate(createInvoiceSchema), controller.create);
router.post(
  '/:id/settle',
  requirePermission('invoices.settle_credit'),
  validate(settleCreditSchema),
  controller.settle
);
router.post('/:id/cancel', requirePermission('invoices.cancel'), controller.cancel);

export default router;
