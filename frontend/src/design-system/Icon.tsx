import React from 'react';
import * as LucideIcons from 'lucide-react';

export type IconName = keyof typeof LucideIcons;

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: IconName;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  strokeWidth?: number;
  title?: string;
}

const sizeMap = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

export const Icon: React.FC<IconProps> = ({
  name,
  size = 'md',
  className = '',
  strokeWidth = 2,
  ...rest
}) => {
  const IconComponent = LucideIcons[name] as React.ComponentType<{
    size?: number;
    className?: string;
    strokeWidth?: number;
  }>;

  if (!IconComponent) {
    return <span className={`inline-block w-4 h-4 bg-slate-200 ${className}`} />;
  }

  const pixelSize = typeof size === 'number' ? size : sizeMap[size] || 20;

  return (
    <IconComponent
      size={pixelSize}
      strokeWidth={strokeWidth}
      className={`inline-block shrink-0 align-middle ${className}`}
      {...rest}
    />
  );
};
