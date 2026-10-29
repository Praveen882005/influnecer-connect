import React from 'react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  shortlistCount: number;
  openAuthModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  shortlistCount,
  openAuthModal,
}) => {
  const { user, isAuthenticated, logout, demoLogin } = useAuth();

  return (
    <header className="app-header" role="banner">
      <div className="header-inner">
        <div className="brand-identity" onClick={() => setActiveTab('discover')} style={{ cursor: 'pointer' }}>
          <svg
            className="brand-logo-svg"
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="BRAND BRIDGE Logo"
            role="img"
            style={{ width: '32px', height: '32px', marginRight: '8px' }}
          >
            <rect x="4" y="32" width="32" height="3" rx="1.5" fill="#DCE5FA" />
            <path d="M9 32V14C9 12.8954 9.89543 12 11 12C12.1046 12 13 12.8954 13 14V32" stroke="#17243A" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M27 32V14C27 12.8954 27.8954 12 29 12C30.1046 12 31 12.8954 31 14V32" stroke="#17243A" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M7 26C13 16 27 16 33 26" stroke="#4169E1" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="16" y1="21" x2="16" y2="32" stroke="#DCE5FA" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="20" y1="18.5" x2="20" y2="32" stroke="#4169E1" strokeWidth="1.75" strokeLinecap="round" />
            <line x1="24" y1="21" x2="24" y2="32" stroke="#DCE5FA" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="20" cy="18.5" r="2.75" fill="#4169E1" />
            <circle cx="20" cy="18.5" r="1.25" fill="#FFFFFF" />
          </svg>
          <div>
            <h1 className="brand-title">BRAND BRIDGE</h1>
            <span style={{ fontSize: '0.7rem', color: '#697386', display: 'block', marginTop: '-2px' }}>
              Intelligence &amp; Collaboration Platform
            </span>
          </div>
        </div>

        <nav className="nav-tabs" aria-label="Main Navigation">
          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'discover' ? 'active' : ''}`}
            onClick={() => setActiveTab('discover')}
          >
            Creator Discovery
          </button>
          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'campaigns' ? 'active' : ''}`}
            onClick={() => setActiveTab('campaigns')}
          >
            Campaigns
          </button>
          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'matching' ? 'active' : ''}`}
            onClick={() => setActiveTab('matching')}
          >
            AI Matching Studio
          </button>

          {isAuthenticated && (user?.role === 'brand' || user?.role === 'admin') && (
            <button
              type="button"
              className={`nav-tab-btn ${activeTab === 'brand_hub' ? 'active' : ''}`}
              onClick={() => setActiveTab('brand_hub')}
            >
              Brand Management
            </button>
          )}

          {isAuthenticated && (user?.role === 'creator' || user?.role === 'admin') && (
            <button
              type="button"
              className={`nav-tab-btn ${activeTab === 'creator_hub' ? 'active' : ''}`}
              onClick={() => setActiveTab('creator_hub')}
            >
              Creator Studio
            </button>
          )}

          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            Analytics &amp; Data
          </button>
        </nav>

        <div className="header-actions">
          {isAuthenticated && (user?.role === 'brand' || user?.role === 'admin') && (
            <button
              type="button"
              className={`shortlist-pill-btn ${activeTab === 'shortlist' ? 'active' : ''}`}
              onClick={() => setActiveTab('shortlist')}
              title="View Shortlisted Creators"
            >
              Shortlist ({shortlistCount})
            </button>
          )}

          {isAuthenticated ? (
            <div className="user-profile-widget">
              <span className={`role-pill role-${user?.role}`}>
                {user?.role.toUpperCase()}
              </span>
              <span className="user-name-label" title={user?.email}>
                {user?.full_name}
              </span>
              <button type="button" className="action-btn-sm" onClick={logout}>
                Log Out
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                className="action-btn-primary"
                onClick={openAuthModal}
              >
                Sign In / Join
              </button>
              <div className="demo-switch-dropdown" title="Instant role test accounts">
                <button
                  type="button"
                  className="demo-pill-btn"
                  onClick={() => demoLogin('brand')}
                >
                  Demo Brand
                </button>
                <button
                  type="button"
                  className="demo-pill-btn"
                  onClick={() => demoLogin('creator')}
                >
                  Demo Creator
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
