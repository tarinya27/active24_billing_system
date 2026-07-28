import { formatCurrency, formatDateTime } from '../../utils/helpers';

function DetailRow({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-medium text-slate-800 dark:text-slate-100">{value ?? '—'}</p>
    </div>
  );
}

export default function ProductPrintView({ products, settings, forPrint = false }) {
  const companyName = settings?.companyName || 'Active24';

  return (
    <div className={forPrint ? 'print-only bg-white p-8 text-black' : 'hidden'}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-only, .print-only * { visibility: visible; }
          .print-only { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
      <div className="mb-6 border-b border-slate-300 pb-4">
        <h1 className="text-2xl font-bold">{companyName}</h1>
        <p className="text-sm text-slate-600">Inventory Catalog — {new Date().toLocaleString('en-LK')}</p>
        <p className="text-sm text-slate-600">Total inventory items: {products.length}</p>
      </div>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-300">
            {['Code', 'Barcode', 'Name', 'Category', 'Purchase', 'Selling', 'VAT%', 'Stock', 'Status'].map((h) => (
              <th key={h} className="px-2 py-2 text-left font-semibold uppercase">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className="border-b border-slate-200">
              <td className="px-2 py-2 font-mono">{p.code}</td>
              <td className="px-2 py-2 font-mono">
                {Array.isArray(p.unitBarcodes) && p.unitBarcodes.length > 1
                  ? `${p.unitBarcodes[0]} (+${p.unitBarcodes.length - 1})`
                  : (p.unitBarcodes?.[0] || p.barcode || '—')}
              </td>
              <td className="px-2 py-2">{p.name}</td>
              <td className="px-2 py-2">{p.category?.name || '—'}</td>
              <td className="px-2 py-2 text-right">{formatCurrency(Number(p.purchasePrice ?? 0))}</td>
              <td className="px-2 py-2 text-right">{formatCurrency(Number(p.sellingPrice ?? p.defaultSellingPrice ?? 0))}</td>
              <td className="px-2 py-2 text-right">{Number(p.vatPercentage ?? 0)}%</td>
              <td className="px-2 py-2 text-right">{p.currentStock ?? 0}</td>
              <td className="px-2 py-2">{p.isActive === false ? 'Inactive' : 'Active'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-xs text-slate-500">Generated {formatDateTime(new Date())}</p>
    </div>
  );
}
