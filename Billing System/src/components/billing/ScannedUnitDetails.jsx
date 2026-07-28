import { PackageCheck, ScanLine } from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';

function DetailField({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{value || '—'}</p>
    </div>
  );
}

export default function ScannedUnitDetails({ item, highlight = false }) {
  if (!item) return null;

  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'border-primary-300 bg-primary-50/50 dark:border-primary-800 dark:bg-primary-950/30' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40'}`}>
      <div className="mb-3 flex items-start gap-2">
        <PackageCheck className={`mt-0.5 h-4 w-4 shrink-0 ${highlight ? 'text-primary-600' : 'text-slate-400'}`} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{item.productName}</p>
          <p className="font-mono text-xs text-slate-500">{item.productCode}</p>
          <p className="mt-1 font-mono text-[11px] text-primary-600">{item.barcode}</p>
        </div>
      </div>

      {item.description && (
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">{item.description}</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <DetailField label="Category" value={item.category} />
        {item.stockSource !== 'DN' && (
          <>
            <DetailField label="GRN No." value={item.grnNumber} />
            <DetailField label="PO No." value={item.poNumber} />
            <DetailField label="Purchase Invoice No." value={item.purchaseInvoiceNo} />
          </>
        )}
        <DetailField label="Purchase Price" value={formatCurrency(item.purchasePrice)} />
        <DetailField label="Selling Price" value={formatCurrency(item.unitPrice)} />
      </div>
    </div>
  );
}

export function ScannedUnitEmpty() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-12 text-center dark:border-slate-700">
      <ScanLine className="mb-3 h-8 w-8 text-slate-300" />
      <p className="text-sm text-slate-500">Scan a unit barcode from inventory</p>
      <p className="mt-1 text-xs text-slate-400">Product and pricing details will appear here</p>
    </div>
  );
}
