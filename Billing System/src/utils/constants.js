export const PO_STATUS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  RECEIVED: 'Received',
};

export const GRN_STATUS = {
  DRAFT: 'Draft',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const INVOICE_STATUS = {
  DRAFT: 'Draft',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const PAYMENT_METHODS = ['Cash', 'Card', 'Bank Transfer', 'Credit'];

export const CREDIT_PAYMENT_TERM_DAYS = 30;

export const STOCK_SOURCES = ['Genius', 'Active24'];

export const PRODUCT_CATEGORIES = [
  'Electronics',
  'Computer Accessories',
  'Networking',
  'Office Supplies',
  'Peripherals',
  'Storage Devices',
  'Cables & Adapters',
  'Software',
];

export function getStatusColor(status) {
  const map = {
    Pending: 'warning',
    Approved: 'info',
    Received: 'success',
    Draft: 'neutral',
    Completed: 'success',
    Cancelled: 'danger',
    'In Stock': 'success',
    'Low Stock': 'warning',
    'Out of Stock': 'danger',
  };
  return map[status] || 'neutral';
}

export function getActivityIcon(type) {
  const map = {
    invoice: 'receipt',
    stock: 'arrow-right-left',
    grn: 'package-check',
    po: 'clipboard-check',
  };
  return map[type] || 'activity';
}
