import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import {
  Alert,
  Badge,
  Button,
  Card,
  Icon,
  Modal,
  Table,
  type Column,
} from '../../design-system';
import type { ImportErrorItem, ImportJob, ProviderAdapterStatus } from '../../types';

export const AdminDataImportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'jobs' | 'upload' | 'adapters'>('jobs');
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [adapters, setAdapters] = useState<ProviderAdapterStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'danger' | 'info';
    title: string;
    message: string;
  } | null>(null);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [entityType, setEntityType] = useState<'profiles' | 'posts'>('profiles');
  const [sourceProvenance, setSourceProvenance] = useState('');

  // Error modal state
  const [inspectedJob, setInspectedJob] = useState<ImportJob | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [jobsData, adaptersData] = await Promise.allSettled([
        api.data.importJobs({ limit: 50 }),
        api.data.providerAdapters(),
      ]);

      if (jobsData.status === 'fulfilled') {
        setJobs(jobsData.value || []);
      }
      if (adaptersData.status === 'fulfilled') {
        setAdapters(adaptersData.value || []);
      }
    } catch {
      setFeedback({
        type: 'danger',
        title: 'Network Error',
        message: 'Failed to retrieve ingestion records from the server.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSeedSynthetic = async () => {
    setIsSeeding(true);
    setFeedback(null);
    try {
      const res = await api.data.seedSynthetic();
      const creatorsCount = res.creators_job?.processed_records ?? 0;
      const postsCount = res.posts_job?.processed_records ?? 0;
      setFeedback({
        type: 'success',
        title: 'Synthetic Pipeline Ingestion Completed',
        message: `Successfully seeded ${creatorsCount} creators and ${postsCount} social posts from data/samples/. Missing metrics are explicitly represented as NULL, never replaced with zero.`,
      });
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error during synthetic ingestion.';
      setFeedback({
        type: 'danger',
        title: 'Seeding Failed',
        message: msg,
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setFeedback({
        type: 'danger',
        title: 'No File Selected',
        message: 'Please choose a CSV or JSON dataset to ingest.',
      });
      return;
    }

    setIsUploading(true);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('entity_type', entityType);
      if (sourceProvenance.trim()) {
        formData.append('source_provenance', sourceProvenance.trim());
      }

      const res = await api.data.uploadDataset(formData);
      setFeedback({
        type: res.failed_records > 0 ? 'info' : 'success',
        title: `Ingestion ${res.status.toUpperCase()}`,
        message: `${res.message} (Provenance: ${res.provenance})`,
      });
      setSelectedFile(null);
      setSourceProvenance('');
      setActiveTab('jobs');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed.';
      setFeedback({
        type: 'danger',
        title: 'Upload Failed',
        message: msg,
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Job columns definition
  const jobColumns: Column<ImportJob>[] = [
    {
      key: 'id',
      header: 'Job ID',
      render: (job) => <span className="font-mono text-xs font-bold text-slate-900">#{job.id}</span>,
    },
    {
      key: 'job_type',
      header: 'Type',
      render: (job) => (
        <span className="text-xs font-semibold text-slate-800">
          {job.job_type === 'creator_profiles_import' ? 'Creator Profiles' : 'Influencer Posts'}
        </span>
      ),
    },
    {
      key: 'source_provenance',
      header: 'Source / Provenance',
      render: (job) => (
        <div className="max-w-xs truncate text-xs font-mono text-slate-600" title={job.source_provenance}>
          {job.source_provenance}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (job) => {
        const variant =
          job.status === 'completed' ? 'success' : job.status === 'failed' ? 'danger' : 'warning';
        return (
          <Badge variant={variant} size="sm">
            {job.status.toUpperCase()}
          </Badge>
        );
      },
    },
    {
      key: 'processed',
      header: 'Processed / Total',
      align: 'right',
      render: (job) => (
        <span className="font-mono text-xs text-slate-800">
          <strong className="text-emerald-700">{job.processed_records}</strong> / {job.total_records}
        </span>
      ),
    },
    {
      key: 'failed',
      header: 'Failed',
      align: 'center',
      render: (job) => (
        job.failed_records > 0 ? (
          <button
            onClick={() => setInspectedJob(job)}
            className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
          >
            <Icon name="AlertTriangle" size="xs" />
            <span>{job.failed_records} errors</span>
          </button>
        ) : (
          <span className="text-xs text-slate-400">0</span>
        )
      ),
    },
    {
      key: 'created_at',
      header: 'Timestamp',
      align: 'right',
      render: (job) => (
        <span className="text-xs text-slate-500 font-mono">
          {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Audit',
      align: 'right',
      render: (job) => (
        <Button variant="ghost" size="xs" onClick={() => setInspectedJob(job)}>
          Details
        </Button>
      ),
    },
  ];

  // Error table columns
  const errorColumns: Column<ImportErrorItem>[] = [
    {
      key: 'row',
      header: 'Row',
      align: 'center',
      render: (err) => <span className="font-mono text-xs font-bold text-slate-900">#{err.row}</span>,
    },
    {
      key: 'record_identifier',
      header: 'Identifier',
      render: (err) => <span className="font-mono text-xs text-sky-700 font-semibold">{err.record_identifier}</span>,
    },
    {
      key: 'error',
      header: 'Validation Error',
      render: (err) => <span className="text-xs text-rose-700">{err.error}</span>,
    },
  ];

  const totalProcessed = jobs.reduce((acc, j) => acc + j.processed_records, 0);
  const totalFailed = jobs.reduce((acc, j) => acc + j.failed_records, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Data Ingestion &amp; Social Ingestion Pipeline
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Provider-neutral CSV/JSON ingestion engine, idempotent re-import, and platform adapter compliance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            leftIcon={<Icon name="RefreshCw" size="xs" className={isLoading ? 'animate-spin' : ''} />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Icon name="Sparkles" size="xs" className={isSeeding ? 'animate-spin' : ''} />}
            onClick={handleSeedSynthetic}
            disabled={isSeeding}
          >
            {isSeeding ? 'Ingesting Datasets...' : 'Run Synthetic Ingestion'}
          </Button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <Alert variant={feedback.type} title={feedback.title} onClose={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card orientation="vertical" padding="md">
          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Ingestion Engine</div>
          <div className="text-base font-bold text-slate-900 mt-1 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            Provider-Neutral
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Idempotent upsert on handle/post_id</div>
        </Card>

        <Card orientation="vertical" padding="md">
          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total Records Ingested</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1 font-mono">{totalProcessed}</div>
          <div className="text-xs text-slate-500 mt-0.5">Across {jobs.length} logged batches</div>
        </Card>

        <Card orientation="vertical" padding="md">
          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Validation Errors Caught</div>
          <div className="text-2xl font-bold text-rose-600 mt-1 font-mono">{totalFailed}</div>
          <div className="text-xs text-slate-500 mt-0.5">Tracked with row-level error audit</div>
        </Card>

        <Card orientation="vertical" padding="md">
          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Live API Safeguards</div>
          <div className="text-base font-bold text-amber-700 mt-1 flex items-center gap-1.5">
            <Icon name="Shield" size="sm" className="text-amber-600" />
            Meta &amp; Google Disabled
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Zero unapproved scraping allowed</div>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('jobs')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === 'jobs'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Icon name="Clock" size="xs" />
            Ingestion Job History ({jobs.length})
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === 'upload'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Icon name="Upload" size="xs" />
            Upload CSV / JSON Dataset
          </button>
          <button
            onClick={() => setActiveTab('adapters')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === 'adapters'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Icon name="Share2" size="xs" />
            Social Provider Adapters ({adapters.length})
          </button>
        </nav>
      </div>

      {/* TAB 1: Ingestion Jobs History */}
      {activeTab === 'jobs' && (
        <Card orientation="vertical" padding="md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Ingestion Audit Records</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Every batch records total records, processed count, failed rows, and audit trails.
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono">Real-time DB audit</span>
          </div>

          {jobs.length === 0 ? (
            <div className="py-12 text-center">
              <Icon name="Database" size="lg" className="mx-auto text-slate-300 mb-3" />
              <div className="text-sm font-semibold text-slate-700">No Ingestion Jobs Yet</div>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Trigger the synthetic benchmark ingestion pipeline or upload a CSV/JSON dataset to get started.
              </p>
              <Button
                variant="primary"
                size="sm"
                className="mt-4"
                onClick={handleSeedSynthetic}
                disabled={isSeeding}
              >
                Seed Synthetic Benchmarks
              </Button>
            </div>
          ) : (
            <Table columns={jobColumns} data={jobs} keyExtractor={(j) => String(j.id)} />
          )}
        </Card>
      )}

      {/* TAB 2: Upload CSV / JSON */}
      {activeTab === 'upload' && (
        <div className="max-w-2xl mx-auto space-y-4">
          <Card orientation="vertical" padding="lg">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Batch Data Importer</h3>
            <p className="text-xs text-slate-500 mb-6">
              Upload CSV or JSON files for influencer profiles or social post performance metrics.
              Validates handles, timestamps, and strictly distinguishes genuine zeros from unmonitored metrics.
            </p>

            <form onSubmit={handleFileUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Target Entity Schema
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEntityType('profiles')}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${
                      entityType === 'profiles'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-1 ring-indigo-600'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <Icon name="User" size="sm" className={entityType === 'profiles' ? 'text-indigo-600' : 'text-slate-400'} />
                    <div>
                      <div className="text-xs font-bold">Creator Profiles</div>
                      <div className="text-[11px] text-slate-500">Handle, niches, follower tiers</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEntityType('posts')}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${
                      entityType === 'posts'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-1 ring-indigo-600'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <Icon name="FileText" size="sm" className={entityType === 'posts' ? 'text-indigo-600' : 'text-slate-400'} />
                    <div>
                      <div className="text-xs font-bold">Influencer Posts</div>
                      <div className="text-[11px] text-slate-500">Likes, views, comments, shares</div>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Dataset File (.csv or .json)
                </label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-indigo-500 transition-colors bg-slate-50/50">
                  <input
                    type="file"
                    accept=".csv,.json"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="file-upload-input"
                  />
                  <label htmlFor="file-upload-input" className="cursor-pointer">
                    <Icon name="UploadCloud" size="lg" className="mx-auto text-slate-400 mb-2" />
                    <div className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                      {selectedFile ? selectedFile.name : 'Click to select CSV or JSON file'}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {selectedFile
                        ? `${(selectedFile.size / 1024).toFixed(1)} KB selected`
                        : 'Supports standard CSV and JSON creator/post catalogs'}
                    </p>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Source Provenance (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Agency Partner Export Q4, Vendor Fixture v2"
                  value={sourceProvenance}
                  onChange={(e) => setSourceProvenance(e.target.value)}
                  className="w-full text-xs rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3 border"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Preserved in database audit logs and creator profile metadata.
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setSelectedFile(null);
                    setSourceProvenance('');
                  }}
                  disabled={isUploading || !selectedFile}
                >
                  Clear
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isUploading || !selectedFile}
                  leftIcon={<Icon name="Upload" size="xs" className={isUploading ? 'animate-spin' : ''} />}
                >
                  {isUploading ? 'Ingesting Dataset...' : 'Start Ingestion'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* TAB 3: Provider Adapters & Platform Compliance */}
      {activeTab === 'adapters' && (
        <div className="space-y-4">
          <div className="rounded-lg bg-amber-50 p-4 border border-amber-200 flex items-start gap-3">
            <Icon name="Shield" size="md" className="text-amber-700 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <strong className="font-semibold block mb-0.5">Social Platform Developer Compliance</strong>
              Brand Bridge is engineered to use authorized official developer APIs only. Live external integrations
              remain disabled until App Review approval, business verification, and granted scopes are confirmed.
              Web scraping or bypassing platform rate limits is strictly forbidden by system architecture.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {adapters.map((adapter) => (
              <Card key={adapter.provider_id} orientation="vertical" padding="md" className="flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-slate-500 uppercase">{adapter.provider_id}</span>
                    <Badge variant={adapter.is_enabled ? 'success' : 'neutral'} size="sm">
                      {adapter.status.toUpperCase()}
                    </Badge>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mb-2">{adapter.display_name}</h4>
                  <p className="text-xs text-slate-600 leading-normal">
                    {adapter.disclaimer || adapter.reason || 'Registered provider adapter.'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Ingestion Mode</span>
                  <span className="font-medium text-slate-700">
                    {adapter.is_enabled ? 'Local Fixtures' : 'Awaiting Review'}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Ingestion Job Audit / Error Breakdown Modal */}
      {inspectedJob && (
        <Modal
          isOpen={!!inspectedJob}
          onClose={() => setInspectedJob(null)}
          title={`Job #${inspectedJob.id}: ${inspectedJob.job_type}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-50 rounded-lg text-xs">
              <div>
                <span className="text-slate-400 block">Status</span>
                <span className="font-bold text-slate-900 uppercase">{inspectedJob.status}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Total Records</span>
                <span className="font-bold text-slate-900">{inspectedJob.total_records}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Succeeded</span>
                <span className="font-bold text-emerald-700">{inspectedJob.processed_records}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Failed</span>
                <span className="font-bold text-rose-700">{inspectedJob.failed_records}</span>
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-700 block mb-1">Source Provenance</span>
              <div className="p-2 bg-slate-100 rounded text-xs font-mono text-slate-800 break-all">
                {inspectedJob.source_provenance}
              </div>
            </div>

            {inspectedJob.error_summary && inspectedJob.error_summary.length > 0 ? (
              <div>
                <span className="text-xs font-semibold text-rose-700 block mb-1">
                  Validation Error Breakdown ({inspectedJob.error_summary.length})
                </span>
                <div className="max-h-56 overflow-y-auto border border-rose-200 rounded">
                  <Table
                    columns={errorColumns}
                    data={inspectedJob.error_summary}
                    keyExtractor={(err, i) => `${err.row}-${i}`}
                  />
                </div>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded border border-emerald-200 flex items-center gap-2">
                <Icon name="CheckCircle" size="sm" />
                <span>Zero row-level validation errors encountered for this batch.</span>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setInspectedJob(null)}>
                Close Audit View
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
