import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import productRoutes from '../modules/products/products.routes.js';
import categoryRoutes from '../modules/categories/categories.routes.js';
import supplierRoutes from '../modules/suppliers/suppliers.routes.js';
import customerRoutes from '../modules/customers/customers.routes.js';
import userRoutes from '../modules/users/users.routes.js';
import purchaseOrderRoutes from '../modules/purchase-orders/purchase-orders.routes.js';
import purchaseInvoiceRoutes from '../modules/purchase-invoices/purchase-invoices.routes.js';
import grnRoutes from '../modules/grns/grns.routes.js';
import deliveryNoteRoutes from '../modules/delivery-notes/delivery-notes.routes.js';
import stockRoutes from '../modules/stock/stock.routes.js';
import invoiceRoutes from '../modules/invoices/invoices.routes.js';
import dashboardRoutes from '../modules/dashboard/dashboard.routes.js';
import reportRoutes from '../modules/reports/reports.routes.js';
import settingsRoutes from '../modules/settings/settings.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ data: { status: 'ok', time: new Date().toISOString() }, error: null });
});

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/customers', customerRoutes);
router.use('/users', userRoutes);
router.use('/purchase-orders', purchaseOrderRoutes);
router.use('/purchase-invoices', purchaseInvoiceRoutes);
router.use('/grns', grnRoutes);
router.use('/delivery-notes', deliveryNoteRoutes);
router.use('/stock', stockRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportRoutes);
router.use('/settings', settingsRoutes);

export default router;
