import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Database, RefreshCw, Wifi, CheckCircle2, AlertCircle, Upload, FileJson } from 'lucide-react';
import { toast } from 'react-toastify';
import PageHeader from '../../components/ui/PageHeader';
import { purchaseOrdersApi } from '../../api/procurement';
import { getErrorMessage } from '../../api/client';

function MigrationResult({ result }) {
  if (!result) return null;

  return (
    <div className="glass-card p-6">
      <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
        Last migration result
        {result.source === 'backup' && result.totalInFile != null && (
          <span className="ml-2 font-normal text-slate-500">({result.totalInFile} PO(s) in file)</span>
        )}
      </h3>
      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <span className="rounded-lg bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
          Created: {result.created}
        </span>
        <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          Skipped: {result.skipped}
        </span>
        {result.errors > 0 && (
          <span className="rounded-lg bg-rose-50 px-3 py-1.5 font-medium text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">
            Errors: {result.errors}
          </span>
        )}
      </div>

      {result.details?.length > 0 && (
        <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">PO</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Action</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Details</th>
              </tr>
            </thead>
            <tbody>
              {result.details.map((row, i) => (
                <tr key={`${row.poNumber}-${i}`} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2 font-medium">{row.poNumber}</td>
                  <td className="px-3 py-2 capitalize">{row.action}</td>
                  <td className="px-3 py-2 text-slate-500">
                    {row.reason || row.supplier || (row.totalAmount != null ? `LKR ${row.totalAmount}` : '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function PurchaseOrderMigration() {
  const fileRef = useRef(null);
  const [connection, setConnection] = useState(null);
  const [testing, setTesting] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [importingBackup, setImportingBackup] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [lastResult, setLastResult] = useState(null);

  useEffect(() => {
    purchaseOrdersApi
      .testConnection()
      .then(setConnection)
      .catch((err) => {
        setConnection({ ok: false, message: getErrorMessage(err) });
      })
      .finally(() => setTesting(false));
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await purchaseOrdersApi.sync('ACTIVE24');
      setLastResult(result);
      toast.success(`Migration complete — ${result.created} created, ${result.skipped} skipped`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Migration failed'));
    } finally {
      setSyncing(false);
    }
  };

  const handleBackupFile = async (file) => {
    if (!file) return;

    const name = file.name.toLowerCase();
    if (!name.endsWith('.json')) {
      toast.error('Please upload a JSON backup file (.json)');
      return;
    }

    setImportingBackup(true);
    setSelectedFileName(file.name);
    try {
      const text = await file.text();
      let backup;
      try {
        backup = JSON.parse(text);
      } catch {
        toast.error('Invalid JSON file — could not parse backup');
        return;
      }

      const result = await purchaseOrdersApi.importBackup(backup, 'ACTIVE24');
      setLastResult(result);
      toast.success(`Backup imported — ${result.created} created, ${result.skipped} skipped`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Backup import failed'));
    } finally {
      setImportingBackup(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const busy = syncing || importingBackup;

  return (
    <div>
      <PageHeader
        title="Data Migration"
        subtitle="Import purchase orders from the hosted PO system or from a downloaded backup file."
      />

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="glass-card p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-primary-100 p-3 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300">
              <Wifi className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-white">Live Sync</h3>
              <p className="text-sm text-slate-500">Connect to po.geniuslanka.com</p>
            </div>
          </div>

          {testing ? (
            <p className="text-sm text-slate-500">Testing connection…</p>
          ) : (
            <div className="space-y-3">
              <div className={`flex items-start gap-2 rounded-xl p-4 ${connection?.ok ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200' : 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200'}`}>
                {connection?.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                <div className="text-sm">
                  <p className="font-medium">{connection?.ok ? 'Connected' : 'Not connected'}</p>
                  <p className="mt-1 opacity-90">{connection?.message}</p>
                  {connection?.mode && (
                    <p className="mt-1 text-xs opacity-75">
                      Mode: {connection.mode}
                      {connection.sampleCount != null ? ` · ${connection.sampleCount} sample record(s)` : ''}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Set <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">PO_USE_MOCK=false</code> and PO credentials in backend <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">.env</code> for live sync.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleSync}
            disabled={busy || testing}
            className="btn-primary mt-4 w-full sm:w-auto"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Run Live Sync'}
          </button>
        </div>

        <div className="glass-card p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-amber-100 p-3 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">
              <FileJson className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-white">Import from Backup File</h3>
              <p className="text-sm text-slate-500">JSON download from hosted PO system</p>
            </div>
          </div>

          <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
            Upload the data backup you downloaded from the PO system. Purchase orders, suppliers, and line items are imported automatically. Duplicates are skipped.
          </p>

          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => handleBackupFile(e.target.files?.[0])}
          />

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="btn-primary w-full sm:w-auto"
          >
            <Upload className={`h-4 w-4 ${importingBackup ? 'animate-pulse' : ''}`} />
            {importingBackup ? 'Importing backup…' : 'Choose Backup File & Import'}
          </button>

          {selectedFileName && !importingBackup && (
            <p className="mt-2 text-xs text-slate-500">Last file: {selectedFileName}</p>
          )}

          <p className="mt-3 text-xs text-slate-500">
            Supported: <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">.json</code> export with purchase orders and line items.
          </p>
        </div>
      </div>

      <div className="glass-card mb-6 p-6">
        <div className="mb-2 flex items-center gap-3">
          <div className="rounded-xl bg-violet-100 p-3 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-white">After migration</h3>
            <p className="text-sm text-slate-500">Active (Pvt) Ltd company only</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          View imported orders on the{' '}
          <Link to="/" className="text-primary-600 underline">main dashboard</Link>
          {' '}or{' '}
          <Link to="/purchase-orders" className="text-primary-600 underline">PO history</Link>.
          New suppliers and products are created when needed.
        </p>
      </div>

      <MigrationResult result={lastResult} />
    </div>
  );
}
