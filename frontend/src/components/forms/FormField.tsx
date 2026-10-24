import React from 'react';

export interface FormFieldProps {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  helperText?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  htmlFor,
  required = false,
  helperText,
  error,
  children,
  className = '',
}) => {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  const helperId = htmlFor ? `${htmlFor}-helper` : undefined;

  return (
    <div className={`w-full flex flex-col gap-1.5 text-left ${className}`}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-xs font-semibold text-slate-800 tracking-wide select-none flex items-center justify-between"
        >
          <span>
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </span>
        </label>
      )}

      {children}

      {error ? (
        <p id={errorId} role="alert" className="text-xs text-red-600 font-medium tracking-tight animate-in fade-in-50">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-[11px] text-slate-500">
          {helperText}
        </p>
      ) : null}
    </div>
  );
};
