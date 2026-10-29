import React, { useState } from 'react';
import { Container, Modal, Button, BrandBridgeLogo } from '../../design-system';

export const LandingFooter: React.FC = () => {
  const [legalModalContent, setLegalModalContent] = useState<{
    title: string;
    description: string;
  } | null>(null);

  const openLegalPlaceholder = (title: string, desc: string) => {
    setLegalModalContent({ title, description: desc });
  };

  return (
    <footer className="bg-[#17243A] text-slate-300 py-12 md:py-16 text-left border-t border-[#21324E]">
      <Container size="lg">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Info */}
          <div className="md:col-span-1">
            <div className="mb-3">
              <BrandBridgeLogo size="sm" theme="light" subtitle="Creator Intelligence" />
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Intelligence-driven creator and brand partnership architecture with auditable matching
              and milestone tracking.
            </p>
            <span className="text-[11px] font-mono text-slate-400">
              Release v0.1.0 · Phase 04 Verified
            </span>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3 font-['Manrope',sans-serif]">
              Platform
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-300">
              <li>
                <a href="#features" className="hover:text-white transition-colors">
                  Semantic Engine
                </a>
              </li>
              <li>
                <a href="#workflow" className="hover:text-white transition-colors">
                  Contract Workflow
                </a>
              </li>
              <li>
                <a href="#for-brands" className="hover:text-white transition-colors">
                  Brand Management
                </a>
              </li>
              <li>
                <a href="#for-creators" className="hover:text-white transition-colors">
                  Creator Opportunities
                </a>
              </li>
            </ul>
          </div>

          {/* Standards & Governance */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3 font-['Manrope',sans-serif]">
              Methodology
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-300">
              <li>
                <a href="#trust" className="hover:text-white transition-colors">
                  Data Transparency
                </a>
              </li>
              <li>
                <a href="#trust" className="hover:text-white transition-colors">
                  Authenticity Heuristics
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition-colors">
                  FAQ &amp; Documentation
                </a>
              </li>
            </ul>
          </div>

          {/* Legal / Unfinished Placeholders */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3 font-['Manrope',sans-serif]">
              Legal &amp; Policy
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-300">
              <li>
                <button
                  type="button"
                  onClick={() =>
                    openLegalPlaceholder(
                      'Privacy Policy [Draft Placeholder]',
                      'This is a local development placeholder. Complete legal policies will be drafted and published prior to production deployment.'
                    )
                  }
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  Privacy Policy <span className="text-[10px] text-amber-400 font-semibold">[Draft]</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() =>
                    openLegalPlaceholder(
                      'Terms of Service [Draft Placeholder]',
                      'This is an unfinished draft placeholder. Service terms, dispute handling, and campaign milestone obligations will be formalized in the production deployment phase.'
                    )
                  }
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  Terms of Service <span className="text-[10px] text-amber-400 font-semibold">[Draft]</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() =>
                    openLegalPlaceholder(
                      'Data Security Guidelines [Draft Placeholder]',
                      'Security documentation covering OAuth2, HMAC-SHA256 token rotation, and SQL injection mitigations is maintained in the internal architecture repository.'
                    )
                  }
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  Security Guidelines <span className="text-[10px] text-amber-400 font-semibold">[Draft]</span>
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Strip */}
        <div className="pt-6 border-t border-[#21324E] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <span>&copy; {new Date().getFullYear()} BRAND BRIDGE. All rights reserved.</span>
          <span className="font-mono text-[11px] text-slate-400">
            No fabricated metrics · No unlicensed brand marks · Transparent data provenance
          </span>
        </div>
      </Container>

      {/* Unfinished Placeholder Notice Modal */}
      {legalModalContent && (
        <Modal
          isOpen={true}
          onClose={() => setLegalModalContent(null)}
          title={legalModalContent.title}
          description="Documentation & Compliance Status"
          footer={
            <Button variant="primary" size="sm" onClick={() => setLegalModalContent(null)}>
              Understood
            </Button>
          }
        >
          <div className="space-y-3 text-xs text-[#17243A] leading-relaxed">
            <p className="p-3 bg-[#FEF7EC] text-[#915F15] border border-[#F5D6A4] rounded-[8px]">
              <strong>Notice:</strong> {legalModalContent.description}
            </p>
            <p className="text-[#697386]">
              In accordance with project transparency guidelines, this destination is explicitly
              marked as an unfinished draft. Full legal instruments and binding agreements will be
              finalized during Production Deployment &amp; Observability.
            </p>
          </div>
        </Modal>
      )}
    </footer>
  );
};
