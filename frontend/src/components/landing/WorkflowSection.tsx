import React from 'react';
import { Badge, Card, Container, Icon, type IconName } from '../../design-system';

interface WorkflowStep {
  step: string;
  title: string;
  description: string;
  icon: IconName;
  badge: string;
}

const STEPS: WorkflowStep[] = [
  {
    step: '01',
    title: 'Publish Campaign Specifications',
    description:
      'Brands define budget, required deliverable assets (e.g. YouTube integrations, Reels), content niche, and target demographic cohorts.',
    icon: 'FileEdit',
    badge: 'Brief Creation',
  },
  {
    step: '02',
    title: 'Algorithmic Fit & Anomaly Scoring',
    description:
      'Our engine evaluates content relevance with TF-IDF cosine similarity, demographic alignment, and follower-tier normalized engagement.',
    icon: 'Cpu',
    badge: 'AI Engine',
  },
  {
    step: '03',
    title: 'Direct Pitch & Proposal Negotiation',
    description:
      'Vetted creators submit competitive pitches with customized delivery timelines and pricing, reviewed directly on the brand dashboard.',
    icon: 'SendHorizontal',
    badge: 'Collaboration',
  },
  {
    step: '04',
    title: 'Deliverable Verification & Settlement',
    description:
      'Creators submit published proof links for review. Milestone approvals and deliverable tracking maintain transparency across both parties.',
    icon: 'CheckSquare',
    badge: 'Execution',
  },
];

export const WorkflowSection: React.FC = () => {
  return (
    <section id="workflow" className="py-16 md:py-24 bg-[#F7F5F0] border-b border-[#E5E7EB] text-left">
      <Container size="lg">
        {/* Section Header */}
        <div className="max-w-2xl mb-12">
          <Badge variant="brand" size="sm" className="mb-2.5">
            Structured Execution
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-bold font-['Manrope',sans-serif] text-[#17243A] tracking-tight mb-3">
            How Brand Bridge Accelerates Partnerships
          </h2>
          <p className="text-sm text-[#697386] leading-relaxed">
            From initial campaign brief to deliverable link verification, every step is structured,
            auditable, and backed by verifiable data.
          </p>
        </div>

        {/* 4-Step Workflow Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((s) => (
            <Card key={s.step} hoverable className="relative flex flex-col justify-between p-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl font-mono font-bold text-[#4169E1]">{s.step}</span>
                  <Badge variant="neutral" size="sm">
                    {s.badge}
                  </Badge>
                </div>

                <div className="w-10 h-10 rounded-[10px] bg-[#F7F5F0] border border-[#E5E7EB] text-[#17243A] flex items-center justify-center mb-4">
                  <Icon name={s.icon} size={18} />
                </div>

                <h3 className="text-sm font-bold font-['Manrope',sans-serif] text-[#17243A] mb-2 leading-snug">{s.title}</h3>
                <p className="text-xs text-[#697386] leading-relaxed">{s.description}</p>
              </div>

              <div className="pt-4 mt-6 border-t border-[#E5E7EB] text-[11px] font-semibold text-[#4169E1] flex items-center gap-1">
                <span>Phase-Enforced Workflow</span>
                <Icon name="ChevronRight" size={12} />
              </div>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
};
