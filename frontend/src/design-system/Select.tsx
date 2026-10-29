import React, { useId } from 'react';
import { Icon } from './Icon';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options?: SelectOption[];
  helperText?: string;
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      options,
      helperText,
      error,
      children,
      className = '',
      id,
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = id || generatedId;
    const errorId = `${selectId}-error`;
    const helperId = `${selectId}-helper`;

    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        {label && (
          <label
            htmlFor={selectId}
            className="text-xs font-semibold text-[#17243A] tracking-wide select-none"
          >
            {label}
            {required && <span className="text-[#C24141] ml-0.5">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            required={required}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={`w-full appearance-none rounded-[8px] border bg-white pl-3.5 pr-9 py-2.5 text-sm text-[#17243A] transition-all duration-150 shadow-xs h-10 focus:outline-none focus:ring-2 focus:ring-[#DCE5FA] focus:border-[#4169E1] disabled:bg-[#F0EFEA] disabled:text-[#697386] disabled:cursor-not-allowed cursor-pointer ${
              error
                ? 'border-[#C24141] focus:ring-[#F8D4D4] focus:border-[#C24141]'
                : 'border-[#E5E7EB] hover:border-slate-300'
            } ${className}`}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          <div className="absolute right-3 text-[#697386] pointer-events-none flex items-center">
            <Icon name="ChevronDown" size={16} />
          </div>
        </div>

        {error ? (
          <p id={errorId} className="text-xs text-[#C24141] font-medium" role="alert">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-[11px] text-[#697386]">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
