import React, { useEffect, useRef } from 'react';
import { Icon } from './Icon';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  footer,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeStyles = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#17243A]/50 backdrop-blur-xs transition-opacity duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-headline"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className={`w-full ${sizeStyles[size]} bg-white border border-[#E5E7EB] rounded-[16px] shadow-[0_20px_40px_rgba(23,36,58,0.14)] flex flex-col max-h-[90vh] overflow-hidden text-left transition-all duration-200`}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-[#E5E7EB] bg-[#F7F5F0]/60">
          <div>
            <h3 id="modal-headline" className="text-lg font-bold font-['Manrope',sans-serif] text-[#17243A]">
              {title}
            </h3>
            {description && (
              <p className="text-xs text-[#697386] mt-1">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#697386] hover:text-[#17243A] rounded-[6px] p-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-[#4169E1] focus-visible:outline-none cursor-pointer"
            aria-label="Close modal"
          >
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>

        {/* Optional Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-[#F7F5F0]/60 border-t border-[#E5E7EB]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
