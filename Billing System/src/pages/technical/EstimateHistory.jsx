import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import SearchBar from '../../components/ui/SearchBar';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import StatusBadge from '../../components/ui/StatusBadge';
import Can from '../../components/auth/Can';
import HistoryActions from '../../components/technical/HistoryActions';
import { usePagination, useSearch } from '../../hooks/usePagination';
import { useResourceList } from '../../hooks/useResourceList';
import { estimatesApi } from '../../api/technical';
import { formatCurrency, formatDate, formatCustomerName } from '../../utils/helpers';

export default function EstimateHistory() {
  const navigate = useNavigate();
  const { items, loading } = useResourceList(estimatesApi);
  const { searchQuery, setSearchQuery, filteredItems } = useSearch(items, ['estimateNumber', 'description', 'sofRef', 'machineModel', 'serialNo', 'customer.name']);
  const { currentPage, totalPages, paginatedItems, goToPage, totalItems, itemsPerPage } = usePagination(filteredItems);

  const columns = [
    { key: 'estimateNumber', label: 'REF No.', render: (r) => <span className="font-semibold text-primary-600">{r.estimateNumber}</span> },
    { key: 'customer', label: 'Customer', render: (r) => r.customer?.name ? formatCustomerName(r.customer) : '—' },
    { key: 'sofRef', label: 'S.O.F No.', render: (r) => r.sofRef || '—' },
    { key: 'machineModel', label: 'Model', render: (r) => r.machineModel || '—' },
    { key: 'serialNo', label: 'Serial No.', render: (r) => r.serialNo || '—' },
    { key: 'description', label: 'Description', render: (r) => <span className="whitespace-pre-line">{r.description || '—'}</span> },
    { key: 'amount', label: 'Amount', render: (r) => formatCurrency(r.amount) },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'createdAt', label: 'Date', render: (r) => formatDate(r.createdAt) },
    { key: 'createdBy', label: 'Created by', render: (r) => r.createdBy?.name || '—' },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <HistoryActions
          viewTo={`/technical/estimates/${r.id}`}
          editTo={`/technical/estimates/${r.id}/edit`}
          downloadTo={`/technical/estimates/${r.id}?download=1`}
          editPermission="estimates.edit"
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Estimate History"
        subtitle="Previously saved estimates"
        actions={(
          <Can permission="estimates.create">
            <button type="button" className="btn-primary" onClick={() => navigate('/technical/estimates')}>
              <Plus className="h-4 w-4" /> New estimate
            </button>
          </Can>
        )}
      />
      <div className="glass-card space-y-4 p-4">
        <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search estimate number, customer, or description..." />
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading estimates…</p>
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
