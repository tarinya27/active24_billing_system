import { cn } from '../../utils/helpers';

const variants = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800',
  warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
  danger: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800',
  info: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800',
  neutral: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
};

export default function StatusBadge({ status, className }) {
  const colorMap = {
    Pending: 'warning',
    Approved: 'info',
    Received: 'success',
    Draft: 'neutral',
    Completed: 'success',
    Cancelled: 'danger',
    'In Stock': 'success',
    'Low Stock': 'warning',
    'Out of Stock': 'danger',
  };

  const variant = colorMap[status] || 'neutral';

  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', variants[variant], className)}>
      {status}
    </span>
  );
}
