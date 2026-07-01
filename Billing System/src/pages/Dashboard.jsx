import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  DollarSign, TrendingUp, Package, ShoppingCart, PackageCheck, AlertTriangle,
  Receipt, ArrowRightLeft, ClipboardCheck, Truck, Hash, Printer,
} from 'lucide-react';
import { toast } from 'react-toastify';
import SummaryCard from '../components/ui/SummaryCard';
import PageHeader from '../components/ui/PageHeader';
import Can from '../components/auth/Can';
import PurchaseOrderPrintView from '../components/purchaseOrders/PurchaseOrderPrintView';
import { dashboardApi } from '../api/ops';
import { purchaseOrdersApi } from '../api/procurement';
import { getErrorMessage } from '../api/client';
import { formatCurrency, formatDate, formatDateTime } from '../utils/helpers';
import { usePermission } from '../hooks/usePermission';

const COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2'];

const activityIcons = {
  invoice: Receipt,
  stock: ArrowRightLeft,
  grn: PackageCheck,
  po: ClipboardCheck,
};

const emptyPoStats = {
  totalPos: 0,
  totalValue: 0,
  activeSuppliers: 0,
  nextPoNumber: '—',
  nextSerial: '—',
  recentOrders: [],
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [printPo, setPrintPo] = useState(null);

  useEffect(() => {
    dashboardApi
      .stats()
      .then(setStats)
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle="Loading business overview…" />
        <p className="py-20 text-center text-slate-400">Loading dashboard…</p>
      </div>
    );
  }

  const dashboardStats = stats || {
    todaySales: 0,
    totalRevenue: 0,
    availableStock: 0,
    todayGRNs: 0,
    lowStockItems: 0,
    monthlySales: [],
    topProducts: [],
    stockSourceDistribution: [],
    activities: [],
    purchaseOrders: emptyPoStats,
  };

  const poStats = dashboardStats.purchaseOrders || emptyPoStats;
  const showPoSection = can('purchase_orders.view');

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={
          showPoSection
            ? `Welcome back! Next PO number will be ${poStats.nextPoNumber}.`
            : "Welcome back! Here's your business overview."
        }
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <SummaryCard title="Today's Sales" value={formatCurrency(dashboardStats.todaySales)} icon={DollarSign} color="primary" />
        <SummaryCard title="Total Revenue" value={formatCurrency(dashboardStats.totalRevenue)} icon={TrendingUp} color="emerald" />
        <SummaryCard title="Available Stock" value={dashboardStats.availableStock.toLocaleString()} icon={Package} color="cyan" />
        <SummaryCard title="Today's GRNs" value={dashboardStats.todayGRNs} icon={PackageCheck} color="violet" />
        <SummaryCard title="Low Stock Items" value={dashboardStats.lowStockItems} icon={AlertTriangle} color="rose" />
      </div>

      {showPoSection && (
        <div className="mb-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Purchase Orders</h2>
            <Can permission="purchase_orders.create">
              <Link to="/purchase-orders/new" className="btn-primary !py-2 !text-xs">
                + New Purchase Order
              </Link>
            </Can>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard title="Total POs (this company)" value={poStats.totalPos} icon={ShoppingCart} color="primary" />
            <SummaryCard title="Total PO Value" value={formatCurrency(poStats.totalValue)} icon={DollarSign} color="emerald" />
            <SummaryCard title="Active Suppliers" value={poStats.activeSuppliers} icon={Truck} color="cyan" />
            <SummaryCard title="Next Serial No." value={poStats.nextSerial} icon={Hash} color="violet" />
          </div>

          <div className="glass-card p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Recent Purchase Orders</h3>
              <Link to="/purchase-orders" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                View all
              </Link>
            </div>

            {poStats.recentOrders.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No purchase orders yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">PO No.</th>
                      <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
                      <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Supplier</th>
                      <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Grand Total</th>
                      <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500" />
                    </tr>
                  </thead>
                  <tbody>
                    {poStats.recentOrders.map((po) => (
                      <tr
                        key={po.id}
                        className="cursor-pointer border-b border-slate-50 transition-colors hover:bg-slate-50/80 dark:border-slate-800/50 dark:hover:bg-slate-800/30"
                        onClick={() => navigate(`/purchase-orders/${po.id}`)}
                      >
                        <td className="py-3 font-medium text-primary-600">{po.poNumber}</td>
                        <td className="py-3 text-slate-600 dark:text-slate-300">{formatDate(po.orderDate)}</td>
                        <td className="py-3">{po.supplier?.name || '—'}</td>
                        <td className="py-3 text-right font-medium">{formatCurrency(Number(po.totalAmount))}</td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              purchaseOrdersApi.get(po.id).then(setPrintPo).catch((err) => toast.error(getErrorMessage(err)));
                            }}
                            className="text-sm font-medium text-primary-600 hover:text-primary-700"
                          >
                            <span className="inline-flex items-center gap-1"><Printer className="h-3.5 w-3.5" /> Print</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <div className="glass-card p-6 lg:col-span-2 xl:col-span-1">
          <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Monthly Sales Overview</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={dashboardStats.monthlySales}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
              <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
              <Area type="monotone" dataKey="sales" stroke="#2563eb" fill="url(#salesGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-6">
          <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Top Selling Products</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dashboardStats.topProducts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} stroke="#94a3b8" />
              <Tooltip formatter={(v) => v.toLocaleString()} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="sales" fill="#2563eb" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-6">
          <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Stock Status Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={dashboardStats.stockSourceDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                {dashboardStats.stockSourceDistribution.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card p-6">
        <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Recent Activity</h3>
        {dashboardStats.activities.length === 0 ? (
          <p className="text-sm text-slate-400">No recent activity.</p>
        ) : (
          <div className="space-y-3">
            {dashboardStats.activities.map((activity) => {
              const Icon = activityIcons[activity.type] || Receipt;
              return (
                <div key={activity.id} className="flex items-start gap-3 rounded-xl border border-slate-100 p-4 dark:border-slate-800">
                  <div className="rounded-lg bg-primary-50 p-2 dark:bg-primary-950">
                    <Icon className="h-4 w-4 text-primary-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.title}</p>
                    {activity.description && <p className="text-xs text-slate-500">{activity.description}</p>}
                    <p className="mt-1 text-[10px] text-slate-400">{formatDateTime(activity.createdAt)} • {activity.user?.name || 'System'}</p>
                  </div>
                  {activity.amount != null && (
                    <span className="text-sm font-semibold text-primary-600">{formatCurrency(activity.amount)}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {printPo && (
        <PurchaseOrderPrintView
          po={printPo}
          onClose={() => setPrintPo(null)}
          onPrint={() => window.print()}
        />
      )}
    </div>
  );
}
