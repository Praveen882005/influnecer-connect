import React from 'react';
import { Badge, Card, Container, Icon, type IconName } from '../../design-system';

interface FeatureCardData {
  title: string;
  tagline: string;
  description: string;
  icon: IconName;
  metrics: string[];
}

const FEATURES: FeatureCardData[] = [
  {
    title: 'Semantic Content Relevance',
    tagline: 'Natural Language Vector Processing',
    description:
      'Our engine applies TF-IDF vectorization and cosine similarity over campaign briefs, creator bios, and content keyword histories to surface true thematic alignment rather than raw keyword matches.',
    icon: 'Network',
    metrics: ['TF-IDF Vector Space', 'Niche Affinity Index', 'Topic Cluster Extraction'],
  },
  {
    title: 'Tier-Normalized Engagement Quality',
    tagline: 'Statistical Baseline Comparison',
    description:
      'Engagement rates vary systematically by follower scale. Nano-influencers (4%) and macro-creators (1.3%) are scored relative to their respective tier benchmarks to evaluate organic efficiency fairly.',
    icon: 'LineChart',
    metrics: ['Tier Benchmarking', 'Efficiency Ratio', 'Interaction Dispersion'],
  },
  {
    title: 'Explainable Fit & Heuristic Signals',
    tagline: 'Transparent Audit Records',
    description:
      'Every score includes attribution signals, identified strengths, and potential caution flags. Authenticity checks evaluate interaction spikes as statistical heuristics rather than unverified fraud claims.',
    icon: 'SearchCode',
    metrics: ['Strengths Breakdown', 'Missing Metrics Handled', 'Heuristic Disclaimers'],
  },
  {
    title: 'End-to-End Campaign Lifecycle',
    tagline: 'Contract & Deliverable Tracking',
    description:
      'Manage briefs, receive inbound proposals with transparent pricing, accept or counter bids, and review submitted proof URLs from a unified brand workspace.',
    icon: 'Briefcase',
    metrics: ['Custom Deliverables', 'Direct Bidding', 'Milestone Verification'],
  },
];

export const FeaturesSection: React.FC = () => {
  return (
    <section id="features" className="py-16 md:py-24 bg-white border-b border-[#E5E7EB] text-left">
      <Container size="lg">
        {/* Section Header */}
        <div className="max-w-2xl mb-14">
          <Badge variant="brand" size="sm" className="mb-2.5">
            Engine Capabilities
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-bold font-['Manrope',sans-serif] text-[#17243A] tracking-tight mb-3">
            Built for Analytical Rigor, Not Guesswork
          </h2>
          <p className="text-sm text-[#697386] leading-relaxed">
            Every feature on Brand Bridge is engineered to give brands and creators clear, auditable
            data for evaluating partnerships with confidence.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {FEATURES.map((f) => (
            <Card key={f.title} padding="lg" hoverable className="flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3.5 mb-4">
                  <div className="w-11 h-11 rounded-[10px] bg-[#DCE5FA] text-[#4169E1] flex items-center justify-center shrink-0">
                    <Icon name={f.icon} size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold font-['Manrope',sans-serif] text-[#17243A] leading-tight">{f.title}</h3>
                    <span className="text-xs text-[#4169E1] font-semibold">{f.tagline}</span>
                  </div>
                </div>

                <p className="text-xs text-[#697386] leading-relaxed mb-6">{f.description}</p>
              </div>

              <div className="pt-4 border-t border-[#E5E7EB] flex flex-wrap gap-2">
                {f.metrics.map((m) => (
                  <span
                    key={m}
                    className="text-[11px] font-mono px-2.5 py-1 rounded-[6px] bg-[#F7F5F0] text-[#17243A] border border-[#E5E7EB]"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
};
