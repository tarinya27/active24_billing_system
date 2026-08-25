import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

export default function CustomerSearchSelect({
  customers,
  value,
  onChange,
  placeholder = 'Search customer by name or mobile…',
}) {
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(
    () => customers.find((c) => c.id === value),
    [customers, value]
  );

  const selectedLabel = selected?.name || '';

  useEffect(() => {
    if (!open) setQuery(selectedLabel);
  }, [selectedLabel, open]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setQuery(selectedLabel);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedLabel]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q || (selected && q === selectedLabel.toLowerCase())) {
      return customers.slice(0, 50);
    }
    return customers.filter((c) => {
      const hay = `${c.name || ''} ${c.mobile || ''} ${c.address || ''} ${c.email || ''}`.toLowerCase();
      return hay.includes(q);
    }).slice(0, 50);
  }, [customers, query, selected, selectedLabel]);

  const handleSelect = (customer) => {
    onChange(customer.id);
    setQuery(customer.name);
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setQuery('');
    setOpen(true);
    inputRef.current?.focus();
  };

  return (
    <div ref={wrapRef} className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      <input
        ref={inputRef}
        type="text"
        className="input-field !py-2 !pl-8 !pr-8 !text-sm"
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          if (selected) setQuery('');
        }}
        autoComplete="off"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
          title="Clear"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {open && (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-xs text-slate-500">No customers found</li>
          ) : (
            filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(c)}
                  className={`w-full px-3 py-2 text-left hover:bg-primary-50 dark:hover:bg-primary-950/40 ${
                    c.id === value
                      ? 'bg-primary-50 font-medium text-primary-700 dark:bg-primary-950/50 dark:text-primary-300'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <span className="block text-sm">{c.name}</span>
                  {(c.mobile || c.address) && (
                    <span className="mt-0.5 block text-[10px] text-slate-400">
                      {[c.mobile, c.address].filter(Boolean).join(' • ')}
                    </span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
