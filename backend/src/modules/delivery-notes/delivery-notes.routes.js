import { Router } from 'express';
import { authMiddleware, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  createDeliveryNoteSchema,
  reserveDnBarcodeSchema,
  completeDeliveryNoteSchema,
  cancelDeliveryNoteSchema,
  createInvoiceFromDnSchema,
} from './delivery-notes.validators.js';
import * as controller from './delivery-notes.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/', requirePermission('delivery_notes.view'), controller.list);
router.post('/', requirePermission('delivery_notes.create'), validate(createDeliveryNoteSchema), controller.create);
router.post('/reserve-barcode', requirePermission('delivery_notes.create'), validate(reserveDnBarcodeSchema), controller.reserveBarcode);
router.delete('/pending-unit/:id', requirePermission('delivery_notes.create'), controller.removePendingUnit);
router.post('/complete', requirePermission('delivery_notes.create'), validate(completeDeliveryNoteSchema), controller.complete);
router.get('/:id', requirePermission('delivery_notes.view'), controller.getOne);
router.post('/:id/cancel', requirePermission('delivery_notes.cancel'), validate(cancelDeliveryNoteSchema), controller.cancel);
router.post('/:id/create-invoice', requirePermission('invoices.create'), validate(createInvoiceFromDnSchema), controller.createInvoice);

export default router;
