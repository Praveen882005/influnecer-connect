import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import {
  campaignFormSchema,
  step1CampaignSchema,
  step2CampaignSchema,
  step3CampaignSchema,
  type CampaignFormValues,
  zodResolver,
} from '../../schemas';
import { FormErrorMessage, FormField, FormTextarea } from '../../components/forms';
import { useToast } from '../../components/feedback';
import { apiClient } from '../../api';
import { ApiClientError } from '../../api/types';
import type { Campaign } from '../../types';
import {
  Button,
  Card,
  Icon,
  Input,
  Select,
} from '../../design-system';

const NICHES = [
  { value: 'technology', label: 'Technology & AI' },
  { value: 'beauty', label: 'Beauty & Cosmetics' },
  { value: 'food', label: 'Food & Culinary' },
  { value: 'fitness', label: 'Fitness & Health' },
  { value: 'fashion', label: 'Fashion & Apparel' },
  { value: 'home', label: 'Home & Living' },
  { value: 'parenting', label: 'Parenting & Family' },
  { value: 'wellness', label: 'Wellness & Mindfulness' },
];

const OBJECTIVES = [
  { value: 'Brand Awareness', label: 'Brand Awareness & Reach' },
  { value: 'Product Launch', label: 'New Product Launch' },
  { value: 'Direct Sales', label: 'Direct Sales & Conversions' },
  { value: 'Content Creation', label: 'High-Quality Asset Licensing' },
  { value: 'Community Building', label: 'Community & Thought Leadership' },
];

const CURRENCIES = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'CAD', label: 'CAD ($)' },
];

export const BrandCampaignCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [apiError, setApiError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    watch,
    formState: { errors },
  } = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      title: '',
      objective: 'Brand Awareness',
      niche: 'technology',
      productDescription: '',
      description: '',
      targetLocation: 'United States & Canada',
      currency: 'USD',
      budget: 5000,
      budgetMin: 4000,
      budgetMax: 6000,
      deliverables: '1x Dedicated Video, 2x Social Story Mentions',
      minEngagementRate: 2.5,
      minFollowers: 10000,
      startDate: '',
      endDate: '',
      deadline: '',
      status: 'published',
    },
  });

  const selectedNiche = watch('niche');
  const selectedObjective = watch('objective');
  const selectedCurrency = watch('currency');
  const selectedStatus = watch('status');
  const descriptionValue = watch('description');
  const productDescriptionValue = watch('productDescription') || '';

  const validateStep = (step: number): boolean => {
    if (step === 1) {
      const result = step1CampaignSchema.safeParse({
        title: watch('title'),
        niche: watch('niche'),
        objective: watch('objective'),
        description: watch('description'),
        productDescription: watch('productDescription'),
      });
      clearErrors(['title', 'niche', 'objective', 'description', 'productDescription']);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const field = issue.path[0] as keyof CampaignFormValues;
          setError(field, { message: issue.message });
        }
        return false;
      }
      return true;
    }
    if (step === 2) {
      const result = step2CampaignSchema.safeParse({
        budget: watch('budget'),
        budgetMin: watch('budgetMin'),
        budgetMax: watch('budgetMax'),
        currency: watch('currency'),
        deliverables: watch('deliverables'),
      });
      clearErrors(['budget', 'budgetMin', 'budgetMax', 'currency', 'deliverables']);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const field = issue.path[0] as keyof CampaignFormValues;
          setError(field, { message: issue.message });
        }
        return false;
      }
      return true;
    }
    if (step === 3) {
      const result = step3CampaignSchema.safeParse({
        targetLocation: watch('targetLocation'),
        minEngagementRate: watch('minEngagementRate'),
        minFollowers: watch('minFollowers'),
      });
      clearErrors(['targetLocation', 'minEngagementRate', 'minFollowers']);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const field = issue.path[0] as keyof CampaignFormValues;
          setError(field, { message: issue.message });
        }
        return false;
      }
      return true;
    }
    return true;
  };

  const handleNext = () => {
    const isValid = validateStep(currentStep);
    if (isValid && currentStep < 4) {
      setCurrentStep((prev) => (prev + 1) as 1 | 2 | 3 | 4);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
    }
  };

  const onSubmit = async (values: CampaignFormValues) => {
    setIsSubmitting(true);
    setApiError(null);
    setFieldErrors({});

    try {
      const deliverablesList = values.deliverables
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);

      const toSafeIso = (val?: string | null): string | null => {
        if (!val || !val.trim()) return null;
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d.toISOString();
      };

      const payload = {
        title: values.title,
        description: values.description,
        product_description: values.productDescription || '',
        niche: values.niche,
        objective: values.objective,
        target_location: values.targetLocation,
        budget: Number(values.budget),
        budget_min: values.budgetMin != null ? Number(values.budgetMin) : null,
        budget_max: values.budgetMax != null ? Number(values.budgetMax) : null,
        currency: values.currency,
        deliverables: deliverablesList.length > 0 ? deliverablesList : [values.deliverables],
        min_followers: Number(values.minFollowers || 0),
        min_engagement_rate: Number(values.minEngagementRate || 0),
        required_criteria: {
          min_followers: Number(values.minFollowers || 0),
          min_engagement: Number(values.minEngagementRate || 0),
          target_location: values.targetLocation,
        },
        preferred_criteria: {
          primary_niche: values.niche,
          objective: values.objective,
        },
        status: values.status || 'published',
        start_date: toSafeIso(values.startDate),
        end_date: toSafeIso(values.endDate),
        deadline: toSafeIso(values.deadline),
      };

      const response = await apiClient.post<Campaign>('/campaigns', payload);

      success(
        'Campaign Created Successfully',
        `"${response?.title || values.title}" is now saved as ${response?.status || values.status}.`
      );
      navigate('/brand/campaigns');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setApiError(err.message);
        setFieldErrors(err.fieldErrors);
        toastError('Campaign Submission Failed', err.message);
      } else {
        const msg = err instanceof Error ? err.message : 'Unable to persist campaign brief.';
        setApiError(msg);
        toastError('Submission Error', msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/brand/campaigns')}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-1.5 cursor-pointer"
          >
            <Icon name="ArrowLeft" size="xs" /> Back to Campaigns Board
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Campaign Creation Wizard</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Define deliverables, target creator criteria, budget parameters, and lifecycle schedule.
          </p>
        </div>

        {/* Wizard Steps Indicator */}
        <div className="flex items-center gap-1.5 p-1 bg-[#F0EFEA] rounded-[10px] border border-[#E5E7EB] text-xs">
          {[
            { num: 1, label: 'Brief' },
            { num: 2, label: 'Budget' },
            { num: 3, label: 'Audience' },
            { num: 4, label: 'Publish' },
          ].map((s) => (
            <div
              key={s.num}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] font-semibold transition-all ${
                currentStep === s.num
                  ? 'bg-[#4169E1] text-white shadow-xs'
                  : currentStep > s.num
                  ? 'bg-[#E5E7EB] text-[#17243A]'
                  : 'text-[#697386]'
              }`}
            >
              <span className="font-bold">{s.num}.</span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {apiError && (
        <FormErrorMessage
          title="Submission Notice"
          message={apiError}
          fieldErrors={fieldErrors}
          onDismiss={() => setApiError(null)}
        />
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {/* STEP 1: Campaign Brief & Objective */}
        {currentStep === 1 && (
          <Card orientation="vertical" padding="lg">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="FileText" size="md" className="text-slate-600" />
              <h2 className="text-base font-semibold text-slate-900">Step 1: Campaign Brief &amp; Objective</h2>
            </div>

            <div className="space-y-4">
              <FormField
                label="Campaign Public Name / Title"
                htmlFor="camp-title"
                required
                helperText="Clear, professional headline creators will see in opportunities list (5-120 chars)"
                error={errors.title?.message}
              >
                <Input
                  id="camp-title"
                  placeholder="e.g. Autonomous AI Workspace Assistant Launch"
                  error={errors.title?.message}
                  {...register('title')}
                />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Category Niche"
                  htmlFor="camp-niche"
                  required
                  error={errors.niche?.message}
                >
                  <Select
                    id="camp-niche"
                    value={selectedNiche}
                    onChange={(e) => setValue('niche', e.target.value, { shouldValidate: true })}
                    error={errors.niche?.message}
                    options={NICHES}
                  />
                </FormField>

                <FormField
                  label="Primary Campaign Objective"
                  htmlFor="camp-objective"
                  required
                  error={errors.objective?.message}
                >
                  <Select
                    id="camp-objective"
                    value={selectedObjective}
                    onChange={(e) => setValue('objective', e.target.value, { shouldValidate: true })}
                    error={errors.objective?.message}
                    options={OBJECTIVES}
                  />
                </FormField>
              </div>

              <FormTextarea
                id="camp-product-desc"
                label="Product / Offering Summary"
                rows={2}
                maxLength={500}
                showCount
                value={productDescriptionValue}
                placeholder="Key value propositions, features, or positioning for creators to emphasize..."
                helperText="Equips creators with technical context during content scripting."
                error={errors.productDescription?.message}
                {...register('productDescription')}
              />

              <FormTextarea
                id="camp-description"
                label="Full Campaign Brief & Requirements"
                required
                rows={4}
                maxLength={1000}
                showCount
                value={descriptionValue}
                placeholder="Detail expectations, brand tone guidelines, call to actions, and required talking points..."
                helperText="Must be at least 20 characters explaining the overarching goals."
                error={errors.description?.message}
                {...register('description')}
              />
            </div>
          </Card>
        )}

        {/* STEP 2: Budget & Compensation */}
        {currentStep === 2 && (
          <Card orientation="vertical" padding="lg">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="DollarSign" size="md" className="text-slate-600" />
              <h2 className="text-base font-semibold text-slate-900">Step 2: Budget &amp; Deliverables</h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <FormField
                  label="Currency"
                  htmlFor="camp-currency"
                  required
                  error={errors.currency?.message}
                >
                  <Select
                    id="camp-currency"
                    value={selectedCurrency}
                    onChange={(e) => setValue('currency', e.target.value)}
                    error={errors.currency?.message}
                    options={CURRENCIES}
                  />
                </FormField>

                <FormField
                  label="Baseline / Target Budget"
                  htmlFor="camp-budget"
                  required
                  helperText="Min $100"
                  error={errors.budget?.message}
                >
                  <Input
                    id="camp-budget"
                    type="number"
                    min="100"
                    step="100"
                    placeholder="5000"
                    error={errors.budget?.message}
                    {...register('budget')}
                  />
                </FormField>

                <FormField
                  label="Budget Range Min"
                  htmlFor="camp-budget-min"
                  helperText="Floor per proposal"
                  error={errors.budgetMin?.message}
                >
                  <Input
                    id="camp-budget-min"
                    type="number"
                    min="0"
                    step="100"
                    placeholder="4000"
                    error={errors.budgetMin?.message}
                    {...register('budgetMin')}
                  />
                </FormField>

                <FormField
                  label="Budget Range Max"
                  htmlFor="camp-budget-max"
                  helperText="Ceiling budget"
                  error={errors.budgetMax?.message}
                >
                  <Input
                    id="camp-budget-max"
                    type="number"
                    min="0"
                    step="100"
                    placeholder="7000"
                    error={errors.budgetMax?.message}
                    {...register('budgetMax')}
                  />
                </FormField>
              </div>

              <FormField
                label="Required Deliverables Scope"
                htmlFor="camp-deliverables"
                required
                helperText="Comma-separated deliverable items (e.g. 1x Dedicated Review, 2x Reels, 1x Newsletter feature)"
                error={errors.deliverables?.message}
              >
                <Input
                  id="camp-deliverables"
                  placeholder="e.g. 1x Dedicated YouTube Video (8-10 min), 2x Instagram Reels"
                  error={errors.deliverables?.message}
                  {...register('deliverables')}
                />
              </FormField>
            </div>
          </Card>
        )}

        {/* STEP 3: Audience & Creator Criteria */}
        {currentStep === 3 && (
          <Card orientation="vertical" padding="lg">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="Users" size="md" className="text-slate-600" />
              <h2 className="text-base font-semibold text-slate-900">Step 3: Audience &amp; Creator Thresholds</h2>
            </div>

            <div className="space-y-4">
              <FormField
                label="Target Geographic Location"
                htmlFor="camp-location"
                required
                helperText="Geographic distribution for creator audience match"
                error={errors.targetLocation?.message}
              >
                <Input
                  id="camp-location"
                  placeholder="e.g. North America & Western Europe, Global, or United States"
                  error={errors.targetLocation?.message}
                  {...register('targetLocation')}
                />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Minimum Follower / Subscriber Count"
                  htmlFor="camp-min-followers"
                  helperText="Creators below this tier will be filtered from recommendations"
                  error={errors.minFollowers?.message}
                >
                  <Input
                    id="camp-min-followers"
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="10000"
                    error={errors.minFollowers?.message}
                    {...register('minFollowers')}
                  />
                </FormField>

                <FormField
                  label="Minimum Engagement Threshold (%)"
                  htmlFor="camp-min-engagement"
                  helperText="Enforces authentic audience engagement (0 - 50%)"
                  error={errors.minEngagementRate?.message}
                >
                  <Input
                    id="camp-min-engagement"
                    type="number"
                    min="0"
                    max="50"
                    step="0.1"
                    placeholder="2.5"
                    error={errors.minEngagementRate?.message}
                    {...register('minEngagementRate')}
                  />
                </FormField>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">Criteria Matching Philosophy:</p>
                <p>
                  Required criteria (follower tier, location, engagement rate) act as strict pre-filters.
                  Preferred criteria (content style, topic relevance) inform the AI semantic score.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* STEP 4: Dates & Lifecycle Publishing */}
        {currentStep === 4 && (
          <Card orientation="vertical" padding="lg">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="Calendar" size="md" className="text-slate-600" />
              <h2 className="text-base font-semibold text-slate-900">Step 4: Campaign Dates &amp; Publishing State</h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField
                  label="Application Deadline"
                  htmlFor="camp-deadline"
                  required
                  helperText="Last day for creators to submit proposals"
                  error={errors.deadline?.message}
                >
                  <Input
                    id="camp-deadline"
                    type="date"
                    error={errors.deadline?.message}
                    {...register('deadline')}
                  />
                </FormField>

                <FormField
                  label="Campaign Start Date"
                  htmlFor="camp-start-date"
                  helperText="When deliverables kickoff"
                  error={errors.startDate?.message}
                >
                  <Input
                    id="camp-start-date"
                    type="date"
                    error={errors.startDate?.message}
                    {...register('startDate')}
                  />
                </FormField>

                <FormField
                  label="Campaign End Date"
                  htmlFor="camp-end-date"
                  helperText="Final asset delivery date"
                  error={errors.endDate?.message}
                >
                  <Input
                    id="camp-end-date"
                    type="date"
                    error={errors.endDate?.message}
                    {...register('endDate')}
                  />
                </FormField>
              </div>

              <FormField
                label="Initial Campaign Lifecycle Status"
                htmlFor="camp-status"
                required
                error={errors.status?.message}
              >
                <Select
                  id="camp-status"
                  value={selectedStatus}
                  onChange={(e) => setValue('status', e.target.value as any)}
                  options={[
                    { value: 'published', label: 'Published (Open to inbound pitches & AI discovery)' },
                    { value: 'draft', label: 'Save as Draft (Private workspace only)' },
                  ]}
                />
              </FormField>

              <div className="p-3 bg-sky-50 border border-sky-100 rounded-lg text-xs text-sky-900 space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <Icon name="Info" size="xs" /> Ready to Launch:
                </p>
                <p>
                  Submitting will persist this brief to the database API. You can pause, edit, complete, or archive the campaign at any time.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Wizard Navigation Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <div>
            {currentStep > 1 && (
              <Button variant="secondary" type="button" onClick={handlePrev} leftIcon="ArrowLeft">
                Previous Step
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" type="button" onClick={() => navigate('/brand/campaigns')}>
              Cancel
            </Button>

            {currentStep < 4 ? (
              <Button variant="primary" type="button" onClick={handleNext} rightIcon="ArrowRight">
                Continue
              </Button>
            ) : (
              <Button variant="primary" type="submit" isLoading={isSubmitting} leftIcon="CheckCircle">
                {selectedStatus === 'draft' ? 'Save Draft Campaign' : 'Publish Campaign'}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};
