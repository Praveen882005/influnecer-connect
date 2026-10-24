import React from 'react';

export interface RouteLoadingProps {
  label?: string;
}

export const RouteLoading: React.FC<RouteLoadingProps> = ({ label = 'Loading workspace...' }) => {
  return (
    <div className="flex-1 min-h-[350px] flex flex-col items-center justify-center p-8 text-center animate-in fade-in-50 duration-200">
      <div className="w-9 h-9 border-3 border-slate-200 border-t-sky-600 rounded-full animate-spin mb-3" />
      <span className="text-xs font-medium text-slate-500 tracking-wide">{label}</span>
    </div>
  );
};
