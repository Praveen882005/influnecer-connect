import React from 'react';

export interface BrandBridgeMarkProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
  theme?: 'dark' | 'light' | 'monochrome';
}

/**
 * Architectural Bridge Mark:
 * Represents the structured, trustworthy bridge between brands and creators.
 * Two upward structural piers supporting a dynamic connection arch with a central synergy node.
 */
export const BrandBridgeMark: React.FC<BrandBridgeMarkProps> = ({
  size = 32,
  className = '',
  theme = 'dark',
  ...props
}) => {
  const pierColor = theme === 'light' ? '#FFFFFF' : '#17243A';
  const archColor = theme === 'monochrome' ? pierColor : theme === 'light' ? '#93C5FD' : '#4169E1';
  const nodeColor = theme === 'monochrome' ? pierColor : theme === 'light' ? '#93C5FD' : '#4169E1';
  const deckColor = theme === 'light' ? 'rgba(255, 255, 255, 0.4)' : '#DCE5FA';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-transform duration-200 ${className}`}
      aria-hidden="true"
      {...props}
    >
      {/* Base Foundation Plate */}
      <rect x="4" y="32" width="32" height="3" rx="1.5" fill={deckColor} />

      {/* Left Anchor Pier / Tower (Brand Pillar) */}
      <path
        d="M9 32V14C9 12.8954 9.89543 12 11 12C12.1046 12 13 12.8954 13 14V32"
        stroke={pierColor}
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Right Anchor Pier / Tower (Creator Pillar) */}
      <path
        d="M27 32V14C27 12.8954 27.8954 12 29 12C30.1046 12 31 12.8954 31 14V32"
        stroke={pierColor}
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Main Suspension Arch spanning across pillars */}
      <path
        d="M7 26C13 16 27 16 33 26"
        stroke={archColor}
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Central Cable Suspenders */}
      <line x1="16" y1="21" x2="16" y2="32" stroke={deckColor} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="20" y1="18.5" x2="20" y2="32" stroke={archColor} strokeWidth="1.75" strokeLinecap="round" />
      <line x1="24" y1="21" x2="24" y2="32" stroke={deckColor} strokeWidth="1.5" strokeLinecap="round" />

      {/* Keystone Collaboration Node */}
      <circle cx="20" cy="18.5" r="2.75" fill={nodeColor} />
      <circle cx="20" cy="18.5" r="1.25" fill="#FFFFFF" />
    </svg>
  );
};

export interface BrandBridgeLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'mark-only' | 'stacked';
  theme?: 'dark' | 'light';
  subtitle?: string;
}

export const BrandBridgeLogo: React.FC<BrandBridgeLogoProps> = ({
  size = 'md',
  variant = 'full',
  theme = 'dark',
  subtitle,
  className = '',
  ...props
}) => {
  const markSizes = {
    sm: 24,
    md: 32,
    lg: 40,
    xl: 52,
  };

  const textSizes = {
    sm: 'text-sm tracking-tight',
    md: 'text-base tracking-tight',
    lg: 'text-xl tracking-tight',
    xl: 'text-2xl tracking-tight',
  };

  const subTextSizes = {
    sm: 'text-[9px] tracking-wider',
    md: 'text-[10px] tracking-wider',
    lg: 'text-xs tracking-wider',
    xl: 'text-sm tracking-wider',
  };

  const isLight = theme === 'light';
  const brandTextColor = isLight ? 'text-white' : 'text-[#17243A]';
  const bridgeTextColor = isLight ? 'text-[#93C5FD]' : 'text-[#4169E1]';
  const subtitleColor = isLight ? 'text-slate-300' : 'text-[#697386]';

  if (variant === 'mark-only') {
    return (
      <div className={`inline-flex items-center ${className}`} {...props}>
        <BrandBridgeMark size={markSizes[size]} theme={theme} />
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2.5 select-none ${
        variant === 'stacked' ? 'flex-col items-center gap-1.5' : ''
      } ${className}`}
      {...props}
    >
      <div className="relative flex items-center justify-center p-1 rounded-lg bg-white/80 shadow-xs border border-slate-200/60 backdrop-blur-xs">
        <BrandBridgeMark size={markSizes[size]} theme="dark" />
      </div>

      <div className={`flex flex-col ${variant === 'stacked' ? 'items-center text-center' : 'text-left'}`}>
        <div className={`font-extrabold font-['Manrope',sans-serif] leading-tight ${textSizes[size]}`}>
          <span className={brandTextColor}>BRAND</span>
          <span className={`ml-1 ${bridgeTextColor}`}>BRIDGE</span>
        </div>
        {subtitle && (
          <span className={`uppercase font-semibold tracking-widest ${subtitleColor} ${subTextSizes[size]}`}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};

export default BrandBridgeLogo;
