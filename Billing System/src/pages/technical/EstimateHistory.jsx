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
import { estimatesApi } from '../../api/technical';
import { getErrorMessage } from '../../api/client';
import { formatCurrency, formatDate, formatCustomerName } from '../../utils/helpers';
import { ESTIMATE_COMPANY } from '../../utils/estimateCompanies';

export default function EstimateHistory() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const canEdit = can('estimates.edit');
  const { items, setItems, loading } = useResourceList(estimatesApi);
  const [companyFilter, setCompanyFilter] = useState('All');
  const { searchQuery, setSearchQuery, filteredItems: searched } = useSearch(items, ['estimateNumber', 'description', 'sofRef', 'machineModel', 'serialNo', 'customer.name']);
  const filteredItems = companyFilter === 'All'
    ? searched
    : searched.filter((item) => item.company === companyFilter);
  const { currentPage, totalPages, paginatedItems, goToPage, totalItems, itemsPerPage } = usePagination(filteredItems);
  const [savingId, setSavingId] = useState('');

  const changeCompanyFilter = (value) => {
    setCompanyFilter(value);
    goToPage(1);
  };

  const updateStatus = async (row, status) => {
    if (toJobStatus(row.status) === status) return;
    setSavingId(row.id);
    try {
      const updated = await estimatesApi.update(row.id, { status });
      setItems((prev) => prev.map((item) => (item.id === row.id ? { ...item, status: updated.status } : item)));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update status'));
    } finally {
      setSavingId('');
    }
  };

  const columns = [
    { key: 'estimateNumber', label: 'REF No.', render: (r) => <span className="font-semibold text-primary-600">{r.estimateNumber}</span> },
    { key: 'company', label: 'Company', render: (r) => (r.company === 'ACTIVE24' ? 'Active24' : 'Genius') },
    { key: 'customer', label: 'Customer', render: (r) => r.customer?.name ? formatCustomerName(r.customer) : '—' },
    { key: 'sofRef', label: 'S.O.F No.', render: (r) => r.sofRef || '—' },
    { key: 'machineModel', label: 'Model', render: (r) => r.machineModel || '—' },
    { key: 'serialNo', label: 'Serial No.', render: (r) => r.serialNo || '—' },
    { key: 'description', label: 'Description', render: (r) => <span className="whitespace-pre-line">{r.description || '—'}</span> },
    { key: 'amount', label: 'Amount', render: (r) => formatCurrency(r.amount) },
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
    { key: 'createdAt', label: 'Date', render: (r) => formatDate(r.createdAt) },
    { key: 'createdBy', label: 'Created by', render: (r) => r.createdBy?.name || '—' },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <HistoryActions
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search estimate number, customer, or description..."
            className="flex-1"
          />
          <select
            value={companyFilter}
            onChange={(e) => changeCompanyFilter(e.target.value)}
            className="select-field !w-auto"
            aria-label="Filter by company"
          >
            <option value="All">All companies</option>
            <option value={ESTIMATE_COMPANY.GENIUS}>Genius</option>
            <option value={ESTIMATE_COMPANY.ACTIVE24}>Active24</option>
          </select>
        </div>
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading estimates…</p>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={paginatedItems}
              onRowClick={(row) => navigate(`/technical/estimates/${row.id}`)}
            />
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
