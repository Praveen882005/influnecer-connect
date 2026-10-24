import React, { useId } from 'react';
import { Icon, type IconName } from './Icon';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: IconName | React.ReactNode;
  rightIcon?: IconName | React.ReactNode;
  onRightIconClick?: () => void;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      onRightIconClick,
      className = '',
      id,
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    const renderIconNode = (icon?: IconName | React.ReactNode) => {
      if (!icon) return null;
      if (React.isValidElement(icon)) return icon;
      return <Icon name={icon as IconName} size={16} />;
    };

    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold text-slate-800 tracking-wide select-none flex items-center justify-between"
          >
            <span>
              {label}
              {required && <span className="text-red-500 ml-0.5">*</span>}
            </span>
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-slate-400">
              {renderIconNode(leftIcon)}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={`w-full bg-white text-slate-900 placeholder:text-slate-400 text-sm rounded-[5px] border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${
              leftIcon ? 'pl-9.5' : 'pl-3'
            } ${rightIcon ? 'pr-9.5' : 'pr-3'} py-2 ${
              error
                ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                : 'border-slate-300 hover:border-slate-400 focus:border-sky-600 focus:ring-sky-100'
            } ${className}`}
            {...props}
          />

          {rightIcon && (
            <div
              onClick={onRightIconClick}
              className={`absolute right-3 flex items-center text-slate-400 ${
                onRightIconClick ? 'cursor-pointer hover:text-slate-600' : 'pointer-events-none'
              }`}
            >
              {renderIconNode(rightIcon)}
            </div>
          )}
        </div>

        {error && (
          <p id={errorId} className="text-xs text-red-600 font-medium tracking-tight">
            {error}
          </p>
        )}

        {!error && helperText && (
          <p id={helperId} className="text-[11px] text-slate-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
