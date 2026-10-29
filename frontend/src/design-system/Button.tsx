import React from 'react';
import { Icon, type IconName } from './Icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: IconName | React.ReactNode;
  rightIcon?: IconName | React.ReactNode;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    // Base styles: premium typography, smooth transition, accessible focus outline
    const baseStyles =
      'inline-flex items-center justify-center font-medium font-["Inter",sans-serif] transition-all duration-150 select-none rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

    // Variant styles conforming to Deep Ink, Warm Ivory, and Cobalt Blue palette
    const variantStyles = {
      primary:
        'bg-[#4169E1] text-white hover:bg-[#2563EB] active:bg-[#1D4ED8] shadow-xs focus-visible:ring-[#4169E1]',
      secondary:
        'bg-[#F7F5F0] text-[#17243A] border border-[#E5E7EB] hover:bg-[#F0EFEA] hover:text-[#17243A] active:bg-[#E5E7EB] focus-visible:ring-[#4169E1]',
      outline:
        'border border-[#E5E7EB] bg-white text-[#17243A] hover:bg-[#F7F5F0] hover:border-slate-300 active:bg-[#F0EFEA] shadow-xs focus-visible:ring-[#4169E1]',
      ghost:
        'bg-transparent text-[#697386] hover:text-[#17243A] hover:bg-[#F0EFEA] active:bg-[#E5E7EB] focus-visible:ring-[#4169E1]',
      danger:
        'bg-[#C24141] text-white hover:bg-[#9E3232] active:bg-[#7F2828] shadow-xs focus-visible:ring-[#C24141]',
    };

    // Size styles
    const sizeStyles = {
      xs: 'text-[11px] px-2.5 py-1 gap-1 h-7 font-medium',
      sm: 'text-xs px-3 py-1.5 gap-1.5 h-8 font-medium',
      md: 'text-sm px-4 py-2 gap-2 h-9.5 font-medium',
      lg: 'text-base px-6 py-2.5 gap-2.5 h-11 font-semibold',
    };

    const renderIconNode = (icon?: IconName | React.ReactNode) => {
      if (!icon) return null;
      if (React.isValidElement(icon)) return icon;
      const iconSize = size === 'xs' || size === 'sm' ? 14 : 16;
      return <Icon name={icon as IconName} size={iconSize} />;
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${
          fullWidth ? 'w-full' : ''
        } ${className}`}
        {...props}
      >
        {isLoading && (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5" />
        )}
        {!isLoading && leftIcon && (
          <span className="inline-flex shrink-0">{renderIconNode(leftIcon)}</span>
        )}
        {children}
        {!isLoading && rightIcon && (
          <span className="inline-flex shrink-0">{renderIconNode(rightIcon)}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
