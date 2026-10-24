import React from 'react';
import { Badge, Card, Container, Icon } from '../../design-system';

export const TrustTransparencySection: React.FC = () => {
  return (
    <section id="trust" className="py-16 md:py-24 bg-slate-50 border-b border-slate-200 text-left">
      <Container size="lg">
        {/* Section Header */}
        <div className="max-w-2xl mb-12">
          <Badge variant="brand" size="sm" className="mb-2">
            Governance &amp; Methodology
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight mb-3">
            Data Transparency &amp; Algorithmic Ethics
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            We adhere to strict data-provenance and ethical guidelines. We do not invent production
            metrics, make unverified claims, or mask data gaps.
          </p>
        </div>

        {/* 3 Transparency Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card padding="lg" className="flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-[6px] bg-amber-50 text-amber-700 flex items-center justify-center mb-4">
                <Icon name="ShieldAlert" size={18} />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">
                Authenticity as Heuristic, Not Proof of Fraud
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Our authenticity score flags statistical anomalies in follower-to-engagement distributions
                and engagement spikes. These are explicitly reported as diagnostic heuristics rather than
                conclusive proof of fraudulent audience manipulation.
              </p>
            </div>
            <div className="pt-4 mt-6 border-t border-slate-100 text-[11px] font-mono text-slate-500">
              Diagnostic Heuristic Standard
            </div>
          </Card>

          <Card padding="lg" className="flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-[6px] bg-sky-50 text-sky-700 flex items-center justify-center mb-4">
                <Icon name="FileCheck" size={18} />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">
                Explicit Handling of Missing Metrics
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                When demographic data, geographic breakdowns, or historical platform metrics are not
                available from a creator, our engine explicitly reports the attribute under "Missing Metrics"
                rather than fabricating default values or skewing the total score.
              </p>
            </div>
            <div className="pt-4 mt-6 border-t border-slate-100 text-[11px] font-mono text-slate-500">
              Zero Synthetic Imputation
            </div>
          </Card>

          <Card padding="lg" className="flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-[6px] bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
                <Icon name="Database" size={18} />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">
                Sample Fixtures Clearly Labeled
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Development fixtures, simulated benchmark creators, and demo campaigns are visibly labeled
                with provenance metadata. We do not claim third-party platform partnerships or unverified
                customer testimonials.
              </p>
            </div>
            <div className="pt-4 mt-6 border-t border-slate-100 text-[11px] font-mono text-slate-500">
              Transparent Provenance Labeling
            </div>
          </Card>
        </div>
      </Container>
    </section>
  );
};
