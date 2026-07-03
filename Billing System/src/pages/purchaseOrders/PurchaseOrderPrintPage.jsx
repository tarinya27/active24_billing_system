import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { toast } from 'react-toastify';
import PurchaseOrderDocument from '../../components/purchaseOrders/PurchaseOrderDocument';
import { purchaseOrdersApi } from '../../api/procurement';
import { getErrorMessage } from '../../api/client';

export default function PurchaseOrderPrintPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    purchaseOrdersApi
      .get(id)
      .then((data) => {
        if (!cancelled) setPo(data);
      })
      .catch((err) => {
        toast.error(getErrorMessage(err, 'Failed to load purchase order'));
        navigate('/purchase-orders', { replace: true });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="po-print-page">
        <p className="py-24 text-center text-sm text-slate-400">Loading purchase order…</p>
      </div>
    );
  }

  if (!po) return null;

  const title = `Purchase Order No: ${po.poNumber} — ${po.supplier?.name || 'Supplier'}`;

  return (
    <div className="po-print-page">
      <header className="po-print-toolbar no-print">
        <Link to="/purchase-orders" className="po-print-back">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="po-print-toolbar-title">{title}</h1>
        <button type="button" onClick={() => window.print()} className="po-print-action">
          <Printer className="h-4 w-4" />
          Print / Save as PDF
        </button>
      </header>

      <div className="po-print-canvas">
        <PurchaseOrderDocument po={po} />
      </div>
    </div>
  );
}
