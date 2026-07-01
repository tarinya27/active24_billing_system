import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, PackageCheck, Warehouse,
  Receipt, BarChart3, Settings, ChevronLeft, ChevronRight, Zap,
  Boxes, Tags, Contact, UserCog, Truck, FileInput,
} from 'lucide-react';
import { cn } from '../../utils/helpers';
import { usePermission } from '../../hooks/usePermission';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
  { path: '/products', label: 'Inventory', icon: Boxes, permission: 'products.view' },
  { path: '/categories', label: 'Categories', icon: Tags, permission: 'categories.manage' },
  { path: '/customers', label: 'Customers', icon: Contact, permission: 'customers.view' },
  { path: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart, permission: 'purchase_orders.view' },
  { path: '/suppliers', label: 'Suppliers', icon: Truck, permission: 'suppliers.view' },
  { path: '/purchase-invoices', label: 'Purchase Invoices', icon: FileInput, permission: 'purchase_invoices.view' },
  { path: '/grn', label: 'Goods Received Notes', icon: PackageCheck, permission: 'grn.view' },
  { path: '/stock', label: 'Stock Management', icon: Warehouse, permission: 'stock.view' },
  { path: '/billing', label: 'Billing / Invoicing', icon: Receipt, permission: 'invoices.create' },
  { path: '/reports', label: 'Reports', icon: BarChart3, permission: 'reports.sales' },
  { path: '/users', label: 'Users', icon: UserCog, permission: 'users.view_all' },
  { path: '/settings', label: 'Settings', icon: Settings, permission: 'settings.view' },
];

export default function Sidebar({ collapsed, onToggle }) {
  const { can } = usePermission();
  const visibleNavItems = navItems.filter((item) => !item.permission || can(item.permission));
  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-30 flex h-screen flex-col border-r border-slate-200/60 bg-white/90 backdrop-blur-xl transition-all duration-300 dark:border-slate-700/60 dark:bg-slate-900/90',
        collapsed ? 'w-[72px]' : 'w-64'
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b border-slate-200/60 px-4 dark:border-slate-700/60">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 text-white shadow-lg">
          <Zap className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="truncate text-sm font-bold text-slate-800 dark:text-white">Active24</h1>
            <p className="truncate text-[10px] text-slate-500">Billing System</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {visibleNavItems.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary-50 text-primary-700 shadow-sm dark:bg-primary-950/50 dark:text-primary-400'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
              )
            }
            title={collapsed ? label : undefined}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={onToggle}
        className="flex h-12 items-center justify-center border-t border-slate-200/60 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 dark:border-slate-700/60 dark:hover:bg-slate-800"
      >
        {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
      </button>
    </aside>
  );
}
