import React from 'react';
import { Icon } from '../../design-system';

export interface FormErrorMessageProps {
  title?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  onDismiss?: () => void;
  className?: string;
}

export const FormErrorMessage: React.FC<FormErrorMessageProps> = ({
  title = 'Form submission error',
  message,
  fieldErrors,
  onDismiss,
  className = '',
}) => {
  if (!message && (!fieldErrors || Object.keys(fieldErrors).length === 0)) {
    return null;
  }

  const errorEntries = fieldErrors ? Object.entries(fieldErrors) : [];

  return (
    <div
      role="alert"
      className={`p-3.5 bg-red-50 border border-red-200 rounded-[6px] text-left text-xs text-red-900 flex items-start gap-3 shadow-2xs animate-in fade-in-50 ${className}`}
    >
      <div className="shrink-0 text-red-600 mt-0.5">
        <Icon name="AlertCircle" size={18} />
      </div>

      <div className="flex-1 space-y-1">
        {title && <h4 className="font-semibold text-red-950 text-xs">{title}</h4>}
        {message && <p className="text-red-800 leading-relaxed">{message}</p>}

        {errorEntries.length > 0 && (
          <ul className="list-disc list-inside mt-2 space-y-0.5 text-red-700">
            {errorEntries.map(([field, err]) => (
              <li key={field}>
                <span className="font-semibold capitalize">{field.replace(/_/g, ' ')}:</span> {err}
              </li>
            ))}
          </ul>
        )}
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-red-400 hover:text-red-700 p-1 -mr-1 -mt-1 rounded cursor-pointer"
          aria-label="Dismiss error message"
        >
          <Icon name="X" size={14} />
        </button>
      )}
    </div>
  );
};
