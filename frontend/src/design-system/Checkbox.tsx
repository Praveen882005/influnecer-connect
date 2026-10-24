import React, { useId } from 'react';
import { Icon } from './Icon';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
  error?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, error, className = '', id, disabled, checked, ...props }, ref) => {
    const generatedId = useId();
    const checkboxId = id || generatedId;

    return (
      <div className={`flex items-start gap-2.5 text-left ${className}`}>
        <div className="relative flex items-center justify-center mt-0.5">
          <input
            ref={ref}
            type="checkbox"
            id={checkboxId}
            disabled={disabled}
            checked={checked}
            className="peer sr-only"
            {...props}
          />
          <label
            htmlFor={checkboxId}
            className={`w-4 h-4 rounded-[3px] border transition-colors flex items-center justify-center cursor-pointer select-none peer-focus-visible:ring-2 peer-focus-visible:ring-sky-600 peer-focus-visible:ring-offset-1 ${
              disabled
                ? 'bg-slate-100 border-slate-300 cursor-not-allowed opacity-60'
                : error
                ? 'border-red-400 bg-white'
                : 'border-slate-300 bg-white peer-checked:bg-sky-600 peer-checked:border-sky-600 hover:border-slate-400'
            }`}
          >
            <Icon
              name="Check"
              size={12}
              className={`text-white transition-opacity ${checked ? 'opacity-100' : 'opacity-0'}`}
              strokeWidth={3}
            />
          </label>
        </div>

        <div className="flex flex-col">
          <label
            htmlFor={checkboxId}
            className={`text-sm font-medium text-slate-800 cursor-pointer select-none leading-none ${
              disabled ? 'cursor-not-allowed text-slate-400' : ''
            }`}
          >
            {label}
          </label>
          {description && (
            <p className="text-xs text-slate-500 mt-1 leading-normal">{description}</p>
          )}
          {error && <p className="text-xs text-red-600 font-medium mt-1">{error}</p>}
        </div>
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
