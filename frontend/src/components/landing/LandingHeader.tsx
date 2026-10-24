import React, { useState } from 'react';
import { Button, Icon } from '../../design-system';
import { useAuth } from '../../context/AuthContext';

interface LandingHeaderProps {
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onExploreApp: () => void;
}

export const LandingHeader: React.FC<LandingHeaderProps> = ({ onOpenAuth, onExploreApp }) => {
  const { user, isAuthenticated, logout, demoLogin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Workflow', href: '#workflow' },
    { label: 'Features', href: '#features' },
    { label: 'For Brands', href: '#for-brands' },
    { label: 'For Creators', href: '#for-creators' },
    { label: 'Trust & Ethics', href: '#trust' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <a href="#" className="flex items-center gap-2.5 text-slate-900 group">
          <svg
            className="w-8 h-8 rounded-[6px]"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="BRAND BRIDGE Logo"
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
          <div className="text-left">
            <span className="font-bold text-sm tracking-tight text-slate-950 block leading-tight">
              BRAND BRIDGE
            </span>
            <span className="text-[10px] text-slate-500 font-medium tracking-wide block uppercase">
              Creator Intelligence
            </span>
          </div>
        </a>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-6" aria-label="Public website links">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-xs font-semibold text-slate-600 hover:text-sky-600 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Action Controls */}
        <div className="hidden md:flex items-center gap-2.5">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-700">
                {user?.full_name} ({user?.role})
              </span>
              <Button variant="primary" size="sm" onClick={onExploreApp}>
                Open Platform Studio
              </Button>
              <Button variant="ghost" size="sm" onClick={logout}>
                Log Out
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => onOpenAuth('login')}>
                Sign In
              </Button>
              <Button variant="primary" size="sm" onClick={() => onOpenAuth('register')}>
                Get Started
              </Button>
              <div className="h-4 w-px bg-slate-200 mx-1" />
              <Button
                variant="outline"
                size="sm"
                leftIcon="Zap"
                onClick={() => demoLogin('brand')}
                title="Log in immediately with preloaded benchmark demo data"
              >
                Demo
              </Button>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="md:hidden flex items-center">
          <button
            type="button"
            className="p-2 text-slate-600 hover:text-slate-900 focus:outline-none"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            <Icon name={mobileMenuOpen ? 'X' : 'Menu'} size={20} />
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white px-4 pt-3 pb-5 space-y-3 text-left animate-in slide-in-from-top duration-150">
          <nav className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-xs font-semibold text-slate-700 hover:text-sky-600 py-1.5"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            {isAuthenticated ? (
              <>
                <Button variant="primary" size="sm" fullWidth onClick={onExploreApp}>
                  Open Platform Studio
                </Button>
                <Button variant="ghost" size="sm" fullWidth onClick={logout}>
                  Log Out ({user?.full_name})
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth('register');
                  }}
                >
                  Create Free Account
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  fullWidth
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth('login');
                  }}
                >
                  Sign In
                </Button>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      demoLogin('brand');
                    }}
                  >
                    Demo Brand
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      demoLogin('creator');
                    }}
                  >
                    Demo Creator
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
