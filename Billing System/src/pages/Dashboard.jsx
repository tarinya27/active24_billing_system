import { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  DollarSign, TrendingUp, Package, ShoppingCart, PackageCheck, AlertTriangle,
  Receipt, ArrowRightLeft, ClipboardCheck,
} from 'lucide-react';
import SummaryCard from '../components/ui/SummaryCard';
import PageHeader from '../components/ui/PageHeader';
import { dashboardApi } from '../api/ops';
import { getErrorMessage } from '../api/client';
import { formatCurrency, formatDateTime } from '../utils/helpers';
import { toast } from 'react-toastify';

const COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2'];

const activityIcons = {
  invoice: Receipt,
  stock: ArrowRightLeft,
  grn: PackageCheck,
  po: ClipboardCheck,
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

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
        <PageHeader title="Executive Dashboard" subtitle="Loading business overview…" />
        <p className="py-20 text-center text-slate-400">Loading dashboard…</p>
      </div>
    );
  }

  const dashboardStats = stats || {
    todaySales: 0,
    totalRevenue: 0,
    availableStock: 0,
    pendingPOs: 0,
    todayGRNs: 0,
    lowStockItems: 0,
    monthlySales: [],
    topProducts: [],
    stockSourceDistribution: [],
    activities: [],
  };

  return (
    <div>
      <PageHeader
        title="Executive Dashboard"
        subtitle="Welcome back! Here's your business overview."
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <SummaryCard title="Today's Sales" value={formatCurrency(dashboardStats.todaySales)} icon={DollarSign} color="primary" />
        <SummaryCard title="Total Revenue" value={formatCurrency(dashboardStats.totalRevenue)} icon={TrendingUp} color="emerald" />
        <SummaryCard title="Available Stock" value={dashboardStats.availableStock.toLocaleString()} icon={Package} color="cyan" />
        <SummaryCard title="Pending POs" value={dashboardStats.pendingPOs} icon={ShoppingCart} color="amber" />
        <SummaryCard title="Today's GRNs" value={dashboardStats.todayGRNs} icon={PackageCheck} color="violet" />
        <SummaryCard title="Low Stock Items" value={dashboardStats.lowStockItems} icon={AlertTriangle} color="rose" />
      </div>

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
    </div>
  );
}
