type ToastType = 'success' | 'error' | 'info' | 'warning';

export type ToastMessage = {
  id: number;
  type: ToastType;
  message: string;
};

type ToastProps = {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
};

const toastStyles: Record<ToastType, { bg: string; text: string; icon: string }> = {
  success: { bg: 'bg-emerald-600', text: 'text-white', icon: '✓' },
  error: { bg: 'bg-red-600', text: 'text-white', icon: '✕' },
  info: { bg: 'bg-blue-600', text: 'text-white', icon: 'ℹ' },
  warning: { bg: 'bg-amber-500', text: 'text-white', icon: '⚠' },
};

export default function Toast({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 space-y-2 no-print">
      {toasts.map((toast) => {
        const style = toastStyles[toast.type];
        return (
          <div
            key={toast.id}
            className={`${style.bg} ${style.text} px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 fade-in min-w-[280px] max-w-md`}
          >
            <span className="font-bold text-lg">{style.icon}</span>
            <span className="flex-1 text-sm font-semibold">{toast.message}</span>
            <button
              onClick={() => onDismiss(toast.id)}
              className="hover:opacity-70 transition-opacity"
              aria-label="إغلاق"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
