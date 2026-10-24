import React from 'react';
import { Icon, type IconName } from './Icon';

export interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  onClose,
  className = '',
}) => {
  const variantConfig: Record<
    'info' | 'success' | 'warning' | 'danger',
    { icon: IconName; border: string; bg: string; text: string; iconColor: string }
  > = {
    info: {
      icon: 'Info',
      border: 'border-sky-200',
      bg: 'bg-sky-50/70',
      text: 'text-sky-900',
      iconColor: 'text-sky-600',
    },
    success: {
      icon: 'CheckCircle2',
      border: 'border-emerald-200',
      bg: 'bg-emerald-50/70',
      text: 'text-emerald-900',
      iconColor: 'text-emerald-600',
    },
    warning: {
      icon: 'AlertTriangle',
      border: 'border-amber-200',
      bg: 'bg-amber-50/70',
      text: 'text-amber-900',
      iconColor: 'text-amber-600',
    },
    danger: {
      icon: 'AlertCircle',
      border: 'border-red-200',
      bg: 'bg-red-50/70',
      text: 'text-red-900',
      iconColor: 'text-red-600',
    },
  };

  const config = variantConfig[variant] || variantConfig.info;

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-3.5 rounded-[6px] border text-xs text-left ${config.border} ${config.bg} ${config.text} ${className}`}
    >
      <div className={`mt-0.5 shrink-0 ${config.iconColor}`}>
        <Icon name={config.icon} size={16} />
      </div>

      <div className="flex-1">
        {title && <h4 className="font-semibold text-slate-900 mb-0.5">{title}</h4>}
        <div className="leading-relaxed">{children}</div>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          aria-label="Dismiss alert"
        >
          <Icon name="X" size={14} />
        </button>
      )}
    </div>
  );
};
