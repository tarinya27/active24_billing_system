import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import SearchBar from '../../components/ui/SearchBar';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import Can from '../../components/auth/Can';
import HistoryActions from '../../components/technical/HistoryActions';
import JobStatusSelect, { toJobStatus } from '../../components/technical/JobStatusSelect';
import { usePagination, useSearch } from '../../hooks/usePagination';
import { useResourceList } from '../../hooks/useResourceList';
import { usePermission } from '../../hooks/usePermission';
import { sofApi } from '../../api/technical';
import { getErrorMessage } from '../../api/client';
import { formatDate, formatCustomerName } from '../../utils/helpers';

export default function SofHistory() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const canEdit = can('sof.edit');
  const { items, setItems, loading } = useResourceList(sofApi);
  const { searchQuery, setSearchQuery, filteredItems } = useSearch(items, ['sofNumber', 'description', 'customer.name', 'invoiceNumber']);
  const { currentPage, totalPages, paginatedItems, goToPage, totalItems, itemsPerPage } = usePagination(filteredItems);
  const [savingId, setSavingId] = useState('');

  const updateStatus = async (row, status) => {
    if (toJobStatus(row.status) === status) return;
    setSavingId(row.id);
    try {
      const updated = await sofApi.update(row.id, { status });
      setItems((prev) => prev.map((item) => (item.id === row.id ? { ...item, status: updated.status } : item)));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update status'));
    } finally {
      setSavingId('');
    }
  };

  const columns = [
    { key: 'sofNumber', label: 'SOF No.', render: (r) => <span className="font-semibold text-primary-600">{r.sofNumber}</span> },
    { key: 'customer', label: 'Customer', render: (r) => r.customer?.name ? formatCustomerName(r.customer) : '—' },
    { key: 'description', label: 'Description', render: (r) => <span className="whitespace-pre-line">{r.description || '—'}</span> },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <JobStatusSelect
          value={r.status}
          disabled={!canEdit || savingId === r.id}
          onChange={(status) => updateStatus(r, status)}
        />
      ),
    },
    {
      key: 'invoiced',
      label: 'Invoiced',
      render: (r) => (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
          r.invoiced
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400'
            : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
        }`}
        >
          {r.invoiced ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'invoiceNumber',
      label: 'Invoice No.',
      render: (r) => (
        r.invoiceNumber
          ? <span className="font-semibold text-primary-600">{(r.invoiceNumbers || [r.invoiceNumber]).join(', ')}</span>
          : '—'
      ),
    },
    { key: 'createdAt', label: 'Date', render: (r) => formatDate(r.createdAt) },
    { key: 'createdBy', label: 'Created person', render: (r) => r.createdPerson || r.createdBy?.name || '—' },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <HistoryActions
          viewTo={`/technical/sof/${r.id}`}
          editTo={`/technical/sof/${r.id}/edit`}
          downloadTo={`/technical/sof/${r.id}?download=1`}
          editPermission="sof.edit"
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="SOF History"
        subtitle="Previously saved service orders"
        actions={(
          <Can permission="sof.create">
            <button type="button" className="btn-primary" onClick={() => navigate('/technical/sof')}>
              <Plus className="h-4 w-4" /> New SOF
            </button>
          </Can>
        )}
      />
      <div className="glass-card space-y-4 p-4">
        <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search SOF number, customer, or description..." />
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading service orders…</p>
        ) : (
          <>
            <DataTable columns={columns} data={paginatedItems} />
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={goToPage}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
