import React, { useState } from 'react';
import { Badge, Card, Container, Icon } from '../../design-system';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    id: 'how-scoring-works',
    question: 'How does the AI brand-creator fit scoring work?',
    answer:
      'Brand Bridge evaluates a multi-signal composite score combining: (1) Semantic content relevance via TF-IDF cosine similarity between campaign descriptions and creator keywords; (2) Quantitative demographic overlap across target age groups and countries; (3) Follower-tier normalized engagement quality; and (4) Interaction consistency heuristics.',
  },
  {
    id: 'tier-normalization',
    question: 'Why are engagement rates normalized by follower tier?',
    answer:
      'Average organic engagement rates naturally decline as follower counts grow. A nano-influencer with 5,000 followers typically averages ~4% engagement, whereas a macro-influencer with 800,000 followers averages ~1.3%. Directly comparing raw percentages disadvantages larger creators. We normalize against industry tier baselines to measure true efficiency.',
  },
  {
    id: 'missing-data',
    question: 'What happens when a creator does not report demographic data?',
    answer:
      'The engine does not fabricate or hallucinate missing data. Instead, it explicitly marks the attribute under "Missing Metrics", applies a transparent neutral baseline with documented weighting penalties, and indicates the score confidence level.',
  },
  {
    id: 'authenticity-heursitics',
    question: 'Are authenticity scores considered definitive proof of fraud?',
    answer:
      'No. Authenticity scores on Brand Bridge are statistical anomaly heuristics measuring whether interaction ratios and engagement spikes deviate from typical organic distributions. They are provided as diagnostic caution indicators for due diligence, not conclusive determinations of fraud.',
  },
  {
    id: 'deliverables-workflow',
    question: 'How do proposal bidding and deliverable tracking work?',
    answer:
      'Brands publish campaign briefs with specific budgets and required deliverables (e.g. YouTube integrations, Reels). Creators submit structured proposals with their proposed rate and turnaround days. Once accepted, creators submit published proof URLs which brands review and approve directly in the platform.',
  },
];

export const FaqSection: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<string | null>('how-scoring-works');

  const toggleFaq = (id: string) => {
    setOpenFaq((prev) => (prev === id ? null : id));
  };

  return (
    <section id="faq" className="py-16 md:py-24 bg-white border-b border-[#E5E7EB] text-left">
      <Container size="md">
        {/* Header */}
        <div className="text-center max-w-xl mx-auto mb-12">
          <Badge variant="brand" size="sm" className="mb-2.5">
            Got Questions?
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-bold font-['Manrope',sans-serif] text-[#17243A] tracking-tight mb-3">
            Frequently Asked Questions
          </h2>
          <p className="text-sm text-[#697386] leading-relaxed">
            Everything you need to know about our scoring methodology, workflow, and platform standards.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-3.5">
          {FAQS.map((faq) => {
            const isOpen = openFaq === faq.id;
            return (
              <Card
                key={faq.id}
                padding="none"
                className="overflow-hidden border border-[#E5E7EB] rounded-[12px] transition-all duration-150"
              >
                <button
                  type="button"
                  className="w-full px-5 py-4 flex items-center justify-between text-left text-xs sm:text-sm font-bold font-['Manrope',sans-serif] text-[#17243A] hover:text-[#4169E1] transition-colors cursor-pointer select-none"
                  onClick={() => toggleFaq(faq.id)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${faq.id}`}
                >
                  <span>{faq.question}</span>
                  <div
                    className={`ml-3 shrink-0 text-[#697386] transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-[#4169E1]' : ''
                    }`}
                  >
                    <Icon name="ChevronDown" size={16} />
                  </div>
                </button>

                {isOpen && (
                  <div
                    id={`faq-answer-${faq.id}`}
                    className="px-5 pb-5 pt-2 text-xs text-[#697386] leading-relaxed border-t border-[#E5E7EB] bg-[#F7F5F0]/50"
                  >
                    {faq.answer}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </Container>
    </section>
  );
};
