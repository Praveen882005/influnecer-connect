import React from 'react';
import { Icon, type IconName } from './Icon';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'brand' | 'success' | 'warning' | 'danger' | 'neutral';
  size?: 'sm' | 'md';
  icon?: IconName;
  withDot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  icon,
  withDot = false,
  className = '',
  ...props
}) => {
  const variantStyles = {
    brand: 'bg-[#DCE5FA]/60 text-[#1E3A8A] border-[#BFDBFE]',
    success: 'bg-[#E8F5EE] text-[#186443] border-[#B4E0CC]',
    warning: 'bg-[#FEF7EC] text-[#915F15] border-[#F5D6A4]',
    danger: 'bg-[#FDF2F2] text-[#9E3232] border-[#F5BCBC]',
    neutral: 'bg-[#F0EFEA] text-[#17243A] border-[#E5E7EB]',
  };

  const dotStyles = {
    brand: 'bg-[#4169E1]',
    success: 'bg-[#21865B]',
    warning: 'bg-[#B7791F]',
    danger: 'bg-[#C24141]',
    neutral: 'bg-[#697386]',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };

  return (
    <span
      className={`inline-flex items-center font-medium border rounded-[6px] select-none transition-colors ${
        variantStyles[variant]
      } ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {withDot && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotStyles[variant]}`} />
      )}
      {icon && <Icon name={icon} size={size === 'sm' ? 12 : 14} />}
      <span>{children}</span>
    </span>
  );
};
