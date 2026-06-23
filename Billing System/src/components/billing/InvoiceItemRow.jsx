import { formatCurrency } from '../../utils/helpers';

export default function InvoiceItemRow({ item, product, onQuantityChange, onDiscountChange, onRemove }) {
  const lineTotal = item.unitPrice * item.quantity;
  const finalTotal = lineTotal - (item.discount || 0);

  return (
    <tr className="border-b border-slate-100 dark:border-slate-800">
      <td className="px-3 py-3">
        <p className="font-medium text-slate-800 dark:text-white">{product?.name || 'Unknown'}</p>
        <p className="text-xs text-slate-500">{product?.code}</p>
      </td>
      <td className="px-3 py-3">
        <input
          type="number"
          min="1"
          value={item.quantity}
          onChange={(e) => onQuantityChange(parseInt(e.target.value) || 1)}
          className="input-field !w-20 !py-1.5 text-center"
        />
      </td>
      <td className="px-3 py-3 text-right">{formatCurrency(item.unitPrice)}</td>
      <td className="px-3 py-3 text-right">{formatCurrency(lineTotal)}</td>
      <td className="px-3 py-3">
        <input
          type="number"
          min="0"
          value={item.discount || 0}
          onChange={(e) => onDiscountChange(parseFloat(e.target.value) || 0)}
          className="input-field !w-24 !py-1.5 text-right"
        />
      </td>
      <td className="px-3 py-3 text-right font-semibold">{formatCurrency(finalTotal)}</td>
      <td className="px-3 py-3">
        <button onClick={onRemove} className="text-red-500 hover:text-red-700 text-sm font-medium">Remove</button>
      </td>
    </tr>
  );
}
