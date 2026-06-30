import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import SearchBar from '../../components/ui/SearchBar';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Pagination from '../../components/ui/Pagination';
import { usePagination, useSearch } from '../../hooks/usePagination';
import { useResourceList } from '../../hooks/useResourceList';
import { purchaseOrdersApi } from '../../api/procurement';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { poStatusLabel } from '../../utils/constants';

export default function PurchaseOrderList() {
  const navigate = useNavigate();
  const { items: purchaseOrders, loading } = useResourceList(purchaseOrdersApi, { company: 'ACTIVE24' });
  const [statusFilter, setStatusFilter] = useState('All');

  const { searchQuery, setSearchQuery, filteredItems: searched } = useSearch(purchaseOrders, [
    'poNumber', 'notes', 'externalRef',
    'supplier.name',
  ]);

  const filtered = searched.filter((po) => {
    if (statusFilter !== 'All' && po.status !== statusFilter) return false;
    return po.company === 'ACTIVE24';
  });

  const { currentPage, totalPages, paginatedItems, goToPage, totalItems, itemsPerPage } = usePagination(filtered);

  const columns = [
    { key: 'poNumber', label: 'PO No.', render: (row) => <span className="font-medium text-primary-600">{row.poNumber}</span> },
    { key: 'supplier', label: 'Supplier', render: (row) => row.supplier?.name || '—' },
    { key: 'orderDate', label: 'Date', render: (row) => formatDate(row.orderDate) },
    { key: 'totalAmount', label: 'Grand Total', render: (row) => formatCurrency(Number(row.totalAmount)) },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={poStatusLabel(row.status)} /> },
    {
      key: 'actions', label: '',
      render: (row) => (
        <button type="button" onClick={(e) => { e.stopPropagation(); navigate(`/purchase-orders/${row.id}`); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800" title="View">
          <Eye className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        subtitle="Active24 purchase orders — Manager: full access · Admin: view only"
      />

      <div className="glass-card mb-6 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search PO number, supplier..." className="flex-1" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select-field !w-auto">
            <option value="All">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="RECEIVED">Received</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="glass-card p-4">
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading purchase orders…</p>
        ) : (
          <>
            <DataTable columns={columns} data={paginatedItems} onRowClick={(row) => navigate(`/purchase-orders/${row.id}`)} />
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} totalItems={totalItems} itemsPerPage={itemsPerPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
