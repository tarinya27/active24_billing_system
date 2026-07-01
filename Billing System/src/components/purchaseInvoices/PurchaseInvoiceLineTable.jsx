import { Trash2 } from 'lucide-react';
import ProductSearchSelect from '../ui/ProductSearchSelect';
import { formatCurrency } from '../../utils/helpers';
import { calcPurchaseInvoiceLine } from '../../utils/pricing';

export default function PurchaseInvoiceLineTable({
  lines,
  products,
  vatEnabled,
  vatRate,
  onChange,
  onRemove,
  canRemove,
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            <th className="pb-3 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Product</th>
            <th className="pb-3 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Item Description</th>
            <th className="pb-3 pr-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Unit Price</th>
            <th className="pb-3 pr-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Units</th>
            <th className="pb-3 pr-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">VAT</th>
            <th className="pb-3 pr-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Total Price</th>
            <th className="pb-3 w-10" />
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => {
            const calc = calcPurchaseInvoiceLine(line.unitPrice, line.units, vatEnabled, vatRate);
            const product = products.find((p) => p.id === line.productId);
            return (
              <tr key={index} className="border-b border-slate-100 dark:border-slate-800/60">
                <td className="py-3 pr-3 align-top">
                  <ProductSearchSelect
                    products={products}
                    value={line.productId}
                    onChange={(id) => onChange(index, 'productId', id)}
                  />
                </td>
                <td className="py-3 pr-3 align-top">
                  <input
                    className="input-field !text-xs"
                    value={line.description}
                    onChange={(e) => onChange(index, 'description', e.target.value)}
                    placeholder={product?.name || 'Description'}
                  />
                </td>
                <td className="py-3 pr-3 align-top">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input-field !text-right !text-xs"
                    value={line.unitPrice}
                    onChange={(e) => onChange(index, 'unitPrice', e.target.value)}
                  />
                </td>
                <td className="py-3 pr-3 align-top">
                  <input
                    type="number"
                    min="1"
                    className="input-field !w-20 !text-right !text-xs"
                    value={line.units}
                    onChange={(e) => onChange(index, 'units', e.target.value)}
                  />
                </td>
                <td className="py-3 pr-3 text-right align-top font-medium text-slate-600 dark:text-slate-300">
                  {vatEnabled ? formatCurrency(calc.vatAmount) : '—'}
                </td>
                <td className="py-3 pr-3 text-right align-top font-semibold text-primary-600">
                  {formatCurrency(calc.lineTotal)}
                </td>
                <td className="py-3 align-top">
                  {canRemove && (
                    <button type="button" onClick={() => onRemove(index)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
