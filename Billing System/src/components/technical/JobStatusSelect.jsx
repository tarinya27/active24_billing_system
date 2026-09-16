const OPTIONS = [
  { value: 'OPEN', label: 'Processing' },
  { value: 'COMPLETED', label: 'Completed' },
];

const SELECT_CLASS = {
  OPEN: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  COMPLETED: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
};

export function toJobStatus(status) {
  return status === 'COMPLETED' ? 'COMPLETED' : 'OPEN';
}

export default function JobStatusSelect({ value, onChange, disabled }) {
  const current = toJobStatus(value);

  return (
    <select
      className={`rounded-full border px-2.5 py-1 text-xs font-medium outline-none focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-70 ${SELECT_CLASS[current]}`}
      value={current}
      disabled={disabled}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.target.value)}
    >
      {OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
