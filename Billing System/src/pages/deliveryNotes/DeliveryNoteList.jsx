import { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, Plus, Pencil } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Pagination from '../../components/ui/Pagination';
import Can from '../../components/auth/Can';
import { useServerList } from '../../hooks/useServerList';
import { deliveryNotesApi } from '../../api/procurement';
import { formatDate } from '../../utils/helpers';
import { dnStatusLabel } from '../../utils/constants';

const EMPTY_FILTERS = {
  serialNo: '',
  status: 'All',
};

function listParams(applied) {
  const params = { pageSize: 20 };
  if (applied.serialNo?.trim()) params.serialNo = applied.serialNo.trim();
  if (applied.status && applied.status !== 'All') params.status = applied.status;
  return params;
}

export default function DeliveryNoteList() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);

  const queryParams = useMemo(() => listParams(applied), [applied]);

  const {
    items: notes,
    loading,
    goToPage,
    total: totalItems,
    page,
    totalPages,
    setPage,
  } = useServerList(deliveryNotesApi, queryParams, [queryParams]);

  const handleSearch = (e) => {
    e?.preventDefault();
    setPage(1);
    setApplied({ ...filters });
  };

  const handleClear = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
    setApplied(EMPTY_FILTERS);
  };

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
        <div className="flex items-center justify-end gap-1">
          {row.status !== 'CANCELLED' && (
            <Can permission="delivery_notes.create">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/delivery-notes/${row.id}/edit`);
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800"
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </Can>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/delivery-notes/${row.id}`);
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800"
            title="View"
          >
            <Eye className="h-4 w-4" />
          </button>
        </div>
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

      <form onSubmit={handleSearch} className="glass-card mb-6 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Serial No.
            </label>
            <input
              type="text"
              value={filters.serialNo}
              onChange={(e) => setFilters((prev) => ({ ...prev, serialNo: e.target.value }))}
              placeholder="e.g. DN-2026-0003 or unit S/N"
              className="input-field"
            />
          </div>
          <div className="lg:w-48">
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
              className="select-field"
            >
              <option value="All">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="COMPLETED">Completed</option>
              <option value="INVOICED">Invoiced</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleClear} className="btn-secondary">
              Clear
            </button>
            <button type="submit" className="btn-primary min-w-[100px]">
              Search
            </button>
          </div>
        </div>
      </form>

      <div className="glass-card p-4">
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading…</p>
        ) : notes.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">No delivery notes found.</p>
        ) : (
          <>
            <DataTable columns={columns} data={notes} onRowClick={(row) => navigate(`/delivery-notes/${row.id}`)} />
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={goToPage}
                totalItems={totalItems}
                itemsPerPage={20}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
