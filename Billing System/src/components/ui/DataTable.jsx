import EmptyState from './EmptyState';
import { Inbox } from 'lucide-react';

export default function DataTable({ columns, data, onRowClick, keyField = 'id' }) {
  if (!data.length) {
    return <EmptyState icon={Inbox} title="No records found" description="Try adjusting your search or filters." />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-700/60">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200/60 bg-slate-50/80 dark:border-slate-700/60 dark:bg-slate-800/50">
            {columns.map((col) => (
              <th key={col.key} className="whitespace-nowrap px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.map((row) => (
            <tr
              key={row[keyField]}
              onClick={() => onRowClick?.(row)}
              className={`bg-white/50 transition-colors dark:bg-slate-900/30 ${onRowClick ? 'cursor-pointer hover:bg-primary-50/50 dark:hover:bg-primary-950/20' : ''}`}
            >
              {columns.map((col) => (
                <td key={col.key} className="whitespace-nowrap px-4 py-3.5 text-slate-700 dark:text-slate-300">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
