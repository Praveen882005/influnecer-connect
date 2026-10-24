import { z } from 'zod';

export const brandProfileSchema = z.object({
  companyName: z
    .string()
    .min(1, 'Company legal name is required')
    .min(2, 'Company name must be at least 2 characters'),
  website: z
    .string()
    .min(1, 'Official website is required')
    .url('Website must be a valid URL starting with http:// or https://'),
  logoUrl: z
    .string()
    .url('Logo must be a valid URL starting with http:// or https://')
    .or(z.literal(''))
    .optional(),
  industry: z
    .string()
    .min(1, 'Please select an industry sector'),
  targetRegion: z
    .string()
    .min(1, 'Target region is required'),
  description: z
    .string()
    .min(1, 'Mission summary is required')
    .min(15, 'Mission summary must be at least 15 characters')
    .max(500, 'Mission summary cannot exceed 500 characters'),
  minEngagement: z
    .coerce
    .number()
    .min(0, 'Cannot be negative')
    .max(50, 'Engagement threshold cannot exceed 50%'),
  minAuthenticity: z
    .coerce
    .number()
    .min(50, 'Minimum authenticity score cannot be below 50')
    .max(100, 'Authenticity score cannot exceed 100'),
});

export type BrandProfileFormValues = z.infer<typeof brandProfileSchema>;
