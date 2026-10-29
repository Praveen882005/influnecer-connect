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
      border: 'border-[#BFDBFE]',
      bg: 'bg-[#F0F4FE]',
      text: 'text-[#1E3A8A]',
      iconColor: 'text-[#4169E1]',
    },
    success: {
      icon: 'CheckCircle2',
      border: 'border-[#B4E0CC]',
      bg: 'bg-[#E8F5EE]',
      text: 'text-[#186443]',
      iconColor: 'text-[#21865B]',
    },
    warning: {
      icon: 'AlertTriangle',
      border: 'border-[#F5D6A4]',
      bg: 'bg-[#FEF7EC]',
      text: 'text-[#915F15]',
      iconColor: 'text-[#B7791F]',
    },
    danger: {
      icon: 'AlertCircle',
      border: 'border-[#F5BCBC]',
      bg: 'bg-[#FDF2F2]',
      text: 'text-[#9E3232]',
      iconColor: 'text-[#C24141]',
    },
  };

  const config = variantConfig[variant] || variantConfig.info;

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-3.5 rounded-[8px] border text-xs text-left ${config.border} ${config.bg} ${config.text} ${className}`}
    >
      <div className={`mt-0.5 shrink-0 ${config.iconColor}`}>
        <Icon name={config.icon} size={16} />
      </div>
      <div className="flex-1">
        {title && <h5 className="font-semibold text-xs mb-0.5">{title}</h5>}
        <div className="leading-relaxed opacity-95">{children}</div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-slate-400 hover:text-slate-600 p-0.5 transition-colors cursor-pointer"
          aria-label="Dismiss alert"
        >
          <Icon name="X" size={14} />
        </button>
      )}
    </div>
  );
};
