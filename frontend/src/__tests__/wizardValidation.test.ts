import { describe, it, expect } from 'vitest';
import {
  step1CampaignSchema,
  step2CampaignSchema,
  step3CampaignSchema,
  campaignFormSchema,
} from '../schemas/campaign';

describe('Campaign Creation Wizard Validation', () => {
  describe('Step 1: Brief & Objectives', () => {
    it('accepts valid input matching user screenshot', () => {
      const input = {
        title: 'Praveen',
        niche: 'technology',
        objective: 'Brand Awareness',
        productDescription: '',
        description:
          'Campaign for our 100% recycled organic cotton collection. Creators will highlight style versatility, ethical craftsmanship, and long-lasting wardrobe essentials.',
      };
      const result = step1CampaignSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects title shorter than 5 characters', () => {
      const input = {
        title: 'Prav', // 4 chars
        niche: 'technology',
        objective: 'Brand Awareness',
        description: 'This is a sufficiently long campaign description for testing purposes.',
      };
      const result = step1CampaignSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Title must be at least 5 characters');
      }
    });

    it('rejects description shorter than 20 characters', () => {
      const input = {
        title: 'Praveen Campaign',
        niche: 'technology',
        objective: 'Brand Awareness',
        description: 'Too short',
      };
      const result = step1CampaignSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('at least 20 characters');
      }
    });
  });

  describe('Step 2: Budget & Deliverables', () => {
    it('accepts valid budget and deliverables', () => {
      const input = {
        budget: 5000,
        budgetMin: 4000,
        budgetMax: 6000,
        currency: 'USD',
        deliverables: '1x Dedicated Video, 2x Social Story Mentions',
      };
      const result = step2CampaignSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects budget below $100', () => {
      const input = {
        budget: 50,
        currency: 'USD',
        deliverables: '1x Dedicated Video',
      };
      const result = step2CampaignSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects budgetMin greater than budgetMax', () => {
      const input = {
        budget: 5000,
        budgetMin: 8000,
        budgetMax: 6000,
        currency: 'USD',
        deliverables: '1x Dedicated Video',
      };
      const result = step2CampaignSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Minimum budget cannot exceed maximum budget');
      }
    });
  });

  describe('Step 3: Audience & Verification Criteria', () => {
    it('accepts valid location and metric thresholds', () => {
      const input = {
        targetLocation: 'United States & Canada',
        minEngagementRate: 2.5,
        minFollowers: 10000,
      };
      const result = step3CampaignSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects negative engagement rate', () => {
      const input = {
        targetLocation: 'Global',
        minEngagementRate: -1,
        minFollowers: 0,
      };
      const result = step3CampaignSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('Step 4 & Full Schema: Lifecycle & Dates', () => {
    it('accepts complete campaign submission payload', () => {
      const fullPayload = {
        title: 'Praveen Brand Launch',
        niche: 'technology',
        objective: 'Brand Awareness',
        description: 'Campaign for our 100% recycled organic cotton collection. Creators will highlight style versatility.',
        targetLocation: 'United States & Canada',
        budget: 5000,
        budgetMin: 4000,
        budgetMax: 6000,
        currency: 'USD',
        deliverables: '1x Dedicated Video, 2x Social Story Mentions',
        minEngagementRate: 2.5,
        minFollowers: 10000,
        startDate: '2026-11-01',
        endDate: '2026-12-01',
        deadline: '2026-10-31',
        status: 'published',
      };
      const result = campaignFormSchema.safeParse(fullPayload);
      expect(result.success).toBe(true);
    });
  });
});
