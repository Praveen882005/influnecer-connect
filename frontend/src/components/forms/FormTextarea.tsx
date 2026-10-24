import React, { useId } from 'react';

export interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
  maxLength?: number;
  showCount?: boolean;
}

export const FormTextarea = React.forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  (
    {
      label,
      helperText,
      error,
      id,
      className = '',
      required,
      value,
      maxLength,
      showCount = false,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const textareaId = id || generatedId;
    const errorId = `${textareaId}-error`;
    const helperId = `${textareaId}-helper`;

    const charCount = typeof value === 'string' ? value.length : 0;

    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        {label && (
          <label
            htmlFor={textareaId}
            className="text-xs font-semibold text-slate-800 tracking-wide select-none flex items-center justify-between"
          >
            <span>
              {label}
              {required && <span className="text-red-500 ml-0.5">*</span>}
            </span>
            {showCount && maxLength && (
              <span className="text-[10px] font-mono font-normal text-slate-400">
                {charCount}/{maxLength}
              </span>
            )}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          value={value}
          maxLength={maxLength}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={`w-full bg-white text-slate-900 placeholder:text-slate-400 text-sm rounded-[5px] border p-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
              : 'border-slate-300 hover:border-slate-400 focus:border-sky-600 focus:ring-sky-100'
          } ${className}`}
          {...props}
        />

        {error ? (
          <p id={errorId} role="alert" className="text-xs text-red-600 font-medium tracking-tight">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-[11px] text-slate-500">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

FormTextarea.displayName = 'FormTextarea';
