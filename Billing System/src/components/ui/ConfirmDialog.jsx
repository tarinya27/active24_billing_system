import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', variant = 'danger' }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className={`rounded-full p-2 ${variant === 'danger' ? 'bg-red-100 text-red-600 dark:bg-red-950' : 'bg-amber-100 text-amber-600 dark:bg-amber-950'}`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => { onConfirm(); onClose(); }} className={variant === 'danger' ? 'btn-danger' : 'btn-primary'}>
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
