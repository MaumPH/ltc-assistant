import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Database, FlaskConical, RefreshCcw, Settings2 } from 'lucide-react';
import { getApiUrl } from '../lib/apiUrl';
import type {
  AdminHealthResponse,
  AdminProfilesResponse,
  AdminReindexResponse,
  BackendReadinessItem,
  BackendReadinessKey,
  BackendReadinessStatus,
  EvalTrialReport,
  PromptMode,
  RetrievalFeatureFlags,
} from '../lib/ragTypes';

interface RagAdminPanelProps {
  authToken: string;
  onAuthExpired: () => void;
}

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
  semanticFrame: {
    primaryIntent: string;
    secondaryIntents: string[];
    canonicalTerms: string[];
    assumptions: string[];
    missingCriticalSlots: string[];
    riskLevel: string;
    slots: Record<string, Array<{ canonical: string }>>;
    relationRequests: Array<{ relation: string; reason: string }>;
  };
  assumptions: string[];
  usedPromotedConcepts: string[];
  usedValidatedConcepts: string[];
  validationIssues: Array<{
    code: string;
    severity: string;
    message: string;
  }>;
  claimCoverage: {
    totalClaims: number;
    supportedClaims: number;
    partiallySupportedClaims: number;
    unsupportedClaims: number;
  };
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

interface OntologyReviewResponse {
  concepts: OntologyConceptRecord[];
  updatedAt: string;
}

type OntologyReviewStatus = 'candidate' | 'validated' | 'promoted' | 'rejected';

interface OntologyConceptRecord {
  source: 'generated' | 'curated';
  label: string;
  entityType?: string;
  status: OntologyReviewStatus;
  confidence?: number;
  aliases: string[];
  slotHints: string[];
  relationCount: number;
  statusReason?: string;
  recommendedStatus: OntologyReviewStatus;
  recommendationReason: string;
  evidence: Array<{
    label: string;
    path: string;
    reason: string;
  }>;
}

class AdminAuthError extends Error {}

const FEATURE_FLAG_LABELS: Array<[keyof RetrievalFeatureFlags, string]> = [
  ['queryRewrite', '질의 재작성'],
  ['queryClarification', '추가 확인'],
  ['hyde', 'HyDE 가상 문서'],
  ['decompose', '질문 분해'],
  ['sectionRouting', '섹션 라우팅'],
  ['reranker', '재정렬'],
  ['cache', '캐시'],
  ['guardrails', '가드레일'],
  ['externalElasticsearch', 'Elasticsearch'],
];

const PROFILE_LABELS: Record<string, string> = {
  balanced: '균형',
  precision: '정밀',
  recall: '확장',
};

const BACKEND_LABELS: Record<BackendReadinessKey, string> = {
  pgvector: '벡터 저장소',
  elasticsearch: 'Elasticsearch',
  redis: 'Redis 캐시',
  parser: '문서 파서',
  reranker: '재정렬기',
  queue: '작업 대기열',
};

const STATUS_LABELS: Record<BackendReadinessStatus, string> = {
  ready: '준비됨',
  degraded: '부분 동작',
  disabled: '비활성',
  unavailable: '사용 불가',
};

const CACHE_LABELS: Record<string, string> = {
  normalization: '정규화',
  hyde: 'HyDE',
  retrieval: '검색',
  fallback: '대체 검색',
  answer: '답변',
};

function getProfileLabel(id: string, fallback: string): string {
  return PROFILE_LABELS[id] ?? fallback;
}

function translateConfidence(value: string): string {
  switch (value) {
    case 'high':
      return '높음';
    case 'medium':
      return '보통';
    case 'low':
      return '낮음';
    default:
      return value;
  }
}

function translateRetrievalMode(value: string): string {
  switch (value) {
    case 'local':
      return '로컬';
    case 'workflow-global':
      return '워크플로 전체';
    case 'drift-refine':
      return '드리프트 보정';
    default:
      return value;
  }
}

function translateIndexState(value: string): string {
  switch (value) {
    case 'fresh':
      return '최신';
    case 'stale':
      return '갱신 필요';
    case 'partial_embeddings':
      return '부분 임베딩';
    default:
      return value;
  }
}

function translatePromptMode(value: PromptMode): string {
  return value === 'evaluation' ? '평가채팅' : '통합채팅';
}

function translateBackendDetail(item: BackendReadinessItem): string {
  switch (item.detail) {
    case 'Postgres/pgvector store active.':
      return 'Postgres/pgvector 저장소가 활성화되어 있습니다.';
    case 'Postgres/pgvector store configured.':
      return 'Postgres/pgvector 저장소가 설정되어 있습니다.';
    case 'Memory store active; vector retrieval is local-only.':
      return '메모리 저장소로 동작 중이며 벡터 검색은 로컬 프로세스에서 처리됩니다.';
    case 'Running on memory store; vector search falls back to in-process embeddings.':
      return '메모리 저장소로 실행 중이며 벡터 검색은 프로세스 내부 임베딩으로 처리합니다.';
    case 'Not configured.':
      return '설정되지 않았습니다.';
    case 'Waiting for store initialization.':
      return '저장소 초기화를 기다리는 중입니다.';
    case 'Redis is not configured; using in-process cache fallback.':
      return 'Redis가 설정되지 않아 프로세스 내부 캐시를 사용합니다.';
    case 'Redis URL configured, but this build is using the in-process cache fallback.':
      return 'Redis URL은 설정되어 있지만 현재 빌드는 프로세스 내부 캐시를 사용합니다.';
    case 'Structured PDF parser is not configured; markdown/txt ingestion remains active.':
      return '구조화 PDF 파서가 설정되지 않아 Markdown/TXT 수집만 활성화되어 있습니다.';
    case 'Background worker queue is idle.':
    case 'In-process worker queue is idle.':
      return '백그라운드 작업 대기열이 비어 있습니다.';
    default:
      return item.detail;
  }
}

async function readJson<T>(input: string, authToken: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${authToken}`);

  const response = await fetch(getApiUrl(input), {
    ...init,
    headers,
  });

  if (!response.ok) {
    const payload = (await response.json().catch((error) => {
      console.warn('[RagAdminPanel] failed to parse admin API error response:', error);
      return {};
    })) as { error?: string; details?: string };
    const message = payload.details || payload.error || `요청에 실패했습니다. 상태 코드: ${response.status}`;
    if (response.status === 401) {
      throw new AdminAuthError('관리자 로그인이 만료되었습니다. 다시 로그인해 주세요.');
    }
    throw new Error(message);
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

export default function RagAdminPanel({ authToken, onAuthExpired }: RagAdminPanelProps) {
  const [health, setHealth] = useState<AdminHealthResponse | null>(null);
  const [profiles, setProfiles] = useState<AdminProfilesResponse | null>(null);
  const [trials, setTrials] = useState<EvalTrialReport[]>([]);
  const [ontologyReview, setOntologyReview] = useState<OntologyReviewResponse | null>(null);
  const [inspectQuery, setInspectQuery] = useState('');
  const [inspectMode, setInspectMode] = useState<PromptMode>('integrated');
  const [inspectProfileId, setInspectProfileId] = useState<string>('');
  const [inspectResult, setInspectResult] = useState<InspectResponse | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyAction, setBusyAction] = useState<'profiles' | 'reindex' | 'eval' | 'inspect' | 'ontology' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const activeFeatureFlags = profiles?.featureFlags ?? health?.featureFlags ?? null;
  const backendEntries = useMemo(
    () => (health ? Object.values(health.backendReadiness) : []),
    [health],
  );
  const ontologyConcepts = useMemo(() => ontologyReview?.concepts ?? [], [ontologyReview]);
  const visibleOntologyConcepts = useMemo(() => ontologyConcepts.slice(0, 12), [ontologyConcepts]);
  const pendingOntologyConcepts = useMemo(
    () => ontologyConcepts.filter((concept) => concept.status === 'candidate'),
    [ontologyConcepts],
  );
  const ontologyStatusCounts = useMemo(
    () =>
      ontologyConcepts.reduce<Record<OntologyReviewStatus, number>>(
        (counts, concept) => ({
          ...counts,
          [concept.status]: counts[concept.status] + 1,
        }),
        { candidate: 0, validated: 0, promoted: 0, rejected: 0 },
      ),
    [ontologyConcepts],
  );
  const recommendedOntologyConcepts = useMemo(
    () =>
      pendingOntologyConcepts.filter(
        (concept) => concept.recommendedStatus !== 'candidate' && concept.recommendedStatus !== concept.status,
      ),
    [pendingOntologyConcepts],
  );
  const rejectedRecommendationConcepts = useMemo(
    () => pendingOntologyConcepts.filter((concept) => concept.recommendedStatus === 'rejected'),
    [pendingOntologyConcepts],
  );

  const requestJson = async <T,>(input: string, init?: RequestInit): Promise<T> => readJson<T>(input, authToken, init);

  const describeError = (requestError: unknown, fallback: string): string => {
    if (requestError instanceof AdminAuthError) {
      onAuthExpired();
      return requestError.message;
    }
    return requestError instanceof Error ? requestError.message : fallback;
  };

  const refreshAll = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const [nextHealth, nextProfiles, nextTrials, nextOntologyReview] = await Promise.all([
        requestJson<AdminHealthResponse>('/api/admin/rag/health'),
        requestJson<AdminProfilesResponse>('/api/admin/rag/profiles'),
        requestJson<EvalTrialReport[]>('/api/admin/rag/evals'),
        requestJson<OntologyReviewResponse>('/api/admin/rag/ontology'),
      ]);
      setHealth(nextHealth);
      setProfiles(nextProfiles);
      setTrials(nextTrials);
      setOntologyReview(nextOntologyReview);
      setInspectProfileId((current) => current || nextProfiles.activeProfileId);
    } catch (loadError) {
      setError(describeError(loadError, 'RAG 관리자 데이터를 불러오지 못했습니다.'));
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void refreshAll();
  }, [authToken]);

  const updateProfiles = async (payload: {
    activeProfileId?: string;
    overrides?: Partial<RetrievalFeatureFlags>;
  }) => {
    setBusyAction('profiles');
    setError(null);
    setNotice(null);
    try {
      const updated = await requestJson<AdminProfilesResponse>('/api/admin/rag/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setProfiles(updated);
      setInspectProfileId(updated.activeProfileId);
      setNotice('RAG 프로필 설정을 저장했습니다.');
      const nextHealth = await requestJson<AdminHealthResponse>('/api/admin/rag/health');
      setHealth(nextHealth);
    } catch (updateError) {
      setError(describeError(updateError, '프로필 설정을 저장하지 못했습니다.'));
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
      const response = await requestJson<AdminReindexResponse>('/api/admin/rag/reindex', {
        method: 'POST',
      });
      setNotice(`재색인 작업을 대기열에 넣었습니다. 대기 중인 작업: ${response.queue.pending}건`);
      const nextHealth = await requestJson<AdminHealthResponse>('/api/admin/rag/health');
      setHealth(nextHealth);
    } catch (reindexError) {
      setError(describeError(reindexError, '재색인 작업을 대기열에 넣지 못했습니다.'));
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
      const report = await requestJson<EvalTrialReport>('/api/admin/rag/evals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileIds,
        }),
      });
      setTrials((current) => [report, ...current.filter((item) => item.id !== report.id)]);
      setNotice(`평가 실험을 완료했습니다: ${report.id}`);
    } catch (evalError) {
      setError(describeError(evalError, '평가 실험을 실행하지 못했습니다.'));
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
      const result = await requestJson<InspectResponse>('/api/admin/rag/inspect', {
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
      setError(describeError(inspectError, '검색 경로를 점검하지 못했습니다.'));
    } finally {
      setBusyAction(null);
    }
  };

  const handleOntologyReview = async (
    source: 'generated' | 'curated',
    label: string,
    status: Exclude<OntologyReviewStatus, 'candidate'>,
  ) => {
    setBusyAction('ontology');
    setError(null);
    setNotice(null);
    try {
      const nextReview = await requestJson<OntologyReviewResponse>('/api/admin/rag/ontology/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          label,
          status,
        }),
      });
      setOntologyReview(nextReview);
      setNotice(`온톨로지 상태를 업데이트했습니다: ${label} -> ${status}`);
    } catch (reviewError) {
      setError(describeError(reviewError, '온톨로지 상태를 업데이트하지 못했습니다.'));
    } finally {
      setBusyAction(null);
    }
  };

  const handleOntologyBulkReview = async (
    scope: 'visible' | 'pending',
    status: Exclude<OntologyReviewStatus, 'candidate'>,
  ) => {
    const targets = (scope === 'visible' ? visibleOntologyConcepts : pendingOntologyConcepts).filter(
      (concept) => concept.status !== status,
    );
    if (targets.length === 0) {
      setNotice('변경할 온톨로지 후보가 없습니다.');
      return;
    }

    if (
      scope === 'pending' &&
      !window.confirm(`검토 대기 후보 ${targets.length}개를 모두 ${status} 상태로 변경할까요?`)
    ) {
      return;
    }

    setBusyAction('ontology');
    setError(null);
    setNotice(null);
    try {
      const nextReview = await requestJson<OntologyReviewResponse>('/api/admin/rag/ontology/review/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: targets.map((concept) => ({
            source: concept.source,
            label: concept.label,
            status,
          })),
        }),
      });
      setOntologyReview(nextReview);
      setNotice(`온톨로지 후보 ${targets.length}개를 ${status} 상태로 변경했습니다.`);
    } catch (reviewError) {
      setError(describeError(reviewError, '온톨로지 후보를 일괄 업데이트하지 못했습니다.'));
    } finally {
      setBusyAction(null);
    }
  };

  const handleApplyOntologyRecommendations = async (mode: 'all' | 'reject') => {
    const targets = mode === 'reject' ? rejectedRecommendationConcepts : recommendedOntologyConcepts;
    if (targets.length === 0) {
      setNotice('적용할 자동 추천 후보가 없습니다.');
      return;
    }

    if (!window.confirm(`자동 추천에 따라 후보 ${targets.length}개를 일괄 변경할까요?`)) {
      return;
    }

    setBusyAction('ontology');
    setError(null);
    setNotice(null);
    try {
      const nextReview = await requestJson<OntologyReviewResponse>('/api/admin/rag/ontology/review/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: targets.map((concept) => ({
            source: concept.source,
            label: concept.label,
            status: concept.recommendedStatus,
          })),
        }),
      });
      setOntologyReview(nextReview);
      setNotice(`자동 추천에 따라 온톨로지 후보 ${targets.length}개를 변경했습니다.`);
    } catch (reviewError) {
      setError(describeError(reviewError, '온톨로지 자동 추천을 적용하지 못했습니다.'));
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
            RAG 관리자 도구
          </div>
          <h2 className="mt-3 text-xl font-semibold text-slate-900">하이브리드 검색 운영</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            검색 프로필, 백엔드 준비 상태, 재색인 작업, 평가 실험을 관리자 화면에서 점검합니다.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refreshAll()}
          disabled={isRefreshing}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          새로고침
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
            활성 검색 프로필
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
                  {getProfileLabel(profile.id, profile.label)}
                </button>
              );
            })}
          </div>

          {profiles && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">
                {getProfileLabel(profiles.activeProfileId, profiles.activeProfileId)}
              </p>
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
            백엔드 준비 상태
          </div>

          <div className="mt-4 grid gap-3">
            {backendEntries.map((item) => (
              <div key={item.name} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{BACKEND_LABELS[item.name]}</p>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getBackendTone(item)}`}>
                    {STATUS_LABELS[item.status]}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-600">{translateBackendDetail(item)}</p>
                {typeof item.backlog === 'number' && (
                  <p className="mt-1 text-xs text-slate-500">대기 작업: {item.backlog}건</p>
                )}
              </div>
            ))}
          </div>

          {health && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              실행 {health.queue.running}건, 대기 {health.queue.pending}건, 인덱스 상태 {translateIndexState(health.indexStatus.state)}
            </div>
          )}
        </section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Database className="h-4 w-4 text-violet-600" />
            운영 작업
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void handleReindex()}
              disabled={busyAction !== null}
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyAction === 'reindex' ? '재색인 등록 중...' : '재색인 실행'}
            </button>
            <button
              type="button"
              onClick={() => void handleRunEval()}
              disabled={busyAction !== null}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyAction === 'eval' ? '평가 실행 중...' : '평가 실험 실행'}
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
            평가 실험 결과는 <code>benchmarks/trials</code>에 저장됩니다. 재색인 작업은 백그라운드 대기열에서 처리되어
            일반 질의 응답 흐름을 막지 않습니다.
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <FlaskConical className="h-4 w-4 text-amber-600" />
            최근 평가 실험
          </div>

          <div className="mt-4 space-y-3">
            {trials.length > 0 ? (
              trials.slice(0, 4).map((trial) => (
                <div key={trial.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{trial.id}</p>
                    <span className="text-xs text-slate-500">{new Date(trial.createdAt).toLocaleString('ko-KR')}</span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      상위 3개 {(trial.top3Recall * 100).toFixed(1)}%
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      근거 적중 {(trial.expectedEvidencePassRate * 100).toFixed(1)}%
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      섹션 적중 {(trial.sectionHitRate * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
                아직 평가 실험 기록이 없습니다.
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <FlaskConical className="h-4 w-4 text-sky-600" />
          검색 경로 점검
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_180px_220px_140px]">
          <textarea
            value={inspectQuery}
            onChange={(event) => setInspectQuery(event.target.value)}
            rows={3}
            placeholder="검색 경로를 확인할 한국어 질문을 입력하세요."
            className="min-h-[92px] rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={inspectMode}
            onChange={(event) => setInspectMode(event.target.value as PromptMode)}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="integrated">{translatePromptMode('integrated')}</option>
            <option value="evaluation">{translatePromptMode('evaluation')}</option>
          </select>
          <select
            value={inspectProfileId}
            onChange={(event) => setInspectProfileId(event.target.value)}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {(profiles?.profiles ?? []).map((profile) => (
              <option key={profile.id} value={profile.id}>
                {getProfileLabel(profile.id, profile.label)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void handleInspect()}
            disabled={busyAction !== null || !inspectQuery.trim()}
            className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyAction === 'inspect' ? '점검 중...' : '점검'}
          </button>
        </div>

        {inspectResult && (
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">
                  {getProfileLabel(inspectResult.profile.id, inspectResult.profile.label)} ({inspectResult.profile.id})
                </p>
                <p className="mt-1 text-sm text-slate-600">정규화 질의: {inspectResult.normalizedQuery}</p>
                <p className="mt-1 text-sm text-slate-600">
                  검색 모드 {translateRetrievalMode(inspectResult.selectedRetrievalMode)}, 신뢰도 {translateConfidence(inspectResult.search.confidence)}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  검색 {inspectResult.latency.retrievalMs}ms, 전체 {inspectResult.latency.totalMs}ms
                </p>
                <p className="mt-1 text-sm text-slate-600">{inspectResult.hybridReadinessReason}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">질문 해석</p>
                <p className="mt-1 text-sm text-slate-600">
                  primary {inspectResult.semanticFrame.primaryIntent}, risk {inspectResult.semanticFrame.riskLevel}
                </p>
                {inspectResult.semanticFrame.secondaryIntents.length > 0 && (
                  <p className="mt-1 text-sm text-slate-600">
                    secondary {inspectResult.semanticFrame.secondaryIntents.join(', ')}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {inspectResult.semanticFrame.canonicalTerms.slice(0, 8).map((term) => (
                    <span key={term} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                      {term}
                    </span>
                  ))}
                </div>
                {Object.entries(inspectResult.semanticFrame.slots).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(inspectResult.semanticFrame.slots).flatMap(([slot, values]) =>
                      values.map((value) => (
                        <span key={`${slot}-${value.canonical}`} className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
                          {slot}: {value.canonical}
                        </span>
                      )),
                    )}
                  </div>
                )}
                {inspectResult.assumptions.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {inspectResult.assumptions.map((assumption) => (
                      <div key={assumption} className="rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        {assumption}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">섹션 라우팅</p>
                <p className="mt-1 text-sm text-slate-600">{inspectResult.sectionRouting.detail}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {inspectResult.sectionRouting.selectedSectionTitles.length > 0 ? (
                    inspectResult.sectionRouting.selectedSectionTitles.map((title) => (
                      <span key={title} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                        {title}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">선택된 섹션 없음</span>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">캐시 및 가드레일</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(inspectResult.cacheHits).map(([key, hit]) => (
                    <span
                      key={key}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        hit ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {CACHE_LABELS[key] ?? key} {hit ? '적중' : '미스'}
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
                    <div className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-500">작동한 가드레일이 없습니다.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">상위 통합 후보</p>
                <div className="mt-3 space-y-2">
                  {inspectResult.search.fusedCandidates.slice(0, 5).map((candidate) => (
                    <div key={candidate.id} className="rounded-2xl bg-slate-50 px-3 py-3">
                      <p className="text-sm font-semibold text-slate-900">{candidate.docTitle}</p>
                      <p className="mt-1 text-sm text-slate-600">점수 {candidate.rerankScore.toFixed(2)}</p>
                      <p className="mt-1 text-xs text-slate-500">{candidate.sectionPath.join(' > ')}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">선택된 근거</p>
                <div className="mt-3 space-y-2">
                  {inspectResult.search.evidence.length > 0 ? (
                    inspectResult.search.evidence.map((candidate) => (
                      <div key={candidate.id} className="rounded-2xl bg-slate-50 px-3 py-3">
                        <p className="text-sm font-semibold text-slate-900">{candidate.docTitle}</p>
                        <p className="mt-1 text-sm text-slate-600">점수 {candidate.rerankScore.toFixed(2)}</p>
                        <p className="mt-1 text-xs text-slate-500">{candidate.sectionPath.join(' > ')}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-500">선택된 근거가 없습니다.</div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">검증 상태</p>
                <p className="mt-1 text-sm text-slate-600">
                  claim coverage {inspectResult.claimCoverage.supportedClaims}/{inspectResult.claimCoverage.totalClaims}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {inspectResult.usedPromotedConcepts.map((label) => (
                    <span key={`promoted-${label}`} className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
                      promoted {label}
                    </span>
                  ))}
                  {inspectResult.usedValidatedConcepts.map((label) => (
                    <span key={`validated-${label}`} className="rounded-full bg-sky-50 px-3 py-1 text-xs text-sky-700">
                      validated {label}
                    </span>
                  ))}
                </div>
                <div className="mt-3 space-y-2">
                  {inspectResult.validationIssues.length > 0 ? (
                    inspectResult.validationIssues.map((issue) => (
                      <div key={`${issue.code}-${issue.message}`} className="rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
                        {issue.severity} / {issue.code}: {issue.message}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-500">검증 경고가 없습니다.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Database className="h-4 w-4 text-sky-600" />
          온톨로지 후보 검토
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
          <span className="rounded-full bg-white px-3 py-1">대기 {ontologyStatusCounts.candidate}</span>
          <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-700">validated {ontologyStatusCounts.validated}</span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">promoted {ontologyStatusCounts.promoted}</span>
          <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">rejected {ontologyStatusCounts.rejected}</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busyAction !== null || visibleOntologyConcepts.length === 0}
            onClick={() => void handleOntologyBulkReview('visible', 'promoted')}
            className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-200 disabled:opacity-60"
          >
            표시 12개 승인
          </button>
          <button
            type="button"
            disabled={busyAction !== null || visibleOntologyConcepts.length === 0}
            onClick={() => void handleOntologyBulkReview('visible', 'rejected')}
            className="rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-200 disabled:opacity-60"
          >
            표시 12개 제외
          </button>
          <button
            type="button"
            disabled={busyAction !== null || recommendedOntologyConcepts.length === 0}
            onClick={() => void handleApplyOntologyRecommendations('all')}
            className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60"
          >
            추천 전체 적용
          </button>
          <button
            type="button"
            disabled={busyAction !== null || rejectedRecommendationConcepts.length === 0}
            onClick={() => void handleApplyOntologyRecommendations('reject')}
            className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
          >
            잡음 전체 제외
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {visibleOntologyConcepts.map((concept) => (
            <div key={`${concept.source}-${concept.label}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {concept.label} <span className="text-slate-400">({concept.source}/{concept.status})</span>
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    entity {concept.entityType || 'concept'}, relation {concept.relationCount}, confidence{' '}
                    {typeof concept.confidence === 'number' ? concept.confidence.toFixed(2) : 'n/a'}
                  </p>
                  <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">추천: {concept.recommendedStatus}</span>
                    <span className="ml-2">{concept.recommendationReason}</span>
                  </div>
                  {concept.evidence.length > 0 && (
                    <div className="mt-2 text-xs text-slate-500">
                      근거: {concept.evidence[0].label} ({concept.evidence[0].reason})
                    </div>
                  )}
                  {concept.aliases.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {concept.aliases.slice(0, 4).map((alias) => (
                        <span key={alias} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                          {alias}
                        </span>
                      ))}
                    </div>
                  )}
                  {concept.slotHints.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {concept.slotHints.map((slotHint) => (
                        <span key={slotHint} className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
                          {slotHint}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => void handleOntologyReview(concept.source, concept.label, 'validated')}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-200 disabled:opacity-60"
                  >
                    validated
                  </button>
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => void handleOntologyReview(concept.source, concept.label, 'promoted')}
                    className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-200 disabled:opacity-60"
                  >
                    promoted
                  </button>
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => void handleOntologyReview(concept.source, concept.label, 'rejected')}
                    className="rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-200 disabled:opacity-60"
                  >
                    rejected
                  </button>
                </div>
              </div>
            </div>
          ))}

          {!ontologyReview || ontologyReview.concepts.length === 0 ? (
            <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-500">검토할 온톨로지 후보가 없습니다.</div>
          ) : null}
        </div>
      </section>
    </section>
  );
}
