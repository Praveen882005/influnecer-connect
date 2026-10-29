import React, { useState } from 'react';
import { Avatar, Badge, Card, Container } from '../../design-system';

export const ProductPreviewSection: React.FC = () => {
  const [selectedCreatorTab, setSelectedCreatorTab] = useState<'marcus' | 'claire'>('marcus');

  const previewData = {
    marcus: {
      name: 'Marcus Chen',
      handle: '@tech_marcus',
      niche: 'Tech & AI',
      followers: '490,000 Reach',
      engagement: '3.8%',
      authenticity: 94.5,
      overallScore: 92.4,
      contentScore: 94.0,
      audienceScore: 88.0,
      engagementScore: 92.5,
      authScore: 95.0,
      strengths: [
        'Strong niche alignment in Tech & AI with high keyword density in developer tooling',
        '84% concentration in primary target age cohorts (18-34)',
        'Healthy follower-to-interaction distributions conforming to expected organic curves',
      ],
      signals: ['TF-IDF keyword overlap', 'Geographic match: US, CA, UK', 'Tier benchmark: 1.8%'],
    },
    claire: {
      name: 'Claire Vance',
      handle: '@claire_wellness',
      niche: 'Fitness & Wellness',
      followers: '515,000 Reach',
      engagement: '4.6%',
      authenticity: 96.0,
      overallScore: 89.2,
      contentScore: 85.0,
      audienceScore: 91.0,
      engagementScore: 95.0,
      authScore: 96.0,
      strengths: [
        'Above-benchmark engagement efficiency (4.6% vs 1.8% mid-tier baseline)',
        'High demographic concentration in health and wellness lifestyle buyers',
        'Low anomaly indicator index across multi-platform activity',
      ],
      signals: ['Audience age split: 18-34 (86%)', 'Primary platform: Instagram & YouTube', 'Verified identity'],
    },
  };

  const active = previewData[selectedCreatorTab];

  return (
    <section className="py-16 md:py-24 bg-white border-b border-[#E5E7EB] text-left">
      <Container size="lg">
        {/* Section Header */}
        <div className="max-w-2xl mb-12">
          <Badge variant="brand" size="sm" className="mb-2.5">
            Inside the Workspace
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-bold font-['Manrope',sans-serif] text-[#17243A] tracking-tight mb-3">
            Real Component Preview: Multi-Signal Match Scoring
          </h2>
          <p className="text-sm text-[#697386] leading-relaxed">
            See exactly how Brand Bridge evaluates creators against active campaign briefs using our
            production UI primitives and explainable scoring breakdown.
          </p>
        </div>

        {/* Interactive Workspace Simulator Container */}
        <div className="rounded-[16px] border border-[#E5E7EB] bg-[#F7F5F0]/70 shadow-sm p-4 sm:p-6 lg:p-8">
          {/* Top Mock Window Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-6 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#CBD5E1]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#CBD5E1]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#CBD5E1]" />
              <span className="text-xs font-mono font-medium text-[#697386] ml-2">
                Brand Bridge // AI Evaluation Studio
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#697386] font-medium">Select Preview Creator:</span>
              <button
                type="button"
                className={`text-xs px-3 py-1.5 rounded-[6px] font-semibold transition-all cursor-pointer ${
                  selectedCreatorTab === 'marcus'
                    ? 'bg-[#4169E1] text-white shadow-xs'
                    : 'bg-white border border-[#E5E7EB] text-[#17243A] hover:bg-[#F0EFEA]'
                }`}
                onClick={() => setSelectedCreatorTab('marcus')}
              >
                Marcus Chen (Tech)
              </button>
              <button
                type="button"
                className={`text-xs px-3 py-1.5 rounded-[6px] font-semibold transition-all cursor-pointer ${
                  selectedCreatorTab === 'claire'
                    ? 'bg-[#4169E1] text-white shadow-xs'
                    : 'bg-white border border-[#E5E7EB] text-[#17243A] hover:bg-[#F0EFEA]'
                }`}
                onClick={() => setSelectedCreatorTab('claire')}
              >
                Claire Vance (Wellness)
              </button>
            </div>
          </div>

          {/* Simulated Match Evaluation Card */}
          <Card padding="lg" className="bg-white rounded-[14px]">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#E5E7EB]">
              <div className="flex items-start sm:items-center gap-4">
                <Avatar name={active.name} size="lg" status="online" />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold font-['Manrope',sans-serif] text-[#17243A] leading-none">{active.name}</h3>
                    <span className="text-xs text-[#697386] font-mono">{active.handle}</span>
                    <span className="w-4.5 h-4.5 rounded-full bg-[#E8F5EE] text-[#21865B] flex items-center justify-center text-[10px] font-bold">
                      ✓
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#697386]">
                    <Badge variant="neutral" size="sm">
                      {active.niche}
                    </Badge>
                    <span>{active.followers}</span>
                    <span>·</span>
                    <span className="text-[#4169E1] font-semibold">{active.engagement} Avg Engagement</span>
                  </div>
                </div>
              </div>

              {/* Score Display Box */}
              <div className="flex items-center gap-4 bg-[#F7F5F0] border border-[#E5E7EB] rounded-[10px] px-5 py-3.5 shrink-0">
                <div>
                  <div className="text-[11px] font-bold text-[#697386] uppercase tracking-wider">
                    Calculated Match Score
                  </div>
                  <div className="text-2xl font-extrabold font-['Manrope',sans-serif] text-[#17243A] leading-none mt-1">
                    {active.overallScore} <span className="text-xs font-normal text-[#697386]">/ 100</span>
                  </div>
                </div>
                <div className="h-10 w-10 rounded-[8px] bg-[#DCE5FA] text-[#4169E1] flex items-center justify-center font-bold text-sm">
                  ★
                </div>
              </div>
            </div>

            {/* Signal Bars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 py-6 border-b border-[#E5E7EB]">
              <div>
                <div className="flex justify-between text-xs font-semibold text-[#17243A] mb-1.5">
                  <span>Content Relevance</span>
                  <span className="font-mono text-[#4169E1]">{active.contentScore}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#E5E7EB] overflow-hidden">
                  <div className="h-full bg-[#4169E1] rounded-full transition-all duration-300" style={{ width: `${active.contentScore}%` }} />
                </div>
                <span className="text-[11px] text-[#697386] mt-1.5 block">TF-IDF Vector Cosine</span>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-[#17243A] mb-1.5">
                  <span>Audience Affinity</span>
                  <span className="font-mono text-[#17243A]">{active.audienceScore}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#E5E7EB] overflow-hidden">
                  <div className="h-full bg-[#17243A] rounded-full transition-all duration-300" style={{ width: `${active.audienceScore}%` }} />
                </div>
                <span className="text-[11px] text-[#697386] mt-1.5 block">Age &amp; Geography Cohort</span>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-[#17243A] mb-1.5">
                  <span>Engagement Quality</span>
                  <span className="font-mono text-[#21865B]">{active.engagementScore}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#E5E7EB] overflow-hidden">
                  <div className="h-full bg-[#21865B] rounded-full transition-all duration-300" style={{ width: `${active.engagementScore}%` }} />
                </div>
                <span className="text-[11px] text-[#697386] mt-1.5 block">Tier-Normalized Ratio</span>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-[#17243A] mb-1.5">
                  <span>Authenticity Index*</span>
                  <span className="font-mono text-[#B7791F]">{active.authScore}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#E5E7EB] overflow-hidden">
                  <div className="h-full bg-[#B7791F] rounded-full transition-all duration-300" style={{ width: `${active.authScore}%` }} />
                </div>
                <span className="text-[11px] text-[#697386] mt-1.5 block">Statistical Heuristic</span>
              </div>
            </div>

            {/* Strengths & Signals */}
            <div className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-xs font-bold text-[#17243A] uppercase tracking-wider mb-3">
                  Signal-Backed Strengths
                </h4>
                <ul className="space-y-2.5">
                  {active.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-xs text-[#17243A]">
                      <span className="text-[#21865B] font-bold shrink-0">✓</span>
                      <span className="leading-relaxed">{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-bold text-[#17243A] uppercase tracking-wider mb-3">
                  Attribution Signals Used
                </h4>
                <div className="flex flex-wrap gap-2">
                  {active.signals.map((sig, i) => (
                    <span
                      key={i}
                      className="text-[11px] font-mono px-2.5 py-1 rounded-[6px] bg-[#F7F5F0] border border-[#E5E7EB] text-[#17243A]"
                    >
                      {sig}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-[#697386] mt-4 leading-normal italic">
                  *Authenticity scores evaluate interaction dispersion heuristics and do not constitute
                  definitive proof of fraud.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </Container>
    </section>
  );
};
