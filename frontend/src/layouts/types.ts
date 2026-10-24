import type { IconName } from '../design-system';

export type WorkspaceRole = 'brand' | 'influencer' | 'admin';

export interface NavItem {
  id: string;
  label: string;
  icon: IconName;
  badge?: string | number;
  badgeVariant?: 'brand' | 'success' | 'warning' | 'neutral';
}

export interface BreadcrumbItem {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export interface WorkspaceContextInfo {
  role: WorkspaceRole;
  displayName: string;
  subTitle: string;
  avatarText: string;
}
