import { useState } from 'react';
import { createPortal } from 'react-dom';
import Modal from '../ui/Modal';

function parseBarcodes(item) {
  if (Array.isArray(item?.unitBarcodes) && item.unitBarcodes.length) {
    return item.unitBarcodes.map(String);
  }
  const raw = item?.barcode;
  if (!raw || raw === '—') return [];
  return String(raw)
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);
}

/**
 * Compact barcode cell for inventory list — avoids stretching the table
 * when a product has many serialized unit barcodes.
 */
export default function InventoryBarcodesCell({ item }) {
  const [open, setOpen] = useState(false);
  const barcodes = parseBarcodes(item);

  if (!barcodes.length) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  if (barcodes.length === 1) {
    return <span className="font-mono text-xs">{barcodes[0]}</span>;
  }

  const first = barcodes[0];
  const extra = barcodes.length - 1;

  return (
    <>
      <div className="flex max-w-[11rem] items-center gap-1.5">
        <span className="truncate font-mono text-xs" title={first}>{first}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-primary-50 hover:text-primary-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-primary-950 dark:hover:text-primary-300"
          title={`View all ${barcodes.length} barcodes`}
        >
          +{extra} more
        </button>
      </div>

      {open && createPortal(
        <Modal
          isOpen={open}
          onClose={() => setOpen(false)}
          title={`Barcodes — ${item?.name || item?.code || 'Item'}`}
          size="sm"
        >
          <div className="min-w-0 space-y-3 whitespace-normal">
            <p className="text-xs text-slate-500">
              {barcodes.length} serialized unit{barcodes.length === 1 ? '' : 's'}
            </p>
            <div className="min-h-0 max-h-[min(18rem,calc(90vh-12rem))] overflow-y-auto overscroll-contain rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="flex flex-wrap gap-2">
                {barcodes.map((code) => (
                  <span
                    key={code}
                    className="rounded-full bg-white px-2.5 py-1 font-mono text-xs text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700"
                  >
                    {code}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </Modal>,
        document.body
      )}
    </>
  );
}

/** Chip grid for detail pages — wraps instead of one long line. */
export function InventoryBarcodesGrid({ item, empty = '—' }) {
  const barcodes = parseBarcodes(item);
  if (!barcodes.length) return <span>{empty}</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {barcodes.map((code) => (
        <span
          key={code}
          className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          {code}
        </span>
      ))}
    </div>
  );
}
