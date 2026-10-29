import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Avatar, Dropdown, Icon } from '../design-system';
import type { NotificationItem } from '../types';
import type { BreadcrumbItem, WorkspaceContextInfo, WorkspaceRole } from './types';

interface TopHeaderProps {
  title: string;
  breadcrumbs: BreadcrumbItem[];
  contextInfo: WorkspaceContextInfo;
  onOpenMobileSidebar: () => void;
  onSwitchRole: (newRole: WorkspaceRole) => void;
  onReturnToWebsite: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  title,
  breadcrumbs,
  contextInfo,
  onOpenMobileSidebar,
  onSwitchRole,
  onReturnToWebsite,
}) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await api.notifications.list({ limit: 10 });
      setNotifications(res.notifications);
      setUnreadCount(res.unread_count);
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // 30s poll
    return () => clearInterval(interval);
  }, [user]);

  // Click outside and Escape key listener for notifications popover
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        notificationsOpen &&
        notificationsRef.current &&
        !notificationsRef.current.contains(e.target as Node)
      ) {
        setNotificationsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && notificationsOpen) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [notificationsOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/auth/sign-in');
  };

  const handleMarkAllRead = async () => {
    try {
      await api.notifications.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // Non-blocking
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.is_read) {
      try {
        await api.notifications.markRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // Non-blocking
      }
    }
    setNotificationsOpen(false);
    if (notif.link_url) {
      navigate(notif.link_url);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-[#E5E7EB] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 select-none shadow-2xs">
      {/* Left: Mobile hamburger + Title & Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="md:hidden text-[#697386] hover:text-[#17243A] p-2 rounded-[6px] border border-[#E5E7EB] focus-visible:ring-2 focus-visible:ring-[#4169E1] focus-visible:outline-none transition-colors cursor-pointer"
          aria-label="Open navigation sidebar"
        >
          <Icon name="Menu" size={18} />
        </button>

        <div className="text-left">
          {/* Breadcrumb row */}
          {breadcrumbs.length > 0 && (
            <nav className="flex items-center gap-1.5 text-[11px] text-[#697386] font-medium mb-0.5">
              <span>Brand Bridge</span>
              {breadcrumbs.map((b, i) => (
                <React.Fragment key={i}>
                  <span className="text-[#CBD5E1]">/</span>
                  <span
                    className={
                      b.active
                        ? 'text-[#17243A] font-semibold'
                        : 'hover:text-[#17243A] cursor-pointer'
                    }
                    onClick={b.onClick}
                  >
                    {b.label}
                  </span>
                </React.Fragment>
              ))}
            </nav>
          )}
          <h1 className="text-base font-bold font-['Manrope',sans-serif] text-[#17243A] leading-tight tracking-tight">
            {title}
          </h1>
        </div>
      </div>

      {/* Right: Notification Bell + Profile Menu */}
      <div className="flex items-center gap-3">
        {/* Notification Bell with Badge */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setNotificationsOpen(!notificationsOpen);
              if (!notificationsOpen) fetchNotifications();
            }}
            aria-expanded={notificationsOpen}
            className="w-9 h-9 rounded-[8px] border border-[#E5E7EB] text-[#697386] hover:text-[#17243A] hover:bg-[#F7F5F0] flex items-center justify-center transition-all duration-150 relative cursor-pointer focus-visible:ring-2 focus-visible:ring-[#4169E1] focus-visible:outline-none"
            aria-label="View notifications"
          >
            <Icon name="Bell" size={16} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[17px] h-4.5 px-1 rounded-full bg-[#C24141] text-white text-[9px] font-bold flex items-center justify-center border-2 border-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Popover */}
          {notificationsOpen && (
            <div
              ref={notificationsRef}
              role="region"
              aria-label="In-App Notifications"
              className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-84 max-w-sm rounded-[14px] bg-white border border-[#E5E7EB] shadow-[0_12px_28px_rgba(23,36,58,0.12)] py-2 z-50 text-left animate-in fade-in-50 zoom-in-95 duration-100"
            >
              <div className="px-4 py-2 border-b border-[#E5E7EB] flex items-center justify-between text-xs font-bold font-['Manrope',sans-serif] text-[#17243A]">
                <span>In-App Notifications</span>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-[10px] text-[#4169E1] hover:text-[#2563EB] font-semibold cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                  <span className="text-[10px] text-[#697386] font-mono">
                    {unreadCount} unread
                  </span>
                </div>
              </div>
              <div className="divide-y divide-[#E5E7EB] max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#697386]">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`p-3 transition-colors cursor-pointer ${
                        n.is_read ? 'hover:bg-[#F7F5F0] opacity-80' : 'bg-[#F0F4FE] hover:bg-[#DCE5FA]/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="text-xs font-bold text-[#17243A] leading-tight">
                          {n.title}
                        </div>
                        {!n.is_read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#4169E1] shrink-0 mt-1" />
                        )}
                      </div>
                      <div className="text-[11px] text-[#475569] mt-0.5 line-clamp-2 leading-relaxed">
                        {n.message}
                      </div>
                      <div className="text-[9px] text-[#697386] mt-1 font-mono">
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="px-4 py-1.5 bg-[#F7F5F0] border-t border-[#E5E7EB] text-[9px] text-[#697386]">
                In-app delivery active · SMS/Email disabled without provider keys
              </div>
            </div>
          )}
        </div>

        {/* User Account Dropdown */}
        <Dropdown
          trigger={
            <div className="flex items-center gap-2.5 pl-2.5 border-l border-[#E5E7EB] cursor-pointer group">
              <Avatar name={contextInfo.displayName} size="sm" status="online" />
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold font-['Manrope',sans-serif] text-[#17243A] group-hover:text-[#4169E1] transition-colors leading-tight">
                  {contextInfo.displayName}
                </div>
                <div className="text-[10px] text-[#697386] font-mono uppercase">
                  {contextInfo.role}
                </div>
              </div>
              <Icon name="ChevronDown" size={14} className="text-[#697386] group-hover:text-[#17243A] transition-colors" />
            </div>
          }
          items={[
            {
              id: 'switch-brand',
              label: 'Switch to Brand View',
              icon: 'Building2',
              onClick: () => onSwitchRole('brand'),
            },
            {
              id: 'switch-influencer',
              label: 'Switch to Influencer View',
              icon: 'Video',
              onClick: () => onSwitchRole('influencer'),
            },
            {
              id: 'switch-admin',
              label: 'Switch to Admin View',
              icon: 'Shield',
              onClick: () => onSwitchRole('admin'),
            },
            {
              id: 'return-website',
              label: 'Return to Website',
              icon: 'Globe',
              onClick: onReturnToWebsite,
            },
            {
              id: 'logout',
              label: 'Sign Out',
              icon: 'LogOut',
              danger: true,
              onClick: handleLogout,
            },
          ]}
        />
      </div>
    </header>
  );
};
