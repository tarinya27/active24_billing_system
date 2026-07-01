import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'react-toastify';
import Modal from '../../components/ui/Modal';
import { productsApi } from '../../api/masters';
import { getErrorMessage } from '../../api/client';
import { readImportFile } from '../../utils/productExport';

export default function ProductImportModal({ isOpen, onClose, onImported }) {
  const inputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState(null);

  const handleFile = async (file) => {
    if (!file) return;
    setImporting(true);
    setSummary(null);
    try {
      const rows = await readImportFile(file);
      if (!rows.length) {
        toast.error('No rows found in file');
        return;
      }
      const result = await productsApi.importRows(rows);
      setSummary(result);
      if (result.created > 0) {
        toast.success(`Imported ${result.created} product(s)`);
        onImported?.();
      }
      if (result.failed > 0) {
        toast.warning(`${result.failed} row(s) failed validation`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Import failed'));
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setSummary(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Products" size="lg">
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Upload a CSV or Excel file with columns: Product Code, Barcode, Product Name, Category, Brand, Supplier, Purchase Price, Selling Price, VAT %, Reorder Level, Description, Status.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <button
          type="button"
          disabled={importing}
          onClick={() => inputRef.current?.click()}
          className="btn-secondary w-full justify-center disabled:opacity-60"
        >
          <Upload className="h-4 w-4" />
          {importing ? 'Importing…' : 'Choose File'}
        </button>

        {summary && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-900/50">
            <p className="font-medium text-slate-800 dark:text-slate-100">Import Summary</p>
            <p className="mt-2 text-emerald-600 dark:text-emerald-400">Created: {summary.created}</p>
            <p className="text-red-600 dark:text-red-400">Failed: {summary.failed}</p>
            {summary.errors?.length > 0 && (
              <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs text-slate-600 dark:text-slate-300">
                {summary.errors.map((err) => (
                  <li key={`${err.row}-${err.message}`}>Row {err.row}: {err.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
