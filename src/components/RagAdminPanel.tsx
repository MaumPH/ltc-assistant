import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Database, FlaskConical, RefreshCcw, Settings2 } from 'lucide-react';
import { getApiUrl } from '../lib/apiUrl';
import type {
  AdminHealthResponse,
  AdminProfilesResponse,
  AdminReindexResponse,
  BackendReadinessItem,
  EvalTrialReport,
  PromptMode,
  RetrievalFeatureFlags,
} from '../lib/ragTypes';

interface InspectResponse {
  query: string;
  normalizedQuery: string;
  selectedRetrievalMode: string;
  retrievalReadiness: string;
  hybridReadinessReason: string;
  search: {
    confidence: string;
    fusedCandidates: Array<{
      id: string;
      docTitle: string;
      articleNo?: string;
      rerankScore: number;
      sectionPath: string[];
    }>;
    evidence: Array<{
      id: string;
      docTitle: string;
      articleNo?: string;
      rerankScore: number;
      sectionPath: string[];
    }>;
  };
  profile: {
    id: string;
    label: string;
  };
  latency: {
    totalMs: number;
    retrievalMs: number;
  };
  cacheHits: Record<string, boolean>;
  sectionRouting: {
    enabled: boolean;
    strategy: string;
    selectedSectionTitles: string[];
    detail: string;
  };
  guardrails: Array<{
    type: string;
    severity: string;
    triggered: boolean;
    detail: string;
  }>;
  fallbackTriggered: boolean;
  fallbackSources: Array<{
    title: string;
    source: string;
    cached: boolean;
  }>;
}

const FEATURE_FLAG_LABELS: Array<[keyof RetrievalFeatureFlags, string]> = [
  ['queryRewrite', 'Query rewrite'],
  ['queryClarification', 'Clarification'],
  ['hyde', 'HyDE'],
  ['decompose', 'Decompose'],
  ['sectionRouting', 'Tree routing'],
  ['reranker', 'Reranker'],
  ['cache', 'Cache'],
  ['guardrails', 'Guardrails'],
  ['externalElasticsearch', 'Elasticsearch'],
];

async function readJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(getApiUrl(input), init);
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
    throw new Error(payload.details || payload.error || `Request failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

function getBackendTone(item: BackendReadinessItem): string {
  switch (item.status) {
    case 'ready':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'degraded':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'unavailable':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'disabled':
      return 'border-slate-200 bg-slate-100 text-slate-600';
  }
}

export default function RagAdminPanel() {
  const [health, setHealth] = useState<AdminHealthResponse | null>(null);
  const [profiles, setProfiles] = useState<AdminProfilesResponse | null>(null);
  const [trials, setTrials] = useState<EvalTrialReport[]>([]);
  const [inspectQuery, setInspectQuery] = useState('');
  const [inspectMode, setInspectMode] = useState<PromptMode>('integrated');
  const [inspectProfileId, setInspectProfileId] = useState<string>('');
  const [inspectResult, setInspectResult] = useState<InspectResponse | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyAction, setBusyAction] = useState<'profiles' | 'reindex' | 'eval' | 'inspect' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const activeFeatureFlags = profiles?.featureFlags ?? health?.featureFlags ?? null;
  const backendEntries = useMemo(
    () => (health ? Object.values(health.backendReadiness) : []),
    [health],
  );

  const refreshAll = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const [nextHealth, nextProfiles, nextTrials] = await Promise.all([
        readJson<AdminHealthResponse>('/api/admin/rag/health'),
        readJson<AdminProfilesResponse>('/api/admin/rag/profiles'),
        readJson<EvalTrialReport[]>('/api/admin/rag/evals'),
      ]);
      setHealth(nextHealth);
      setProfiles(nextProfiles);
      setTrials(nextTrials);
      setInspectProfileId((current) => current || nextProfiles.activeProfileId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load RAG admin data');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void refreshAll();
  }, []);

  const updateProfiles = async (payload: {
    activeProfileId?: string;
    overrides?: Partial<RetrievalFeatureFlags>;
  }) => {
    setBusyAction('profiles');
    setError(null);
    setNotice(null);
    try {
      const updated = await readJson<AdminProfilesResponse>('/api/admin/rag/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setProfiles(updated);
      setInspectProfileId(updated.activeProfileId);
      setNotice('RAG profile settings updated.');
      const nextHealth = await readJson<AdminHealthResponse>('/api/admin/rag/health');
      setHealth(nextHealth);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update profile settings');
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleFlag = async (flag: keyof RetrievalFeatureFlags, value: boolean) => {
    await updateProfiles({
      activeProfileId: profiles?.activeProfileId,
      overrides: {
        [flag]: value,
      },
    });
  };

  const handleReindex = async () => {
    setBusyAction('reindex');
    setError(null);
    setNotice(null);
    try {
      const response = await readJson<AdminReindexResponse>('/api/admin/rag/reindex', {
        method: 'POST',
      });
      setNotice(`Reindex queued. Pending jobs: ${response.queue.pending}`);
      const nextHealth = await readJson<AdminHealthResponse>('/api/admin/rag/health');
      setHealth(nextHealth);
    } catch (reindexError) {
      setError(reindexError instanceof Error ? reindexError.message : 'Failed to enqueue reindex');
    } finally {
      setBusyAction(null);
    }
  };

  const handleRunEval = async () => {
    setBusyAction('eval');
    setError(null);
    setNotice(null);
    try {
      const profileIds = profiles?.profiles.map((profile) => profile.id) ?? [];
      const report = await readJson<EvalTrialReport>('/api/admin/rag/evals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileIds,
        }),
      });
      setTrials((current) => [report, ...current.filter((item) => item.id !== report.id)]);
      setNotice(`Eval trial finished: ${report.id}`);
    } catch (evalError) {
      setError(evalError instanceof Error ? evalError.message : 'Failed to run eval trial');
    } finally {
      setBusyAction(null);
    }
  };

  const handleInspect = async () => {
    if (!inspectQuery.trim()) return;
    setBusyAction('inspect');
    setError(null);
    setNotice(null);
    try {
      const result = await readJson<InspectResponse>('/api/retrieval/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: inspectQuery.trim(),
          mode: inspectMode,
          retrievalProfileId: inspectProfileId || profiles?.activeProfileId,
        }),
      });
      setInspectResult(result);
    } catch (inspectError) {
      setError(inspectError instanceof Error ? inspectError.message : 'Failed to inspect query');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
            <Settings2 className="h-3.5 w-3.5" />
            RAG admin controls
          </div>
          <h2 className="mt-3 text-xl font-semibold text-slate-900">Hybrid retrieval operations</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Tune the active retrieval profile, inspect backend readiness, trigger reindex jobs, and run eval trials
            without leaving the dashboard.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refreshAll()}
          disabled={isRefreshing}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {(error || notice) && (
        <div className="mt-4 space-y-2">
          {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
          {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}
        </div>
      )}

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Settings2 className="h-4 w-4 text-sky-600" />
            Active profile
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {profiles?.profiles.map((profile) => {
              const isActive = profile.id === profiles.activeProfileId;
              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => void updateProfiles({ activeProfileId: profile.id })}
                  disabled={busyAction === 'profiles'}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {profile.label}
                </button>
              );
            })}
          </div>

          {profiles && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">{profiles.activeProfileId}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {profiles.profiles.find((profile) => profile.id === profiles.activeProfileId)?.description}
              </p>
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {FEATURE_FLAG_LABELS.map(([flag, label]) => {
              const checked = activeFeatureFlags?.[flag] ?? false;
              return (
                <label key={flag} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={busyAction === 'profiles'}
                    onChange={(event) => void handleToggleFlag(flag, event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>
              );
            })}
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Activity className="h-4 w-4 text-emerald-600" />
            Backend readiness
          </div>

          <div className="mt-4 grid gap-3">
            {backendEntries.map((item) => (
              <div key={item.name} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold capitalize text-slate-900">{item.name}</p>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getBackendTone(item)}`}>
                    {item.status}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
                {typeof item.backlog === 'number' && (
                  <p className="mt-1 text-xs text-slate-500">Backlog: {item.backlog}</p>
                )}
              </div>
            ))}
          </div>

          {health && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              Queue running {health.queue.running}, pending {health.queue.pending}, index state {health.indexStatus.state}
            </div>
          )}
        </section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Database className="h-4 w-4 text-violet-600" />
            Operations
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void handleReindex()}
              disabled={busyAction !== null}
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyAction === 'reindex' ? 'Queueing reindex...' : 'Queue reindex'}
            </button>
            <button
              type="button"
              onClick={() => void handleRunEval()}
              disabled={busyAction !== null}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyAction === 'eval' ? 'Running eval...' : 'Run eval suite'}
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
            Eval runs are stored under <code>benchmarks/trials</code>. Reindex jobs stay on the background worker so the
            query path can remain responsive.
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <FlaskConical className="h-4 w-4 text-amber-600" />
            Recent eval trials
          </div>

          <div className="mt-4 space-y-3">
            {trials.length > 0 ? (
              trials.slice(0, 4).map((trial) => (
                <div key={trial.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{trial.id}</p>
                    <span className="text-xs text-slate-500">{new Date(trial.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      top-3 {(trial.top3Recall * 100).toFixed(1)}%
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      evidence {(trial.expectedEvidencePassRate * 100).toFixed(1)}%
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      section {(trial.sectionHitRate * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
                No eval trial history yet.
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <FlaskConical className="h-4 w-4 text-sky-600" />
          Case analysis
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_180px_220px_140px]">
          <textarea
            value={inspectQuery}
            onChange={(event) => setInspectQuery(event.target.value)}
            rows={3}
            placeholder="Enter a Korean query to inspect the retrieval path..."
            className="min-h-[92px] rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={inspectMode}
            onChange={(event) => setInspectMode(event.target.value as PromptMode)}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="integrated">integrated</option>
            <option value="evaluation">evaluation</option>
          </select>
          <select
            value={inspectProfileId}
            onChange={(event) => setInspectProfileId(event.target.value)}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {(profiles?.profiles ?? []).map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void handleInspect()}
            disabled={busyAction !== null || !inspectQuery.trim()}
            className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyAction === 'inspect' ? 'Inspecting...' : 'Inspect'}
          </button>
        </div>

        {inspectResult && (
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">
                  {inspectResult.profile.label} ({inspectResult.profile.id})
                </p>
                <p className="mt-1 text-sm text-slate-600">Normalized query: {inspectResult.normalizedQuery}</p>
                <p className="mt-1 text-sm text-slate-600">
                  Mode {inspectResult.selectedRetrievalMode}, confidence {inspectResult.search.confidence}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Retrieval {inspectResult.latency.retrievalMs} ms, total {inspectResult.latency.totalMs} ms
                </p>
                <p className="mt-1 text-sm text-slate-600">{inspectResult.hybridReadinessReason}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">Section routing</p>
                <p className="mt-1 text-sm text-slate-600">{inspectResult.sectionRouting.detail}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {inspectResult.sectionRouting.selectedSectionTitles.length > 0 ? (
                    inspectResult.sectionRouting.selectedSectionTitles.map((title) => (
                      <span key={title} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                        {title}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">No routed section</span>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">Cache and guardrails</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(inspectResult.cacheHits).map(([key, hit]) => (
                    <span
                      key={key}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        hit ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {key} {hit ? 'hit' : 'miss'}
                    </span>
                  ))}
                </div>
                <div className="mt-3 space-y-2">
                  {inspectResult.guardrails.filter((item) => item.triggered).length > 0 ? (
                    inspectResult.guardrails
                      .filter((item) => item.triggered)
                      .map((item) => (
                        <div key={`${item.type}-${item.detail}`} className="rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                          {item.type}: {item.detail}
                        </div>
                      ))
                  ) : (
                    <div className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-500">No triggered guardrails.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">Top fused candidates</p>
                <div className="mt-3 space-y-2">
                  {inspectResult.search.fusedCandidates.slice(0, 5).map((candidate) => (
                    <div key={candidate.id} className="rounded-2xl bg-slate-50 px-3 py-3">
                      <p className="text-sm font-semibold text-slate-900">{candidate.docTitle}</p>
                      <p className="mt-1 text-sm text-slate-600">score {candidate.rerankScore.toFixed(2)}</p>
                      <p className="mt-1 text-xs text-slate-500">{candidate.sectionPath.join(' > ')}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">Selected evidence</p>
                <div className="mt-3 space-y-2">
                  {inspectResult.search.evidence.length > 0 ? (
                    inspectResult.search.evidence.map((candidate) => (
                      <div key={candidate.id} className="rounded-2xl bg-slate-50 px-3 py-3">
                        <p className="text-sm font-semibold text-slate-900">{candidate.docTitle}</p>
                        <p className="mt-1 text-sm text-slate-600">score {candidate.rerankScore.toFixed(2)}</p>
                        <p className="mt-1 text-xs text-slate-500">{candidate.sectionPath.join(' > ')}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-500">No evidence selected.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}
