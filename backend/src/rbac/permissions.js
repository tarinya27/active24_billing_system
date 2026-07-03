// Central RBAC matrix. Mirrors section 4.3 of the project plan.
// Roles: MANAGER (full access), ADMIN (reports + user management + settings + read-only oversight), CASHIER (billing only).

export const PERMISSIONS = [
  'auth.login',
  'dashboard.view',
  'users.view_all',
  'users.create',
  'users.edit',
  'users.delete',
  'users.change_role',
  'products.view',
  'products.create',
  'products.edit',
  'products.delete',
  'categories.manage',
  'suppliers.view',
  'suppliers.create',
  'suppliers.edit',
  'suppliers.delete',
  'customers.view',
  'customers.create',
  'customers.edit',
  'customers.delete',
  'purchase_orders.view',
  'purchase_orders.search',
  'purchase_orders.print',
  'purchase_orders.sync',
  'purchase_orders.create',
  'purchase_orders.edit',
  'purchase_orders.approve',
  'purchase_orders.delete',
  'purchase_invoices.view',
  'purchase_invoices.create',
  'purchase_invoices.edit',
  'purchase_invoices.delete',
  'grn.view',
  'grn.create',
  'grn.edit_description',
  'grn.set_price',
  'grn.cancel',
  'stock.view',
  'stock.view_movements',
  'stock.adjust',
  'invoices.view_all',
  'invoices.view_own',
  'invoices.create',
  'invoices.settle_credit',
  'invoices.cancel',
  'reports.sales',
  'reports.stock',
  'reports.purchase',
  'reports.grn',
  'reports.debtors',
  'reports.export',
  'settings.view',
  'settings.edit',
];

const ADMIN_PERMISSIONS = [
  'auth.login',
  'dashboard.view',
  'users.view_all',
  'users.create',
  'users.edit',
  'users.delete',
  'users.change_role',
  'products.view',
  'suppliers.view',
  'customers.view',
  'purchase_orders.view',
  'purchase_invoices.view',
  'grn.view',
  'stock.view',
  'stock.view_movements',
  'invoices.view_all',
  'invoices.view_own',
  'reports.sales',
  'reports.stock',
  'reports.purchase',
  'reports.grn',
  'reports.debtors',
  'reports.export',
  'settings.view',
  'settings.edit',
];

const CASHIER_PERMISSIONS = [
  'auth.login',
  'dashboard.view',
  'products.view',
  'customers.view',
  'customers.create',
  'stock.view',
  'invoices.view_own',
  'invoices.create',
];

// PO capabilities for Manager: search (list/filter), edit, and print/reprint.
const MANAGER_PO_PERMISSIONS = [
  'purchase_orders.view',
  'purchase_orders.search',
  'purchase_orders.print',
  'purchase_orders.create',
  'purchase_orders.edit',
  'purchase_orders.approve',
  'purchase_orders.delete',
  'purchase_orders.sync',
];

const MANAGER_PERMISSIONS = [
  ...PERMISSIONS.filter((p) => !p.startsWith('purchase_orders.')),
  ...MANAGER_PO_PERMISSIONS,
];

// MANAGER: full access. ADMIN: purchase orders view-only.
export const ROLE_PERMISSIONS = {
  MANAGER: new Set(MANAGER_PERMISSIONS),
  ADMIN: new Set(ADMIN_PERMISSIONS),
  CASHIER: new Set(CASHIER_PERMISSIONS),
};

export function getPermissionsForRole(role) {
  const set = ROLE_PERMISSIONS[role];
  return set ? [...set] : [];
}

export function roleHasPermission(role, permission) {
  const set = ROLE_PERMISSIONS[role];
  return Boolean(set && set.has(permission));
}
