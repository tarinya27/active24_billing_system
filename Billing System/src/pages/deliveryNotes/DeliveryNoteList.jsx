import { useNavigate, Link } from 'react-router-dom';
import { Eye, Plus } from 'lucide-react';
import { useState } from 'react';
import PageHeader from '../../components/ui/PageHeader';
import SearchBar from '../../components/ui/SearchBar';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Pagination from '../../components/ui/Pagination';
import Can from '../../components/auth/Can';
import { usePagination, useSearch } from '../../hooks/usePagination';
import { useResourceList } from '../../hooks/useResourceList';
import { deliveryNotesApi } from '../../api/procurement';
import { formatDate } from '../../utils/helpers';
import { dnStatusLabel } from '../../utils/constants';

export default function DeliveryNoteList() {
  const navigate = useNavigate();
  const { items: notes, loading } = useResourceList(deliveryNotesApi);
  const [statusFilter, setStatusFilter] = useState('All');
  const { searchQuery, setSearchQuery, filteredItems: searched } = useSearch(notes, [
    'dnNumber',
    'notes',
    'supplier.name',
    'customer.name',
  ]);
  const filtered = statusFilter === 'All' ? searched : searched.filter((d) => d.status === statusFilter);
  const { currentPage, totalPages, paginatedItems, goToPage, totalItems, itemsPerPage } = usePagination(filtered);

  const columns = [
    {
      key: 'dnNumber',
      label: 'DN Number',
      render: (row) => <span className="font-medium text-primary-600">{row.dnNumber}</span>,
    },
    { key: 'supplier', label: 'Supplier', render: (row) => row.supplier?.name || '—' },
    { key: 'customer', label: 'Customer', render: (row) => row.customer?.name || '—' },
    { key: 'receivedDate', label: 'Date', render: (row) => formatDate(row.receivedDate || row.createdAt) },
    { key: 'items', label: 'Lines', render: (row) => row.items?.length || 0 },
    {
      key: 'units',
      label: 'Units',
      render: (row) => row.items?.reduce((s, i) => s + (i.units || 0), 0) || 0,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={dnStatusLabel(row.status)} />,
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/delivery-notes/${row.id}`);
          }}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800"
        >
          <Eye className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Delivery Notes"
        subtitle="Stock in inventory from a DN, then create a sales invoice from DN units"
        actions={
          <Can permission="delivery_notes.create">
            <Link to="/delivery-notes/new" className="btn-primary">
              <Plus className="h-4 w-4" /> New Delivery Note
            </Link>
          </Can>
        }
      />

      <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
        Parallel flow (does not replace GRN): <strong>Delivery Note → Scan barcodes → Stock → Create Invoice</strong>.
        Existing PO → PI → GRN → Billing flow is unchanged.
      </div>

      <div className="glass-card mb-6 p-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search delivery notes..." className="flex-1" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select-field !w-auto">
            <option value="All">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="COMPLETED">Completed</option>
            <option value="INVOICED">Invoiced</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="glass-card p-4">
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <DataTable columns={columns} data={paginatedItems} onRowClick={(row) => navigate(`/delivery-notes/${row.id}`)} />
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
