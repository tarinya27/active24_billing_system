import { useNavigate } from 'react-router-dom';
import { Eye, PackageCheck, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import SearchBar from '../../components/ui/SearchBar';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Pagination from '../../components/ui/Pagination';
import Can from '../../components/auth/Can';
import { usePagination, useSearch } from '../../hooks/usePagination';
import { useResourceList } from '../../hooks/useResourceList';
import { purchaseInvoicesApi } from '../../api/procurement';
import { formatCurrency, formatDate, isInvoiceReadyForGrn } from '../../utils/helpers';

function isVatEnabled(invoice) {
  return invoice.vatEnabled ?? (Number(invoice.vatRate) > 0 && !invoice.purchaseWithVat);
}

function formatVatLabel(invoice) {
  if (!isVatEnabled(invoice)) return 'No';
  const rate = Number(invoice.vatRate) || 0;
  return rate > 0 ? `Yes (${rate}%)` : 'Yes';
}

export default function PurchaseInvoiceList() {
  const navigate = useNavigate();
  const { items: invoices, loading } = useResourceList(purchaseInvoicesApi);
  const { searchQuery, setSearchQuery, filteredItems } = useSearch(invoices, ['supplierInvoiceNo', 'supplier.name']);
  const { currentPage, totalPages, paginatedItems, goToPage, totalItems, itemsPerPage } = usePagination(filteredItems);

  const columns = [
    { key: 'id', label: 'Invoice', render: (r) => <span className="font-medium">{r.supplierInvoiceNo || `PI-${r.id.slice(-6).toUpperCase()}`}</span> },
    { key: 'supplier', label: 'Supplier', render: (r) => r.supplier?.name || '—' },
    { key: 'po', label: 'PO', render: (r) => r.po?.poNumber || '—' },
    { key: 'company', label: 'Company', render: (r) => r.company },
    { key: 'vat', label: 'VAT', render: (r) => formatVatLabel(r) },
    { key: 'total', label: 'Total', render: (r) => formatCurrency(Number(r.total)) },
    { key: 'createdAt', label: 'Date', render: (r) => formatDate(r.createdAt) },
    {
      key: 'grnStatus', label: 'GRN Status', render: (r) => (
        r.grn ? (
          <div className="flex flex-col gap-1">
            <StatusBadge status={r.grn.status || 'COMPLETED'} />
            <Link to={`/grn/${r.grn.id}`} onClick={(e) => e.stopPropagation()} className="text-xs font-medium text-primary-600 hover:underline">
              {r.grn.grnNumber}
            </Link>
          </div>
        ) : (
          <StatusBadge status="PENDING" />
        )
      ),
    },
    {
      key: 'grnAction', label: '',
      render: (r) => (
        isInvoiceReadyForGrn(r) ? (
          <Can permission="grn.create">
            <Link
              to={`/grn/new?purchaseInvoiceId=${r.id}`}
              onClick={(e) => e.stopPropagation()}
              className="btn-secondary !inline-flex !px-2.5 !py-1 !text-xs"
            >
              <PackageCheck className="h-3.5 w-3.5" /> Create GRN
            </Link>
          </Can>
        ) : !r.grn ? (
          <span className="text-xs text-slate-400">Complete PO &amp; invoice no.</span>
        ) : null
      ),
    },
    {
      key: 'actions', label: '',
      render: (r) => (
        <button onClick={(e) => { e.stopPropagation(); navigate(`/purchase-invoices/${r.id}`); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800">
          <Eye className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Purchase Invoices"
        subtitle="Step 2: Purchase Order → Purchase Invoice → GRN"
        actions={
          <Can permission="purchase_orders.view">
            <Link to="/purchase-orders" className="btn-primary"><ShoppingCart className="h-4 w-4" /> Purchase Orders</Link>
          </Can>
        }
      />
      <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
        Create invoices from a <Link to="/purchase-orders" className="font-medium underline">purchase order</Link>, then create GRN from the invoice. Stock is updated only when GRN is confirmed.
      </div>
      <div className="glass-card mb-6 p-4">
        <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search invoices..." />
      </div>
      <div className="glass-card p-4">
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <DataTable columns={columns} data={paginatedItems} onRowClick={(r) => navigate(`/purchase-invoices/${r.id}`)} />
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} totalItems={totalItems} itemsPerPage={itemsPerPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
