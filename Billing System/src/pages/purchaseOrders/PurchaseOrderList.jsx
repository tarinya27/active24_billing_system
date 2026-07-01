import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import Pagination from '../../components/ui/Pagination';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Can from '../../components/auth/Can';
import PurchaseOrderPrintView from '../../components/purchaseOrders/PurchaseOrderPrintView';
import { useServerList } from '../../hooks/useServerList';
import { purchaseOrdersApi } from '../../api/procurement';
import { getErrorMessage } from '../../api/client';
import { formatDate } from '../../utils/helpers';
import { PO_COMPANY, PO_COMPANY_LABEL } from '../../utils/poConstants';

const EMPTY_FILTERS = {
  serialNo: '',
  supplier: '',
  dateFrom: '',
  dateTo: '',
};

function formatGrandTotal(amount) {
  return new Intl.NumberFormat('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

function companyPill(company) {
  const label = company === 'GENIUS' ? 'GENIUS' : 'ACTIVE';
  return (
    <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
      {label}
    </span>
  );
}

function listParams(applied) {
  const params = { pageSize: 20, company: PO_COMPANY };
  if (applied.serialNo?.trim()) params.serialNo = applied.serialNo.trim();
  if (applied.supplier?.trim()) params.supplier = applied.supplier.trim();
  if (applied.dateFrom) params.dateFrom = applied.dateFrom;
  if (applied.dateTo) params.dateTo = applied.dateTo;
  return params;
}

export default function PurchaseOrderList() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [printPo, setPrintPo] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const queryParams = useMemo(() => listParams(applied), [applied]);

  const {
    items: purchaseOrders,
    loading,
    reload,
    goToPage,
    totalItems,
    page,
    totalPages,
    setPage,
  } = useServerList(purchaseOrdersApi, queryParams, [queryParams]);

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

  const handlePrint = (row) => {
    purchaseOrdersApi
      .get(row.id)
      .then(setPrintPo)
      .catch((err) => toast.error(getErrorMessage(err)));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await purchaseOrdersApi.remove(deleteTarget.id);
      toast.success(`PO ${deleteTarget.poNumber} deleted`);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete PO'));
    }
  };

  return (
    <div>
      <PageHeader
        title="Purchase Order History"
        subtitle="Search, reprint, edit or delete purchase orders for Active24 (Pvt) Ltd."
        actions={
          <>
            <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {PO_COMPANY_LABEL}
            </span>
            <Can permission="purchase_orders.create">
              <Link to="/purchase-orders/new" className="btn-primary">
                + New PO
              </Link>
            </Can>
          </>
        }
      />

      <form onSubmit={handleSearch} className="glass-card mb-6 p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Issuing Company</label>
            <input
              type="text"
              value={PO_COMPANY_LABEL}
              readOnly
              className="input-field bg-slate-50 dark:bg-slate-900/60"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Serial No.</label>
            <input
              type="text"
              value={filters.serialNo}
              onChange={(e) => setFilters({ ...filters, serialNo: e.target.value })}
              placeholder="e.g. 25472"
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Supplier</label>
            <input
              type="text"
              value={filters.supplier}
              onChange={(e) => setFilters({ ...filters, supplier: e.target.value })}
              placeholder="name contains..."
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">From &amp; To</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="input-field"
              />
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="input-field"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button type="button" onClick={handleClear} className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            Clear
          </button>
          <button type="submit" className="btn-primary min-w-[120px]">
            Search
          </button>
        </div>
      </form>

      <div className="glass-card overflow-hidden p-0">
        {loading ? (
          <p className="py-16 text-center text-sm text-slate-500">Loading purchase orders…</p>
        ) : purchaseOrders.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-500">No purchase orders found.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/50">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">PO No.</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Company</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Supplier</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">VAT %</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Grand Total</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500" />
                  </tr>
                </thead>
                <tbody>
                  {purchaseOrders.map((po) => (
                    <tr key={po.id} className="border-b border-slate-50 dark:border-slate-800/50">
                      <td className="px-5 py-4 font-semibold text-slate-800 dark:text-white">{po.poNumber}</td>
                      <td className="px-5 py-4">{companyPill(po.company)}</td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{formatDate(po.orderDate)}</td>
                      <td className="px-5 py-4">{po.supplier?.name || '—'}</td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                        {Number(po.vatRate ?? 0)}%
                      </td>
                      <td className="px-5 py-4 text-right font-medium text-slate-800 dark:text-white">
                        {formatGrandTotal(po.totalAmount)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Can permission="purchase_orders.edit">
                            <button
                              type="button"
                              onClick={() => navigate(`/purchase-orders/${po.id}/edit`)}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              Edit
                            </button>
                          </Can>
                          <button
                            type="button"
                            onClick={() => handlePrint(po)}
                            className="btn-primary !px-3 !py-1.5 !text-sm"
                          >
                            Print
                          </button>
                          <Can permission="purchase_orders.delete">
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(po)}
                              className="btn-danger !px-3 !py-1.5 !text-sm"
                            >
                              Delete
                            </button>
                          </Can>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
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

      {printPo && (
        <PurchaseOrderPrintView
          po={printPo}
          onClose={() => setPrintPo(null)}
          onPrint={() => window.print()}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Purchase Order"
        message={`Delete PO ${deleteTarget?.poNumber}? This cannot be undone.`}
        confirmText="Delete"
      />
    </div>
  );
}
