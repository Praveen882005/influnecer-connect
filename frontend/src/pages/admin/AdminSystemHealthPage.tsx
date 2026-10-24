import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import {
  Alert,
  Badge,
  Button,
  Card,
  Icon,
} from '../../design-system';
import type { AdminDiagnosticsResult, AdminSystemHealthData } from '../../types';

export const AdminSystemHealthPage: React.FC = () => {
  const [healthData, setHealthData] = useState<AdminSystemHealthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<AdminDiagnosticsResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchHealth = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.admin.systemHealth();
      setHealthData(data);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to fetch operational health.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const handleRunDiagnostic = async () => {
    setIsRunningDiagnostic(true);
    setDiagnosticResult(null);
    setErrorMsg(null);
    try {
      const res = await api.admin.runDiagnostics();
      setDiagnosticResult(res);
      // Re-fetch health to update cache and telemetry
      await fetchHealth();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Diagnostic self-test failed.');
    } finally {
      setIsRunningDiagnostic(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs}h ${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">System Health &amp; Telemetry</h1>
            <Badge
              variant={healthData?.is_ready ? 'success' : 'danger'}
              size="sm"
            >
              {healthData?.is_ready ? 'All Subsystems Ready' : 'Degraded Operational State'}
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time infrastructure probes, database connection state, and live diagnostic execution.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Icon name="RefreshCw" size="sm" />}
            onClick={fetchHealth}
            disabled={isLoading}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Icon name="Play" size="sm" />}
            onClick={handleRunDiagnostic}
            disabled={isRunningDiagnostic}
          >
            {isRunningDiagnostic ? 'Running Probe...' : 'Run Diagnostics'}
          </Button>
        </div>
      </div>

      {/* Security Redaction Banner */}
      <Alert variant="info">
        <div className="flex items-center gap-2">
          <Icon name="Shield" size="sm" className="text-sky-600" />
          <span>
            {healthData?.security_redaction_notice || 'All credentials, secret keys, and database passwords are redacted.'}
          </span>
        </div>
      </Alert>

      {/* Error Banner */}
      {errorMsg && (
        <Alert variant="danger" onClose={() => setErrorMsg(null)}>
          {errorMsg}
        </Alert>
      )}

      {/* Diagnostics Result Card */}
      {diagnosticResult && (
        <Card orientation="vertical" padding="md" className="border-l-4 border-l-sky-500 bg-sky-50/40">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Icon name="CheckCircle" size="md" className="text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-sm">Diagnostic Self-Test Completed</h3>
            </div>
            <Badge variant="brand" size="sm">
              {diagnosticResult.duration_ms.toFixed(1)} ms
            </Badge>
          </div>
          <p className="text-xs text-slate-700 mb-3">{diagnosticResult.message}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {Object.entries(diagnosticResult.subsystems_tested).map(([sub, status]) => (
              <div key={sub} className="bg-white p-2 rounded border border-slate-200">
                <span className="font-semibold text-slate-800 capitalize block">{sub}</span>
                <span className="font-mono text-slate-600 text-xs">{status}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card orientation="vertical" padding="md">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Liveness State
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-lg font-bold text-slate-900 capitalize">
              {healthData?.liveness_status || 'Healthy'}
            </span>
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Process running</span>
        </Card>

        <Card orientation="vertical" padding="md">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Readiness State
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${healthData?.is_ready ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span className="text-lg font-bold text-slate-900 capitalize">
              {healthData?.readiness_status || 'Ready'}
            </span>
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Traffic acceptance</span>
        </Card>

        <Card orientation="vertical" padding="md">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Service Uptime
          </div>
          <div className="text-lg font-bold text-slate-900">
            {healthData ? formatUptime(healthData.uptime_seconds) : '—'}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Process duration</span>
        </Card>

        <Card orientation="vertical" padding="md">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Cache Entries
          </div>
          <div className="text-lg font-bold text-slate-900">
            {healthData?.active_memory_cache_entries ?? 0}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Vector LRU cache</span>
        </Card>
      </div>

      {/* Subsystem Details Table */}
      <Card orientation="vertical" padding="md">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Platform Subsystems Status</h3>
            <p className="text-xs text-slate-500">Live health state across database, embedding engine, and authentication.</p>
          </div>
          <Badge variant="neutral" size="sm">
            {healthData?.subsystems.length ?? 0} Monitored
          </Badge>
        </div>

        <div className="divide-y divide-slate-100">
          {healthData?.subsystems.map((sub) => (
            <div key={sub.name} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 text-sm">{sub.name}</span>
                  <Badge variant="neutral" size="sm">{sub.category}</Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{sub.details}</p>
              </div>
              <div className="flex items-center gap-3">
                {sub.latency_ms !== null && sub.latency_ms !== undefined && (
                  <span className="font-mono text-xs text-slate-400">
                    {sub.latency_ms.toFixed(1)} ms
                  </span>
                )}
                <Badge
                  variant={sub.status.toLowerCase() === 'operational' ? 'success' : 'danger'}
                  size="sm"
                >
                  {sub.status.toUpperCase()}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Configuration & Architecture Card */}
      <Card orientation="vertical" padding="md">
        <h3 className="text-base font-semibold text-slate-900 mb-3">Runtime Configuration &amp; Persistence</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="text-slate-500 block font-medium">Database Connection String</span>
            <span className="font-mono text-slate-900 font-semibold block mt-0.5 break-all">
              {healthData?.database_engine || '—'}
            </span>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="text-slate-500 block font-medium">Environment &amp; Application Version</span>
            <span className="font-mono text-slate-900 font-semibold block mt-0.5">
              {healthData?.app_name} v{healthData?.version} ({healthData?.environment})
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
};
