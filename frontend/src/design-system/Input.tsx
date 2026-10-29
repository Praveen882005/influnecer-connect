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
            className="text-xs font-semibold text-[#17243A] tracking-wide select-none flex items-center justify-between"
          >
            <span>
              {label}
              {required && <span className="text-[#C24141] ml-0.5">*</span>}
            </span>
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-[#697386]">
              {renderIconNode(leftIcon)}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={`w-full bg-white text-[#17243A] placeholder:text-[#697386]/60 text-sm rounded-[8px] border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-[#F0EFEA] disabled:text-[#697386] disabled:cursor-not-allowed ${
              leftIcon ? 'pl-9.5' : 'pl-3.5'
            } ${rightIcon ? 'pr-9.5' : 'pr-3.5'} py-2.5 ${
              error
                ? 'border-[#C24141] focus:border-[#C24141] focus:ring-[#F8D4D4]'
                : 'border-[#E5E7EB] hover:border-slate-300 focus:border-[#4169E1] focus:ring-[#DCE5FA]'
            } ${className}`}
            {...props}
          />

          {rightIcon && (
            <div
              onClick={onRightIconClick}
              className={`absolute right-3 flex items-center text-[#697386] ${
                onRightIconClick ? 'cursor-pointer hover:text-[#17243A]' : 'pointer-events-none'
              }`}
            >
              {renderIconNode(rightIcon)}
            </div>
          )}
        </div>

        {error && (
          <p id={errorId} className="text-xs text-[#C24141] font-medium tracking-tight">
            {error}
          </p>
        )}

        {!error && helperText && (
          <p id={helperId} className="text-[11px] text-[#697386]">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
