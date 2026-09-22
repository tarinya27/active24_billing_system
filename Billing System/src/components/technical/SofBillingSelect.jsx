import { useEffect, useState } from 'react';

const OPTIONS = [
  { value: 'NONE', label: 'No' },
  { value: 'INVOICE', label: 'Invoice' },
  { value: 'DN', label: 'DN' },
];

const SELECT_CLASS = {
  NONE: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  INVOICE: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400',
  DN: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300',
};

export function displayedBillingType(row) {
  if (row?.billingSource === 'auto') return 'INVOICE';
  if (row?.billingDocType === 'INVOICE' || row?.billingDocType === 'DN') return row.billingDocType;
  return 'NONE';
}

export function savedBillingNumber(row) {
  if (row?.billingSource === 'auto') {
    return (row.invoiceNumbers || [row.invoiceNumber]).filter(Boolean).join(', ');
  }
  return String(row?.billingDocNumber || row?.invoiceNumber || '').trim();
}

export function isBillingLocked(row) {
  if (row?.billingSource === 'auto') return true;
  const type = displayedBillingType(row);
  return (type === 'INVOICE' || type === 'DN') && Boolean(savedBillingNumber(row));
}

export default function SofBillingSelect({ row, disabled, onChange }) {
  const current = displayedBillingType(row);
  const locked = isBillingLocked(row);

  return (
    <select
      className={`rounded-full border px-2.5 py-1 text-xs font-medium outline-none focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-70 ${SELECT_CLASS[current]}`}
      value={current}
      disabled={disabled || locked}
      title={
        row?.billingSource === 'auto'
          ? 'Updated automatically when an invoice is created from this SOF'
          : locked
            ? 'Invoice / DN cannot be changed after the number is saved'
            : undefined
      }
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

export function SofDocNumberInput({ value, placeholder, disabled, saving, onSave }) {
  const [draft, setDraft] = useState(value || '');

  useEffect(() => {
    setDraft(value || '');
  }, [value]);

  const next = String(draft || '').trim();
  const previous = String(value || '').trim();
  const dirty = next !== previous;

  const commit = (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (!dirty) return;
    onSave(next);
  };

  return (
    <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
      <input
        type="text"
        className="input-field h-8 min-w-[9rem] px-2.5 py-1 text-xs font-semibold text-primary-600"
        value={draft}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Enter') commit(event);
        }}
      />
      {(dirty || saving) && (
        <button
          type="button"
          className="inline-flex h-8 shrink-0 items-center rounded-lg bg-primary-600 px-2.5 text-xs font-medium text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          onClick={commit}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      )}
    </div>
  );
}
