import React from 'react';
import { Badge, Button, Icon } from '../../design-system';

interface LandingHeroProps {
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onExploreApp: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({ onOpenAuth, onExploreApp }) => {
  return (
    <section className="relative pt-12 pb-16 md:pt-20 md:pb-24 border-b border-slate-200 bg-white overflow-hidden text-center">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
        {/* Top Product Badge */}
        <div className="inline-flex items-center gap-2 mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Badge variant="brand" withDot size="md">
            Algorithmic Creator Intelligence Platform
          </Badge>
          <span className="text-xs text-slate-500 font-medium">B2B SaaS Architecture</span>
        </div>

        {/* Primary Headline */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-950 tracking-tight leading-[1.12] mb-6 max-w-3xl">
          Precision Brand-Creator Partnerships Driven by{' '}
          <span className="text-sky-600 underline decoration-sky-300 underline-offset-4">
            Auditable Intelligence
          </span>
        </h1>

        {/* Lead Subtitle */}
        <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed mb-8 font-normal">
          Replace subjective influencer outreach with multi-signal semantic matching, demographic
          affinity scoring, tier-normalized engagement benchmarks, and end-to-end campaign contract workflows.
        </p>

        {/* CTA Button Group */}
        <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto mb-10">
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full max-w-3xl pt-8 border-t border-slate-100 text-left">
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-[4px] bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 mt-0.5">
              <Icon name="Binary" size={15} />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-900">Semantic Matching</div>
              <div className="text-[11px] text-slate-500">TF-IDF Vectorized Similarity</div>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-[4px] bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
              <Icon name="Users" size={15} />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-900">Audience Overlap</div>
              <div className="text-[11px] text-slate-500">Age &amp; Geography Alignment</div>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-[4px] bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
              <Icon name="BarChart3" size={15} />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-900">Tier Benchmarks</div>
              <div className="text-[11px] text-slate-500">Follower-Normalized Quality</div>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-[4px] bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
              <Icon name="ShieldCheck" size={15} />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-900">Explainable Signals</div>
              <div className="text-[11px] text-slate-500">Transparent Anomaly Heuristics</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
