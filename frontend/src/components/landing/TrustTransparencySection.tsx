import React from 'react';
import { Badge, Card, Container, Icon } from '../../design-system';

export const TrustTransparencySection: React.FC = () => {
  return (
    <section id="trust" className="py-16 md:py-24 bg-[#F7F5F0] border-b border-[#E5E7EB] text-left">
      <Container size="lg">
        {/* Section Header */}
        <div className="max-w-2xl mb-12">
          <Badge variant="brand" size="sm" className="mb-2.5">
            Governance &amp; Methodology
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-bold font-['Manrope',sans-serif] text-[#17243A] tracking-tight mb-3">
            Data Transparency &amp; Algorithmic Ethics
          </h2>
          <p className="text-sm text-[#697386] leading-relaxed">
            We adhere to strict data-provenance and ethical guidelines. We do not invent production
            metrics, make unverified claims, or mask data gaps.
          </p>
        </div>

        {/* 3 Transparency Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card padding="lg" className="flex flex-col justify-between rounded-[14px]">
            <div>
              <div className="w-10 h-10 rounded-[10px] bg-[#FEF7EC] text-[#B7791F] flex items-center justify-center mb-4">
                <Icon name="ShieldAlert" size={20} />
              </div>
              <h3 className="text-sm font-bold font-['Manrope',sans-serif] text-[#17243A] mb-2 leading-snug">
                Authenticity as Heuristic, Not Proof of Fraud
              </h3>
              <p className="text-xs text-[#697386] leading-relaxed">
                Our authenticity score flags statistical anomalies in follower-to-engagement distributions
                and engagement spikes. These are explicitly reported as diagnostic heuristics rather than
                conclusive proof of fraudulent audience manipulation.
              </p>
            </div>
            <div className="pt-4 mt-6 border-t border-[#E5E7EB] text-[11px] font-mono text-[#697386]">
              Diagnostic Heuristic Standard
            </div>
          </Card>

          <Card padding="lg" className="flex flex-col justify-between rounded-[14px]">
            <div>
              <div className="w-10 h-10 rounded-[10px] bg-[#DCE5FA] text-[#4169E1] flex items-center justify-center mb-4">
                <Icon name="FileCheck" size={20} />
              </div>
              <h3 className="text-sm font-bold font-['Manrope',sans-serif] text-[#17243A] mb-2 leading-snug">
                Explicit Handling of Missing Metrics
              </h3>
              <p className="text-xs text-[#697386] leading-relaxed">
                When demographic data, geographic breakdowns, or historical platform metrics are not
                available from a creator, our engine explicitly reports the attribute under "Missing Metrics"
                rather than fabricating default values or skewing the total score.
              </p>
            </div>
            <div className="pt-4 mt-6 border-t border-[#E5E7EB] text-[11px] font-mono text-[#697386]">
              Zero Synthetic Imputation
            </div>
          </Card>

          <Card padding="lg" className="flex flex-col justify-between rounded-[14px]">
            <div>
              <div className="w-10 h-10 rounded-[10px] bg-[#E8F5EE] text-[#21865B] flex items-center justify-center mb-4">
                <Icon name="Database" size={20} />
              </div>
              <h3 className="text-sm font-bold font-['Manrope',sans-serif] text-[#17243A] mb-2 leading-snug">
                Sample Fixtures Clearly Labeled
              </h3>
              <p className="text-xs text-[#697386] leading-relaxed">
                Development fixtures, simulated benchmark creators, and demo campaigns are visibly labeled
                with provenance metadata. We do not claim third-party platform partnerships or unverified
                customer testimonials.
              </p>
            </div>
            <div className="pt-4 mt-6 border-t border-[#E5E7EB] text-[11px] font-mono text-[#697386]">
              Transparent Provenance Labeling
            </div>
          </Card>
        </div>
      </Container>
    </section>
  );
};
