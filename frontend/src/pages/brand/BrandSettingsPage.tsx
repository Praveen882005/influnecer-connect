import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { brandProfileSchema, type BrandProfileFormValues, zodResolver } from '../../schemas';
import { FormErrorMessage, FormField, FormTextarea } from '../../components/forms';
import { useToast } from '../../components/feedback';
import { apiClient } from '../../api';
import { ApiClientError } from '../../api/types';
import type { BrandProfile } from '../../types';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Icon,
  Input,
  Select,
  Skeleton,
} from '../../design-system';

export const BrandSettingsPage: React.FC = () => {
  const { success, error: toastError } = useToast();
  const [profile, setProfile] = useState<BrandProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Notification toggles
  const [notifyProposals, setNotifyProposals] = useState(true);
  const [notifyMilestones, setNotifyMilestones] = useState(true);
  const [notifyWeeklyDigest, setNotifyWeeklyDigest] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<BrandProfileFormValues>({
    resolver: zodResolver(brandProfileSchema),
    defaultValues: {
      companyName: '',
      website: '',
      logoUrl: '',
      industry: 'tech',
      targetRegion: 'us_eu',
      description: '',
      minEngagement: 3.0,
      minAuthenticity: 90.0,
    },
  });

  const selectedIndustry = watch('industry');
  const selectedRegion = watch('targetRegion');
  const descriptionValue = watch('description');
  const currentLogoUrl = watch('logoUrl');

  const fetchProfile = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await apiClient.get<BrandProfile>('/brands/profile');
      setProfile(data);
      reset({
        companyName: data.company_name || '',
        website: data.website || '',
        logoUrl: data.logo_url || '',
        industry: data.industry || 'tech',
        targetRegion: data.location || 'us_eu',
        description: data.description || '',
        minEngagement: Number(data.target_demographics?.min_engagement ?? 3.0),
        minAuthenticity: Number(data.target_demographics?.min_authenticity ?? 90.0),
      });
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 404) {
          // No profile found yet, initialize with defaults
          setProfile(null);
        } else if (err.isUnavailable) {
          // Backend offline or fallback
          setLoadError('Backend service is currently unavailable. Operating in local preview mode.');
          // Provide fallback defaults so user can continue testing UI
          reset({
            companyName: 'Acme Tech Innovations',
            website: 'https://acmetech.io',
            logoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe',
            industry: 'tech',
            targetRegion: 'us_eu',
            description: 'Developer-focused productivity tooling and next-gen AI workspaces built for software engineering teams.',
            minEngagement: 3.0,
            minAuthenticity: 90.0,
          });
        } else {
          setLoadError(err.message);
        }
      } else {
        setLoadError(err instanceof Error ? err.message : 'Failed to load brand profile.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const onSubmit = async (values: BrandProfileFormValues) => {
    setIsSubmitting(true);
    setApiError(null);
    setFieldErrors({});

    try {
      const updated = profile
        ? await apiClient.put<BrandProfile>('/brands/profile', values)
        : await apiClient.post<BrandProfile>('/brands/profile', {
            company_name: values.companyName,
            industry: values.industry,
            website: values.website,
            description: values.description,
            logo_url: values.logoUrl,
            location: values.targetRegion,
          });
      setProfile(updated);
      setIsCreating(false);
      reset({
        companyName: updated.company_name,
        website: updated.website || '',
        logoUrl: updated.logo_url || '',
        industry: updated.industry || 'tech',
        targetRegion: updated.location || 'us_eu',
        description: updated.description || '',
        minEngagement: Number(updated.target_demographics?.min_engagement ?? 3.0),
        minAuthenticity: Number(updated.target_demographics?.min_authenticity ?? 90.0),
      });
      success('Brand Settings Saved', 'Your company profile, logo, and AI matching parameters have been updated.');
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.isUnavailable) {
          setApiError(`Backend synchronization unavailable (${err.message}). Client changes saved locally.`);
          toastError('Sync Unavailable', 'Backend endpoint offline. Settings preserved in local session.');
        } else {
          setApiError(err.message);
          setFieldErrors(err.fieldErrors);
          toastError('Update Failed', err.message);
        }
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to update brand profile.';
        setApiError(msg);
        toastError('Error', msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl text-left" role="status" aria-label="Loading profile">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Card orientation="vertical" padding="lg">
          <div className="space-y-4">
            <Skeleton className="h-6 w-48" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-24 w-full" />
          </div>
        </Card>
      </div>
    );
  }

  if (!profile && !loadError && !isCreating) {
    return (
      <div className="space-y-6 max-w-4xl text-left">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Brand Workspace Settings</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure organization profile, verified branding, and team ownership.
          </p>
        </div>
        <Card orientation="vertical" padding="lg">
          <EmptyState
            title="No Brand Profile Found"
            description="Your user account is registered, but no company profile is configured yet. Set up your brand profile to start creating campaigns and matching with creators."
            icon="Building"
            action={
              <Button variant="primary" onClick={() => setIsCreating(true)}>
                Initialize Brand Profile
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const completenessScore = profile?.completeness_score ?? (profile?.company_name ? 75 : 0);
  const missingFields = profile?.completeness?.missing_fields ?? [];

  return (
    <div className="space-y-6 max-w-4xl text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Brand Workspace Settings</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure organization profile, verified branding, semantic matching parameters, and team ownership.
          </p>
        </div>

        {/* Profile Completeness Pill */}
        <div className="flex items-center gap-2 p-2 px-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="text-xs">
            <span className="font-semibold text-slate-700">Profile Health: </span>
            <span className="font-bold text-sky-700">{completenessScore}%</span>
          </div>
          <div className="w-20 bg-slate-200 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                completenessScore >= 80 ? 'bg-emerald-600' : completenessScore >= 50 ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${completenessScore}%` }}
            />
          </div>
        </div>
      </div>

      {loadError && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Icon name="AlertTriangle" size="sm" className="text-amber-600 flex-shrink-0" />
            <span>{loadError}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={fetchProfile}>
            Retry
          </Button>
        </div>
      )}

      {apiError && (
        <FormErrorMessage
          title="Backend Persistence Notice"
          message={apiError}
          fieldErrors={fieldErrors}
          onDismiss={() => setApiError(null)}
        />
      )}

      {/* Completeness Checklist banner if missing items */}
      {missingFields.length > 0 && (
        <div className="p-3 bg-sky-50 border border-sky-100 rounded-lg text-xs text-sky-900 flex flex-wrap items-center gap-2">
          <span className="font-semibold flex items-center gap-1">
            <Icon name="Info" size="xs" /> Suggestions to reach 100% completeness:
          </span>
          {missingFields.map((field) => (
            <Badge key={field} variant="neutral" size="sm">
              + Add {field.replace('_', ' ')}
            </Badge>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {/* Ownership & Account Meta Card */}
        <Card orientation="vertical" padding="md" className="bg-slate-50/50 border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Icon name="ShieldCheck" size="sm" className="text-sky-700" />
              <span className="font-semibold text-slate-800">Workspace Ownership:</span>
              <span>{profile?.owner_name || 'Brand Lead'} ({profile?.owner_email || 'Verified Owner'})</span>
            </div>
            {profile?.id && (
              <div className="font-mono text-slate-400">
                Organization ID: #{profile.id}
              </div>
            )}
          </div>
        </Card>

        {/* Company Profile Card */}
        <Card orientation="vertical" padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="Building" size="md" className="text-slate-600" />
            <h2 className="text-base font-semibold text-slate-900">Company Information</h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Organization Legal Name"
                htmlFor="brand-company-name"
                required
                error={errors.companyName?.message}
              >
                <Input
                  id="brand-company-name"
                  placeholder="e.g. Acme Innovations Inc."
                  error={errors.companyName?.message}
                  {...register('companyName')}
                />
              </FormField>

              <FormField
                label="Official Website"
                htmlFor="brand-website"
                required
                helperText="Must start with http:// or https://"
                error={errors.website?.message}
              >
                <Input
                  id="brand-website"
                  placeholder="https://acme.io"
                  error={errors.website?.message}
                  {...register('website')}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Logo Image URL"
                htmlFor="brand-logo-url"
                helperText="Provide a public HTTPS link to company emblem or badge"
                error={errors.logoUrl?.message}
              >
                <div className="flex items-center gap-3">
                  {currentLogoUrl ? (
                    <img
                      src={currentLogoUrl}
                      alt="Brand Logo Preview"
                      className="w-10 h-10 rounded border border-slate-200 object-cover bg-white"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded border border-dashed border-slate-300 flex items-center justify-center text-slate-400 bg-slate-50">
                      <Icon name="Image" size="xs" />
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      id="brand-logo-url"
                      placeholder="https://example.com/logo.png"
                      error={errors.logoUrl?.message}
                      {...register('logoUrl')}
                    />
                  </div>
                </div>
              </FormField>

              <FormField
                label="Primary Industry Sector"
                htmlFor="brand-industry"
                required
                error={errors.industry?.message}
              >
                <Select
                  id="brand-industry"
                  value={selectedIndustry}
                  onChange={(e) => setValue('industry', e.target.value, { shouldValidate: true })}
                  error={errors.industry?.message}
                  options={[
                    { value: 'tech', label: 'B2B Software & AI' },
                    { value: 'consumer_tech', label: 'Consumer Hardware & Gadgets' },
                    { value: 'wellness', label: 'Health, Wellness & Fitness' },
                    { value: 'fashion', label: 'Sustainable Apparel & Goods' },
                    { value: 'food', label: 'Culinary, Food & Beverage' },
                    { value: 'home', label: 'Home & Living' },
                    { value: 'fintech', label: 'FinTech & Finance' },
                  ]}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Target Geographic Focus / Location"
                htmlFor="brand-region"
                required
                error={errors.targetRegion?.message}
              >
                <Select
                  id="brand-region"
                  value={selectedRegion}
                  onChange={(e) => setValue('targetRegion', e.target.value, { shouldValidate: true })}
                  error={errors.targetRegion?.message}
                  options={[
                    { value: 'us_eu', label: 'North America & Western Europe' },
                    { value: 'global', label: 'Global Distribution' },
                    { value: 'apac', label: 'Asia-Pacific' },
                    { value: 'latam', label: 'Latin America' },
                  ]}
                />
              </FormField>
            </div>

            <FormTextarea
              id="brand-description"
              label="Brand Mission & Tone Summary"
              required
              rows={3}
              maxLength={500}
              showCount
              value={descriptionValue}
              helperText="Used by the semantic recommendation engine to vectorize brand identity."
              error={errors.description?.message}
              {...register('description')}
            />
          </div>
        </Card>

        {/* AI Discovery Matching Preferences */}
        <Card orientation="vertical" padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="Sliders" size="md" className="text-slate-600" />
            <h2 className="text-base font-semibold text-slate-900">AI Matching Filter Defaults</h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Minimum Creator Engagement (%)"
                htmlFor="brand-min-engagement"
                helperText="Creators with lower engagement will be deprioritized in results."
                error={errors.minEngagement?.message}
              >
                <Input
                  id="brand-min-engagement"
                  type="number"
                  step="0.1"
                  error={errors.minEngagement?.message}
                  {...register('minEngagement')}
                />
              </FormField>

              <FormField
                label="Minimum Authenticity Score (%)"
                htmlFor="brand-min-authenticity"
                helperText="Discards creators flagged with suspicious follower activity."
                error={errors.minAuthenticity?.message}
              >
                <Input
                  id="brand-min-authenticity"
                  type="number"
                  step="0.5"
                  error={errors.minAuthenticity?.message}
                  {...register('minAuthenticity')}
                />
              </FormField>
            </div>
          </div>
        </Card>

        {/* Notification Preferences */}
        <Card orientation="vertical" padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="Bell" size="md" className="text-slate-600" />
            <h2 className="text-base font-semibold text-slate-900">Notification Preferences</h2>
          </div>

          <div className="space-y-3">
            <Checkbox
              checked={notifyProposals}
              onChange={(e) => setNotifyProposals(e.target.checked)}
              label="Instant proposal alerts"
              description="Receive email when a verified creator submits a bid to an open campaign."
            />
            <Checkbox
              checked={notifyMilestones}
              onChange={(e) => setNotifyMilestones(e.target.checked)}
              label="Deliverable submission alerts"
              description="Notify team when proof URLs and draft assets are uploaded for review."
            />
            <Checkbox
              checked={notifyWeeklyDigest}
              onChange={(e) => setNotifyWeeklyDigest(e.target.checked)}
              label="Weekly ROI summary digest"
              description="A curated overview of active deliverables and aggregate impressions."
            />
          </div>
        </Card>

        <div className="flex justify-end gap-3 pt-2">
          <Button
            variant="primary"
            type="submit"
            isLoading={isSubmitting}
            disabled={!isDirty && isSubmitting}
            leftIcon="Save"
          >
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
};
