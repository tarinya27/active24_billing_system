import { Eye } from 'lucide-react';
import Drawer from '../ui/Drawer';
import SearchBar from '../ui/SearchBar';
import EmptyState from '../ui/EmptyState';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { useState, useMemo } from 'react';
import { FileText } from 'lucide-react';

export default function PreviousInvoicesDrawer({ isOpen, onClose, invoices, customers, onViewInvoice }) {
  const [search, setSearch] = useState('');

  const sortedInvoices = useMemo(() => {
    return [...invoices].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [invoices]);

  const filtered = useMemo(() => {
    if (!search) return sortedInvoices;
    const q = search.toLowerCase();
    return sortedInvoices.filter((inv) => {
      const customer = customers.find((c) => c.id === inv.customerId);
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        customer?.name.toLowerCase().includes(q) ||
        inv.paymentMethod.toLowerCase().includes(q)
      );
    });
  }, [sortedInvoices, search, customers]);

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Previous Invoices">
      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search invoice, customer, payment..."
        className="mb-4"
      />

      {filtered.length === 0 ? (
        <EmptyState icon={FileText} title="No invoices found" description="Generate an invoice to see it here." />
      ) : (
        <div className="space-y-2">
          {filtered.map((inv) => {
            const customer = customers.find((c) => c.id === inv.customerId);
            return (
              <button
                key={inv.id}
                type="button"
                onClick={() => onViewInvoice(inv)}
                className="w-full rounded-xl border border-slate-100 p-4 text-left transition-all hover:border-primary-200 hover:bg-primary-50/50 dark:border-slate-800 dark:hover:border-primary-900 dark:hover:bg-primary-950/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-primary-600">{inv.invoiceNumber}</p>
                    <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-200">{customer?.name || 'Unknown'}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDate(inv.date)} • {inv.paymentMethod} • {inv.items?.length || 0} item(s)
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-slate-800 dark:text-white">{formatCurrency(inv.grandTotal)}</p>
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary-600">
                      <Eye className="h-3.5 w-3.5" /> View
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Drawer>
  );
}
