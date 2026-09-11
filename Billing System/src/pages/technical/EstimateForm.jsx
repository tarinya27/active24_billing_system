import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import CustomerSearchSelect from '../../components/billing/CustomerSearchSelect';
import Can from '../../components/auth/Can';
import { estimatesApi } from '../../api/technical';
import { settingsApi } from '../../api/ops';
import { getErrorMessage } from '../../api/client';
import { useCustomers } from '../../context/CustomersContext';
import { printElement } from '../../utils/printDocument';

const emptyLine = () => ({ description: '', qty: '', rate: '' });
const LINE_COUNT = 8;

function todayInputValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function toDateInput(value) {
  if (!value) return todayInputValue();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function padLines(lines) {
  const next = (Array.isArray(lines) ? lines : []).map((line) => ({
    description: line.description || '',
    qty: line.qty == null ? '' : String(line.qty),
    rate: line.rate == null ? '' : String(line.rate),
  }));
  while (next.length < LINE_COUNT) next.push(emptyLine());
  return next;
}

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function lineAmount(line) {
  if (line.qty === '' && line.rate === '') return null;
  const qty = Number(line.qty);
  const rate = Number(line.rate);
  const safeQty = Number.isFinite(qty) ? qty : 0;
  const safeRate = Number.isFinite(rate) ? rate : 0;
  return Math.round(safeQty * safeRate * 100) / 100;
}

export default function EstimateForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { customers, create, update } = useCustomers();
  const isEdit = Boolean(id) && location.pathname.endsWith('/edit');
  const isView = Boolean(id) && !isEdit;
  const isCreate = !id;
  const autoDownload = searchParams.get('download') === '1';
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));
  const [vatEnabled, setVatEnabled] = useState(true);
  const [vatRate, setVatRate] = useState(18);
  const [form, setForm] = useState({
    customerId: '',
    name: '',
    address: '',
    jobDate: todayInputValue(),
    estimateNumber: '',
    sofRef: '',
    machineModel: '',
    serialNo: '',
    lines: Array.from({ length: 8 }, emptyLine),
  });

  useEffect(() => {
    if (isCreate) {
      estimatesApi.nextNumber()
        .then((data) => {
          if (data?.estimateNumber) {
            setForm((prev) => ({ ...prev, estimateNumber: prev.estimateNumber || data.estimateNumber }));
          }
        })
        .catch(() => {});
    }
    settingsApi.get()
      .then((settings) => {
        if (!isCreate) return;
        setVatEnabled(Boolean(settings?.vatEnabled));
        setVatRate(Number(settings?.vatRate) || 0);
      })
      .catch(() => {});
  }, [isCreate]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    estimatesApi.get(id)
      .then((item) => {
        if (cancelled) return;
        const customer = item.customer || {};
        setVatEnabled(Boolean(item.vatEnabled));
        setVatRate(Number(item.vatRate) || 0);
        setForm({
          customerId: item.customerId || '',
          name: customer.name || '',
          address: customer.address || '',
          jobDate: toDateInput(item.jobDate || item.createdAt),
          estimateNumber: item.estimateNumber || '',
          sofRef: item.sofRef || '',
          machineModel: item.machineModel || '',
          serialNo: item.serialNo || '',
          lines: padLines(item.lines),
        });
      })
      .catch((err) => {
        toast.error(getErrorMessage(err, 'Failed to load estimate'));
        navigate('/technical/estimate-history');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id, navigate]);

  useEffect(() => {
    if (!autoDownload || loading || isCreate) return;
    const timer = setTimeout(() => {
      printElement('est-print-content')
        .catch(() => toast.error('Could not open download preview'))
        .finally(() => setSearchParams({}, { replace: true }));
    }, 400);
    return () => clearTimeout(timer);
  }, [autoDownload, loading, isCreate, setSearchParams]);

  const applyCustomer = (customerId) => {
    const customer = customers.find((c) => c.id === customerId);
    setForm((prev) => ({
      ...prev,
      customerId,
      name: customer?.name || '',
      address: customer?.address || '',
    }));
  };

  const updateLine = (index, patch) => {
    setForm((prev) => {
      const lines = prev.lines.map((line, i) => (i === index ? { ...line, ...patch } : line));
      return { ...prev, lines };
    });
  };

  const totals = useMemo(() => {
    const subTotal = form.lines.reduce((sum, line) => sum + (lineAmount(line) || 0), 0);
    const vatAmount = vatEnabled ? Math.round(subTotal * vatRate / 100 * 100) / 100 : 0;
    return {
      subTotal: Math.round(subTotal * 100) / 100,
      vatAmount,
      total: Math.round((subTotal + vatAmount) * 100) / 100,
    };
  }, [form.lines, vatEnabled, vatRate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isView) return;
    if (!form.name.trim()) {
      toast.error('Enter the customer name');
      return;
    }

    setSaving(true);
    try {
      let customerId = form.customerId;
      const customerPayload = {
        name: form.name.trim(),
        address: form.address.trim() || null,
      };

      if (customerId) {
        await update(customerId, customerPayload);
      } else {
        const createdCustomer = await create({
          ...customerPayload,
          type: 'INDIVIDUAL',
        });
        customerId = createdCustomer.id;
        setForm((prev) => ({ ...prev, customerId }));
      }

      const payload = {
        customerId,
        jobDate: form.jobDate || null,
        sofRef: form.sofRef.trim() || null,
        machineModel: form.machineModel.trim() || null,
        serialNo: form.serialNo.trim() || null,
        vatEnabled,
        vatRate: vatEnabled ? vatRate : 0,
        lines: form.lines,
      };

      if (isEdit) {
        const updated = await estimatesApi.update(id, payload);
        toast.success(`Estimate ${updated.estimateNumber} updated`);
      } else {
        const created = await estimatesApi.create(payload);
        setForm((prev) => ({ ...prev, estimateNumber: created.estimateNumber }));
        toast.success(`Estimate ${created.estimateNumber} created`);
      }
      navigate('/technical/estimate-history');
    } catch (err) {
      toast.error(getErrorMessage(err, isEdit ? 'Failed to update estimate' : 'Failed to save estimate'));
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    printElement('est-print-content').catch(() => {
      toast.error('Could not open print preview');
    });
  };

  return (
    <div className="sof-page">
      <PageHeader
        title={isView ? `Estimate ${form.estimateNumber || ''}`.trim() : isEdit ? 'Edit Estimate' : 'Estimate'}
        subtitle="Genius Associates estimate"
        actions={(
          <div className="sof-page-actions flex gap-2">
            <button type="button" className="btn-secondary" onClick={() => navigate('/technical/estimate-history')}>
              View history
            </button>
            {isView && (
              <Can permission="estimates.edit">
                <button type="button" className="btn-secondary" onClick={() => navigate(`/technical/estimates/${id}/edit`)}>
                  Edit
                </button>
              </Can>
            )}
            <button type="button" className="btn-secondary" onClick={handlePrint}>
              Download
            </button>
            {!isView && (
              <button type="submit" form="est-print-content" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : isEdit ? 'Update estimate' : 'Save estimate'}
              </button>
            )}
          </div>
        )}
      />

      {loading ? (
        <p className="py-12 text-center text-slate-400">Loading estimate…</p>
      ) : (
      <div className="sof-doc-wrap">
        <form id="est-print-content" onSubmit={handleSubmit} className={`sof-doc est-doc${isView ? ' sof-readonly' : ''}`}>
          <div className="est-header">
            <div className="est-company">
              <h1>Genius Associates (Pvt) Ltd</h1>
              <p>No. 1,</p>
              <p>Skelton Gardens,</p>
              <p>Colombo 05.</p>
              <p>Tel: 0115522266/7 , 0115656578</p>
              <p>E-mail: technical1@geniuslanka.com</p>
            </div>
            <div className="est-header-right">
              <h2 className="est-title">Estimate</h2>
              <table className="est-meta">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>REF No.</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <input
                        type="date"
                        value={form.jobDate}
                        onChange={(e) => setForm((prev) => ({ ...prev, jobDate: e.target.value }))}
                      />
                    </td>
                    <td>{form.estimateNumber || '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="est-split">
            <div className="est-name-box">
              <div className="est-box-title">Name / Address</div>
              <div className="est-box-body">
                <div className={`sof-search no-print${isView ? ' hidden' : ''}`}>
                  <CustomerSearchSelect
                    customers={customers}
                    value={form.customerId}
                    onChange={applyCustomer}
                    placeholder="Search existing customer…"
                  />
                </div>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Customer name"
                />
                <textarea
                  rows={4}
                  value={form.address}
                  onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Address"
                />
              </div>
            </div>
            <table className="est-machine">
              <tbody>
                <tr>
                  <th>S.O.F No.</th>
                  <td>
                    <input
                      value={form.sofRef}
                      onChange={(e) => setForm((prev) => ({ ...prev, sofRef: e.target.value }))}
                    />
                  </td>
                </tr>
                <tr>
                  <th>Model</th>
                  <td>
                    <input
                      value={form.machineModel}
                      onChange={(e) => setForm((prev) => ({ ...prev, machineModel: e.target.value }))}
                    />
                  </td>
                </tr>
                <tr>
                  <th>Serial No.</th>
                  <td>
                    <input
                      value={form.serialNo}
                      onChange={(e) => setForm((prev) => ({ ...prev, serialNo: e.target.value }))}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <table className="est-lines">
            <thead>
              <tr>
                <th className="col-desc">Description</th>
                <th className="col-qty">Qty</th>
                <th className="col-rate">Rate</th>
                <th className="col-total">Total</th>
              </tr>
            </thead>
            <tbody>
              {form.lines.map((line, index) => {
                const amount = lineAmount(line);
                return (
                  <tr key={index}>
                    <td className="col-desc">
                      <textarea
                        rows={1}
                        value={line.description}
                        onChange={(e) => updateLine(index, { description: e.target.value })}
                      />
                    </td>
                    <td className="col-qty">
                      <input
                        value={line.qty}
                        onChange={(e) => updateLine(index, { qty: e.target.value })}
                      />
                    </td>
                    <td className="col-rate">
                      <input
                        value={line.rate}
                        onChange={(e) => updateLine(index, { rate: e.target.value })}
                      />
                    </td>
                    <td className="col-total">{amount == null ? '' : money(amount)}</td>
                  </tr>
                );
              })}
              {vatEnabled && vatRate > 0 && (
                <tr className="est-vat-row">
                  <td className="col-desc">VAT {vatRate}%</td>
                  <td className="col-qty" />
                  <td className="col-rate">{Number(vatRate).toFixed(2)}%</td>
                  <td className="col-total">{money(totals.vatAmount)}</td>
                </tr>
              )}
              {Array.from({ length: 5 }, (_, index) => (
                <tr key={`spacer-${index}`} className="est-spacer-row">
                  <td className="col-desc" />
                  <td className="col-qty" />
                  <td className="col-rate" />
                  <td className="col-total" />
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="est-grand-row">
                <td colSpan={3} className="est-grand-label">Total</td>
                <td className="col-total">{money(totals.total)}</td>
              </tr>
            </tfoot>
          </table>

          <div className="est-terms">
            <h3>TERMS &amp; CONDITIONS</h3>
            <div className="est-terms-body">
              <p>This estimate is valid only for a period of 7 Days</p>
              <p>To commence with the work you should send the confirmation of the estimate by return fax or email</p>
              <p>after confirmation of the estimate, the repaired can be collected only after 24 hours (after Testing)</p>
              <p>Spare parts marked with * mark are not available and need 2-3 weeks after confirmation</p>
              <p>This estimate is not the final bill</p>
              <p>During Repair, if other component is found defective we&apos;ll send you a revised estimate</p>
              <p>If Collect repairs a minimum estimate charge would be Rs.1,500.00</p>
              <p>Repair Computer Could Collect/Deliver on sending the above payment by cash/Cheque after approving the above estimate.</p>
            </div>
            <p className="est-disclaimer">
              This is Computer generated estimation and Signature no therefore no signature or Company seal on this.
            </p>
            <div className="est-signoff">
              <p>Thank you</p>
              <p>Yours faith fully</p>
              <p>Genius Associates (Pvt) Ltd</p>
            </div>
            <div className="est-phones">
              <p>....................</p>
              <p>0777 300210</p>
              <p>0115656578/ 0115522266</p>
            </div>
          </div>
        </form>
      </div>
      )}
    </div>
  );
}
