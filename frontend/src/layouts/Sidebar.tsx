import React, { useEffect } from 'react';
import { Badge, BrandBridgeLogo, Icon } from '../design-system';
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
    brand: 'bg-[#DCE5FA] text-[#1E3A8A] border-[#BFDBFE]',
    influencer: 'bg-[#EEF2FF] text-[#4338CA] border-[#C7D2FE]',
    admin: 'bg-[#FEF7EC] text-[#915F15] border-[#F5D6A4]',
  };

  const roleLabels = {
    brand: 'Brand Workspace',
    influencer: 'Influencer Studio',
    admin: 'Admin Operations',
  };

  const sidebarContent = (
    <aside className="w-64 bg-white border-r border-[#E5E7EB] flex flex-col h-full select-none text-left">
      {/* Brand Bridge Workspace Brand Header */}
      <div className="p-4 border-b border-[#E5E7EB] flex items-center justify-between">
        <BrandBridgeLogo size="sm" subtitle="Workspace Shell" />

        {/* Mobile close button */}
        {isMobileOpen && (
          <button
            type="button"
            className="md:hidden text-[#697386] hover:text-[#17243A] p-1.5 rounded-[6px] border border-[#E5E7EB] focus-visible:ring-2 focus-visible:ring-[#4169E1] focus-visible:outline-none cursor-pointer"
            onClick={onCloseMobile}
            aria-label="Close sidebar"
          >
            <Icon name="X" size={16} />
          </button>
        )}
      </div>

      {/* Active Role & Workspace Selector Box */}
      <div className="p-3.5 border-b border-[#E5E7EB] bg-[#F7F5F0]/80">
        <div className="text-[10px] font-bold text-[#697386] uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>Active Context</span>
          <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold border ${roleColors[role]}`}>
            {role.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-2.5 bg-white border border-[#E5E7EB] rounded-[10px] p-2.5 shadow-2xs">
          <div className="w-8 h-8 rounded-[8px] bg-[#17243A] text-white font-bold text-xs flex items-center justify-center shrink-0 font-['Manrope',sans-serif]">
            {contextInfo.avatarText}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-[#17243A] truncate font-['Manrope',sans-serif]">
              {contextInfo.displayName}
            </div>
            <div className="text-[11px] text-[#697386] truncate">{contextInfo.subTitle}</div>
          </div>
        </div>

        {/* Switch Role Quick Dropdown */}
        <div className="mt-2.5 flex items-center gap-1.5 pt-2 border-t border-[#E5E7EB]/70">
          <span className="text-[10px] font-semibold text-[#697386]">Switch:</span>
          {(['brand', 'influencer', 'admin'] as WorkspaceRole[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                onSwitchRole(r);
                if (isMobileOpen) onCloseMobile();
              }}
              className={`text-[10px] px-2 py-0.5 rounded-[6px] transition-all font-semibold cursor-pointer focus-visible:ring-2 focus-visible:ring-[#4169E1] focus-visible:outline-none ${
                role === r
                  ? 'bg-[#17243A] text-white shadow-xs'
                  : 'text-[#697386] hover:text-[#17243A] hover:bg-[#E5E7EB]/60'
              }`}
            >
              {r === 'brand' ? 'Brand' : r === 'influencer' ? 'Creator' : 'Admin'}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Sidebar navigation">
        <div className="text-[11px] font-bold text-[#697386] uppercase tracking-wider px-2.5 py-1.5">
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
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-[8px] transition-all duration-150 cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-[#4169E1] focus-visible:outline-none ${
                isActive
                  ? 'bg-[#F0F4FE] text-[#1D4ED8] font-bold border-l-[3px] border-l-[#4169E1] shadow-2xs'
                  : 'text-[#475569] hover:bg-[#F7F5F0] hover:text-[#17243A]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  name={item.icon}
                  size={16}
                  className={isActive ? 'text-[#4169E1]' : 'text-[#697386]'}
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
      <div className="p-3 border-t border-[#E5E7EB] bg-[#F7F5F0]/60">
        <button
          type="button"
          onClick={onReturnToWebsite}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#697386] hover:text-[#17243A] hover:bg-[#E5E7EB]/60 rounded-[8px] transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[#4169E1] focus-visible:outline-none"
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
          className="md:hidden fixed inset-0 z-50 flex bg-[#17243A]/50 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-label="Workspace Navigation Drawer"
          onClick={onCloseMobile}
        >
          <div
            className="w-64 bg-white h-full shadow-[0_20px_40px_rgba(23,36,58,0.2)] animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
