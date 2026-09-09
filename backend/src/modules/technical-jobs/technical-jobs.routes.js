import { Router } from 'express';
import { authMiddleware, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  createSofSchema,
  updateSofSchema,
  createEstimateSchema,
  updateEstimateSchema,
} from './technical-jobs.validators.js';
import * as controller from './technical-jobs.controller.js';

const sofRouter = Router();
sofRouter.use(authMiddleware);
sofRouter.get('/', requirePermission('sof.view'), controller.listSof);
sofRouter.get('/next-number', requirePermission('sof.view'), controller.nextSof);
sofRouter.get('/:id', requirePermission('sof.view'), controller.getSof);
sofRouter.post('/', requirePermission('sof.create'), validate(createSofSchema), controller.createSof);
sofRouter.patch('/:id', requirePermission('sof.edit'), validate(updateSofSchema), controller.updateSof);

const estimateRouter = Router();
estimateRouter.use(authMiddleware);
estimateRouter.get('/', requirePermission('estimates.view'), controller.listEstimates);
estimateRouter.get('/:id', requirePermission('estimates.view'), controller.getEstimate);
estimateRouter.post('/', requirePermission('estimates.create'), validate(createEstimateSchema), controller.createEstimate);
estimateRouter.patch('/:id', requirePermission('estimates.edit'), validate(updateEstimateSchema), controller.updateEstimate);

export { sofRouter, estimateRouter };
