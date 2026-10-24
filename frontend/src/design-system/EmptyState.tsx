import React from 'react';
import { Icon, type IconName } from './Icon';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: IconName | React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon = 'Inbox',
  action,
  className = '',
}) => {
  const renderIconNode = () => {
    if (React.isValidElement(icon)) return icon;
    return <Icon name={(icon as IconName) || 'Inbox'} size={22} strokeWidth={1.75} />;
  };

  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center max-w-sm mx-auto ${className}`}
    >
      <div className="w-12 h-12 rounded-[8px] bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center mb-3 shadow-xs">
        {renderIconNode()}
      </div>

      <h4 className="text-sm font-semibold text-slate-900 mb-1">{title}</h4>
      {description && (
        <p className="text-xs text-slate-500 leading-relaxed mb-4">{description}</p>
      )}

      {action && <div>{action}</div>}
    </div>
  );
};
