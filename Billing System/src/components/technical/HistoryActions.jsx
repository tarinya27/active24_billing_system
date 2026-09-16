import { Pencil, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Can from '../auth/Can';

const btnClass =
  'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-primary-600 dark:text-slate-300 dark:hover:bg-slate-800';

export default function HistoryActions({ editTo, downloadTo, editPermission }) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <Can permission={editPermission}>
        <button
          type="button"
          className={btnClass}
          title="Edit"
          onClick={() => navigate(editTo)}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
      </Can>
      <button
        type="button"
        className={btnClass}
        title="Download"
        onClick={() => navigate(downloadTo)}
      >
        <Download className="h-3.5 w-3.5" />
        Download
      </button>
    </div>
  );
}
