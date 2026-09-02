import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Printer, Pencil } from 'lucide-react';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import SearchBar from '../../components/ui/SearchBar';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';
import CustomerSearchSelect from '../../components/billing/CustomerSearchSelect';
import InvoicePrintView from '../../components/billing/InvoicePrintView';
import { useServerList } from '../../hooks/useServerList';
import { customersApi } from '../../api/masters';
import { invoicesApi, settingsApi, PAYMENT_METHOD_LABEL, PAYMENT_METHOD_API } from '../../api/ops';
import { getErrorMessage } from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { PAYMENT_METHODS } from '../../utils/constants';
import { printElement } from '../../utils/printDocument';

function toYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function rangeForPreset(preset) {
  const now = new Date();
  const today = toYmd(now);
  if (preset === 'today') return { dateFrom: today, dateTo: today };
  if (preset === 'week') {
    const start = new Date(now);
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    return { dateFrom: toYmd(start), dateTo: today };
  }
  if (preset === 'month') {
    return { dateFrom: toYmd(new Date(now.getFullYear(), now.getMonth(), 1)), dateTo: today };
  }
  return { dateFrom: '', dateTo: '' };
}

export default function InvoiceHistory() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [datePreset, setDatePreset] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('All');
  const [status, setStatus] = useState('All');
  const [applied, setApplied] = useState({
    search: '',
    dateFrom: '',
    dateTo: '',
    customerId: '',
    paymentMethod: 'All',
    status: 'All',
  });
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    customersApi.list({ pageSize: 200 }).then((result) => {
      setCustomers(result.items || result || []);
    }).catch((err) => toast.error(getErrorMessage(err, 'Failed to load customers')));
    settingsApi.get().then(setSettings).catch(() => {});
  }, []);

  const queryParams = useMemo(() => {
    const params = { pageSize: 25 };
    if (applied.search) params.search = applied.search;
    if (applied.dateFrom) params.dateFrom = applied.dateFrom;
    if (applied.dateTo) params.dateTo = applied.dateTo;
    if (applied.customerId) params.customerId = applied.customerId;
    if (applied.paymentMethod && applied.paymentMethod !== 'All') {
      params.paymentMethod = PAYMENT_METHOD_API[applied.paymentMethod] || applied.paymentMethod;
    }
    if (applied.status && applied.status !== 'All') params.status = applied.status;
    return params;
  }, [applied]);

  const {
    items: invoices,
    loading,
    goToPage,
    total: totalItems,
    page,
    pageSize,
    totalPages,
    setPage,
    changePageSize,
  } = useServerList(invoicesApi, queryParams, [queryParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setApplied((prev) => ({ ...prev, search: searchInput.trim() }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, setPage]);

  const applyFilters = (next) => {
    setPage(1);
    setApplied((prev) => ({ ...prev, ...next }));
  };

  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    if (preset === 'custom') return;
    const range = rangeForPreset(preset);
    setDateFrom(range.dateFrom);
    setDateTo(range.dateTo);
    applyFilters(range);
  };

  const handleCustomDate = (from, to) => {
    setDateFrom(from);
    setDateTo(to);
    setDatePreset('custom');
    applyFilters({ dateFrom: from, dateTo: to });
  };

  const handleClear = () => {
    setSearchInput('');
    setDatePreset('all');
    setDateFrom('');
    setDateTo('');
    setCustomerId('');
    setPaymentMethod('All');
    setStatus('All');
    setApplied({
      search: '',
      dateFrom: '',
      dateTo: '',
      customerId: '',
      paymentMethod: 'All',
      status: 'All',
    });
    setPage(1);
  };

  const mapInvoiceForView = (full) => ({
    ...full,
    date: full.createdAt,
    cashier: full.cashier?.name,
    paymentMethod: PAYMENT_METHOD_LABEL[full.paymentMethod] || full.paymentMethod,
    customer: full.customer,
    poNumber: full.poNumber ?? null,
    poNo: full.poNo ?? null,
    sofNo: full.sofNo ?? null,
    supplierTin: full.supplierTin ?? null,
    items: (full.items || []).map((item) => {
      const barcodes = item.barcodes?.length
        ? item.barcodes
        : (item.units || []).map((u) => u.barcode).filter(Boolean);
      const primaryBarcode = barcodes[0] || item.productUnit?.barcode || null;
      return {
        ...item,
        productName: item.itemType === 'SERVICE'
          ? (item.description || 'Service')
          : (item.product?.name || item.itemDescription || item.description),
        itemDescription: item.itemDescription || item.description || null,
        barcode: primaryBarcode,
        barcodes,
        quantity: Number(item.quantity ?? 1),
      };
    }),
  });

  const openInvoice = async (invoice, { printAfter } = {}) => {
    try {
      const full = await invoicesApi.get(invoice.id);
      const view = mapInvoiceForView(full);
      setPreview(view);
      if (printAfter) {
        setTimeout(() => {
          printElement('invoice-print-content').catch((err) => {
            console.error(err);
            toast.error('Could not open print preview. Please try again.');
          });
        }, 400);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load invoice'));
    }
  };

  const handlePrint = () => {
    printElement('invoice-print-content').catch((err) => {
      console.error(err);
      toast.error('Could not open print preview. Please try again.');
    });
  };

  const columns = [
    {
      key: 'invoiceNumber',
      label: 'Invoice No.',
      render: (row) => <span className="font-semibold text-primary-600">{row.invoiceNumber}</span>,
    },
    {
      key: 'createdAt',
      label: 'Date',
      render: (row) => formatDate(row.createdAt),
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (row) => row.customer?.name || '—',
    },
    {
      key: 'mobile',
      label: 'Mobile',
      render: (row) => row.customer?.mobile || '—',
    },
    {
      key: 'grandTotal',
      label: 'Total',
      render: (row) => <span className="font-medium">{formatCurrency(row.grandTotal)}</span>,
    },
    {
      key: 'paymentMethod',
      label: 'Payment',
      render: (row) => PAYMENT_METHOD_LABEL[row.paymentMethod] || row.paymentMethod,
    },
    {
      key: 'lines',
      label: 'Lines',
      render: (row) => row._count?.items ?? row.items?.length ?? 0,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <StatusBadge status={row.status} />
          {row.paymentMethod === 'CREDIT' && row.creditStatus && (
            <StatusBadge status={row.creditStatus} />
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            title="View"
            onClick={() => openInvoice(row)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Print / Reprint"
            onClick={() => openInvoice(row, { printAfter: true })}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800"
          >
            <Printer className="h-4 w-4" />
          </button>
          {row.status !== 'CANCELLED' && (
            <button
              type="button"
              title="Edit customer / payment"
              onClick={() => navigate(`/billing?edit=${row.id}`)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Invoice History"
        subtitle="Search, view and reprint every invoice stored in the system"
      />

      <div className="glass-card mb-6 space-y-4 p-4">
        <SearchBar
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search invoice number, customer, mobile, amount..."
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Date Range</label>
            <select
              value={datePreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="select-field !text-sm"
            >
              <option value="all">All dates</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Customer</label>
            <CustomerSearchSelect
              customers={customers}
              value={customerId}
              onChange={(id) => {
                setCustomerId(id);
                applyFilters({ customerId: id });
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => {
                setPaymentMethod(e.target.value);
                applyFilters({ paymentMethod: e.target.value });
              }}
              className="select-field !text-sm"
            >
              <option value="All">All methods</option>
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                applyFilters({ status: e.target.value });
              }}
              className="select-field !text-sm"
            >
              <option value="All">All statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
        {datePreset === 'custom' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => handleCustomDate(e.target.value, dateTo)}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => handleCustomDate(dateFrom, e.target.value)}
                className="input-field"
              />
            </div>
          </div>
        )}
        <div className="flex justify-end">
          <button type="button" onClick={handleClear} className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            Clear filters
          </button>
        </div>
      </div>

      <div className="glass-card p-4">
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading invoices…</p>
        ) : (
          <>
            <DataTable columns={columns} data={invoices} onRowClick={(row) => openInvoice(row)} />
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={goToPage}
                totalItems={totalItems}
                itemsPerPage={pageSize}
                pageSize={pageSize}
                onPageSizeChange={changePageSize}
                pageSizeOptions={[25, 50, 100]}
              />
            </div>
          </>
        )}
      </div>

      <Modal isOpen={Boolean(preview)} onClose={() => setPreview(null)} title="Invoice Preview — A4" size="xl">
        {preview && (
          <div className="rounded-lg bg-slate-100 p-4 dark:bg-slate-950">
            <InvoicePrintView
              invoice={preview}
              settings={settings}
              onClose={() => setPreview(null)}
              onPrint={handlePrint}
              onEdit={
                preview.status === 'CANCELLED'
                  ? undefined
                  : () => navigate(`/billing?edit=${preview.id}`)
              }
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
