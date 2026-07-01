import { NavLink, Outlet } from 'react-router-dom';
import {
  Plus, History, Truck, Database,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import BrandLogo from '../ui/BrandLogo';

const navItems = [
  { to: '/purchase-orders', label: 'PO History', icon: History, end: true },
  { to: '/purchase-orders/new', label: 'New Purchase Order', icon: Plus, permission: 'purchase_orders.create' },
  { to: '/suppliers', label: 'Suppliers', icon: Truck, permission: 'suppliers.view' },
  { to: '/purchase-orders/migration', label: 'Data Migration', icon: Database, permission: 'purchase_orders.sync' },
];

export default function PurchaseOrderLayout() {
  const { user } = useAuth();
  const { can } = usePermission();

  const visibleNav = navItems.filter((item) => !item.permission || can(item.permission));

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
      <aside className="w-full shrink-0 lg:w-56 xl:w-60">
        <div className="rounded-2xl bg-slate-900 p-4 text-slate-100 shadow-xl dark:bg-slate-950">
          <div className="mb-5 flex items-center gap-3 border-b border-slate-700/80 pb-4">
            <div className="rounded-lg bg-white p-2">
              <BrandLogo className="h-11 w-auto max-w-[8rem]" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Active24 (Pvt) Ltd</p>
              <p className="text-xs text-slate-400">Purchase Orders</p>
            </div>
          </div>

          <nav className="space-y-1">
            {visibleNav.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/30'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="mt-6 border-t border-slate-700/80 pt-4 text-xs text-slate-400">
            <p className="font-medium text-slate-300">{user?.name || 'User'}</p>
            <p className="mt-0.5 capitalize">{user?.role?.toLowerCase() || '—'}</p>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
