import React from 'react';
import { Icon, type IconName } from './Icon';

export interface TabItem {
  id: string;
  label: string;
  icon?: IconName;
  count?: number | string;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'underline' | 'pill';
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  variant = 'underline',
  className = '',
}) => {
  return (
    <nav
      className={`flex items-center gap-1 border-b border-[#E5E7EB] overflow-x-auto scrollbar-none select-none ${className}`}
      role="tablist"
      aria-label="Tabs navigation"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        if (variant === 'pill') {
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              disabled={tab.disabled}
              onClick={() => !tab.disabled && onChange(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-[8px] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                isActive
                  ? 'bg-[#4169E1] text-white shadow-xs'
                  : 'text-[#697386] hover:text-[#17243A] hover:bg-[#F0EFEA]'
              }`}
            >
              {tab.icon && <Icon name={tab.icon} size={14} />}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-semibold ${
                    isActive ? 'bg-[#1D4ED8] text-white' : 'bg-[#E5E7EB] text-[#17243A]'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        }

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onChange(tab.id)}
            className={`relative inline-flex items-center gap-2 px-4 py-3 text-xs font-semibold tracking-wide transition-colors border-b-2 -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              isActive
                ? 'border-[#4169E1] text-[#4169E1]'
                : 'border-transparent text-[#697386] hover:text-[#17243A] hover:border-slate-300'
            }`}
          >
            {tab.icon && <Icon name={tab.icon} size={15} />}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-[4px] ${
                  isActive
                    ? 'bg-[#DCE5FA] text-[#1E3A8A] border border-[#BFDBFE]'
                    : 'bg-[#F0EFEA] text-[#697386] border border-[#E5E7EB]'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
};
