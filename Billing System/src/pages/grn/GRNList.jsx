import { useNavigate, Link } from 'react-router-dom';
import { Eye, FileText } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import SearchBar from '../../components/ui/SearchBar';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Pagination from '../../components/ui/Pagination';
import { usePagination, useSearch } from '../../hooks/usePagination';
import { useResourceList } from '../../hooks/useResourceList';
import { grnsApi } from '../../api/procurement';
import { formatDate } from '../../utils/helpers';
import { grnStatusLabel } from '../../utils/constants';
import { useState } from 'react';

export default function GRNList() {
  const navigate = useNavigate();
  const { items: grns, loading } = useResourceList(grnsApi);
  const [statusFilter, setStatusFilter] = useState('All');
  const { searchQuery, setSearchQuery, filteredItems: searched } = useSearch(grns, ['grnNumber', 'notes', 'supplier.name']);
  const filtered = statusFilter === 'All' ? searched : searched.filter((g) => g.status === statusFilter);
  const { currentPage, totalPages, paginatedItems, goToPage, totalItems, itemsPerPage } = usePagination(filtered);

  const columns = [
    { key: 'grnNumber', label: 'GRN Number', render: (row) => <span className="font-medium text-primary-600">{row.grnNumber}</span> },
    { key: 'supplier', label: 'Supplier', render: (row) => row.supplier?.name || '—' },
    { key: 'receivedDate', label: 'Date', render: (row) => formatDate(row.receivedDate) },
    { key: 'receivedBy', label: 'Received By', render: (row) => row.receivedBy?.name || '—' },
    { key: 'items', label: 'Lines', render: (row) => row.items?.length || 0 },
    { key: 'units', label: 'Units', render: (row) => row.items?.reduce((s, i) => s + (i.units || 0), 0) || 0 },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={grnStatusLabel(row.status)} /> },
    {
      key: 'actions', label: '',
      render: (row) => (
        <button onClick={(e) => { e.stopPropagation(); navigate(`/grn/${row.id}`); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800">
          <Eye className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Goods Received Notes" subtitle="View completed receipts — create GRN from a purchase invoice" actions={
        <Link to="/purchase-invoices" className="btn-primary"><FileText className="h-4 w-4" /> Purchase Invoices</Link>
      } />

      <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
        GRN cannot be created directly. Create a <Link to="/purchase-invoices" className="font-medium underline">purchase invoice</Link> first, then use <strong>Create GRN</strong> on the invoice detail page.
      </div>

      <div className="glass-card mb-6 p-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search GRNs..." className="flex-1" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select-field !w-auto">
            <option value="All">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="DRAFT">Draft</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>
      <div className="glass-card p-4">
        {loading ? <p className="py-12 text-center text-sm text-slate-500">Loading…</p> : (
          <>
            <DataTable columns={columns} data={paginatedItems} onRowClick={(row) => navigate(`/grn/${row.id}`)} />
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} totalItems={totalItems} itemsPerPage={itemsPerPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
