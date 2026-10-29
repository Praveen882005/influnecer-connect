import React, { useState } from 'react';
import { Button, BrandBridgeLogo, Icon } from '../../design-system';
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
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-[#E5E7EB] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand Logo */}
        <a href="#" className="flex items-center group">
          <BrandBridgeLogo size="md" subtitle="Creator Intelligence" />
        </a>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-7" aria-label="Public website links">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-xs font-semibold text-[#697386] hover:text-[#4169E1] transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Action Controls */}
        <div className="hidden md:flex items-center gap-2.5">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-[#17243A]">
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
              <div className="h-4 w-px bg-[#E5E7EB] mx-1" />
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
            className="p-2 text-[#697386] hover:text-[#17243A] rounded-[6px] border border-[#E5E7EB] focus-visible:ring-2 focus-visible:ring-[#4169E1] focus:outline-none cursor-pointer"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            <Icon name={mobileMenuOpen ? 'X' : 'Menu'} size={20} />
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#E5E7EB] bg-white px-4 pt-3 pb-5 space-y-3 text-left animate-in slide-in-from-top duration-150">
          <nav className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-xs font-semibold text-[#17243A] hover:text-[#4169E1] py-1.5"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="pt-3 border-t border-[#E5E7EB] flex flex-col gap-2">
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
