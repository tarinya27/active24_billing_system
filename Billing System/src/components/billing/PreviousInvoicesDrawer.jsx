import { useEffect, useMemo, useState } from 'react';
import { Eye, FileText } from 'lucide-react';
import Drawer from '../ui/Drawer';
import SearchBar from '../ui/SearchBar';
import EmptyState from '../ui/EmptyState';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { invoicesApi, PAYMENT_METHOD_LABEL } from '../../api/ops';
import { getErrorMessage } from '../../api/client';
import { toast } from 'react-toastify';

export default function PreviousInvoicesDrawer({ isOpen, onClose, customers, onViewInvoice }) {
  const [search, setSearch] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    invoicesApi
      .list({ pageSize: 50 })
      .then((result) => setInvoices(result.items || []))
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const sortedInvoices = useMemo(
    () => [...invoices].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [invoices]
  );

  const filtered = useMemo(() => {
    if (!search) return sortedInvoices;
    const q = search.toLowerCase();
    return sortedInvoices.filter((inv) => {
      const customer = customers.find((c) => c.id === inv.customerId) || inv.customer;
      const pm = PAYMENT_METHOD_LABEL[inv.paymentMethod] || inv.paymentMethod;
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        customer?.name?.toLowerCase().includes(q) ||
        pm.toLowerCase().includes(q)
      );
    });
  }, [sortedInvoices, search, customers]);

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Previous Invoices">
      <SearchBar value={search} onChange={setSearch} placeholder="Search invoice, customer, payment..." className="mb-4" />

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-400">Loading invoices…</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={FileText} title="No invoices found" description="Generate an invoice to see it here." />
      ) : (
        <div className="space-y-2">
          {filtered.map((inv) => {
            const customer = customers.find((c) => c.id === inv.customerId) || inv.customer;
            const pm = PAYMENT_METHOD_LABEL[inv.paymentMethod] || inv.paymentMethod;
            return (
              <button
                key={inv.id}
                type="button"
                onClick={() => onViewInvoice(inv)}
                className="w-full rounded-xl border border-slate-100 p-4 text-left transition-all hover:border-primary-200 hover:bg-primary-50/50 dark:border-slate-800 dark:hover:border-primary-900 dark:hover:bg-primary-950/20"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{inv.invoiceNumber}</p>
                    <p className="text-xs text-slate-500">{customer?.name}</p>
                  </div>
                  <span className="text-sm font-bold text-primary-600">{formatCurrency(Number(inv.grandTotal))}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                  <span>{formatDate(inv.createdAt)} • {pm}</span>
                  <Eye className="h-3.5 w-3.5" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Drawer>
  );
}
