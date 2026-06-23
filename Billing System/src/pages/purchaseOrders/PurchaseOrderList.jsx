import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Eye, Pencil } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import SearchBar from '../../components/ui/SearchBar';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Pagination from '../../components/ui/Pagination';
import { useApp } from '../../context/AppContext';
import { usePagination, useSearch } from '../../hooks/usePagination';
import { formatCurrency, formatDate } from '../../utils/helpers';

export default function PurchaseOrderList() {
  const { purchaseOrders, suppliers } = useApp();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('All');
  const { searchQuery, setSearchQuery, filteredItems: searched } = useSearch(purchaseOrders, ['poNumber', 'status', 'notes']);
  const filtered = statusFilter === 'All' ? searched : searched.filter((po) => po.status === statusFilter);
  const { currentPage, totalPages, paginatedItems, goToPage, totalItems, itemsPerPage } = usePagination(filtered);

  const getSupplierName = (id) => suppliers.find((s) => s.id === id)?.name || '—';

  const columns = [
    { key: 'poNumber', label: 'PO Number', render: (row) => <span className="font-medium text-primary-600">{row.poNumber}</span> },
    { key: 'supplier', label: 'Supplier', render: (row) => getSupplierName(row.supplierId) },
    { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
    { key: 'expectedDelivery', label: 'Expected Delivery', render: (row) => formatDate(row.expectedDelivery) },
    { key: 'totalAmount', label: 'Total', render: (row) => formatCurrency(row.totalAmount) },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions', label: 'Actions',
      render: (row) => (
        <div className="flex gap-2">
          <button onClick={(e) => { e.stopPropagation(); navigate(`/purchase-orders/${row.id}`); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800">
            <Eye className="h-4 w-4" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); navigate(`/purchase-orders/edit/${row.id}`); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800">
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        subtitle="Manage and track all purchase orders"
        actions={
          <Link to="/purchase-orders/new" className="btn-primary">
            <Plus className="h-4 w-4" /> New Purchase Order
          </Link>
        }
      />

      <div className="glass-card mb-6 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search POs..." className="flex-1" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select-field !w-auto">
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Received">Received</option>
          </select>
        </div>
      </div>

      <div className="glass-card p-4">
        <DataTable columns={columns} data={paginatedItems} onRowClick={(row) => navigate(`/purchase-orders/${row.id}`)} />
        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} totalItems={totalItems} itemsPerPage={itemsPerPage} />
        </div>
      </div>
    </div>
  );
}
