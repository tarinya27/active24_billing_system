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
import SofBillingSelect, { displayedBillingType, isBillingLocked, savedBillingNumber, SofDocNumberInput } from '../../components/technical/SofBillingSelect';
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
  const { searchQuery, setSearchQuery, filteredItems } = useSearch(items, ['sofNumber', 'description', 'customer.name', 'invoiceNumber', 'billingDocNumber']);
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

  const updateBilling = async (row, payload) => {
    if (isBillingLocked(row)) return;
    setSavingId(row.id);
    try {
      const updated = await sofApi.update(row.id, payload);
      setItems((prev) => prev.map((item) => (item.id === row.id ? { ...item, ...updated } : item)));
      if (payload.billingDocNumber !== undefined) {
        toast.success(payload.billingDocNumber ? 'Document number saved' : 'Document number cleared');
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update invoiced status'));
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
        <SofBillingSelect
          row={r}
          disabled={!canEdit || savingId === r.id}
          onChange={(billingDocType) => {
            if (isBillingLocked(r) || displayedBillingType(r) === billingDocType) return;
            updateBilling(r, {
              billingDocType,
              ...(billingDocType === 'NONE' ? { billingDocNumber: null } : {}),
            });
          }}
        />
      ),
    },
    {
      key: 'invoiceNumber',
      label: 'Invoice / DN No.',
      render: (r) => {
        const type = displayedBillingType(r);
        const number = savedBillingNumber(r);
        if (isBillingLocked(r)) {
          return number
            ? <span className="font-semibold text-primary-600">{number}</span>
            : '—';
        }
        if (type === 'NONE') return '—';
        if (!canEdit) {
          return number
            ? <span className="font-semibold text-primary-600">{number}</span>
            : '—';
        }
        return (
          <SofDocNumberInput
            value={r.billingDocNumber || r.invoiceNumber || ''}
            placeholder={type === 'DN' ? 'DN Number' : 'Invoice Number'}
            disabled={savingId === r.id}
            saving={savingId === r.id}
            onSave={(billingDocNumber) => updateBilling(r, { billingDocNumber: billingDocNumber || null })}
          />
        );
      },
    },
    { key: 'createdAt', label: 'Date', render: (r) => formatDate(r.createdAt) },
    { key: 'createdBy', label: 'Created person', render: (r) => r.createdPerson || r.createdBy?.name || '—' },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <HistoryActions
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
            <DataTable
              columns={columns}
              data={paginatedItems}
              onRowClick={(row) => navigate(`/technical/sof/${row.id}`)}
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
