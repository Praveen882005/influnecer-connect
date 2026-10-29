import React from 'react';
import { Badge, Card, Container, Icon } from '../../design-system';

export const ValuePropositionSection: React.FC = () => {
  return (
    <section className="py-16 md:py-24 bg-[#F7F5F0] border-b border-[#E5E7EB] text-left">
      <Container size="lg">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <Badge variant="brand" size="sm" className="mb-2.5">
            Tailored Value
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-bold font-['Manrope',sans-serif] text-[#17243A] tracking-tight mb-3">
            Built for Both Sides of the Partnership
          </h2>
          <p className="text-sm text-[#697386] leading-relaxed">
            Brand Bridge aligns brand campaign ROI with authentic creator monetization through
            transparent parameters, mutual accountability, and direct communication.
          </p>
        </div>

        {/* Dual Value Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Brand Card */}
          <Card id="for-brands" padding="lg" className="border-t-4 border-t-[#4169E1] rounded-[16px] flex flex-col justify-between shadow-2xs">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[#4169E1]">
                  For Brands &amp; Agencies
                </span>
                <div className="w-9 h-9 rounded-[8px] bg-[#DCE5FA] text-[#4169E1] flex items-center justify-center">
                  <Icon name="Building2" size={18} />
                </div>
              </div>

              <h3 className="text-xl font-bold font-['Manrope',sans-serif] text-[#17243A] mb-3">
                Data-Driven Influencer Sourcing Without the Guesswork
              </h3>
              <p className="text-xs text-[#697386] leading-relaxed mb-6">
                Eliminate hours of manual profile scrolling. Source vetted creators whose audience
                demographics, content niche, and engagement performance match your campaign requirements.
              </p>

              <ul className="space-y-3.5 mb-6">
                <li className="flex items-start gap-2.5 text-xs text-[#17243A]">
                  <div className="text-[#21865B] mt-0.5 shrink-0">
                    <Icon name="Check" size={14} strokeWidth={3} />
                  </div>
                  <span>
                    <strong>Semantic Creator Discovery:</strong> Surface creators using full brief context rather than basic hashtag lookups.
                  </span>
                </li>
                <li className="flex items-start gap-2.5 text-xs text-[#17243A]">
                  <div className="text-[#21865B] mt-0.5 shrink-0">
                    <Icon name="Check" size={14} strokeWidth={3} />
                  </div>
                  <span>
                    <strong>Audience Overlap Verification:</strong> Confirm target age cohorts and top countries match your buyer personas.
                  </span>
                </li>
                <li className="flex items-start gap-2.5 text-xs text-[#17243A]">
                  <div className="text-[#21865B] mt-0.5 shrink-0">
                    <Icon name="Check" size={14} strokeWidth={3} />
                  </div>
                  <span>
                    <strong>Centralized Proposal Review:</strong> Compare bids, review creative pitches, and accept proposals with explicit milestones.
                  </span>
                </li>
                <li className="flex items-start gap-2.5 text-xs text-[#17243A]">
                  <div className="text-[#21865B] mt-0.5 shrink-0">
                    <Icon name="Check" size={14} strokeWidth={3} />
                  </div>
                  <span>
                    <strong>Deliverable Link Verification:</strong> Direct proof-of-work link submission keeps execution documented and organized.
                  </span>
                </li>
              </ul>
            </div>

            <div className="p-3 bg-[#F7F5F0] border border-[#E5E7EB] rounded-[8px] text-[11px] text-[#697386]">
              Ideal for Marketing Teams, D2C Brands, Tech Startups, and Creator Agencies.
            </div>
          </Card>

          {/* Influencer Card */}
          <Card id="for-creators" padding="lg" className="border-t-4 border-t-[#17243A] rounded-[16px] flex flex-col justify-between shadow-2xs">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[#17243A]">
                  For Creators &amp; Influencers
                </span>
                <div className="w-9 h-9 rounded-[8px] bg-[#F0EFEA] text-[#17243A] flex items-center justify-center">
                  <Icon name="Video" size={18} />
                </div>
              </div>

              <h3 className="text-xl font-bold font-['Manrope',sans-serif] text-[#17243A] mb-3">
                Transparent Brand Partnerships on Your Terms
              </h3>
              <p className="text-xs text-[#697386] leading-relaxed mb-6">
                Stop relying on cold DMs and opaque intermediary agencies. Browse verified brand briefs
                with allocated budgets, pitch your unique creative angles, and build ongoing partnerships.
              </p>

              <ul className="space-y-3.5 mb-6">
                <li className="flex items-start gap-2.5 text-xs text-[#17243A]">
                  <div className="text-[#21865B] mt-0.5 shrink-0">
                    <Icon name="Check" size={14} strokeWidth={3} />
                  </div>
                  <span>
                    <strong>Transparent Budgets &amp; Deliverables:</strong> See exact brand budgets, expected content formats, and deadlines upfront.
                  </span>
                </li>
                <li className="flex items-start gap-2.5 text-xs text-[#17243A]">
                  <div className="text-[#21865B] mt-0.5 shrink-0">
                    <Icon name="Check" size={14} strokeWidth={3} />
                  </div>
                  <span>
                    <strong>Direct Bidding &amp; Pitching:</strong> Submit your proposal with customized rates and turnaround times directly to decision-makers.
                  </span>
                </li>
                <li className="flex items-start gap-2.5 text-xs text-[#17243A]">
                  <div className="text-[#21865B] mt-0.5 shrink-0">
                    <Icon name="Check" size={14} strokeWidth={3} />
                  </div>
                  <span>
                    <strong>Multi-Platform Profile Showcase:</strong> Connect YouTube, Instagram, TikTok, and Twitch stats in a unified professional portfolio.
                  </span>
                </li>
                <li className="flex items-start gap-2.5 text-xs text-[#17243A]">
                  <div className="text-[#21865B] mt-0.5 shrink-0">
                    <Icon name="Check" size={14} strokeWidth={3} />
                  </div>
                  <span>
                    <strong>Trackable Milestone Delivery:</strong> Submit live post and video proof URLs with status receipts to ensure clear communication.
                  </span>
                </li>
              </ul>
            </div>

            <div className="p-3 bg-[#F7F5F0] border border-[#E5E7EB] rounded-[8px] text-[11px] text-[#697386]">
              Designed for Nano, Micro, Mid-Tier, and Macro digital creators across all content niches.
            </div>
          </Card>
        </div>
      </Container>
    </section>
  );
};
