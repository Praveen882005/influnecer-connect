import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Icon,
  Input,
  Select,
} from '../../design-system';
import type { CreatorProfile } from '../../types';

export const InfluencerSettingsPage: React.FC = () => {
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [primaryNiche, setPrimaryNiche] = useState('technology');
  const [contactEmail, setContactEmail] = useState('');
  const [location, setLocation] = useState('Global');
  const [stripeConnected, setStripeConnected] = useState(true);

  // Notifications
  const [notifyBriefs, setNotifyBriefs] = useState(true);
  const [notifyApprovals, setNotifyApprovals] = useState(true);
  const [notifyMarketing, setNotifyMarketing] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const creatorData = await api.creators.getMyProfile();
        if (isMounted) {
          setProfile(creatorData);
          setDisplayName(creatorData.display_name || '');
          setHandle(creatorData.handle || '');
          setBio(creatorData.bio || '');
          setPrimaryNiche(creatorData.primary_niche || 'technology');
          setContactEmail(creatorData.owner_email || '');
          setLocation(creatorData.collaboration_preferences?.location || 'Global');
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMsg(err?.message || 'Failed to load creator account settings.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);
    setErrorMsg(null);
    try {
      const updated = await api.creators.updateMyProfile({
        display_name: displayName.trim(),
        handle: handle.trim(),
        bio: bio.trim(),
        primary_niche: primaryNiche,
        collaboration_preferences: {
          ...profile?.collaboration_preferences,
          location: location.trim(),
        },
      });
      setProfile(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || err?.message || 'Failed to update creator account settings.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="py-20 text-center text-xs text-slate-400">Loading creator account settings...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">Creator Account &amp; Payout Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure financial disbursement channels, legal entity details, and partnership notification alerts.
        </p>
      </div>

      {savedSuccess && (
        <Alert variant="success" onClose={() => setSavedSuccess(false)}>
          Your creator payout routing and notification preferences have been safely updated and persisted.
        </Alert>
      )}

      {errorMsg && (
        <Alert variant="danger" onClose={() => setErrorMsg(null)}>
          {errorMsg}
        </Alert>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Creator Identity & Legal */}
        <Card orientation="vertical" padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="User" size="md" className="text-slate-600" />
            <h2 className="text-base font-semibold text-slate-900">Legal Entity &amp; Representation</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Creator Display / Legal Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
            <Input
              label="Creator Handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              required
            />
            <Input
              label="Account Email (Authenticated User)"
              type="email"
              value={contactEmail}
              disabled
            />
            <Input
              label="Primary Location / Jurisdiction"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className="mt-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Content Vertical / Niche</label>
            <Select
              value={primaryNiche}
              onChange={(e) => setPrimaryNiche(e.target.value)}
              options={[
                { value: 'technology', label: 'Technology & Dev' },
                { value: 'beauty', label: 'Beauty & Skincare' },
                { value: 'food', label: 'Food & Culinary' },
                { value: 'fitness', label: 'Fitness & Health' },
                { value: 'fashion', label: 'Fashion & Style' },
                { value: 'home', label: 'Home & Decor' },
                { value: 'parenting', label: 'Parenting & Family' },
                { value: 'wellness', label: 'Wellness & Lifestyle' },
              ]}
            />
          </div>
        </Card>

        {/* Payout & Banking */}
        <Card orientation="vertical" padding="lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Icon name="CreditCard" size="md" className="text-slate-600" />
              <h2 className="text-base font-semibold text-slate-900">Direct Escrow Payouts</h2>
            </div>
            {stripeConnected ? (
              <Badge variant="success" size="sm">
                <Icon name="CheckCircle" size="sm" className="mr-1 inline" />
                Stripe Express Connected
              </Badge>
            ) : (
              <Badge variant="warning" size="sm">Setup Required</Badge>
            )}
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="font-semibold text-slate-900 text-sm">Escrow Direct Deposit Gateway</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Automatic bank transfers upon brand milestone acceptance and completion sign-off.
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => setStripeConnected(!stripeConnected)}
            >
              {stripeConnected ? 'Manage Payouts' : 'Connect Stripe'}
            </Button>
          </div>
        </Card>

        {/* Notification Preferences */}
        <Card orientation="vertical" padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="Bell" size="md" className="text-slate-600" />
            <h2 className="text-base font-semibold text-slate-900">Collaboration Alerts &amp; Notifications</h2>
          </div>

          <div className="space-y-3">
            <Checkbox
              id="notify-briefs"
              checked={notifyBriefs}
              onChange={(e) => setNotifyBriefs(e.target.checked)}
              label="Direct Brand Invitations"
              description="Notify immediately when a brand extends a formal brief and compensation offer."
            />
            <Checkbox
              id="notify-approvals"
              checked={notifyApprovals}
              onChange={(e) => setNotifyApprovals(e.target.checked)}
              label="Milestone Sign-Offs &amp; Payments"
              description="Alert when a brand approves a submitted deliverable or triggers payment release."
            />
            <Checkbox
              id="notify-marketing"
              checked={notifyMarketing}
              onChange={(e) => setNotifyMarketing(e.target.checked)}
              label="Platform Product &amp; Algorithm Updates"
              description="Receive weekly summaries on matching model enhancements and creator benchmarks."
            />
          </div>
        </Card>

        {/* Action Button */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="primary" type="submit" disabled={isSaving}>
            {isSaving ? 'Saving Changes...' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </div>
  );
};
