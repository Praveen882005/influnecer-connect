import React from 'react';
import { Badge, Button, Icon } from '../../design-system';

interface LandingHeroProps {
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onExploreApp: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({ onOpenAuth, onExploreApp }) => {
  return (
    <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 border-b border-[#E5E7EB] bg-gradient-to-b from-[#F7F5F0] via-white to-[#F7F5F0]/50 overflow-hidden text-center">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
        {/* Top Product Badge */}
        <div className="inline-flex items-center gap-2 mb-6">
          <Badge variant="brand" withDot size="md">
            Architectural Creator Intelligence
          </Badge>
          <span className="text-xs text-[#697386] font-medium">B2B SaaS Platform</span>
        </div>

        {/* Primary Headline */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold font-['Manrope',sans-serif] text-[#17243A] tracking-tight leading-[1.12] mb-6 max-w-4xl">
          Precision Brand-Creator Partnerships Driven by{' '}
          <span className="text-[#4169E1] relative whitespace-nowrap">
            Auditable Intelligence
            <svg
              className="absolute -bottom-2 left-0 w-full h-2.5 text-[#DCE5FA]"
              viewBox="0 0 100 20"
              preserveAspectRatio="none"
              fill="currentColor"
            >
              <path d="M0,10 Q50,0 100,10 L100,20 Q50,10 0,20 Z" />
            </svg>
          </span>
        </h1>

        {/* Lead Subtitle */}
        <p className="text-base sm:text-lg text-[#697386] max-w-2xl leading-relaxed mb-10 font-normal">
          Replace speculative influencer outreach with auditable semantic brief matching, audience affinity
          diagnostics, tier-normalized benchmarks, and transparent end-to-end campaign execution.
        </p>

        {/* CTA Button Group */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto mb-12">
          <Button
            variant="primary"
            size="lg"
            rightIcon="ArrowRight"
            onClick={() => onOpenAuth('register')}
            className="w-full sm:w-auto"
          >
            Start Free Trial as Brand or Creator
          </Button>

          <Button
            variant="outline"
            size="lg"
            leftIcon="Sparkles"
            onClick={onExploreApp}
            className="w-full sm:w-auto"
          >
            Interactive Product Preview
          </Button>
        </div>

        {/* Signal Attributes Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full max-w-4xl pt-8 border-t border-[#E5E7EB] text-left">
          <div className="p-3.5 rounded-[10px] bg-white border border-[#E5E7EB] shadow-2xs flex items-start gap-3">
            <div className="w-8 h-8 rounded-[8px] bg-[#DCE5FA] text-[#4169E1] flex items-center justify-center shrink-0 mt-0.5">
              <Icon name="Binary" size={16} />
            </div>
            <div>
              <div className="text-xs font-bold font-['Manrope',sans-serif] text-[#17243A]">Semantic Matching</div>
              <div className="text-[11px] text-[#697386]">Vectorized Cosine Similarity</div>
            </div>
          </div>

          <div className="p-3.5 rounded-[10px] bg-white border border-[#E5E7EB] shadow-2xs flex items-start gap-3">
            <div className="w-8 h-8 rounded-[8px] bg-[#E8F5EE] text-[#21865B] flex items-center justify-center shrink-0 mt-0.5">
              <Icon name="Users" size={16} />
            </div>
            <div>
              <div className="text-xs font-bold font-['Manrope',sans-serif] text-[#17243A]">Audience Overlap</div>
              <div className="text-[11px] text-[#697386]">Demographic &amp; Geo Alignment</div>
            </div>
          </div>

          <div className="p-3.5 rounded-[10px] bg-white border border-[#E5E7EB] shadow-2xs flex items-start gap-3">
            <div className="w-8 h-8 rounded-[8px] bg-[#FEF7EC] text-[#B7791F] flex items-center justify-center shrink-0 mt-0.5">
              <Icon name="BarChart3" size={16} />
            </div>
            <div>
              <div className="text-xs font-bold font-['Manrope',sans-serif] text-[#17243A]">Tier Benchmarks</div>
              <div className="text-[11px] text-[#697386]">Follower-Normalized Ratios</div>
            </div>
          </div>

          <div className="p-3.5 rounded-[10px] bg-white border border-[#E5E7EB] shadow-2xs flex items-start gap-3">
            <div className="w-8 h-8 rounded-[8px] bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center shrink-0 mt-0.5">
              <Icon name="ShieldCheck" size={16} />
            </div>
            <div>
              <div className="text-xs font-bold font-['Manrope',sans-serif] text-[#17243A]">Explainable Signals</div>
              <div className="text-[11px] text-[#697386]">Transparent Heuristics</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
