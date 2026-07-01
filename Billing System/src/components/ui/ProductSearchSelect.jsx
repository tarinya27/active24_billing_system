import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

export default function ProductSearchSelect({
  products,
  value,
  onChange,
  placeholder = 'Search product by code or name…',
  className = '',
}) {
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(
    () => products.find((p) => p.id === value),
    [products, value]
  );

  useEffect(() => {
    if (!open && selected) {
      setQuery(`${selected.code} — ${selected.name}`);
    }
    if (!value && !open) {
      setQuery('');
    }
  }, [selected, value, open]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        if (selected) setQuery(`${selected.code} — ${selected.name}`);
        else setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selected]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return products.slice(0, 25);
    return products.filter((p) => {
      const hay = `${p.code} ${p.name} ${p.barcode || ''}`.toLowerCase();
      return hay.includes(q);
    }).slice(0, 25);
  }, [products, query]);

  const handleSelect = (product) => {
    onChange(product.id);
    setQuery(`${product.code} — ${product.name}`);
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
    <div ref={wrapRef} className={`relative min-w-[200px] ${className}`}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      <input
        ref={inputRef}
        type="text"
        className="input-field !py-2 !pl-8 !pr-8 !text-xs"
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (!e.target.value.trim()) onChange('');
        }}
        onFocus={() => setOpen(true)}
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
        <ul className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-xs text-slate-500">No products found</li>
          ) : (
            filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(p)}
                  className={`w-full px-3 py-2 text-left text-xs hover:bg-primary-50 dark:hover:bg-primary-950/40 ${
                    p.id === value ? 'bg-primary-50 font-medium text-primary-700 dark:bg-primary-950/50 dark:text-primary-300' : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <span className="font-mono text-slate-500">{p.code}</span>
                  <span className="mx-1.5">—</span>
                  <span>{p.name}</span>
                  {p.barcode && <span className="mt-0.5 block font-mono text-[10px] text-slate-400">{p.barcode}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
