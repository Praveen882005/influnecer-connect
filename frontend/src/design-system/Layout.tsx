import React from 'react';

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export const Container: React.FC<ContainerProps> = ({
  size = 'lg',
  className = '',
  children,
  ...props
}) => {
  const sizeStyles = {
    sm: 'max-w-2xl',
    md: 'max-w-4xl',
    lg: 'max-w-6xl',
    xl: 'max-w-7xl',
    full: 'max-w-full',
  };

  return (
    <div
      className={`w-full mx-auto px-4 sm:px-6 lg:px-8 ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  orientation?: 'vertical' | 'horizontal';
}

export const Card: React.FC<CardProps> = ({
  hoverable = false,
  padding = 'md',
  orientation = 'vertical',
  className = '',
  children,
  ...props
}) => {
  const paddingStyles = {
    none: 'p-0',
    sm: 'p-3.5',
    md: 'p-5 sm:p-6',
    lg: 'p-6 sm:p-8',
  };

  return (
    <div
      className={`bg-white rounded-[14px] border border-[#E5E7EB] shadow-[0_1px_3px_0_rgba(23,36,58,0.04)] transition-all duration-200 text-left ${
        hoverable ? 'hover:shadow-[0_4px_12px_rgba(23,36,58,0.06)] hover:border-slate-300' : ''
      } ${orientation === 'horizontal' ? 'flex flex-row' : ''} ${paddingStyles[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
