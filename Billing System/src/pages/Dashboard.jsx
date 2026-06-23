import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  DollarSign, TrendingUp, Package, ShoppingCart, PackageCheck, AlertTriangle,
  Receipt, ArrowRightLeft, ClipboardCheck,
} from 'lucide-react';
import SummaryCard from '../components/ui/SummaryCard';
import PageHeader from '../components/ui/PageHeader';
import { useApp } from '../context/AppContext';
import {
  mockMonthlySales, mockTopProducts, mockStockSourceDistribution,
} from '../data';
import { formatCurrency, formatDateTime } from '../utils/helpers';

const COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2'];

const activityIcons = {
  invoice: Receipt,
  stock: ArrowRightLeft,
  grn: PackageCheck,
  po: ClipboardCheck,
};

export default function Dashboard() {
  const { dashboardStats, activities } = useApp();

  return (
    <div>
      <PageHeader
        title="Executive Dashboard"
        subtitle="Welcome back! Here's your business overview for Active24 (Pvt) Ltd."
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <SummaryCard title="Today's Sales" value={formatCurrency(dashboardStats.todaySales)} icon={DollarSign} color="primary" trend={12.5} />
        <SummaryCard title="Total Revenue" value={formatCurrency(dashboardStats.totalRevenue)} icon={TrendingUp} color="emerald" trend={8.3} />
        <SummaryCard title="Available Stock" value={dashboardStats.availableStock.toLocaleString()} icon={Package} color="cyan" />
        <SummaryCard title="Pending POs" value={dashboardStats.pendingPOs} icon={ShoppingCart} color="amber" />
        <SummaryCard title="Today's GRNs" value={dashboardStats.todayGRNs} icon={PackageCheck} color="violet" />
        <SummaryCard title="Low Stock Items" value={dashboardStats.lowStockItems} icon={AlertTriangle} color="rose" />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <div className="glass-card p-6 lg:col-span-2 xl:col-span-1">
          <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Monthly Sales Overview</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={mockMonthlySales}>
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
            <BarChart data={mockTopProducts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} stroke="#94a3b8" />
              <Tooltip formatter={(v) => v.toLocaleString()} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="sales" fill="#2563eb" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-6">
          <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Stock Source Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={mockStockSourceDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}%`}>
                {mockStockSourceDistribution.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card p-6">
        <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Recent Activity</h3>
        <div className="space-y-3">
          {activities.slice(0, 8).map((activity) => {
            const Icon = activityIcons[activity.type] || Receipt;
            return (
              <div key={activity.id} className="flex items-start gap-4 rounded-xl border border-slate-100 p-4 transition-colors hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/50">
                <div className="rounded-lg bg-primary-50 p-2.5 text-primary-600 dark:bg-primary-950 dark:text-primary-400">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-white">{activity.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{activity.description}</p>
                </div>
                <div className="text-right shrink-0">
                  {activity.amount && <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(activity.amount)}</p>}
                  <p className="text-[10px] text-slate-400">{formatDateTime(activity.timestamp)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
