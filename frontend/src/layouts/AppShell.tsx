import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import type { BreadcrumbItem, NavItem, WorkspaceContextInfo, WorkspaceRole } from './types';

interface AppShellProps {
  role: WorkspaceRole;
  activeRoute: string;
  onNavigate: (routeId: string) => void;
  onSwitchRole: (newRole: WorkspaceRole) => void;
  onReturnToWebsite: () => void;
  children: React.ReactNode;
}

export const BRAND_NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: 'LayoutDashboard' },
  { id: 'campaigns', label: 'Campaigns', icon: 'Briefcase', badge: 3 },
  { id: 'discover', label: 'Discover Creators', icon: 'Search' },
  { id: 'shortlists', label: 'Shortlists', icon: 'Star', badge: 2 },
  { id: 'invitations', label: 'Invitations', icon: 'Mail', badge: 1 },
  { id: 'analytics', label: 'Analytics', icon: 'BarChart2' },
  { id: 'settings', label: 'Settings', icon: 'Settings' },
];

export const INFLUENCER_NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: 'LayoutDashboard' },
  { id: 'profile', label: 'My Profile', icon: 'UserCheck' },
  { id: 'opportunities', label: 'Opportunities', icon: 'Compass', badge: 4 },
  { id: 'invitations', label: 'Invitations', icon: 'Inbox', badge: 2, badgeVariant: 'warning' },
  { id: 'activity', label: 'Campaign Activity', icon: 'Activity', badge: 2 },
  { id: 'settings', label: 'Settings', icon: 'Settings' },
];

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: 'LayoutDashboard' },
  { id: 'users', label: 'Users', icon: 'Users', badge: 8 },
  { id: 'data-imports', label: 'Data Imports', icon: 'Database' },
  { id: 'models', label: 'Models', icon: 'Cpu' },
  { id: 'audit-events', label: 'Audit Events', icon: 'FileText' },
  { id: 'system-health', label: 'System Health', icon: 'ActivitySquare', badge: '100%', badgeVariant: 'success' },
];

export const CONTEXT_INFO: Record<WorkspaceRole, WorkspaceContextInfo> = {
  brand: {
    role: 'brand',
    displayName: 'Acme Tech Innovations',
    subTitle: 'Brand Admin · Active Plan',
    avatarText: 'AC',
  },
  influencer: {
    role: 'influencer',
    displayName: 'Marcus Chen',
    subTitle: '@tech_marcus · Verified Creator',
    avatarText: 'MC',
  },
  admin: {
    role: 'admin',
    displayName: 'Platform Administrator',
    subTitle: 'System Root Operator',
    avatarText: 'AD',
  },
};

export const AppShell: React.FC<AppShellProps> = ({
  role,
  activeRoute,
  onNavigate,
  onSwitchRole,
  onReturnToWebsite,
  children,
}) => {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const navMap: Record<WorkspaceRole, NavItem[]> = {
    brand: BRAND_NAV_ITEMS,
    influencer: INFLUENCER_NAV_ITEMS,
    admin: ADMIN_NAV_ITEMS,
  };

  const currentNavItems = navMap[role];
  const currentContext = CONTEXT_INFO[role];
  const activeItem = currentNavItems.find((item) => item.id === activeRoute) || currentNavItems[0];

  const roleNameLabel =
    role === 'brand' ? 'Brand Workspace' : role === 'influencer' ? 'Creator Studio' : 'Admin Operations';

  const breadcrumbs: BreadcrumbItem[] = [
    { label: roleNameLabel, onClick: () => onNavigate('overview') },
    { label: activeItem?.label || 'Overview', active: true },
  ];

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#17243A] flex font-sans antialiased text-left">
      {/* Reusable Sidebar */}
      <Sidebar
        role={role}
        contextInfo={currentContext}
        items={currentNavItems}
        activeRoute={activeRoute}
        onNavigate={onNavigate}
        onSwitchRole={onSwitchRole}
        onReturnToWebsite={onReturnToWebsite}
        isMobileOpen={mobileDrawerOpen}
        onCloseMobile={() => setMobileDrawerOpen(false)}
      />

      {/* Main Content View Column */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopHeader
          title={activeItem?.label || 'Overview'}
          breadcrumbs={breadcrumbs}
          contextInfo={currentContext}
          onOpenMobileSidebar={() => setMobileDrawerOpen(true)}
          onSwitchRole={onSwitchRole}
          onReturnToWebsite={onReturnToWebsite}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
