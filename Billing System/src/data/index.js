export { mockProducts, findProductByBarcode, findProductById, searchProducts } from './mockProducts';
export { mockCustomers } from './mockCustomers';
export { mockSuppliers } from './mockSuppliers';
export { mockPurchaseOrders } from './mockPurchaseOrders';
export { mockGRNs } from './mockGRNs';
export { mockInvoices } from './mockInvoices';
export { mockStockTransfers } from './mockStockTransfers';
export {
  mockActivities,
  mockMonthlySales,
  mockTopProducts,
  mockStockSourceDistribution,
  mockDailySales,
  mockWeeklySales,
  mockLowStockReport,
  mockPurchaseReport,
  mockGRNReport,
} from './mockReports';

export const companyInfo = {
  name: 'Active24 (Pvt) Ltd',
  tagline: 'Enterprise Billing & Inventory Management',
  address: 'No. 128, Duplication Road, Colombo 04, Sri Lanka',
  phone: '+94 11 456 7890',
  email: 'info@active24.lk',
  website: 'www.active24.lk',
  registrationNo: 'PV 87654',
  vatNo: 'VAT-102345678',
};

export const currentUser = {
  name: 'Sanduni Fernando',
  role: 'Senior Cashier',
  email: 'sanduni@active24.lk',
  avatar: null,
};
