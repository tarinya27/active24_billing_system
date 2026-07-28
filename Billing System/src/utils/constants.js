export const PO_STATUS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
};

export const PO_STATUS_API = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
};

export const poStatusLabel = (status) => PO_STATUS[status] || status;

export const GRN_STATUS = {
  DRAFT: 'Draft',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const grnStatusLabel = (status) => GRN_STATUS[status] || status;

export const DN_STATUS = {
  DRAFT: 'Draft',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  INVOICED: 'Invoiced',
};

export const dnStatusLabel = (status) => DN_STATUS[status] || status;

export const INVOICE_STATUS = {
  DRAFT: 'Draft',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const PAYMENT_METHODS = ['Cash', 'Card', 'Bank Transfer', 'Credit'];

export const PAYMENT_METHOD_API = {
  Cash: 'CASH',
  Card: 'CARD',
  'Bank Transfer': 'BANK_TRANSFER',
  Credit: 'CREDIT',
};

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
