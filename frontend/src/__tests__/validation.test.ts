import { describe, it, expect } from 'vitest';
import { signInSchema, signUpSchema } from '../schemas/auth';
import { campaignFormSchema } from '../schemas/campaign';
import { influencerProfileSchema } from '../schemas/influencerProfile';
import { brandProfileSchema } from '../schemas/brandProfile';

describe('Zod Validation Schemas', () => {
  describe('signInSchema', () => {
    it('should validate valid email and password', () => {
      const valid = {
        email: 'test@example.com',
        password: 'ValidPassword123',
        rememberMe: true,
      };
      const result = signInSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email format', () => {
      const invalid = {
        email: 'not-an-email',
        password: 'ValidPassword123',
      };
      const result = signInSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('valid email');
      }
    });

    it('should reject passwords shorter than 8 characters', () => {
      const invalid = {
        email: 'test@example.com',
        password: 'short',
      };
      const result = signInSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('at least 8 characters');
      }
    });
  });

  describe('signUpSchema', () => {
    it('should validate complete sign-up payload', () => {
      const valid = {
        name: 'Acme Brand Co',
        email: 'partner@acme.com',
        password: 'SecurePassword1',
        role: 'brand' as const,
        agreeToTerms: true as const,
      };
      const result = signUpSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject password without uppercase or numbers', () => {
      const invalid = {
        name: 'Alex Creator',
        email: 'alex@creator.com',
        password: 'lowercaseonly',
        role: 'creator' as const,
        agreeToTerms: true as const,
      };
      const result = signUpSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject if terms are not agreed to', () => {
      const invalid = {
        name: 'Alex Creator',
        email: 'alex@creator.com',
        password: 'SecurePassword1',
        role: 'creator' as const,
        agreeToTerms: false,
      };
      const result = signUpSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('campaignFormSchema', () => {
    it('should validate valid campaign brief', () => {
      const valid = {
        title: 'Developer Productivity Tool Launch',
        niche: 'Tech & AI',
        budget: 5000,
        deliverables: '1x YouTube Dedicated, 2x Reels',
        description: 'Comprehensive walkthrough of our next-gen developer workspace assistant.',
        deadline: '2026-11-30',
      };
      const result = campaignFormSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject budget less than $100', () => {
      const invalid = {
        title: 'Valid Campaign Title',
        niche: 'Tech & AI',
        budget: 50,
        deliverables: '1x YouTube Video',
        description: 'Comprehensive walkthrough of our next-gen developer workspace assistant.',
        deadline: '2026-11-30',
      };
      const result = campaignFormSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject short descriptions under 20 characters', () => {
      const invalid = {
        title: 'Valid Campaign Title',
        niche: 'Tech & AI',
        budget: 2000,
        deliverables: '1x YouTube Video',
        description: 'Too short',
        deadline: '2026-11-30',
      };
      const result = campaignFormSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('influencerProfileSchema', () => {
    it('should validate handle starting with @', () => {
      const valid = {
        displayName: 'Marcus Chen',
        handle: '@tech_marcus',
        primaryNiche: 'Tech & AI',
        bio: 'In-depth developer workflow reviews and creator software breakdowns.',
        location: 'San Francisco, CA',
        rateYoutubeDedicated: '$3,500',
        rateYoutubeIntegration: '$1,800',
        rateInstagramReel: '$1,200',
      };
      const result = influencerProfileSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject handle missing @ prefix', () => {
      const invalid = {
        displayName: 'Marcus Chen',
        handle: 'tech_marcus_without_at',
        primaryNiche: 'Tech & AI',
        bio: 'In-depth developer workflow reviews and creator software breakdowns.',
        location: 'San Francisco, CA',
        rateYoutubeDedicated: '$3,500',
        rateYoutubeIntegration: '$1,800',
        rateInstagramReel: '$1,200',
      };
      const result = influencerProfileSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('must start with @');
      }
    });
  });

  describe('brandProfileSchema', () => {
    it('should validate authentic brand profile values', () => {
      const valid = {
        companyName: 'Acme Innovations Inc',
        website: 'https://acme.io',
        industry: 'tech',
        targetRegion: 'us_eu',
        description: 'Next-generation AI workflows built for autonomous engineering teams.',
        minEngagement: 3.5,
        minAuthenticity: 92.0,
      };
      const result = brandProfileSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject invalid website URL', () => {
      const invalid = {
        companyName: 'Acme Innovations Inc',
        website: 'not-a-valid-url',
        industry: 'tech',
        targetRegion: 'us_eu',
        description: 'Next-generation AI workflows built for autonomous engineering teams.',
        minEngagement: 3.5,
        minAuthenticity: 92.0,
      };
      const result = brandProfileSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});
