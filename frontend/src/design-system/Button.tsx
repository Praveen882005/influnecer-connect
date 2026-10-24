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
    // Base styles: premium typography, transition, accessible focus outline
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-colors select-none rounded-[5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

    // Variant styles conforming to the deep ink / ocean blue SaaS aesthetic
    const variantStyles = {
      primary:
        'bg-sky-600 text-white hover:bg-sky-700 active:bg-sky-800 shadow-xs focus-visible:ring-sky-600',
      secondary:
        'bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300 focus-visible:ring-slate-400',
      outline:
        'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 active:bg-slate-100 shadow-xs focus-visible:ring-sky-600',
      ghost:
        'bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200 focus-visible:ring-slate-400',
      danger:
        'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-xs focus-visible:ring-red-600',
    };

    // Size styles
    const sizeStyles = {
      xs: 'text-[11px] px-2 py-1 gap-1 h-7',
      sm: 'text-xs px-2.5 py-1.5 gap-1.5 h-8',
      md: 'text-sm px-3.5 py-2 gap-2 h-9.5',
      lg: 'text-base px-5 py-2.5 gap-2.5 h-11',
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
