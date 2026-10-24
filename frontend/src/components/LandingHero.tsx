import React from 'react';
import { useAuth } from '../context/AuthContext';

interface LandingHeroProps {
  onNavigate: (tab: string) => void;
  onOpenAuth: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({ onNavigate, onOpenAuth }) => {
  const { isAuthenticated, demoLogin } = useAuth();

  return (
    <section className="hero-section" aria-labelledby="hero-title">
      <div className="hero-pill" role="status">
        <span>Next-Generation Creator &amp; Brand Intelligence</span>
      </div>
      <h2 id="hero-title" className="hero-heading">
        Bridging Brands and Creators with Intelligence
      </h2>
      <p className="hero-lead">
        Automated campaign workflows, transparent deliverables management, and data-backed
        creator matching powered by multi-signal semantic analysis.
      </p>

      <div className="hero-cta-group">
        <button
          type="button"
          className="action-btn-primary lg"
          onClick={() => onNavigate('discover')}
        >
          Discover Creators →
        </button>
        <button
          type="button"
          className="action-btn-outline lg"
          onClick={() => onNavigate('campaigns')}
        >
          View Campaigns
        </button>
        <button
          type="button"
          className="action-btn-outline lg"
          onClick={() => onNavigate('matching')}
        >
          ⚡ AI Matching Studio
        </button>
      </div>

      {!isAuthenticated && (
        <div className="hero-demo-bar">
          <span className="demo-label">Instant Experience:</span>
          <button
            type="button"
            className="demo-chip"
            onClick={() => demoLogin('brand')}
          >
            🏢 Log in as Demo Brand (Acme Tech)
          </button>
          <button
            type="button"
            className="demo-chip"
            onClick={() => demoLogin('creator')}
          >
            🎬 Log in as Demo Creator (@tech_marcus)
          </button>
          <button
            type="button"
            className="demo-chip"
            onClick={onOpenAuth}
          >
            + Create Custom Account
          </button>
        </div>
      )}
    </section>
  );
};
