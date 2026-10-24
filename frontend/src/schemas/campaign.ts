import { z } from 'zod';

export const campaignFormSchema = z
  .object({
    title: z
      .string()
      .min(1, 'Campaign title is required')
      .min(5, 'Title must be at least 5 characters')
      .max(120, 'Title cannot exceed 120 characters'),
    name: z.string().optional(),
    niche: z.string().min(1, 'Category / Niche is required'),
    objective: z.string().default('Brand Awareness'),
    targetLocation: z.string().default('Global'),
    budget: z
      .coerce
      .number()
      .positive('Budget must be greater than $0')
      .min(100, 'Minimum campaign budget is $100'),
    budgetMin: z
      .coerce
      .number()
      .min(0, 'Minimum budget cannot be negative')
      .optional()
      .nullable(),
    budgetMax: z
      .coerce
      .number()
      .min(0, 'Maximum budget cannot be negative')
      .optional()
      .nullable(),
    currency: z.string().default('USD'),
    deliverables: z
      .string()
      .min(1, 'Deliverables scope is required')
      .min(5, 'Describe deliverables with at least 5 characters'),
    description: z
      .string()
      .min(1, 'Campaign description is required')
      .min(20, 'Description must be at least 20 characters explaining the goal')
      .max(1000, 'Description cannot exceed 1000 characters'),
    productDescription: z.string().max(1000).optional().or(z.literal('')),
    minEngagementRate: z
      .coerce
      .number()
      .min(0, 'Engagement rate cannot be negative')
      .max(50, 'Engagement rate cannot exceed 50%')
      .default(0),
    minFollowers: z
      .coerce
      .number()
      .min(0, 'Followers threshold cannot be negative')
      .default(0),
    startDate: z.string().optional().or(z.literal('')),
    endDate: z.string().optional().or(z.literal('')),
    deadline: z.string().min(1, 'Application deadline date is required'),
    status: z.enum(['draft', 'published', 'active', 'paused', 'completed', 'archived']).default('published'),
  })
  .refine(
    (data) => {
      if (data.budgetMin != null && data.budgetMax != null) {
        return data.budgetMin <= data.budgetMax;
      }
      return true;
    },
    {
      message: 'Minimum budget cannot exceed maximum budget',
      path: ['budgetMin'],
    }
  )
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.endDate) >= new Date(data.startDate);
      }
      return true;
    },
    {
      message: 'Campaign end date cannot be earlier than start date',
      path: ['endDate'],
    }
  );

export type CampaignFormValues = z.infer<typeof campaignFormSchema>;

export const step1CampaignSchema = z.object({
  title: z
    .string()
    .min(1, 'Campaign title is required')
    .min(5, 'Title must be at least 5 characters')
    .max(120, 'Title cannot exceed 120 characters'),
  niche: z.string().min(1, 'Category / Niche is required'),
  objective: z.string().default('Brand Awareness'),
  description: z
    .string()
    .min(1, 'Campaign description is required')
    .min(20, 'Description must be at least 20 characters explaining the goal')
    .max(1000, 'Description cannot exceed 1000 characters'),
  productDescription: z.string().max(1000).optional().or(z.literal('')),
});

export const step2CampaignSchema = z
  .object({
    budget: z
      .coerce
      .number()
      .positive('Budget must be greater than $0')
      .min(100, 'Minimum campaign budget is $100'),
    budgetMin: z
      .coerce
      .number()
      .min(0, 'Minimum budget cannot be negative')
      .optional()
      .nullable(),
    budgetMax: z
      .coerce
      .number()
      .min(0, 'Maximum budget cannot be negative')
      .optional()
      .nullable(),
    currency: z.string().default('USD'),
    deliverables: z
      .string()
      .min(1, 'Deliverables scope is required')
      .min(5, 'Describe deliverables with at least 5 characters'),
  })
  .refine(
    (data) => {
      if (data.budgetMin != null && data.budgetMax != null) {
        return data.budgetMin <= data.budgetMax;
      }
      return true;
    },
    {
      message: 'Minimum budget cannot exceed maximum budget',
      path: ['budgetMin'],
    }
  );

export const step3CampaignSchema = z.object({
  targetLocation: z.string().default('Global'),
  minEngagementRate: z
    .coerce
    .number()
    .min(0, 'Engagement rate cannot be negative')
    .max(50, 'Engagement rate cannot exceed 50%')
    .default(0),
  minFollowers: z
    .coerce
    .number()
    .min(0, 'Followers threshold cannot be negative')
    .default(0),
});
