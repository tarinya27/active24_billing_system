import { useNavigate } from 'react-router-dom';
import { Plus, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import SearchBar from '../../components/ui/SearchBar';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Pagination from '../../components/ui/Pagination';
import { useApp } from '../../context/AppContext';
import { usePagination, useSearch } from '../../hooks/usePagination';
import { formatDate } from '../../utils/helpers';
import { useState } from 'react';

export default function GRNList() {
  const { grns, suppliers } = useApp();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('All');
  const { searchQuery, setSearchQuery, filteredItems: searched } = useSearch(grns, ['grnNumber', 'status', 'notes']);
  const filtered = statusFilter === 'All' ? searched : searched.filter((g) => g.status === statusFilter);
  const { currentPage, totalPages, paginatedItems, goToPage, totalItems, itemsPerPage } = usePagination(filtered);

  const columns = [
    { key: 'grnNumber', label: 'GRN Number', render: (row) => <span className="font-medium text-primary-600">{row.grnNumber}</span> },
    { key: 'supplier', label: 'Supplier', render: (row) => suppliers.find((s) => s.id === row.supplierId)?.name || '—' },
    { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
    { key: 'receivedBy', label: 'Received By' },
    { key: 'items', label: 'Items', render: (row) => row.items.length },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions', label: 'Actions',
      render: (row) => (
        <button onClick={(e) => { e.stopPropagation(); navigate(`/grn/${row.id}`); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800">
          <Eye className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Goods Received Notes" subtitle="Track all incoming inventory" actions={<Link to="/grn/new" className="btn-primary"><Plus className="h-4 w-4" /> Create GRN</Link>} />
      <div className="glass-card mb-6 p-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search GRNs..." className="flex-1" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select-field !w-auto">
            <option value="All">All Statuses</option>
            <option value="Completed">Completed</option>
            <option value="Draft">Draft</option>
          </select>
        </div>
      </div>
      <div className="glass-card p-4">
        <DataTable columns={columns} data={paginatedItems} onRowClick={(row) => navigate(`/grn/${row.id}`)} />
        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} totalItems={totalItems} itemsPerPage={itemsPerPage} />
        </div>
      </div>
    </div>
  );
}
