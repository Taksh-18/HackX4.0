import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../../lib/cn';

interface Props {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'default' | 'danger';
}

export function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
}: Props) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden
      />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm animate-slide-in-up">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                variant === 'danger' ? 'bg-red-50' : 'bg-slate-100'
              )}
            >
              <AlertTriangle
                size={18}
                className={variant === 'danger' ? 'text-red-600' : 'text-slate-600'}
                aria-hidden
              />
            </div>
            <div className="flex-1">
              <h2 id="modal-title" className="text-sm font-semibold text-slate-900 mb-1">
                {title}
              </h2>
              <p className="text-sm text-slate-500">{message}</p>
            </div>
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Close dialog"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="border-t border-slate-100 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              variant === 'danger'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
