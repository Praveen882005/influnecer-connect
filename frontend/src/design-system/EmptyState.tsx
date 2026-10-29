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
      <div className="w-12 h-12 rounded-[10px] bg-[#F7F5F0] border border-[#E5E7EB] text-[#4169E1] flex items-center justify-center mb-3.5 shadow-xs">
        {renderIconNode()}
      </div>

      <h4 className="text-sm font-bold font-['Manrope',sans-serif] text-[#17243A] mb-1.5">{title}</h4>
      {description && (
        <p className="text-xs text-[#697386] leading-relaxed mb-4">{description}</p>
      )}

      {action && <div>{action}</div>}
    </div>
  );
};
