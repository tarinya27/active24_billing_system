import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import CustomerSearchSelect from '../../components/billing/CustomerSearchSelect';
import { sofApi } from '../../api/technical';
import { getErrorMessage } from '../../api/client';
import { useCustomers } from '../../context/CustomersContext';
import { formatShipToBlock } from '../../utils/helpers';
import { printElement } from '../../utils/printDocument';

const emptyLine = () => ({ item: '', description: '', qty: '', fault: '' });

function todayInputValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export default function SofForm() {
  const navigate = useNavigate();
  const { customers, create, update } = useCustomers();
  const [saving, setSaving] = useState(false);
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
    lines: Array.from({ length: 6 }, emptyLine),
  });

  useEffect(() => {
    sofApi.nextNumber()
      .then((data) => {
        if (data?.sofNumber) {
          setForm((prev) => ({ ...prev, sofNumber: prev.sofNumber || data.sofNumber }));
        }
      })
      .catch(() => {});
  }, []);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
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

      const created = await sofApi.create({
        customerId,
        jobDate: form.jobDate || null,
        shipTo: form.shipTo.trim() || null,
        technician: form.technician.trim() || null,
        jobStatus: form.jobStatus.trim() || null,
        createdPerson: form.createdPerson.trim() || null,
        receivedBy: form.receivedBy.trim() || null,
        customerSignature: form.customerSignature.trim() || null,
        lines: form.lines,
      });
      setForm((prev) => ({ ...prev, sofNumber: created.sofNumber }));
      toast.success(`Service order ${created.sofNumber} created`);
      navigate('/technical/sof-history');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save service order'));
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
        title="Service Order Form"
        subtitle="Genius Associates service order"
        actions={(
          <div className="sof-page-actions flex gap-2">
            <button type="button" className="btn-secondary" onClick={() => navigate('/technical/sof-history')}>
              View history
            </button>
            <button type="button" className="btn-secondary" onClick={handlePrint}>
              Print
            </button>
            <button type="submit" form="sof-print-content" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save SOF'}
            </button>
          </div>
        )}
      />

      <div className="sof-doc-wrap">
        <form id="sof-print-content" onSubmit={handleSubmit} className="sof-doc">
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
                <div className="sof-search no-print">
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
                  <div className="sof-search no-print">
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
                        value={form.jobStatus}
                        onChange={(e) => setForm((prev) => ({ ...prev, jobStatus: e.target.value }))}
                      />
                    </td>
                    <td>
                      <input
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
                <th className="col-item">Item</th>
                <th className="col-desc">Description</th>
                <th className="col-qty">Qty</th>
                <th className="col-fault">Fault</th>
              </tr>
            </thead>
            <tbody>
              {form.lines.map((line, index) => (
                <tr key={index}>
                  <td className="col-item">
                    <textarea
                      rows={2}
                      value={line.item}
                      onChange={(e) => updateLine(index, { item: e.target.value })}
                    />
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
                    <textarea
                      rows={2}
                      value={line.fault}
                      onChange={(e) => updateLine(index, { fault: e.target.value })}
                    />
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
    </div>
  );
}
