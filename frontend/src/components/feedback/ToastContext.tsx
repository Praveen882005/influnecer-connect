import React, { createContext, useCallback, useContext, useState } from 'react';
import { Icon } from '../../design-system';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  title: string;
  message?: string;
  variant: ToastVariant;
  duration?: number;
}

export interface ToastContextType {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, 'id'>) => string;
  success: (title: string, message?: string, duration?: number) => string;
  error: (title: string, message?: string, duration?: number) => string;
  warning: (title: string, message?: string, duration?: number) => string;
  info: (title: string, message?: string, duration?: number) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const duration = toast.duration ?? (toast.variant === 'error' ? 6000 : 4000);

      const newToast: ToastItem = { ...toast, id, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }

      return id;
    },
    [dismiss]
  );

  const success = useCallback(
    (title: string, message?: string, duration?: number) =>
      showToast({ title, message, variant: 'success', duration }),
    [showToast]
  );

  const error = useCallback(
    (title: string, message?: string, duration?: number) =>
      showToast({ title, message, variant: 'error', duration }),
    [showToast]
  );

  const warning = useCallback(
    (title: string, message?: string, duration?: number) =>
      showToast({ title, message, variant: 'warning', duration }),
    [showToast]
  );

  const info = useCallback(
    (title: string, message?: string, duration?: number) =>
      showToast({ title, message, variant: 'info', duration }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, success, error, warning, info, dismiss }}>
      {children}
      {/* Toast floating container */}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none select-none"
      >
        {toasts.map((toast) => {
          const variantStyles = {
            success: 'bg-white border-emerald-300 text-slate-900 border-l-4 border-l-emerald-500 shadow-lg',
            error: 'bg-white border-rose-300 text-slate-900 border-l-4 border-l-rose-500 shadow-lg',
            warning: 'bg-white border-amber-300 text-slate-900 border-l-4 border-l-amber-500 shadow-lg',
            info: 'bg-white border-sky-300 text-slate-900 border-l-4 border-l-sky-500 shadow-lg',
          };

          const iconMap = {
            success: { name: 'CheckCircle2' as const, color: 'text-emerald-600' },
            error: { name: 'AlertCircle' as const, color: 'text-rose-600' },
            warning: { name: 'AlertTriangle' as const, color: 'text-amber-600' },
            info: { name: 'Info' as const, color: 'text-sky-600' },
          };

          const { name: iconName, color: iconColor } = iconMap[toast.variant];

          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto p-3.5 rounded-[6px] border flex items-start gap-3 transition-all animate-in slide-in-from-bottom-3 duration-200 ${
                variantStyles[toast.variant]
              }`}
            >
              <div className={`shrink-0 mt-0.5 ${iconColor}`}>
                <Icon name={iconName} size={18} />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-xs font-semibold text-slate-900">{toast.title}</div>
                {toast.message && (
                  <div className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                    {toast.message}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="shrink-0 text-slate-400 hover:text-slate-700 p-0.5 -mr-1 -mt-1 rounded cursor-pointer"
                aria-label="Close notification"
              >
                <Icon name="X" size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
