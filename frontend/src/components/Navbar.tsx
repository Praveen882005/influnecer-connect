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
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="BRAND BRIDGE Logo"
            role="img"
          >
            <rect width="64" height="64" rx="14" fill="#0f172a" />
            <path
              d="M12 44 C24 24, 40 24, 52 44"
              stroke="#38bdf8"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
            <path d="M16 44 L16 34" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
            <path d="M26 44 L26 27" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
            <path d="M38 44 L38 27" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
            <path d="M48 44 L48 34" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
            <circle cx="20" cy="22" r="4" fill="#f43f5e" />
            <circle cx="44" cy="22" r="4" fill="#6366f1" />
            <path d="M24 22 L40 22" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="2 2" />
          </svg>
          <div>
            <h1 className="brand-title">BRAND BRIDGE</h1>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginTop: '-2px' }}>
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
