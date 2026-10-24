import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { PublicWebsite } from '../components/landing/PublicWebsite';
import { DesignSystemShowcase } from '../design-system/DesignSystemShowcase';
import { AppShell } from '../layouts/AppShell';
import type { WorkspaceRole } from '../layouts/types';
import { ErrorBoundary, RouteLoading } from '../components/feedback';
import { ProtectedRoute } from './ProtectedRoute';

// Auth Pages
import { SignInPage, SignUpPage } from '../pages/auth';

// Common Pages
import { NotFoundPage } from '../pages/common';

// Brand Pages
import {
  BrandOverviewPage,
  BrandCampaignsPage,
  BrandCampaignCreatePage,
  BrandDiscoverPage,
  BrandShortlistsPage,
  BrandInvitationsPage,
  BrandAnalyticsPage,
  BrandSettingsPage,
} from '../pages/brand';

// Influencer Pages
import {
  InfluencerOverviewPage,
  InfluencerProfilePage,
  InfluencerOpportunitiesPage,
  InfluencerInvitationsPage,
  InfluencerActivityPage,
  InfluencerSettingsPage,
} from '../pages/influencer';

// Admin Pages
import {
  AdminOverviewPage,
  AdminUsersPage,
  AdminDataImportsPage,
  AdminModelsPage,
  AdminAuditEventsPage,
  AdminSystemHealthPage,
} from '../pages/admin';

// Prototype Studio components
import { CreatorCatalog } from '../components/CreatorCatalog';
import { CampaignBoard } from '../components/CampaignBoard';
import { AIMatchingStudio } from '../components/AIMatchingStudio';
import { BrandDashboard } from '../components/BrandDashboard';
import { CreatorDashboard } from '../components/CreatorDashboard';
import { ShortlistDrawer } from '../components/ShortlistDrawer';
import { AnalyticsDashboard } from '../components/AnalyticsDashboard';
import { Navbar } from '../components/Navbar';
import type { Campaign, CreatorProfile } from '../types';

interface WorkspaceLayoutWrapperProps {
  role: WorkspaceRole;
  children: React.ReactNode;
}

const WorkspaceLayoutWrapper: React.FC<WorkspaceLayoutWrapperProps> = ({ role, children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Extract active sub-route from URL, e.g. /brand/campaigns -> 'campaigns'
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const activeRoute = pathSegments[1] || 'overview';

  const handleNavigate = (routeId: string) => {
    navigate(`/${role}/${routeId}`);
  };

  const handleSwitchRole = (newRole: WorkspaceRole) => {
    navigate(`/${newRole}/overview`);
  };

  const handleReturnToWebsite = () => {
    navigate('/');
  };

  return (
    <ProtectedRoute allowedRoles={[role]}>
      <AppShell
        role={role}
        activeRoute={activeRoute}
        onNavigate={handleNavigate}
        onSwitchRole={handleSwitchRole}
        onReturnToWebsite={handleReturnToWebsite}
      >
        <ErrorBoundary>
          <Suspense fallback={<RouteLoading />}>{children}</Suspense>
        </ErrorBoundary>
      </AppShell>
    </ProtectedRoute>
  );
};

export const PrototypeStudioView: React.FC = () => {
  const [activeProtoTab, setActiveProtoTab] = React.useState<string>('discover');
  const [shortlistedIds, setShortlistedIds] = React.useState<Set<number>>(new Set());
  const [selectedCreatorForAI, setSelectedCreatorForAI] = React.useState<CreatorProfile | null>(null);
  const [selectedCampaignForAI, setSelectedCampaignForAI] = React.useState<Campaign | null>(null);

  const handleToggleShortlist = (creatorId: number) => {
    setShortlistedIds((prev) => {
      const next = new Set(prev);
      if (next.has(creatorId)) {
        next.delete(creatorId);
      } else {
        next.add(creatorId);
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar
        activeTab={activeProtoTab}
        setActiveTab={setActiveProtoTab}
        shortlistCount={shortlistedIds.size}
        openAuthModal={() => {}}
      />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8" id="main-content">
        {activeProtoTab === 'discover' && (
          <CreatorCatalog
            onSelectCreatorForAI={(c) => {
              setSelectedCreatorForAI(c);
              setActiveProtoTab('matching');
            }}
            shortlistedIds={shortlistedIds}
            onToggleShortlist={handleToggleShortlist}
          />
        )}
        {activeProtoTab === 'campaigns' && (
          <CampaignBoard
            onOpenCreateCampaign={() => setActiveProtoTab('brand_hub')}
            onSelectCampaignForAI={(c) => {
              setSelectedCampaignForAI(c);
              setActiveProtoTab('matching');
            }}
          />
        )}
        {activeProtoTab === 'matching' && (
          <AIMatchingStudio
            initialCampaign={selectedCampaignForAI}
            initialCreator={selectedCreatorForAI}
            onToggleShortlist={handleToggleShortlist}
            shortlistedIds={shortlistedIds}
          />
        )}
        {activeProtoTab === 'brand_hub' && <BrandDashboard />}
        {activeProtoTab === 'creator_hub' && <CreatorDashboard />}
        {activeProtoTab === 'shortlist' && (
          <ShortlistDrawer
            onSelectCreatorForAI={(c) => {
              setSelectedCreatorForAI(c);
              setActiveProtoTab('matching');
            }}
            onRemoveFromShortlist={handleToggleShortlist}
          />
        )}
        {activeProtoTab === 'analytics' && <AnalyticsDashboard />}
      </main>
    </div>
  );
};

export const AppRoutes: React.FC = () => {
  const navigate = useNavigate();

  return (
    <ErrorBoundary>
      <Routes>
        {/* Public Website */}
        <Route
          path="/"
          element={
            <PublicWebsite
              onOpenAuth={() => navigate('/auth/sign-in')}
              onExploreApp={() => navigate('/brand/overview')}
            />
          }
        />

        {/* Authentication Routes */}
        <Route path="/auth/sign-in" element={<SignInPage />} />
        <Route path="/auth/sign-up" element={<SignUpPage />} />
        <Route path="/login" element={<Navigate to="/auth/sign-in" replace />} />
        <Route path="/signin" element={<Navigate to="/auth/sign-in" replace />} />
        <Route path="/register" element={<Navigate to="/auth/sign-up" replace />} />
        <Route path="/signup" element={<Navigate to="/auth/sign-up" replace />} />

        {/* Design System Tokens Showcase */}
        <Route
          path="/design-system"
          element={
            <div className="p-6">
              <DesignSystemShowcase />
            </div>
          }
        />

        {/* Prototype Studio Sandbox */}
        <Route path="/prototype" element={<PrototypeStudioView />} />

        {/* Brand Workspace Routes */}
        <Route path="/brand" element={<Navigate to="/brand/overview" replace />} />
        <Route
          path="/brand/overview"
          element={
            <WorkspaceLayoutWrapper role="brand">
              <BrandOverviewPage onNavigate={(route) => navigate(`/brand/${route}`)} />
            </WorkspaceLayoutWrapper>
          }
        />
        <Route
          path="/brand/campaigns"
          element={
            <WorkspaceLayoutWrapper role="brand">
              <BrandCampaignsPage />
            </WorkspaceLayoutWrapper>
          }
        />
        <Route
          path="/brand/campaigns/:id"
          element={
            <WorkspaceLayoutWrapper role="brand">
              <BrandCampaignsPage />
            </WorkspaceLayoutWrapper>
          }
        />
        <Route
          path="/brand/campaigns/new"
          element={
            <WorkspaceLayoutWrapper role="brand">
              <BrandCampaignCreatePage />
            </WorkspaceLayoutWrapper>
          }
        />
        <Route
          path="/brand/discover"
          element={
            <WorkspaceLayoutWrapper role="brand">
              <BrandDiscoverPage />
            </WorkspaceLayoutWrapper>
          }
        />
        <Route
          path="/brand/shortlists"
          element={
            <WorkspaceLayoutWrapper role="brand">
              <BrandShortlistsPage />
            </WorkspaceLayoutWrapper>
          }
        />
        <Route
          path="/brand/invitations"
          element={
            <WorkspaceLayoutWrapper role="brand">
              <BrandInvitationsPage />
            </WorkspaceLayoutWrapper>
          }
        />
        <Route
          path="/brand/analytics"
          element={
            <WorkspaceLayoutWrapper role="brand">
              <BrandAnalyticsPage />
            </WorkspaceLayoutWrapper>
          }
        />
        <Route
          path="/brand/settings"
          element={
            <WorkspaceLayoutWrapper role="brand">
              <BrandSettingsPage />
            </WorkspaceLayoutWrapper>
          }
        />

        {/* Influencer Workspace Routes */}
        <Route path="/influencer" element={<Navigate to="/influencer/overview" replace />} />
        <Route
          path="/influencer/overview"
          element={
            <WorkspaceLayoutWrapper role="influencer">
              <InfluencerOverviewPage onNavigate={(route) => navigate(`/influencer/${route}`)} />
            </WorkspaceLayoutWrapper>
          }
        />
        <Route
          path="/influencer/profile"
          element={
            <WorkspaceLayoutWrapper role="influencer">
              <InfluencerProfilePage />
            </WorkspaceLayoutWrapper>
          }
        />
        <Route
          path="/influencer/opportunities"
          element={
            <WorkspaceLayoutWrapper role="influencer">
              <InfluencerOpportunitiesPage />
            </WorkspaceLayoutWrapper>
          }
        />
        <Route
          path="/influencer/invitations"
          element={
            <WorkspaceLayoutWrapper role="influencer">
              <InfluencerInvitationsPage />
            </WorkspaceLayoutWrapper>
          }
        />
        <Route
          path="/influencer/activity"
          element={
            <WorkspaceLayoutWrapper role="influencer">
              <InfluencerActivityPage />
            </WorkspaceLayoutWrapper>
          }
        />
        <Route
          path="/influencer/settings"
          element={
            <WorkspaceLayoutWrapper role="influencer">
              <InfluencerSettingsPage />
            </WorkspaceLayoutWrapper>
          }
        />

        {/* Admin Workspace Routes */}
        <Route path="/admin" element={<Navigate to="/admin/overview" replace />} />
        <Route
          path="/admin/overview"
          element={
            <WorkspaceLayoutWrapper role="admin">
              <AdminOverviewPage onNavigate={(route) => navigate(`/admin/${route}`)} />
            </WorkspaceLayoutWrapper>
          }
        />
        <Route
          path="/admin/users"
          element={
            <WorkspaceLayoutWrapper role="admin">
              <AdminUsersPage />
            </WorkspaceLayoutWrapper>
          }
        />
        <Route
          path="/admin/data-imports"
          element={
            <WorkspaceLayoutWrapper role="admin">
              <AdminDataImportsPage />
            </WorkspaceLayoutWrapper>
          }
        />
        <Route
          path="/admin/models"
          element={
            <WorkspaceLayoutWrapper role="admin">
              <AdminModelsPage />
            </WorkspaceLayoutWrapper>
          }
        />
        <Route
          path="/admin/audit-events"
          element={
            <WorkspaceLayoutWrapper role="admin">
              <AdminAuditEventsPage />
            </WorkspaceLayoutWrapper>
          }
        />
        <Route
          path="/admin/system-health"
          element={
            <WorkspaceLayoutWrapper role="admin">
              <AdminSystemHealthPage />
            </WorkspaceLayoutWrapper>
          }
        />

        {/* Consistent Not Found Route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  );
};
