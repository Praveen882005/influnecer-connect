import React, { useState } from 'react';
import {
  Alert,
  Avatar,
  Badge,
  BrandBridgeLogo,
  Button,
  Card,
  Checkbox,
  Container,
  Dropdown,
  EmptyState,
  Input,
  Modal,
  Select,
  Skeleton,
  Table,
  Tabs,
  Tooltip,
} from './index';

interface ShowcaseCreator {
  id: number;
  name: string;
  handle: string;
  niche: string;
  followers: string;
  engagement: string;
  authenticity: number;
  status: 'online' | 'offline';
}

const SAMPLE_DATA: ShowcaseCreator[] = [
  {
    id: 1,
    name: 'Marcus Chen',
    handle: '@tech_marcus',
    niche: 'Tech & AI',
    followers: '490K',
    engagement: '3.8%',
    authenticity: 94.5,
    status: 'online',
  },
  {
    id: 2,
    name: 'Claire Vance',
    handle: '@claire_wellness',
    niche: 'Fitness & Wellness',
    followers: '515K',
    engagement: '4.6%',
    authenticity: 96.0,
    status: 'online',
  },
  {
    id: 3,
    name: 'Sora Lindqvist',
    handle: '@sora_ecoluxe',
    niche: 'Sustainable Fashion',
    followers: '220K',
    engagement: '3.9%',
    authenticity: 93.0,
    status: 'offline',
  },
];

export const DesignSystemShowcase: React.FC = () => {
  const [activeTab, setActiveTab] = useState('components');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [selectVal, setSelectVal] = useState('tech');
  const [checkboxChecked, setCheckboxChecked] = useState(true);
  const [showAlert, setShowAlert] = useState(true);

  const tableColumns = [
    {
      key: 'name',
      header: 'Creator Profile',
      render: (row: ShowcaseCreator) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={row.name} size="sm" status={row.status} />
          <div>
            <div className="font-semibold text-slate-900">{row.name}</div>
            <div className="text-xs text-slate-500">{row.handle}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'niche',
      header: 'Primary Niche',
      render: (row: ShowcaseCreator) => (
        <Badge variant="neutral" size="sm">
          {row.niche}
        </Badge>
      ),
    },
    {
      key: 'followers',
      header: 'Audience Reach',
      align: 'right' as const,
      render: (row: ShowcaseCreator) => (
        <span className="font-medium text-slate-800">{row.followers}</span>
      ),
    },
    {
      key: 'engagement',
      header: 'Engagement Rate',
      align: 'right' as const,
      render: (row: ShowcaseCreator) => (
        <span className="font-semibold text-sky-700">{row.engagement}</span>
      ),
    },
    {
      key: 'authenticity',
      header: 'Authenticity Index',
      align: 'right' as const,
      render: (row: ShowcaseCreator) => (
        <Badge variant="success" size="sm">
          {row.authenticity}/100
        </Badge>
      ),
    },
  ];

  return (
    <Container size="lg" className="py-8">
      {/* Design System Header */}
      <div className="border-b border-[#E5E7EB] pb-5 mb-8 text-left">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
          <BrandBridgeLogo size="md" subtitle="Design System & Component Library" />
          <div className="flex items-center gap-2">
            <Badge variant="brand" size="sm">
              Phase 03 Verified
            </Badge>
            <span className="text-xs text-[#697386] font-mono">Tailwind v4.3.3 + Vite</span>
          </div>
        </div>
        <h1 className="text-2xl font-bold font-['Manrope',sans-serif] text-[#17243A] tracking-tight">
          BRAND BRIDGE Design System
        </h1>
        <p className="text-sm text-[#697386] mt-1 max-w-2xl leading-relaxed">
          Premium B2B token foundation featuring deep ink typography (#17243A), warm ivory canvas (#F7F5F0),
          an authoritative cobalt blue accent (#4169E1), and accessible UI component primitives.
        </p>

        <div className="mt-6">
          <Tabs
            tabs={[
              { id: 'components', label: 'Component Primitives', icon: 'Layers' },
              { id: 'typography', label: 'Tokens & Colors', icon: 'Palette' },
              { id: 'table', label: 'Data Tables & States', icon: 'Table2' },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>
      </div>

      {/* Tab 1: Components */}
      {activeTab === 'components' && (
        <div className="space-y-8 text-left">
          {/* Button Matrix */}
          <Card padding="lg">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
              Buttons &amp; Actions
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" leftIcon="Plus">
                Primary Button
              </Button>
              <Button variant="secondary">Secondary Action</Button>
              <Button variant="outline" leftIcon="Filter">
                Filter Results
              </Button>
              <Button variant="ghost">Ghost Option</Button>
              <Button variant="danger" leftIcon="Trash2">
                Destructive Action
              </Button>
              <Button variant="primary" isLoading>
                Loading State
              </Button>
              <Button variant="primary" disabled>
                Disabled
              </Button>
            </div>
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
              <Button variant="outline" size="sm">
                Small Size
              </Button>
              <Button variant="outline" size="md">
                Medium Size (Default)
              </Button>
              <Button variant="outline" size="lg">
                Large Size
              </Button>
            </div>
          </Card>

          {/* Form Controls */}
          <Card padding="lg">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
              Form Controls &amp; Accessibility
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Input
                label="Campaign Brief Title"
                placeholder="e.g. Autumn Autonomous Drone Launch"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                helperText="Enter a descriptive campaign title for creators"
                leftIcon="Megaphone"
                required
              />

              <Input
                label="Validated Field with Error"
                placeholder="Required field..."
                error="Audience demographic format is invalid"
                leftIcon="AlertCircle"
              />

              <Select
                label="Target Content Niche"
                value={selectVal}
                onChange={(e) => setSelectVal(e.target.value)}
                options={[
                  { value: 'tech', label: 'Technology & AI Workflows' },
                  { value: 'fitness', label: 'Fitness & Physical Wellness' },
                  { value: 'fashion', label: 'Sustainable Apparel & Design' },
                  { value: 'gaming', label: 'Competitive Esports & Gaming' },
                ]}
              />

              <div className="flex flex-col justify-end pt-2">
                <Checkbox
                  label="Enforce Creator Verification Gate"
                  description="Require all pitching creators to have confirmed identity and organic audit scores above 90."
                  checked={checkboxChecked}
                  onChange={(e) => setCheckboxChecked(e.target.checked)}
                />
              </div>
            </div>
          </Card>

          {/* Badges, Avatars, Tooltips, Dropdowns */}
          <Card padding="lg">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
              Feedback, Status &amp; Micro-Interactions
            </h3>
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <Badge variant="brand" withDot>
                Brand Accent
              </Badge>
              <Badge variant="success" withDot>
                Verified Active
              </Badge>
              <Badge variant="warning" withDot>
                Review Pending
              </Badge>
              <Badge variant="danger" withDot>
                Proposal Declined
              </Badge>
              <Badge variant="neutral">Neutral Tag</Badge>
            </div>

            <div className="flex flex-wrap items-center gap-5 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <Avatar name="Elena Rostova" size="sm" status="online" />
                <Avatar name="Marcus Chen" size="md" status="busy" />
                <Avatar name="Claire Vance" size="lg" status="offline" />
              </div>

              <Tooltip content="Calculated algorithmic engagement efficiency metric" position="top">
                <Button variant="outline" size="sm" leftIcon="HelpCircle">
                  Hover for Tooltip
                </Button>
              </Tooltip>

              <Dropdown
                trigger={
                  <Button variant="outline" size="sm" rightIcon="ChevronDown">
                    Quick Actions Menu
                  </Button>
                }
                items={[
                  { id: '1', label: 'Add to Shortlist', icon: 'Star', onClick: () => {} },
                  { id: '2', label: 'Generate Brief PDF', icon: 'FileText', onClick: () => {} },
                  { id: '3', label: 'Archive Campaign', icon: 'Trash2', danger: true, onClick: () => {} },
                ]}
              />

              <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
                Open Accessible Modal
              </Button>
            </div>
          </Card>

          {/* Alerts */}
          {showAlert && (
            <Alert
              variant="info"
              title="Algorithmic Authenticity Standard"
              onClose={() => setShowAlert(false)}
            >
              Audience consistency scores reflect mathematical anomaly heuristics comparing engagement
              variance across platform benchmarks. They are diagnostic indicators rather than definitive
              proof of fraud.
            </Alert>
          )}
        </div>
      )}

      {/* Tab 2: Tokens & Colors */}
      {activeTab === 'typography' && (
        <div className="space-y-6 text-left">
          <Card padding="lg">
            <h3 className="text-sm font-bold text-[#17243A] uppercase tracking-wider mb-4">
              Color Token Hierarchy (Deep Ink, Warm Ivory &amp; Cobalt Blue)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3.5 rounded-[10px] border border-[#E5E7EB] bg-white">
                <div className="w-full h-10 rounded-[6px] bg-[#17243A] mb-2" />
                <div className="font-semibold text-xs text-[#17243A]">Deep Ink 900</div>
                <div className="text-[11px] text-[#697386] font-mono">#17243A (Headings)</div>
              </div>
              <div className="p-3.5 rounded-[10px] border border-[#E5E7EB] bg-white">
                <div className="w-full h-10 rounded-[6px] bg-[#4169E1] mb-2" />
                <div className="font-semibold text-xs text-[#17243A]">Cobalt Blue 600</div>
                <div className="text-[11px] text-[#697386] font-mono">#4169E1 (Key Accent)</div>
              </div>
              <div className="p-3.5 rounded-[10px] border border-[#E5E7EB] bg-white">
                <div className="w-full h-10 rounded-[6px] bg-[#DCE5FA] border border-[#BFDBFE] mb-2" />
                <div className="font-semibold text-xs text-[#17243A]">Pale Blue 100</div>
                <div className="text-[11px] text-[#697386] font-mono">#DCE5FA (Tints/Focus)</div>
              </div>
              <div className="p-3.5 rounded-[10px] border border-[#E5E7EB] bg-white">
                <div className="w-full h-10 rounded-[6px] bg-[#F7F5F0] border border-[#E5E7EB] mb-2" />
                <div className="font-semibold text-xs text-[#17243A]">Warm Ivory 50</div>
                <div className="text-[11px] text-[#697386] font-mono">#F7F5F0 (Canvas)</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 3: Data Tables & States */}
      {activeTab === 'table' && (
        <div className="space-y-6 text-left">
          <Card padding="lg">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
              Enterprise Data Table Component
            </h3>
            <Table
              columns={tableColumns}
              data={SAMPLE_DATA}
              keyExtractor={(row) => row.id}
            />
          </Card>

          <Card padding="lg">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
              Loading Skeletons &amp; Empty State
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 border border-slate-200 rounded-[6px] space-y-3">
                <Skeleton variant="text" width="60%" height="1.25rem" />
                <Skeleton variant="text" width="90%" height="0.875rem" />
                <Skeleton variant="text" width="40%" height="0.875rem" />
                <div className="flex gap-2 pt-2">
                  <Skeleton variant="circle" width={32} height={32} />
                  <Skeleton variant="rect" width={100} height={32} />
                </div>
              </div>

              <div className="p-4 border border-slate-200 rounded-[6px]">
                <EmptyState
                  title="No Inbound Bids Recorded"
                  description="Publish a campaign brief to start receiving tailored creator pitches."
                  action={<Button variant="outline" size="sm">Create First Campaign</Button>}
                />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Accessible Interactive Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Creator Verification Checkpoint"
        description="Review algorithmic fit indicators before issuing campaign contracts."
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setIsModalOpen(false)}>
              Confirm Checkpoint
            </Button>
          </>
        }
      >
        <p className="text-xs text-slate-600 leading-relaxed">
          This modal dialog conforms to WAI-ARIA modal guidelines, managing focus, capturing the
          Escape keyboard shortcut, and restricting background body scroll while active.
        </p>
      </Modal>
    </Container>
  );
};
