import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import SearchBar from '../../components/ui/SearchBar';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import StatusBadge from '../../components/ui/StatusBadge';
import Can from '../../components/auth/Can';
import { usePagination, useSearch } from '../../hooks/usePagination';
import { useResourceList } from '../../hooks/useResourceList';
import { sofApi } from '../../api/technical';
import { formatDate, formatCustomerName } from '../../utils/helpers';

export default function SofHistory() {
  const navigate = useNavigate();
  const { items, loading } = useResourceList(sofApi);
  const { searchQuery, setSearchQuery, filteredItems } = useSearch(items, ['sofNumber', 'description', 'customer.name']);
  const { currentPage, totalPages, paginatedItems, goToPage, totalItems, itemsPerPage } = usePagination(filteredItems);

  const columns = [
    { key: 'sofNumber', label: 'SOF No.', render: (r) => <span className="font-semibold text-primary-600">{r.sofNumber}</span> },
    { key: 'customer', label: 'Customer', render: (r) => r.customer?.name ? formatCustomerName(r.customer) : '—' },
    { key: 'description', label: 'Description', render: (r) => <span className="whitespace-pre-line">{r.description || '—'}</span> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'createdAt', label: 'Date', render: (r) => formatDate(r.createdAt) },
    { key: 'createdBy', label: 'Created person', render: (r) => r.createdPerson || r.createdBy?.name || '—' },
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
