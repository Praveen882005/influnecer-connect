import React, { useEffect } from 'react';
import { Badge, Icon } from '../design-system';
import type { NavItem, WorkspaceContextInfo, WorkspaceRole } from './types';

interface SidebarProps {
  role: WorkspaceRole;
  contextInfo: WorkspaceContextInfo;
  items: NavItem[];
  activeRoute: string;
  onNavigate: (routeId: string) => void;
  onSwitchRole: (newRole: WorkspaceRole) => void;
  onReturnToWebsite: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  role,
  contextInfo,
  items,
  activeRoute,
  onNavigate,
  onSwitchRole,
  onReturnToWebsite,
  isMobileOpen,
  onCloseMobile,
}) => {
  // Close drawer on Escape key and lock body scroll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen) {
        onCloseMobile();
      }
    };
    if (isMobileOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isMobileOpen, onCloseMobile]);

  const roleColors = {
    brand: 'bg-sky-50 text-sky-700 border-sky-200',
    influencer: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    admin: 'bg-amber-50 text-amber-800 border-amber-200',
  };

  const roleLabels = {
    brand: 'Brand Workspace',
    influencer: 'Influencer Studio',
    admin: 'Admin Operations',
  };

  const sidebarContent = (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-full select-none text-left">
      {/* Brand Bridge Workspace Brand Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <svg className="w-7 h-7 rounded-[5px]" viewBox="0 0 64 64" fill="none">
            <rect width="64" height="64" rx="14" fill="#0f172a" />
            <path
              d="M12 44 C24 24, 40 24, 52 44"
              stroke="#38bdf8"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
          <div>
            <span className="font-bold text-sm tracking-tight text-slate-900 block leading-tight">
              BRAND BRIDGE
            </span>
            <span className="text-[10px] text-slate-500 font-mono block">Workspace Shell</span>
          </div>
        </div>

        {/* Mobile close button */}
        {isMobileOpen && (
          <button
            type="button"
            className="md:hidden text-slate-400 hover:text-slate-700 p-1 rounded focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:outline-none cursor-pointer"
            onClick={onCloseMobile}
            aria-label="Close sidebar"
          >
            <Icon name="X" size={18} />
          </button>
        )}
      </div>

      {/* Active Role & Workspace Selector Box */}
      <div className="p-3 border-b border-slate-100 bg-slate-50/60">
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
          <span>Active Context</span>
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${roleColors[role]}`}>
            {role.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-[6px] p-2 shadow-xs">
          <div className="w-7 h-7 rounded-[4px] bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
            {contextInfo.avatarText}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-slate-900 truncate">
              {contextInfo.displayName}
            </div>
            <div className="text-[11px] text-slate-500 truncate">{contextInfo.subTitle}</div>
          </div>
        </div>

        {/* Switch Role Quick Dropdown */}
        <div className="mt-2 flex items-center gap-1">
          <span className="text-[10px] text-slate-500">Switch:</span>
          {(['brand', 'influencer', 'admin'] as WorkspaceRole[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                onSwitchRole(r);
                if (isMobileOpen) onCloseMobile();
              }}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors font-medium cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:outline-none ${
                role === r
                  ? 'bg-slate-900 text-white font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              {r === 'brand' ? 'Brand' : r === 'influencer' ? 'Creator' : 'Admin'}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Sidebar navigation">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2.5 py-1.5">
          {roleLabels[role]}
        </div>

        {items.map((item) => {
          const isActive = activeRoute === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onNavigate(item.id);
                if (isMobileOpen) onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-[5px] transition-colors cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:outline-none ${
                isActive
                  ? 'bg-sky-50 text-sky-800 font-semibold border-l-3 border-l-sky-600 shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  name={item.icon}
                  size={16}
                  className={isActive ? 'text-sky-600' : 'text-slate-400'}
                />
                <span>{item.label}</span>
              </div>

              {item.badge !== undefined && (
                <Badge variant={item.badgeVariant || (isActive ? 'brand' : 'neutral')} size="sm">
                  {item.badge}
                </Badge>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Return Action */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/40">
        <button
          type="button"
          onClick={onReturnToWebsite}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-[5px] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:outline-none"
        >
          <Icon name="ArrowLeft" size={15} />
          <span>Exit to Public Website</span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:block shrink-0 h-screen sticky top-0">{sidebarContent}</div>

      {/* Mobile Drawer Backdrop and Sidebar */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-label="Workspace Navigation Drawer"
          onClick={onCloseMobile}
        >
          <div
            className="w-64 bg-white h-full shadow-2xl animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
