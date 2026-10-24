import { z } from 'zod';

export const influencerProfileSchema = z.object({
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .min(2, 'Name must be at least 2 characters'),
  handle: z
    .string()
    .min(1, 'Handle is required')
    .regex(/^@[a-zA-Z0-9_]{2,30}$/, 'Handle must start with @ and be 2-30 characters (letters, numbers, underscores)'),
  profileImageUrl: z
    .string()
    .url('Profile image must be a valid URL starting with http:// or https://')
    .or(z.literal(''))
    .optional(),
  primaryNiche: z
    .string()
    .min(1, 'Primary category is required'),
  bio: z
    .string()
    .min(1, 'Bio is required')
    .min(15, 'Bio must be at least 15 characters long')
    .max(400, 'Bio cannot exceed 400 characters'),
  location: z
    .string()
    .min(1, 'Location / Timezone is required'),
  language: z
    .string()
    .optional(),
  rateYoutubeDedicated: z
    .string()
    .min(1, 'Rate is required'),
  rateYoutubeIntegration: z
    .string()
    .min(1, 'Rate is required'),
  rateInstagramReel: z
    .string()
    .min(1, 'Rate is required'),
});

export type InfluencerProfileFormValues = z.infer<typeof influencerProfileSchema>;
