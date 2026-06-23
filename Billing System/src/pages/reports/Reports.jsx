import { useMemo, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, FileSpreadsheet } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import SearchBar from '../../components/ui/SearchBar';
import StatusBadge from '../../components/ui/StatusBadge';
import {
  mockDailySales, mockWeeklySales, mockMonthlySales,
  mockLowStockReport, mockPurchaseReport, mockGRNReport,
} from '../../data';
import { useApp } from '../../context/AppContext';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { CREDIT_PAYMENT_TERM_DAYS } from '../../utils/constants';
import { toast } from 'react-toastify';

const tabs = [
  { id: 'sales', label: 'Sales Reports' },
  { id: 'stock', label: 'Stock Reports' },
  { id: 'purchase', label: 'Purchase Reports' },
  { id: 'grn', label: 'GRN Reports' },
  { id: 'debtors', label: 'Credit Debtors' },
];

export default function Reports() {
  const [activeTab, setActiveTab] = useState('sales');
  const [salesPeriod, setSalesPeriod] = useState('daily');
  const [debtorSearch, setDebtorSearch] = useState('');
  const [debtorFilter, setDebtorFilter] = useState('All');
  const { products, invoices, customers } = useApp();

  const creditDebtors = useMemo(() => {
    return invoices
      .filter((inv) => inv.paymentMethod === 'Credit')
      .map((inv) => {
        const customer = customers.find((c) => c.id === inv.customerId);
        const invoiceDate = new Date(inv.date);
        const dueDate = new Date(invoiceDate);
        dueDate.setDate(dueDate.getDate() + CREDIT_PAYMENT_TERM_DAYS);
        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          customerName: customer?.name || 'Unknown',
          customerMobile: customer?.mobile || '—',
          date: inv.date,
          dueDate: dueDate.toISOString(),
          amount: inv.grandTotal,
          creditStatus: inv.creditStatus || 'Outstanding',
          paymentTerms: `${CREDIT_PAYMENT_TERM_DAYS} days`,
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [invoices, customers]);

  const filteredDebtors = useMemo(() => {
    return creditDebtors.filter((row) => {
      const matchesSearch =
        !debtorSearch ||
        row.customerName.toLowerCase().includes(debtorSearch.toLowerCase()) ||
        row.invoiceNumber.toLowerCase().includes(debtorSearch.toLowerCase()) ||
        row.customerMobile.includes(debtorSearch);
      const matchesFilter = debtorFilter === 'All' || row.creditStatus === debtorFilter;
      return matchesSearch && matchesFilter;
    });
  }, [creditDebtors, debtorSearch, debtorFilter]);

  const outstandingDebtors = creditDebtors.filter((d) => d.creditStatus === 'Outstanding');
  const totalOutstanding = outstandingDebtors.reduce((sum, d) => sum + d.amount, 0);
  const uniqueDebtorCount = new Set(outstandingDebtors.map((d) => d.customerName)).size;

  const handleExport = (type) => {
    toast.info(`${type} export initiated (UI only — no backend)`);
  };

  const salesData = salesPeriod === 'daily' ? mockDailySales : salesPeriod === 'weekly' ? mockWeeklySales : mockMonthlySales;
  const salesKey = salesPeriod === 'daily' ? 'date' : salesPeriod === 'weekly' ? 'week' : 'month';

  return (
    <div>
      <PageHeader title="Reports" subtitle="Business intelligence and analytics" />

      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-primary-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'sales' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-2">
              {['daily', 'weekly', 'monthly'].map((p) => (
                <button key={p} onClick={() => setSalesPeriod(p)} className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${salesPeriod === p ? 'bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-400' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>{p}</button>
              ))}
            </div>
            <button onClick={() => handleExport('Sales')} className="btn-secondary !text-xs"><Download className="h-3.5 w-3.5" /> Export</button>
          </div>
          <div className="glass-card p-6">
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey={salesKey} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                <Line type="monotone" dataKey="sales" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'stock' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button onClick={() => handleExport('Stock')} className="btn-secondary !text-xs"><FileSpreadsheet className="h-3.5 w-3.5" /> Export Inventory</button>
          </div>
          <div className="glass-card p-6">
            <h3 className="mb-4 text-sm font-semibold">Current Inventory Summary</h3>
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50"><p className="text-xs text-slate-500">Total Products</p><p className="text-2xl font-bold">{products.length}</p></div>
              <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/30"><p className="text-xs text-emerald-600">In Stock</p><p className="text-2xl font-bold text-emerald-700">{products.filter((p) => p.quantity > p.reorderLevel).length}</p></div>
              <div className="rounded-xl bg-amber-50 p-4 dark:bg-amber-950/30"><p className="text-xs text-amber-600">Low Stock</p><p className="text-2xl font-bold text-amber-700">{products.filter((p) => p.quantity > 0 && p.quantity <= p.reorderLevel).length}</p></div>
              <div className="rounded-xl bg-red-50 p-4 dark:bg-red-950/30"><p className="text-xs text-red-600">Out of Stock</p><p className="text-2xl font-bold text-red-700">{products.filter((p) => p.quantity <= 0).length}</p></div>
            </div>
            <h3 className="mb-4 text-sm font-semibold">Low Stock Items</h3>
            <DataTable
              columns={[
                { key: 'code', label: 'Code' },
                { key: 'name', label: 'Product' },
                { key: 'quantity', label: 'Qty', render: (row) => <span className="font-bold text-red-500">{row.quantity}</span> },
                { key: 'reorderLevel', label: 'Reorder Level' },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.quantity <= 0 ? 'Out of Stock' : 'Low Stock'} /> },
              ]}
              data={mockLowStockReport}
            />
          </div>
        </div>
      )}

      {activeTab === 'purchase' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button onClick={() => handleExport('Purchase')} className="btn-secondary !text-xs"><Download className="h-3.5 w-3.5" /> Export</button>
          </div>
          <div className="glass-card p-6">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={mockPurchaseReport}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v, name) => name === 'amount' ? formatCurrency(v) : v} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                <Bar yAxisId="left" dataKey="amount" fill="#2563eb" radius={[6, 6, 0, 0]} name="Amount" />
                <Bar yAxisId="right" dataKey="orders" fill="#059669" radius={[6, 6, 0, 0]} name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'grn' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button onClick={() => handleExport('GRN')} className="btn-secondary !text-xs"><Download className="h-3.5 w-3.5" /> Export</button>
          </div>
          <div className="glass-card p-6">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={mockGRNReport}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="grns" fill="#7c3aed" radius={[6, 6, 0, 0]} name="GRNs" />
                <Bar dataKey="items" fill="#0891b2" radius={[6, 6, 0, 0]} name="Items Received" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'debtors' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="glass-card p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Outstanding Debtors</p>
              <p className="mt-2 text-2xl font-bold text-amber-600">{uniqueDebtorCount}</p>
            </div>
            <div className="glass-card p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Credit Invoices</p>
              <p className="mt-2 text-2xl font-bold">{creditDebtors.length}</p>
            </div>
            <div className="glass-card p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total Outstanding</p>
              <p className="mt-2 text-2xl font-bold text-red-600">{formatCurrency(totalOutstanding)}</p>
            </div>
          </div>

          <div className="glass-card p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <SearchBar
                value={debtorSearch}
                onChange={setDebtorSearch}
                placeholder="Search debtor, invoice, or mobile..."
                className="flex-1"
              />
              <select value={debtorFilter} onChange={(e) => setDebtorFilter(e.target.value)} className="select-field !w-auto">
                <option value="All">All Credit Sales</option>
                <option value="Outstanding">Outstanding Only</option>
                <option value="Paid">Paid Only</option>
              </select>
              <button onClick={() => handleExport('Credit Debtors')} className="btn-secondary !text-xs shrink-0">
                <Download className="h-3.5 w-3.5" /> Export
              </button>
            </div>
          </div>

          <div className="glass-card p-4">
            <h3 className="mb-4 text-sm font-semibold">Credit Debtors — Payment Terms: {CREDIT_PAYMENT_TERM_DAYS} days</h3>
            <DataTable
              columns={[
                { key: 'invoiceNumber', label: 'Invoice', render: (row) => <span className="font-medium text-primary-600">{row.invoiceNumber}</span> },
                { key: 'customerName', label: 'Customer (Debtor)' },
                { key: 'customerMobile', label: 'Mobile' },
                { key: 'date', label: 'Invoice Date', render: (row) => formatDate(row.date) },
                { key: 'dueDate', label: 'Due Date', render: (row) => formatDate(row.dueDate) },
                { key: 'paymentTerms', label: 'Terms' },
                { key: 'amount', label: 'Amount', render: (row) => <span className="font-semibold">{formatCurrency(row.amount)}</span> },
                {
                  key: 'creditStatus',
                  label: 'Status',
                  render: (row) => (
                    <StatusBadge status={row.creditStatus === 'Paid' ? 'Completed' : 'Pending'} />
                  ),
                },
              ]}
              data={filteredDebtors}
            />
          </div>
        </div>
      )}
    </div>
  );
}
