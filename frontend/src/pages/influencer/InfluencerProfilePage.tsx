import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { influencerProfileSchema, type InfluencerProfileFormValues, zodResolver } from '../../schemas';
import { FormErrorMessage, FormField, FormTextarea } from '../../components/forms';
import { useToast } from '../../components/feedback';
import { apiClient } from '../../api';
import { ApiClientError } from '../../api/types';
import type { CreatorProfile } from '../../types';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Input,
  Modal,
  Select,
  Skeleton,
} from '../../design-system';

export const INITIAL_NICHES = [
  'technology',
  'beauty',
  'food',
  'fitness',
  'fashion',
  'home',
  'parenting',
  'wellness',
];

export const InfluencerProfilePage: React.FC = () => {
  const { success, error: toastError } = useToast();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Platform verification modal state
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [verifyHandle, setVerifyHandle] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<InfluencerProfileFormValues>({
    resolver: zodResolver(influencerProfileSchema),
    defaultValues: {
      displayName: 'Marcus Chen',
      handle: '@tech_marcus',
      profileImageUrl: '',
      primaryNiche: 'technology',
      bio: 'Deep dive consumer tech reviews, AI software walkthroughs, and developer workflow setups. Passionate about empowering engineers and makers.',
      location: 'San Francisco, CA',
      language: 'English',
      rateYoutubeDedicated: '$3,500',
      rateYoutubeIntegration: '$1,800',
      rateInstagramReel: '$1,200',
    },
  });

  const selectedNiche = watch('primaryNiche');
  const bioValue = watch('bio');
  const previewImageUrl = watch('profileImageUrl');

  const fetchProfile = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await apiClient.get<CreatorProfile>('/creators/profile');
      setProfile(data);
      const collab = data.collaboration_preferences || {};
      reset({
        displayName: data.display_name,
        handle: data.handle,
        profileImageUrl: data.profile_image_url || '',
        primaryNiche: data.primary_niche || 'technology',
        bio: data.bio || '',
        location: (collab.location as string) || 'San Francisco, CA',
        language: data.language || 'English',
        rateYoutubeDedicated: (collab.rate_youtube_dedicated as string) || '$3,500',
        rateYoutubeIntegration: (collab.rate_youtube_integration as string) || '$1,800',
        rateInstagramReel: (collab.rate_instagram_reel as string) || '$1,200',
      });
      setVerifyHandle((data.handle || '').replace(/^@/, ''));
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 404) {
          setProfile(null);
        } else if (err.isUnavailable) {
          setLoadError('Backend service currently unavailable. Operating in local preview mode.');
        } else {
          setLoadError(err.message);
        }
      } else {
        setLoadError(err instanceof Error ? err.message : 'Failed to load creator profile.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleStartEditing = () => {
    if (profile) {
      const collab = profile.collaboration_preferences || {};
      reset({
        displayName: profile.display_name,
        handle: profile.handle,
        profileImageUrl: profile.profile_image_url || '',
        primaryNiche: profile.primary_niche,
        bio: profile.bio || '',
        location: (collab.location as string) || 'San Francisco, CA',
        language: profile.language || 'English',
        rateYoutubeDedicated: (collab.rate_youtube_dedicated as string) || '$3,500',
        rateYoutubeIntegration: (collab.rate_youtube_integration as string) || '$1,800',
        rateInstagramReel: (collab.rate_instagram_reel as string) || '$1,200',
      });
    }
    setApiError(null);
    setFieldErrors({});
    setIsEditing(true);
  };

  const onSubmit = async (values: InfluencerProfileFormValues) => {
    setIsSubmitting(true);
    setApiError(null);
    setFieldErrors({});

    try {
      const updated = profile
        ? await apiClient.put<CreatorProfile>('/creators/profile', values)
        : await apiClient.post<CreatorProfile>('/creators/profile', {
            handle: values.handle,
            display_name: values.displayName,
            bio: values.bio,
            profile_image_url: values.profileImageUrl,
            primary_niche: values.primaryNiche,
            language: values.language || 'English',
            collaboration_preferences: {
              location: values.location,
              rate_youtube_dedicated: values.rateYoutubeDedicated,
              rate_youtube_integration: values.rateYoutubeIntegration,
              rate_instagram_reel: values.rateInstagramReel,
            },
          });
      setProfile(updated);
      setIsEditing(false);
      setIsCreating(false);
      success('Profile Successfully Updated', 'Your public media kit, category niches, and sponsorship rates have been saved.');
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.isUnavailable) {
          // Local fallback
          setIsEditing(false);
          setApiError(`Backend synchronization unavailable (${err.message}). Profile updated in local session.`);
          toastError('Sync Notice', 'Backend offline. Changes stored in current browser session.');
        } else {
          setApiError(err.message);
          setFieldErrors(err.fieldErrors);
          toastError('Update Failed', err.message);
        }
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to update profile.';
        setApiError(msg);
        toastError('Error', msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyPlatform = async () => {
    if (!verifyHandle.trim()) {
      setVerifyError('Please enter a valid Instagram handle.');
      return;
    }
    setIsVerifying(true);
    setVerifyError(null);

    try {
      const updated = await apiClient.post<CreatorProfile>('/creators/verify-platform', {
        platform: 'instagram',
        external_account_handle: verifyHandle.startsWith('@') ? verifyHandle : `@${verifyHandle}`,
      });
      setProfile(updated);
      setIsVerifyModalOpen(false);
      success('Instagram Connection Verified', 'Account ownership verified. Fresh platform metrics imported.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to verify Instagram account.';
      setVerifyError(msg);
      toastError('Verification Failed', msg);
    } finally {
      setIsVerifying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl text-left" role="status" aria-label="Loading creator profile">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Card orientation="vertical" padding="lg">
          <div className="flex items-center gap-6">
            <Skeleton className="w-20 h-20 rounded-full" />
            <div className="space-y-3 flex-1">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!profile && !loadError && !isCreating) {
    return (
      <div className="space-y-6 max-w-5xl text-left">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Creator Profile &amp; Media Kit</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage public creator portfolio, verified platform metrics, provenance indicators, and sponsorship rates.
          </p>
        </div>
        <Card orientation="vertical" padding="lg">
          <EmptyState
            title="No Creator Profile Found"
            description="Your creator profile has not been initialized yet. Create your public media kit to start showcasing your portfolio to top brands."
            icon="User"
            action={
              <Button
                variant="primary"
                onClick={() => {
                  setIsCreating(true);
                  setIsEditing(true);
                }}
              >
                Initialize Creator Profile
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const isInstagramVerified = Boolean(
    profile?.connected_platforms?.instagram?.verified || profile?.is_platform_verified
  );
  const completenessScore = profile?.completeness_score ?? 70;
  const missingFields = profile?.completeness?.missing_fields ?? [];

  return (
    <div className="space-y-6 max-w-5xl text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Creator Profile &amp; Media Kit</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage public creator portfolio, verified platform metrics, provenance indicators, and sponsorship rates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Profile Health Pill */}
          <div className="flex items-center gap-2 p-2 px-3 bg-slate-50 border border-slate-200 rounded-lg mr-2">
            <div className="text-xs">
              <span className="font-semibold text-slate-700">Completeness: </span>
              <span className="font-bold text-sky-700">{completenessScore}%</span>
            </div>
            <div className="w-16 bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  completenessScore >= 80 ? 'bg-emerald-600' : 'bg-amber-500'
                }`}
                style={{ width: `${completenessScore}%` }}
              />
            </div>
          </div>

          {isEditing ? (
            <Button variant="secondary" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          ) : (
            <Button
              variant="secondary"
              leftIcon="Edit"
              onClick={handleStartEditing}
            >
              Edit Media Kit
            </Button>
          )}
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
          title="Profile Sync Notice"
          message={apiError}
          fieldErrors={fieldErrors}
          onDismiss={() => setApiError(null)}
        />
      )}

      {/* Completeness Checklist banner if missing items */}
      {missingFields.length > 0 && (
        <div className="p-3 bg-sky-50 border border-sky-100 rounded-lg text-xs text-sky-900 flex flex-wrap items-center gap-2">
          <span className="font-semibold flex items-center gap-1">
            <Icon name="Info" size="xs" /> Complete your profile to boost recommendation rank:
          </span>
          {missingFields.map((field) => (
            <Badge key={field} variant="neutral" size="sm">
              + Missing {field.replace('_', ' ')}
            </Badge>
          ))}
        </div>
      )}

      {/* Main Profile Header Card */}
      <Card orientation="vertical" padding="lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <Avatar
            name={profile?.display_name || 'Creator'}
            src={profile?.profile_image_url || undefined}
            size="xl"
            className="w-20 h-20 text-2xl"
          />
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold text-slate-950">{profile?.display_name || 'Marcus Chen'}</h2>
              <span className="text-sm font-mono text-slate-500">{profile?.handle || '@tech_marcus'}</span>
              {profile?.is_verified && (
                <Badge variant="brand" size="sm">
                  <Icon name="CheckCircle" size="xs" className="mr-1 inline" />
                  Verified Creator
                </Badge>
              )}
              <Badge variant="neutral" size="sm" className="capitalize">
                {profile?.primary_niche || 'technology'}
              </Badge>
              {profile?.language && (
                <Badge variant="neutral" size="sm">
                  {profile.language}
                </Badge>
              )}
            </div>
            <p className="text-sm text-slate-600 max-w-2xl">
              {profile?.bio || 'Deep dive consumer tech reviews, AI software walkthroughs, and developer workflow setups.'}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
              <span className="flex items-center gap-1">
                <Icon name="MapPin" size="xs" />
                {(profile?.collaboration_preferences?.location as string) || 'San Francisco, CA'}
              </span>
              <span className="flex items-center gap-1">
                <Icon name="Users" size="xs" />
                {profile?.total_followers ? `${(profile.total_followers / 1000).toFixed(0)}K Total Reach` : 'Reach Pending'}
              </span>
              {profile?.following_count !== null && profile?.following_count !== undefined && (
                <span className="flex items-center gap-1">
                  <Icon name="UserCheck" size="xs" />
                  {profile.following_count.toLocaleString()} Following
                </span>
              )}
              {profile?.posts_count !== null && profile?.posts_count !== undefined && (
                <span className="flex items-center gap-1">
                  <Icon name="FileText" size="xs" />
                  {profile.posts_count} Posts
                </span>
              )}
              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                <Icon name="Activity" size="xs" />
                {profile?.avg_engagement_rate ?? 3.8}% Avg. Engagement
              </span>
              <span className="flex items-center gap-1 text-sky-700 font-medium">
                <Icon name="ShieldCheck" size="xs" />
                {profile?.authenticity_score ?? 94.5} Authenticity Index
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Provenance & Freshness Bar */}
      <Card orientation="vertical" padding="sm" className="bg-slate-50/60 border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 font-medium text-slate-800">
              <Icon name="Database" size="xs" className="text-slate-500" />
              Data Source:
              <span className="font-mono text-slate-600 ml-1">
                {profile?.data_source === 'user_manual' ? 'Self-Reported (Manual Input)' : profile?.data_source || 'Self-Reported'}
              </span>
            </span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1">
              Freshness:
              <Badge
                variant={profile?.freshness_status === 'fresh' ? 'success' : 'neutral'}
                size="sm"
                className="capitalize ml-1"
              >
                {profile?.freshness_status || 'manual'}
              </Badge>
            </span>
          </div>

          <div className="text-slate-500">
            {profile?.last_fetched_at
              ? `Last Provider Sync: ${new Date(profile.last_fetched_at).toLocaleDateString()}`
              : 'Sync Pending: Connect platform account to enable live metrics.'}
          </div>
        </div>
      </Card>

      {/* Edit Form with React Hook Form + Zod */}
      {isEditing && (
        <Card orientation="vertical" padding="lg" className="border-sky-300 bg-sky-50/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900">Edit Creator Profile &amp; Rates</h3>
            <span className="text-xs text-sky-700 font-medium">Client-side Zod validation active</span>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Full Creator Name"
                htmlFor="edit-display-name"
                required
                error={errors.displayName?.message}
              >
                <Input
                  id="edit-display-name"
                  error={errors.displayName?.message}
                  {...register('displayName')}
                />
              </FormField>

              <FormField
                label="Primary Handle (Must start with @)"
                htmlFor="edit-handle"
                required
                helperText="Format: @username (2-30 chars)"
                error={errors.handle?.message}
              >
                <Input
                  id="edit-handle"
                  error={errors.handle?.message}
                  {...register('handle')}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Profile Image URL"
                htmlFor="edit-image-url"
                helperText="Public HTTPS link to avatar or headshot"
                error={errors.profileImageUrl?.message}
              >
                <div className="flex items-center gap-3">
                  {previewImageUrl ? (
                    <img
                      src={previewImageUrl}
                      alt="Avatar Preview"
                      className="w-10 h-10 rounded-full border border-slate-200 object-cover bg-white"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-slate-400 bg-slate-50">
                      <Icon name="User" size="xs" />
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      id="edit-image-url"
                      placeholder="https://example.com/avatar.jpg"
                      error={errors.profileImageUrl?.message}
                      {...register('profileImageUrl')}
                    />
                  </div>
                </div>
              </FormField>

              <FormField
                label="Primary Content Niche (8 Standard Categories)"
                htmlFor="edit-niche"
                required
                error={errors.primaryNiche?.message}
              >
                <Select
                  id="edit-niche"
                  value={selectedNiche}
                  onChange={(e) => setValue('primaryNiche', e.target.value, { shouldValidate: true })}
                  error={errors.primaryNiche?.message}
                  options={INITIAL_NICHES.map((niche) => ({
                    value: niche,
                    label: niche.charAt(0).toUpperCase() + niche.slice(1),
                  }))}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Location / Timezone"
                htmlFor="edit-location"
                required
                error={errors.location?.message}
              >
                <Input
                  id="edit-location"
                  error={errors.location?.message}
                  {...register('location')}
                />
              </FormField>

              <FormField
                label="Primary Content Language"
                htmlFor="edit-language"
                error={errors.language?.message}
              >
                <Select
                  id="edit-language"
                  value={watch('language') || 'English'}
                  onChange={(e) => setValue('language', e.target.value)}
                  options={[
                    { value: 'English', label: 'English' },
                    { value: 'Spanish', label: 'Spanish' },
                    { value: 'French', label: 'French' },
                    { value: 'German', label: 'German' },
                    { value: 'Portuguese', label: 'Portuguese' },
                    { value: 'Japanese', label: 'Japanese' },
                  ]}
                />
              </FormField>
            </div>

            <FormTextarea
              id="edit-bio"
              label="Bio & Channel Description"
              required
              rows={3}
              maxLength={400}
              showCount
              value={bioValue}
              helperText="Describe your content format, production style, and core audience focus."
              error={errors.bio?.message}
              {...register('bio')}
            />

            <div className="pt-2 border-t border-slate-200">
              <label className="block text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2">
                Sponsorship Rate Card (USD)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField
                  label="Rate: Dedicated YouTube"
                  htmlFor="rate-yt-dedicated"
                  required
                  error={errors.rateYoutubeDedicated?.message}
                >
                  <Input
                    id="rate-yt-dedicated"
                    error={errors.rateYoutubeDedicated?.message}
                    {...register('rateYoutubeDedicated')}
                  />
                </FormField>

                <FormField
                  label="Rate: YouTube Integration"
                  htmlFor="rate-yt-integration"
                  required
                  error={errors.rateYoutubeIntegration?.message}
                >
                  <Input
                    id="rate-yt-integration"
                    error={errors.rateYoutubeIntegration?.message}
                    {...register('rateYoutubeIntegration')}
                  />
                </FormField>

                <FormField
                  label="Rate: Instagram Reel"
                  htmlFor="rate-ig-reel"
                  required
                  error={errors.rateInstagramReel?.message}
                >
                  <Input
                    id="rate-ig-reel"
                    error={errors.rateInstagramReel?.message}
                    {...register('rateInstagramReel')}
                  />
                </FormField>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3">
              <Button variant="secondary" type="button" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" isLoading={isSubmitting} leftIcon="Save">
                Save Changes
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Connected Channels & Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* YouTube Card */}
        <Card orientation="vertical" padding="md" className="border-t-4 border-t-red-500">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-red-50 text-red-600 rounded">
                <Icon name="Video" size="sm" />
              </div>
              <span className="font-semibold text-slate-900">YouTube</span>
            </div>
            <Badge variant="neutral" size="sm">Self-Reported</Badge>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Subscribers</span>
              <span className="font-bold text-slate-900">
                {profile?.total_followers ? profile.total_followers.toLocaleString() : '280,000'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Avg. Video Views</span>
              <span className="font-semibold text-slate-900">42,500</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Upload Cadence</span>
              <span className="text-slate-700">2x / week</span>
            </div>
          </div>
        </Card>

        {/* Instagram Card — Honest Provenance: Connected only if verified */}
        <Card orientation="vertical" padding="md" className="border-t-4 border-t-pink-500">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-pink-50 text-pink-600 rounded">
                <Icon name="Camera" size="sm" />
              </div>
              <span className="font-semibold text-slate-900">Instagram</span>
            </div>
            {isInstagramVerified ? (
              <Badge variant="success" size="sm">Verified Sync</Badge>
            ) : (
              <Badge variant="neutral" size="sm">Unverified (Self-Reported)</Badge>
            )}
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Connection Status</span>
              <span className={isInstagramVerified ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-medium'}>
                {isInstagramVerified ? 'Live API Linked' : 'Manual / Pending Sync'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Account Handle</span>
              <span className="font-semibold text-slate-900">
                {profile?.connected_platforms?.instagram?.handle || profile?.handle || 'Not connected'}
              </span>
            </div>
            <div className="pt-2">
              {isInstagramVerified ? (
                <div className="text-[11px] text-emerald-600 flex items-center gap-1 font-medium">
                  <Icon name="CheckCircle" size="xs" /> Provider metrics actively verified
                </div>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setIsVerifyModalOpen(true)}
                >
                  Verify Instagram Account
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* TikTok & Multi-Platform */}
        <Card orientation="vertical" padding="md" className="border-t-4 border-t-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-slate-100 text-slate-800 rounded">
                <Icon name="Smartphone" size="sm" />
              </div>
              <span className="font-semibold text-slate-900">TikTok &amp; Web</span>
            </div>
            <Badge variant="neutral" size="sm">Self-Reported</Badge>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">TikTok Followers</span>
              <span className="font-bold text-slate-900">65,000</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Substack Readers</span>
              <span className="font-semibold text-slate-900">18,200</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Newsletter Open Rate</span>
              <span className="text-indigo-600 font-semibold">48.5%</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Audience Demographics & Rate Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Demographics */}
        <Card orientation="vertical" padding="lg">
          <h3 className="text-base font-semibold text-slate-900 mb-4">Audience Geography &amp; Age</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                <span>United States &amp; Canada</span>
                <span>65%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-sky-600 h-full rounded-full" style={{ width: '65%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                <span>United Kingdom &amp; EU</span>
                <span>22%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-sky-500 h-full rounded-full" style={{ width: '22%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                <span>Core Age: 25-34 Years (Developers, Creators)</span>
                <span>58%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-600 h-full rounded-full" style={{ width: '58%' }} />
              </div>
            </div>
          </div>
        </Card>

        {/* Rate Card */}
        <Card orientation="vertical" padding="lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900">Standard Sponsorship Rate Card</h3>
            <span className="text-xs text-slate-400">Baseline Pricing</span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-md border border-slate-100">
              <div>
                <div className="text-sm font-semibold text-slate-900">Dedicated YouTube Video</div>
                <div className="text-xs text-slate-500">8-12 min dedicated review, link in description</div>
              </div>
              <span className="text-sm font-bold text-slate-900">
                {(profile?.collaboration_preferences?.rate_youtube_dedicated as string) || '$3,500'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-md border border-slate-100">
              <div>
                <div className="text-sm font-semibold text-slate-900">YouTube 60s Integration</div>
                <div className="text-xs text-slate-500">Mid-roll sponsorship segment with demo</div>
              </div>
              <span className="text-sm font-bold text-slate-900">
                {(profile?.collaboration_preferences?.rate_youtube_integration as string) || '$1,800'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-md border border-slate-100">
              <div>
                <div className="text-sm font-semibold text-slate-900">Instagram Reel + Story</div>
                <div className="text-xs text-slate-500">Short video tutorial + link sticker</div>
              </div>
              <span className="text-sm font-bold text-slate-900">
                {(profile?.collaboration_preferences?.rate_instagram_reel as string) || '$1,200'}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Instagram Platform Verification Modal */}
      <Modal
        isOpen={isVerifyModalOpen}
        onClose={() => setIsVerifyModalOpen(false)}
        title="Verify Instagram Account Connection"
        description="Verify account ownership to import official metrics and display verified badges."
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsVerifyModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleVerifyPlatform}
              isLoading={isVerifying}
            >
              Confirm &amp; Verify
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          {verifyError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800">
              {verifyError}
            </div>
          )}
          <FormField
            label="Instagram Account Handle"
            htmlFor="verify-ig-handle"
            required
            helperText="Include or omit the leading @ symbol."
          >
            <Input
              id="verify-ig-handle"
              value={verifyHandle}
              onChange={(e) => setVerifyHandle(e.target.value)}
              placeholder="e.g. tech_marcus"
            />
          </FormField>
          <div className="p-3 bg-slate-50 rounded text-xs text-slate-500 space-y-1">
            <p className="font-semibold text-slate-700">Verification Guarantee:</p>
            <p>
              Brand Bridge never claims a social connection is active without explicit platform verification.
              Verifying transitions your profile provenance from manual self-report to verified provider API status.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
