import React from 'react';
import { LandingHeader } from './LandingHeader';
import { LandingHero } from './LandingHero';
import { WorkflowSection } from './WorkflowSection';
import { FeaturesSection } from './FeaturesSection';
import { ValuePropositionSection } from './ValuePropositionSection';
import { ProductPreviewSection } from './ProductPreviewSection';
import { TrustTransparencySection } from './TrustTransparencySection';
import { FaqSection } from './FaqSection';
import { LandingFooter } from './LandingFooter';

interface PublicWebsiteProps {
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onExploreApp: () => void;
}

export const PublicWebsite: React.FC<PublicWebsiteProps> = ({ onOpenAuth, onExploreApp }) => {
  return (
    <div className="w-full bg-slate-50 text-slate-900 font-sans selection:bg-sky-100 selection:text-sky-900">
      <LandingHeader onOpenAuth={onOpenAuth} onExploreApp={onExploreApp} />
      <LandingHero onOpenAuth={onOpenAuth} onExploreApp={onExploreApp} />
      <WorkflowSection />
      <FeaturesSection />
      <ValuePropositionSection />
      <ProductPreviewSection />
      <TrustTransparencySection />
      <FaqSection />
      <LandingFooter />
    </div>
  );
};
