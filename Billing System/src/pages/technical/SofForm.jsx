import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import CustomerSearchSelect from '../../components/billing/CustomerSearchSelect';
import Can from '../../components/auth/Can';
import { sofApi } from '../../api/technical';
import { categoriesApi } from '../../api/masters';
import { getErrorMessage } from '../../api/client';
import { useCustomers } from '../../context/CustomersContext';
import { formatShipToBlock } from '../../utils/helpers';
import { printElement } from '../../utils/printDocument';

const emptyLine = () => ({ categoryId: '', item: '', description: '', qty: '', fault: '', faultOption: '' });
const LINE_COUNT = 6;
const LEGACY_PREFIX = '__legacy:';
const FAULT_OTHER = 'Other';
const FAULT_OPTIONS = [
  'No power',
  'Hinch damage',
  'No display',
  'Windows problem',
  'Software problem',
  'No backup',
  'Not printing',
  'Auto restart',
  FAULT_OTHER,
];
const FAULT_PRESETS = FAULT_OPTIONS.filter((option) => option !== FAULT_OTHER);

function faultOptionFromValue(fault) {
  if (!fault) return '';
  if (FAULT_PRESETS.includes(fault)) return fault;
  return FAULT_OTHER;
}

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
    categoryId: line.categoryId || '',
    item: line.item || '',
    description: line.description || '',
    qty: line.qty == null ? '' : String(line.qty),
    fault: line.fault || '',
    faultOption: faultOptionFromValue(line.fault),
  }));
  while (next.length < LINE_COUNT) next.push(emptyLine());
  return next;
}

function normalizeCategories(data) {
  return Array.isArray(data) ? data : data?.items || [];
}

function lineCategoryValue(line, categories) {
  if (line.categoryId && categories.some((category) => category.id === line.categoryId)) {
    return line.categoryId;
  }
  const byName = categories.find((category) => category.name === line.item);
  if (byName) return byName.id;
  if (line.item) return `${LEGACY_PREFIX}${line.item}`;
  return '';
}

function lineCategoryLabel(line, categories) {
  const byId = categories.find((category) => category.id === line.categoryId);
  if (byId) return byId.name;
  return line.item || '';
}

function categoryChoices(categories, line) {
  const seen = new Set();
  const choices = [];
  categories.forEach((category) => {
    if (!category?.id || seen.has(category.id)) return;
    seen.add(category.id);
    choices.push(category);
  });
  const value = lineCategoryValue(line, categories);
  if (value.startsWith(LEGACY_PREFIX)) {
    choices.push({ id: value, name: line.item, legacy: true });
  }
  return choices;
}

export default function SofForm() {
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
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    customerId: '',
    name: '',
    mobile: '',
    address: '',
    jobDate: todayInputValue(),
    sofNumber: '',
    shipToCustomerId: '',
    shipTo: '',
    technician: '',
    jobStatus: '',
    createdPerson: '',
    receivedBy: '',
    customerSignature: '',
    lines: Array.from({ length: LINE_COUNT }, emptyLine),
  });

  useEffect(() => {
    if (!isCreate) return;
    sofApi.nextNumber()
      .then((data) => {
        if (data?.sofNumber) {
          setForm((prev) => ({ ...prev, sofNumber: prev.sofNumber || data.sofNumber }));
        }
      })
      .catch(() => {});
  }, [isCreate]);

  const loadCategories = useCallback((notifyError = false) => {
    categoriesApi.list()
      .then((data) => setCategories(normalizeCategories(data)))
      .catch(() => {
        if (notifyError) toast.error('Failed to load categories');
      });
  }, []);

  useEffect(() => {
    loadCategories(true);
    const refresh = () => loadCategories(false);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadCategories]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    sofApi.get(id)
      .then((item) => {
        if (cancelled) return;
        const customer = item.customer || {};
        setForm({
          customerId: item.customerId || '',
          name: customer.name || '',
          mobile: customer.mobile || '',
          address: customer.address || '',
          jobDate: toDateInput(item.jobDate || item.createdAt),
          sofNumber: item.sofNumber || '',
          shipToCustomerId: '',
          shipTo: item.shipTo || '',
          technician: item.technician || '',
          jobStatus: item.jobStatus || '',
          createdPerson: item.createdPerson || '',
          receivedBy: item.receivedBy || '',
          customerSignature: item.customerSignature || '',
          lines: padLines(item.lines),
        });
      })
      .catch((err) => {
        toast.error(getErrorMessage(err, 'Failed to load service order'));
        navigate('/technical/sof-history');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id, navigate]);

  useEffect(() => {
    if (!autoDownload || loading || isCreate) return;
    const timer = setTimeout(() => {
      printElement('sof-print-content')
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
      mobile: customer?.mobile || '',
      address: customer?.address || '',
    }));
  };

  const applyShipToCustomer = (customerId) => {
    const customer = customers.find((c) => c.id === customerId);
    setForm((prev) => ({
      ...prev,
      shipToCustomerId: customerId,
      shipTo: customer ? formatShipToBlock(customer) : prev.shipTo,
    }));
  };

  const updateLine = (index, patch) => {
    setForm((prev) => {
      const lines = prev.lines.map((line, i) => (i === index ? { ...line, ...patch } : line));
      return { ...prev, lines };
    });
  };

  const updateLineCategory = (index, value) => {
    if (value.startsWith(LEGACY_PREFIX)) return;
    const category = categories.find((item) => item.id === value);
    updateLine(index, {
      categoryId: value,
      item: category?.name || '',
    });
  };

  const updateLineFaultOption = (index, value) => {
    setForm((prev) => {
      const lines = prev.lines.map((line, i) => {
        if (i !== index) return line;
        if (value === FAULT_OTHER) {
          return {
            ...line,
            faultOption: FAULT_OTHER,
            fault: FAULT_PRESETS.includes(line.fault) ? '' : line.fault,
          };
        }
        return { ...line, faultOption: value, fault: value };
      });
      return { ...prev, lines };
    });
  };

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
        mobile: form.mobile.trim() || null,
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
        shipTo: form.shipTo.trim() || null,
        technician: form.technician.trim() || null,
        jobStatus: form.jobStatus.trim() || null,
        createdPerson: form.createdPerson.trim() || null,
        receivedBy: form.receivedBy.trim() || null,
        customerSignature: form.customerSignature.trim() || null,
        lines: form.lines.map((line) => {
          const category = categories.find((item) => item.id === line.categoryId)
            || categories.find((item) => item.name === line.item);
          return {
            ...line,
            categoryId: category?.id || line.categoryId || null,
            item: category?.name || line.item || '',
          };
        }),
      };

      if (isEdit) {
        const updated = await sofApi.update(id, payload);
        toast.success(`Service order ${updated.sofNumber} updated`);
      } else {
        const created = await sofApi.create(payload);
        setForm((prev) => ({ ...prev, sofNumber: created.sofNumber }));
        toast.success(`Service order ${created.sofNumber} created`);
      }
      navigate('/technical/sof-history');
    } catch (err) {
      toast.error(getErrorMessage(err, isEdit ? 'Failed to update service order' : 'Failed to save service order'));
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    printElement('sof-print-content').catch(() => {
      toast.error('Could not open print preview');
    });
  };

  return (
    <div className="sof-page">
      <PageHeader
        title={isView ? `Service Order ${form.sofNumber || ''}`.trim() : isEdit ? 'Edit Service Order Form' : 'Service Order Form'}
        subtitle="Genius Associates service order"
        actions={(
          <div className="sof-page-actions flex gap-2">
            <button type="button" className="btn-secondary" onClick={() => navigate('/technical/sof-history')}>
              View history
            </button>
            {isView && (
              <Can permission="sof.edit">
                <button type="button" className="btn-secondary" onClick={() => navigate(`/technical/sof/${id}/edit`)}>
                  Edit
                </button>
              </Can>
            )}
            <button type="button" className="btn-secondary" onClick={handlePrint}>
              Download
            </button>
            {!isView && (
              <button type="submit" form="sof-print-content" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : isEdit ? 'Update SOF' : 'Save SOF'}
              </button>
            )}
          </div>
        )}
      />

      {loading ? (
        <p className="py-12 text-center text-slate-400">Loading service order…</p>
      ) : (
      <div className="sof-doc-wrap">
        <form id="sof-print-content" onSubmit={handleSubmit} className={`sof-doc${isView ? ' sof-readonly' : ''}`}>
          <div className="sof-header">
            <div className="sof-brand">
              <img src="/genius-logo.png" alt="Genius" className="sof-logo" />
              <div className="sof-company">
                <h1>Genius Associates (Pvt) Ltd</h1>
                <p>No. 1, Skelton Gardens, Colombo 05.</p>
                <p>Tel: 0115522266/7 , 0115656578, 0777300210</p>
                <p>E-mail: technical1@geniuslanka.com</p>
              </div>
            </div>
            <div className="sof-header-right">
              <h2 className="sof-title">Service Order Form</h2>
              <table className="sof-meta">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>S.O. No.</th>
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
                    <td>{form.sofNumber || '—'}</td>
                  </tr>
                </tbody>
              </table>
              <label className="sof-created">
                <span>Created person</span>
                <input
                  value={form.createdPerson}
                  onChange={(e) => setForm((prev) => ({ ...prev, createdPerson: e.target.value }))}
                  placeholder="Type name here"
                />
              </label>
            </div>
          </div>

          <div className="sof-split">
            <div className="sof-box">
              <div className="sof-box-title">Name / Address</div>
              <div className="sof-box-body">
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
                <input
                  value={form.mobile}
                  onChange={(e) => setForm((prev) => ({ ...prev, mobile: e.target.value }))}
                  placeholder="Telephone"
                />
                <textarea
                  rows={3}
                  value={form.address}
                  onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Address"
                />
              </div>
            </div>
            <div className="sof-right-col">
              <div className="sof-box">
                <div className="sof-box-title">Ship To</div>
                <div className="sof-box-body">
                  <div className={`sof-search no-print${isView ? ' hidden' : ''}`}>
                    <CustomerSearchSelect
                      customers={customers}
                      value={form.shipToCustomerId}
                      onChange={applyShipToCustomer}
                      placeholder="Search customer or type below…"
                    />
                  </div>
                  <textarea
                    rows={4}
                    value={form.shipTo}
                    onChange={(e) => setForm((prev) => ({ ...prev, shipTo: e.target.value }))}
                    placeholder="Type ship-to name and address"
                  />
                </div>
              </div>
              <table className="sof-status">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Technician</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <input
                        size={1}
                        value={form.jobStatus}
                        onChange={(e) => setForm((prev) => ({ ...prev, jobStatus: e.target.value }))}
                      />
                    </td>
                    <td>
                      <input
                        size={1}
                        value={form.technician}
                        onChange={(e) => setForm((prev) => ({ ...prev, technician: e.target.value }))}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <table className="sof-lines">
            <thead>
              <tr>
                <th className="col-item">Category</th>
                <th className="col-desc">Description</th>
                <th className="col-qty">Qty</th>
                <th className="col-fault">Fault</th>
              </tr>
            </thead>
            <tbody>
              {form.lines.map((line, index) => (
                <tr key={index}>
                  <td className="col-item">
                    {isView ? (
                      <span>{lineCategoryLabel(line, categories)}</span>
                    ) : (
                      <select
                        value={lineCategoryValue(line, categories)}
                        onChange={(e) => updateLineCategory(index, e.target.value)}
                      >
                        <option value="" />
                        {categoryChoices(categories, line).map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.isActive === false ? `${category.name} (Inactive)` : category.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="col-desc">
                    <textarea
                      rows={2}
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
                  <td className="col-fault">
                    {isView ? (
                      <span>{line.fault || ''}</span>
                    ) : (
                      <div className="sof-fault-cell" data-print-text={line.fault || ''}>
                        <select
                          value={line.faultOption || ''}
                          onChange={(e) => updateLineFaultOption(index, e.target.value)}
                        >
                          <option value="" />
                          {FAULT_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                        {line.faultOption === FAULT_OTHER && (
                          <input
                            className="sof-fault-other"
                            value={line.fault}
                            onChange={(e) => updateLine(index, { fault: e.target.value })}
                            placeholder="Enter fault"
                          />
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="sof-sign-row">
            <div className="sof-sign">
              <label>Received By</label>
              <input
                value={form.receivedBy}
                onChange={(e) => setForm((prev) => ({ ...prev, receivedBy: e.target.value }))}
              />
            </div>
            <div className="sof-sign">
              <label>Customer Signature/Name</label>
              <input
                value={form.customerSignature}
                onChange={(e) => setForm((prev) => ({ ...prev, customerSignature: e.target.value }))}
              />
            </div>
          </div>

          <p className="sof-note">
            <strong>NOTE:</strong> Please Produce this receipt on collection. Item will not be released without the payment unless it covered by warranty or maintainance. minimum inspection charge would be Rs.1000.00
          </p>
        </form>
      </div>
      )}
    </div>
  );
}
