import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { formatAnswerAsMarkdown } from './answerMarkdown';
import { formatMarkdownAnswer, generateGroundedAnswer } from './answerGeneration';
import {
  buildAdminOntologyReview,
  buildAdminProfilesResponse,
  buildAndPersistAdminReindex,
  listEvalTrialReports,
  loadBenchmarkCases,
  rememberEvalTrialReport,
  updateAdminProfileState,
  updateOntologyConceptReviewBatchManifest,
  updateOntologyConceptReviewManifest,
} from './adminOperations';
import { buildRetrievalDiagnostics, createEmptyCacheHitSummary, createEmptyLatencyBreakdown } from './ragDiagnosticsInternal';
import { Pool, type PoolClient } from 'pg';
import {
  buildRagCorpusIndex,
  deriveFocusTerms,
  diversifyVisibleCandidates,
  getCandidateFocusMatches,
  isGenericQueryTerm,
  searchCorpus,
  type RagCorpusIndex,
  type SearchOptions,
} from './ragEngine';
import { LawMcpClient, type LawMcpFallbackResult } from './lawMcpClient';
import {
  buildDocumentDiagnostics,
  buildKnowledgeDoctorIssues,
  buildKnowledgeManifest,
  compareIndexStatus,
} from './ragIndex';
import {
  buildBrainDocumentBoosts,
  buildBrainQueryProfile,
  buildDriftSubquestions,
  buildWorkflowBriefs,
  detectServiceScopeClarification,
  loadDomainBrain,
  selectWorkflowBriefs,
  summarizeWorkflowEvents,
  type DomainBrain,
  type ServiceScopeClarification,
  type WorkflowBrief,
} from './brain';
import {
  buildBasisCoverage,
  buildExpertKnowledgeContext,
  createExpertAbstainAnswer,
  createExpertClarificationAnswer,
  detectClarificationNeed,
  generateAnswerPlan,
  suppressSelectedServiceScopeClarification,
  synthesizeExpertAnswer,
} from './expertAnswering';
import {
  classifyPriorityBucket,
  inferRetrievalPriorityClass,
  INTENT_PRIORITY_MATRIX,
  isEvaluationLinkedWorkflowQuery,
  RETRIEVAL_PRIORITY_POLICY_NAME,
} from './retrievalPriority';
import {
  compareIsoDateDesc,
  normalizeDocumentTitle,
  sha1,
  toDocumentMetadata,
} from './ragMetadata';
import {
  applyPiiMasking,
  buildCitationWarning,
  buildHallucinationSignal,
  detectPromptInjectionSignals,
} from './ragGuardrails';
import {
  buildNaturalLanguageQueryProfile as buildNaturalQueryProfile,
  enrichQueryProfileWithServiceScopeLabels,
} from './ragNaturalQuery';
import { loadKnowledgeCorporaFromDisk } from './nodeKnowledge';
import {
  buildOntologyGraph,
  buildOntologyRows,
  expandDocumentsWithOntology,
  loadCuratedOntologyManifest,
  loadGeneratedOntologyManifest,
  writeCuratedOntologyManifest,
  writeGeneratedOntologyManifest,
  type OntologyGraph,
  type OntologySearchResult,
} from './ragOntology';
import {
  buildClaimPlan,
  evaluateRetrievalValidation,
  validateAnswerEnvelope,
} from './ragSemanticValidation';
import {
  applyRetrievalFeatureOverrides,
  getRetrievalFeatureFlags,
  getRetrievalProfile,
  listRetrievalProfiles,
  resolveInitialRetrievalProfileId,
} from './ragProfiles';
import { loadPromptSourceSet } from './nodePrompts';
import type { PromptVariant } from './promptAssembly';
import { RuntimeRagCache } from './ragRuntimeCache';
import { resolveEmbeddingApiKey, resolveGenerationMode, resolveServerGenerationApiKey } from './ragRuntime';
import {
  describeError,
  EMBEDDING_BATCH_SIZE,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MAX_CHUNKS_PER_PASS,
  EMBEDDING_MODEL,
  EMBEDDING_REFRESH_INTERVAL_MS,
  embedQuery,
  getNextEmbeddingRetryAt,
  isQuotaExceededError,
  markEmbeddingQuotaExceeded,
  prepareEmbedding,
  shouldSkipEmbeddingWork,
} from './embeddingService';
import {
  buildIndexMetadataRow,
  ensurePostgresSchema,
  manifestEntriesToKnowledgeStats,
  MemoryRagStore,
  parseStringArray,
  PostgresRagStore,
  type DiskKnowledgeState,
  type RagStore,
  type StoredLawFallbackRow,
} from './ragStore';
import { buildCompiledPages, buildStructuredChunks, buildStructuredSections, chunksToEvidenceContext } from './ragStructured';
import {
  applySectionRoutingBoost,
  applyGroundingGate,
  applyOriginalFocusGate,
  buildDocumentRepresentativeMap,
  documentPathsFromIds,
  injectEvidenceCandidates,
  mergeDocumentScoreBoostMaps,
  summarizeSectionRouting,
  uniqueDocumentCandidates,
  uniqueDocumentPaths,
  type RetrievalScopeContext,
} from './retrievalPipeline';

export { buildIndexMetadataRow };
export { prepareEmbedding };
export {
  buildChunkRows,
  buildCompiledRows,
  buildDocumentRows,
  buildDocumentVersionRows,
  buildIndexManifestEntriesFromRows,
  buildSectionRows,
  embedIndexRows,
  loadKnowledgeFilesForIndex,
  loadBenchmarkCases,
  upsertRowsToPostgres,
} from './adminOperations';
import type {
  AdminHealthResponse,
  AdminProfilesResponse,
  AdminReindexResponse,
  BackendReadiness,
  BackendReadinessItem,
  CacheHitSummary,
  BenchmarkCase,
  BasisBucketKey,
  CandidateDiagnostic,
  ClaimPlanItem,
  ClaimCoverage,
  ExpertAnswerEnvelope,
  ChatCapabilities,
  ChatMessage,
  ChunkWindowRef,
  CompiledPage,
  ConfidenceLevel,
  DocumentDiagnostics,
  EvalTrialCaseResult,
  EvalTrialReport,
  EvalTrialSummary,
  GenerationMode,
  GuardrailResult,
  GraphExpansionTrace,
  GroundedAnswer,
  IndexManifestEntry,
  IndexStatus,
  KnowledgeFile,
  KnowledgeDoctorIssue,
  LawAliasResolution,
  LawFallbackSource,
  NaturalLanguageQueryProfile,
  OntologyHit,
  PromptMode,
  QueryIntent,
  RetrievalPriorityClass,
  RetrievalFeatureFlags,
  RetrievalMode,
  RetrievalDiagnostics,
  RetrievalProfile,
  RetrievalReadiness,
  RecentRetrievalMatch,
  SearchCandidate,
  SearchRun,
  ValidationIssue,
  SectionRoutingDecision,
  StageLatencyBreakdown,
  SourceRole,
  StructuredChunk,
  ServiceScopeId,
  WorkerQueueStatus,
} from './ragTypes';
import { CHAT_MODELS } from './chatModels';
import {
  buildServiceScopeChunkBoosts,
  buildServiceScopePromptContext,
  chunkMatchesSelectedServiceScopes,
  getServiceScopeLabels,
  getServiceScopeSearchAliases,
  isChunkCompatibleWithServiceScopes,
  parseServiceScopes,
} from './serviceScopes';

interface GroundedChatRequest {
  messages: ChatMessage[];
  mode: PromptMode;
  model: string;
  promptVariant: PromptVariant;
  apiKey?: string;
  serviceScopes?: ServiceScopeId[];
  retrievalProfileId?: string;
}

export interface GroundedChatResponse {
  answer: ExpertAnswerEnvelope;
  text: string;
  search: SearchRun;
  citations: StructuredChunk[];
  retrieval: RetrievalDiagnostics;
}

export interface RetrievalInspectionResponse {
  query: string;
  normalizedQuery: string;
  querySources: string[];
  profile: RetrievalProfile;
  retrievalPriorityClass: RetrievalDiagnostics['retrievalPriorityClass'];
  priorityPolicyName: RetrievalDiagnostics['priorityPolicyName'];
  selectedServiceScopes: RetrievalDiagnostics['selectedServiceScopes'];
  serviceScopeLabels: RetrievalDiagnostics['serviceScopeLabels'];
  search: SearchRun;
  compiledPages: CompiledPage[];
  indexStatus: IndexStatus;
  candidateDiagnostics: CandidateDiagnostic[];
  matchedDocumentPaths: string[];
  retrievalReadiness: RetrievalReadiness;
  hybridReadinessReason: RetrievalDiagnostics['hybridReadinessReason'];
  evidenceBalance: RetrievalDiagnostics['evidenceBalance'];
  agentDecision: RetrievalDiagnostics['agentDecision'];
  stageTrace: SearchRun['stageTrace'];
  neighborWindows: ChunkWindowRef[];
  rejectionReasons: RetrievalDiagnostics['rejectionReasons'];
  routingDocuments: string[];
  primaryExpansionDocuments: string[];
  finalEvidenceDocuments: string[];
  selectedRetrievalMode: RetrievalDiagnostics['selectedRetrievalMode'];
  workflowEventsHit: RetrievalDiagnostics['workflowEventsHit'];
  subquestions: RetrievalDiagnostics['subquestions'];
  basisCoverage: RetrievalDiagnostics['basisCoverage'];
  plannerTrace: RetrievalDiagnostics['plannerTrace'];
  normalizationTrace: RetrievalDiagnostics['normalizationTrace'];
  aliasResolutions: RetrievalDiagnostics['aliasResolutions'];
  parsedLawRefs: RetrievalDiagnostics['parsedLawRefs'];
  semanticFrame: RetrievalDiagnostics['semanticFrame'];
  assumptions: RetrievalDiagnostics['assumptions'];
  ontologyHits: RetrievalDiagnostics['ontologyHits'];
  usedPromotedConcepts: RetrievalDiagnostics['usedPromotedConcepts'];
  usedValidatedConcepts: RetrievalDiagnostics['usedValidatedConcepts'];
  graphExpansionTrace: RetrievalDiagnostics['graphExpansionTrace'];
  validationIssues: RetrievalDiagnostics['validationIssues'];
  claimCoverage: RetrievalDiagnostics['claimCoverage'];
  fallbackTriggered: RetrievalDiagnostics['fallbackTriggered'];
  fallbackSources: RetrievalDiagnostics['fallbackSources'];
  guardrails: RetrievalDiagnostics['guardrails'];
  latency: RetrievalDiagnostics['latency'];
  sectionRouting: RetrievalDiagnostics['sectionRouting'];
  cacheHits: RetrievalDiagnostics['cacheHits'];
}

export interface AdminOntologyConceptRecord {
  source: 'generated' | 'curated';
  label: string;
  entityType?: string;
  status: string;
  confidence?: number;
  aliases: string[];
  slotHints: string[];
  relationCount: number;
  statusReason?: string;
  recommendedStatus: 'candidate' | 'validated' | 'promoted' | 'rejected';
  recommendationReason: string;
  evidence: Array<{
    label: string;
    path: string;
    reason: string;
  }>;
}

export interface AdminOntologyReviewResponse {
  concepts: AdminOntologyConceptRecord[];
  updatedAt: string;
}

function createBackendReadinessItem(
  name: BackendReadinessItem['name'],
  partial?: Partial<BackendReadinessItem>,
): BackendReadinessItem {
  return {
    name,
    status: partial?.status ?? 'disabled',
    enabled: partial?.enabled ?? false,
    detail: partial?.detail ?? 'Not configured.',
    checkedAt: partial?.checkedAt,
    latencyMs: partial?.latencyMs,
    backlog: partial?.backlog,
  };
}

function createDefaultBackendReadiness(): BackendReadiness {
  return {
    pgvector: createBackendReadinessItem('pgvector', { detail: 'Waiting for store initialization.' }),
    elasticsearch: createBackendReadinessItem('elasticsearch'),
    redis: createBackendReadinessItem('redis'),
    parser: createBackendReadinessItem('parser'),
    reranker: createBackendReadinessItem('reranker'),
    queue: createBackendReadinessItem('queue', { status: 'ready', enabled: true, detail: 'In-process worker queue is idle.' }),
  };
}

function cloneWorkerQueueStatus(queue: WorkerQueueStatus): WorkerQueueStatus {
  return {
    pending: queue.pending,
    running: queue.running,
    lastStartedAt: queue.lastStartedAt,
    lastCompletedAt: queue.lastCompletedAt,
    lastError: queue.lastError,
  };
}

function buildScopedCacheKey(parts: Array<string | number | undefined>): string {
  return sha1(parts.filter((part) => part !== undefined && String(part).trim()).map((part) => String(part)).join('|'));
}

function buildPseudoHydeText(params: {
  normalizedQuery: string;
  profile: RetrievalProfile;
  queryProfile: NaturalLanguageQueryProfile;
  serviceScopeLabels: string[];
  workflowEvents: string[];
}): string {
  if (!params.profile.queryProcessing.hyde) return '';

  const hints = uniqueNonEmptyLines([
    ...params.queryProfile.searchVariants,
    ...params.queryProfile.aliasResolutions.map((item) => item.canonical),
    ...params.workflowEvents,
    ...params.serviceScopeLabels,
  ]).slice(0, 8);

  if (hints.length === 0) return '';

  return [
    `가상의 정답 문서 요약: ${params.normalizedQuery}`,
    `질의 유형: ${params.queryProfile.queryType}`,
    `핵심 힌트: ${hints.join(', ')}`,
  ].join('\n');
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const POSTGRES_VECTOR_TOP_K = 36;
const LAW_FALLBACK_CONFIDENCE_THRESHOLD = (process.env.LAW_FALLBACK_CONFIDENCE_THRESHOLD || 'low').toLowerCase();
const LAW_MCP_ENABLED = (process.env.LAW_MCP_ENABLED || 'true').toLowerCase() !== 'false';
const LAW_MCP_BASE_URL = process.env.LAW_MCP_BASE_URL || '';
const ONTOLOGY_GRAPH_DEPTH = Math.max(1, parsePositiveInteger(process.env.ONTOLOGY_GRAPH_DEPTH, 1));
const MAX_CONTEXT_CHARS_BY_MODE: Record<PromptMode, number> = {
  integrated: 16_000,
  evaluation: 12_000,
};
const EMBEDDING_CACHE_FILE = 'embeddings.json';
const NORMALIZATION_CACHE_TTL_MS = parsePositiveInteger(process.env.RAG_NORMALIZATION_CACHE_TTL_MS, 10 * 60 * 1000);
const HYDE_CACHE_TTL_MS = parsePositiveInteger(process.env.RAG_HYDE_CACHE_TTL_MS, 30 * 60 * 1000);
const RETRIEVAL_CACHE_TTL_MS = parsePositiveInteger(process.env.RAG_RETRIEVAL_CACHE_TTL_MS, 10 * 60 * 1000);
const ANSWER_CACHE_TTL_MS = parsePositiveInteger(process.env.RAG_ANSWER_CACHE_TTL_MS, 5 * 60 * 1000);
const FALLBACK_CACHE_TTL_MS = parsePositiveInteger(process.env.RAG_FALLBACK_CACHE_TTL_MS, 60 * 60 * 1000);
const BACKEND_HEALTH_TIMEOUT_MS = parsePositiveInteger(process.env.RAG_BACKEND_HEALTH_TIMEOUT_MS, 2_000);

function buildLawFallbackPath(cacheKey: string): string {
  return `/external/korean-law-mcp/${sha1(cacheKey).slice(0, 16)}.md`;
}

function fallbackRowToChunk(row: StoredLawFallbackRow): StructuredChunk {
  const path = row.path || buildLawFallbackPath(row.cache_key);
  const title = row.title || 'Korean Law MCP fallback';
  const parentSectionId = sha1(`${row.cache_key}:${title}`);
  return {
    id: row.id,
    documentId: `fallback:${row.cache_key}`,
    chunkIndex: 0,
    title,
    text: row.text,
    textPreview: row.text.slice(0, 220),
    searchText: `${title}\n${row.query}\n${row.text}`,
    mode: 'integrated',
    sourceType: 'law',
    sourceRole: 'support_reference',
    documentGroup: 'legal',
    docTitle: title,
    fileName: `${title}.md`,
    path,
    sectionPath: [title],
    articleNo: row.article_no ?? undefined,
    matchedLabels: [row.source],
    chunkHash: sha1(`${row.cache_key}:${row.text}`),
    parentSectionId,
    parentSectionTitle: title,
    windowIndex: 0,
    spanStart: 0,
    spanEnd: row.text.length,
    citationGroupId: sha1(`${row.cache_key}:${title}`),
    linkedDocumentTitles: [],
  };
}

function fallbackResultToChunk(result: LawMcpFallbackResult, mode: PromptMode, articleNo?: string): StructuredChunk {
  const chunk = fallbackRowToChunk({
    id: sha1(result.cacheKey),
    cache_key: result.cacheKey,
    title: result.title,
    query: result.query,
    text: result.text,
    source: result.source,
    path: buildLawFallbackPath(result.cacheKey),
    article_no: articleNo ?? null,
  });
  return {
    ...chunk,
    mode,
  };
}

function compareConfidence(left: ConfidenceLevel, right: ConfidenceLevel): number {
  const rank: Record<ConfidenceLevel, number> = { low: 0, medium: 1, high: 2 };
  return rank[left] - rank[right];
}

function shouldTriggerFallbackForConfidence(confidence: ConfidenceLevel): boolean {
  const normalizedThreshold =
    LAW_FALLBACK_CONFIDENCE_THRESHOLD === 'high' ||
    LAW_FALLBACK_CONFIDENCE_THRESHOLD === 'medium' ||
    LAW_FALLBACK_CONFIDENCE_THRESHOLD === 'low'
      ? (LAW_FALLBACK_CONFIDENCE_THRESHOLD as ConfidenceLevel)
      : 'low';
  return compareConfidence(confidence, normalizedThreshold) <= 0;
}

function dedupeCitations(chunks: StructuredChunk[]): StructuredChunk[] {
  const seen = new Set<string>();
  const result: StructuredChunk[] = [];
  for (const chunk of chunks) {
    const key = chunk.citationGroupId;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(chunk);
  }
  return result.sort((left, right) => compareIsoDateDesc(left.effectiveDate, right.effectiveDate));
}

const FOLLOW_UP_QUERY_RE = /^(그럼|그러면|이 경우|위 내용|위에|그 내용|그거|이거|그건|이건|같은 경우|이 상황|그 상황)/;

function isFollowUpQuery(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;
  return trimmed.length <= 18 || FOLLOW_UP_QUERY_RE.test(trimmed);
}

function buildRetrievalAliases(query: string): string[] {
  const compact = query.replace(/\s+/g, '');
  const aliases: string[] = [];
  const recipientOnboardingContextTerms = ['입소', '신규', '초기', '계약초기', '시작일', '오면', '왔을때', '처음'];
  const recipientOnboardingChecklistTerms = ['해야할', '해야하는', '해야되는', '할일', '무엇', '뭐', '업무', '절차'];
  const employeeEducation = compact.includes('직원') && compact.includes('교육');
  const employeeRights = compact.includes('직원') && compact.includes('인권');
  const employeeAbuse = compact.includes('직원') && compact.includes('침해');
  const employeeRightsAbuse = employeeRights && employeeAbuse;
  const recipientContext = compact.includes('수급자') || compact.includes('보호자');
  const onboardingContext =
    recipientOnboardingContextTerms.some((term) => compact.includes(term));
  const recipientEducation =
    recipientContext &&
    onboardingContext &&
    (compact.includes('교육') || compact.includes('설명') || compact.includes('안내'));
  const recipientChecklist =
    recipientContext &&
    onboardingContext &&
    recipientOnboardingChecklistTerms.some((term) => compact.includes(term));

  const add = (...items: string[]) => {
    for (const item of items) {
      const compactItem = item.replace(/\s+/g, '');
      if (!compactItem || compact.includes(compactItem) || aliases.includes(item)) continue;
      aliases.push(item);
    }
  };

  if (employeeEducation && !employeeRightsAbuse) {
    add('직원교육');
  }

  if (employeeRights) {
    add('직원인권보호');
  }

  if (employeeRightsAbuse) {
    add('직원인권침해대응지침');
    add('급여제공지침');
  }

  if (compact.includes('인권') && compact.includes('교육') && !employeeRightsAbuse) {
    add('인권보호지침');
  }

  if (compact.includes('지표') || compact.includes('판단기준') || compact.includes('확인방법') || compact.includes('충족')) {
    add('평가 지표', '판단 기준', '확인 방법', '충족 미충족 기준');
  }

  if (recipientEducation || recipientChecklist) {
    add(
      '신규수급자',
      '수급자 입소 초기 해야 할 일',
      '신규 수급자 초기 업무',
      '급여제공 시작일부터 14일 이내',
      '수급자(보호자) 8가지 지침 설명',
      '모든 수급자(보호자)에게 8가지 지침',
      '욕창예방 낙상예방 탈수예방 배변도움 관절구축예방 치매예방 감염예방 노인인권보호',
    );
  }

  if (recipientChecklist) {
    add(
      '기피식품 파악',
      '급여제공 시작일까지 기피식품 파악',
      '급여제공계획 설명 확인서명 공단통보',
      '신규 급여제공계획 설명 확인서명 공단통보',
    );
  }

  return aliases;
}

function buildNormalizedRetrievalQuery(messages: ChatMessage[]): {
  normalizedQuery: string;
  querySources: string[];
  aliases: string[];
  queryProfile: NaturalLanguageQueryProfile;
} {
  const userMessages = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.text.trim())
    .filter(Boolean);
  const latest = userMessages[userMessages.length - 1] ?? '';
  const previous = userMessages[userMessages.length - 2];
  const combinedQuery = previous && isFollowUpQuery(latest) ? `${previous}\n후속질문: ${latest}` : latest;
  const queryProfile = buildNaturalQueryProfile(combinedQuery);
  const aliases = uniqueNonEmptyLines([
    ...buildRetrievalAliases(combinedQuery),
    ...queryProfile.searchVariants.filter((variant) => variant !== queryProfile.normalizedQuery),
    ...queryProfile.semanticFrame.canonicalTerms,
    ...queryProfile.semanticFrame.entityRefs.map((entity) => entity.canonical),
    ...queryProfile.semanticFrame.relationRequests.flatMap((request) => [request.relation, request.reason]),
    ...Object.values(queryProfile.semanticFrame.slots).flatMap((values) =>
      (values ?? []).flatMap((value) => [value.canonical, value.value]),
    ),
    ...queryProfile.aliasResolutions.flatMap((item) => [item.canonical, ...item.alternatives]),
    ...queryProfile.parsedLawRefs.flatMap((item) => [
      item.canonicalLawName,
      item.article ? `${item.canonicalLawName} ${item.article}` : '',
    ]),
  ]);
  const querySources = latest
    ? uniqueNonEmptyLines([
        ...(previous && isFollowUpQuery(latest) ? [previous, latest] : [latest]),
        ...queryProfile.searchVariants,
        ...queryProfile.semanticFrame.canonicalTerms,
      ])
    : [];

  return {
    normalizedQuery: queryProfile.normalizedQuery,
    querySources,
    aliases,
    queryProfile,
  };
}

interface SearchExecutionResult {
  search: SearchRun;
  scope: RetrievalScopeContext;
  ontologyHits: OntologyHit[];
  graphExpansionTrace: GraphExpansionTrace[];
  sectionRouting: SectionRoutingDecision;
}

interface SearchPlanningOptions {
  profile?: RetrievalProfile;
  additionalDocumentScoreBoosts?: Map<string, number>;
  additionalChunkScoreBoosts?: Map<string, number>;
  extraAliases?: string[];
  queryProfile?: NaturalLanguageQueryProfile;
  retrievalPriorityClass?: RetrievalPriorityClass;
  priorityPolicyName?: string;
  evaluationLinked?: boolean;
  selectedServiceScopes?: ServiceScopeId[];
}

interface RetrievalPlanResult {
  normalizedQuery: string;
  querySources: string[];
  profile: RetrievalProfile;
  retrievalPriorityClass: RetrievalPriorityClass;
  priorityPolicyName: string;
  selectedServiceScopes: ServiceScopeId[];
  serviceScopeLabels: string[];
  aliases: string[];
  queryProfile: NaturalLanguageQueryProfile;
  questionArchetype: string;
  recommendedAnswerType: ExpertAnswerEnvelope['answerType'];
  selectedRetrievalMode: RetrievalMode;
  workflowEventIds: string[];
  workflowEventsHit: string[];
  subquestions: string[];
  plannerTrace: Array<{ step: string; detail: string }>;
  search: SearchRun;
  scope: RetrievalScopeContext;
  evidence: SearchRun['evidence'];
  claimCoverage: ClaimCoverage;
  validationIssues: ValidationIssue[];
  workflowBriefs: WorkflowBrief[];
  knowledgeContext: string;
  basisCoverage: Record<'legal' | 'evaluation' | 'practical', number>;
  ontologyHits: OntologyHit[];
  graphExpansionTrace: GraphExpansionTrace[];
  fallbackTriggered: boolean;
  fallbackSources: LawFallbackSource[];
  cacheHits: CacheHitSummary;
  sectionRouting: SectionRoutingDecision;
  latency: StageLatencyBreakdown;
}

function uniqueNonEmptyLines(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function buildTitleToDocumentIdsMap(chunks: StructuredChunk[]): Map<string, Set<string>> {
  const representatives = buildDocumentRepresentativeMap(chunks);
  const lookup = new Map<string, Set<string>>();

  const add = (title: string, documentId: string) => {
    const key = normalizeDocumentTitle(title);
    if (!key) return;
    const ids = lookup.get(key) ?? new Set<string>();
    ids.add(documentId);
    lookup.set(key, ids);
  };

  for (const chunk of representatives.values()) {
    add(chunk.docTitle, chunk.documentId);
    add(chunk.fileName, chunk.documentId);
    add(chunk.path, chunk.documentId);
  }

  return lookup;
}

function isRecipientOnboardingQuery(query: string): boolean {
  const compact = query.replace(/\s+/g, '');
  const recipientOnboardingContextTerms = ['입소', '신규', '초기', '계약초기', '시작일', '오면', '왔을때', '처음'];
  const recipientOnboardingChecklistTerms = ['해야할', '해야하는', '해야되는', '할일', '무엇', '뭐', '교육', '설명', '안내', '업무', '절차'];
  const recipientContext = compact.includes('수급자') || compact.includes('보호자');
  const onboardingContext = recipientOnboardingContextTerms.some((term) => compact.includes(term));
  const checklistContext = recipientOnboardingChecklistTerms.some((term) => compact.includes(term));

  return recipientContext && onboardingContext && checklistContext;
}

function buildOperationalDocumentBoosts(chunks: StructuredChunk[], query: string): Map<string, number> {
  if (!isRecipientOnboardingQuery(query)) {
    return new Map<string, number>();
  }

  const facets: Array<{ id: string; terms: string[]; weight: number }> = [
    {
      id: 'contract',
      terms: ['장기요양급여제공계약', '계약서', '장기요양급여개시전', '본인여부', '장기요양등급', '개인별장기요양이용계획서', '제16조'],
      weight: 18,
    },
    {
      id: 'care-plan',
      terms: ['장기요양급여제공계획서', '급여제공계획', '제공을시작하기전에', '확인서명', '공단에통보', '제13조', '제21조의2'],
      weight: 18,
    },
    {
      id: 'assessment',
      terms: ['욕구사정', '낙상평가', '낙상위험도', '욕창평가', '욕창위험도', '인지기능평가', '급여제공시작일까지', '신규수급자'],
      weight: 18,
    },
    {
      id: 'food-preference',
      terms: ['기피식품', '기피식품파악', '영양상태', '식사제공유의사항', '섭취하기어려운식재료'],
      weight: 14,
    },
    {
      id: 'guidance',
      terms: ['8가지지침', '욕창예방', '낙상예방', '탈수예방', '배변도움', '관절구축예방', '치매예방', '감염예방', '노인인권보호'],
      weight: 8,
    },
  ];
  const scoreByDocument = new Map<string, number>();
  const matchedFacetsByDocument = new Map<string, Set<string>>();

  for (const chunk of chunks) {
    if (chunk.sourceRole === 'routing_summary') continue;

    const compactSearchText = chunk.searchText.replace(/\s+/g, '');
    const compactTitle = chunk.docTitle.replace(/\s+/g, '');
    const titleBonus =
      compactTitle.includes('평가매뉴얼') || compactTitle.includes('업무의이해')
        ? 8
        : 0;
    const matchedFacets = matchedFacetsByDocument.get(chunk.documentId) ?? new Set<string>();

    for (const facet of facets) {
      if (facet.terms.some((term) => compactSearchText.includes(term) || compactTitle.includes(term))) {
        matchedFacets.add(facet.id);
      }
    }

    matchedFacetsByDocument.set(chunk.documentId, matchedFacets);
    if (titleBonus > 0) {
      scoreByDocument.set(chunk.documentId, Math.max(scoreByDocument.get(chunk.documentId) ?? 0, titleBonus));
    }
  }

  const rankedDocuments = Array.from(matchedFacetsByDocument.entries())
    .map(([documentId, matchedFacets]) => {
      const facetIds = Array.from(matchedFacets);
      return {
        documentId,
        facetIds,
        score:
          (scoreByDocument.get(documentId) ?? 0) +
          facetIds.length * 10 +
          facetIds.reduce((sum, facetId) => sum + (facets.find((item) => item.id === facetId)?.weight ?? 0), 0),
      };
    })
    .filter((entry) => entry.score >= 22 && (entry.facetIds.length >= 2 || !entry.facetIds.includes('guidance')))
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);

  return new Map(rankedDocuments.map((entry) => [entry.documentId, entry.score]));
}

function resolveRoutingExpansionDocumentIds(
  routingCandidates: SearchCandidate[],
  allChunks: StructuredChunk[],
): Set<string> {
  const titleMap = buildTitleToDocumentIdsMap(allChunks);
  const representatives = buildDocumentRepresentativeMap(allChunks);
  const expandedIds = new Set<string>();

  for (const candidate of routingCandidates) {
    for (const linkedTitle of candidate.linkedDocumentTitles) {
      const ids = titleMap.get(normalizeDocumentTitle(linkedTitle));
      if (!ids) continue;

      for (const documentId of ids) {
        const doc = representatives.get(documentId);
        if (!doc || doc.sourceRole === 'routing_summary') continue;
        expandedIds.add(documentId);
      }
    }
  }

  return expandedIds;
}

const RECIPIENT_ONBOARDING_SUPPORT_ANCHORS = [
  '신규수급자',
  '8가지',
  '욕창예방',
  '낙상예방',
  '탈수예방',
  '배변도움',
  '관절구축예방',
  '치매예방',
  '감염예방',
  '노인인권보호',
  '기피식품',
  '급여제공계획',
  '확인서명',
  '공단통보',
] as const;

function hasRecipientOnboardingSupportAnchor(candidate: SearchCandidate): boolean {
  const compactText = [candidate.docTitle, candidate.parentSectionTitle, candidate.searchText]
    .filter(Boolean)
    .join('\n')
    .replace(/\s+/g, '');
  return RECIPIENT_ONBOARDING_SUPPORT_ANCHORS.some((anchor) => compactText.includes(anchor));
}

function selectDirectSupportReferenceIds(search: SearchRun): Set<string> {
  const selected = new Set<string>();
  const focusTerms = search.focusTerms ?? deriveFocusTerms(search.query);
  const recipientOnboardingQuery = isRecipientOnboardingQuery(search.query);

  for (const candidate of search.fusedCandidates) {
    if (candidate.sourceRole !== 'support_reference' || candidate.mode !== 'integrated') continue;

    const focusMatches = getCandidateFocusMatches(candidate, focusTerms);
    if (recipientOnboardingQuery && !hasRecipientOnboardingSupportAnchor(candidate)) continue;

    const hasConcreteSignal = focusMatches.length > 0 || candidate.exactScore >= 18 || candidate.lexicalScore > 0.12;
    const strongEnough = candidate.rerankScore >= 22 || focusMatches.length > 0;
    if (!hasConcreteSignal || !strongEnough) continue;

    selected.add(candidate.documentId);
    if (selected.size >= 4) break;
  }

  return selected;
}

function pruneIrrelevantSupportEvidence(search: SearchRun): SearchRun {
  const focusTerms = search.focusTerms ?? deriveFocusTerms(search.query);
  if (focusTerms.length === 0) return search;
  const queryRequestsEvaluationReference = /(q\s*&\s*a|q&a|qa|질문|답변|문의|사례|비교|후기)/i.test(search.query);
  const recipientOnboardingQuery = isRecipientOnboardingQuery(search.query);

  const hasPriorityEvidence = search.evidence.some(
    (candidate) =>
      candidate.sourceRole === 'primary_evaluation' ||
      ['law', 'ordinance', 'rule', 'notice'].includes(candidate.sourceType),
  );
  if (!hasPriorityEvidence) return search;

  const filteredEvidence = search.evidence.filter((candidate) => {
    if (candidate.sourceRole !== 'support_reference') return true;
    if (candidate.mode === 'evaluation' && !queryRequestsEvaluationReference) return false;

    const focusMatches = getCandidateFocusMatches(candidate, focusTerms);
    if (recipientOnboardingQuery && !hasRecipientOnboardingSupportAnchor(candidate)) {
      return false;
    }

    const hasNonGenericFocusMatch = focusMatches.some((term) => !isGenericQueryTerm(term));
    return hasNonGenericFocusMatch;
  });

  return filteredEvidence.length > 0 ? { ...search, evidence: filteredEvidence } : search;
}

function mergeSearchCandidateLists(
  left: SearchCandidate[],
  right: SearchCandidate[],
  sortBy: 'exactScore' | 'lexicalScore' | 'vectorScore' | 'rerankScore',
  limit = 24,
): SearchCandidate[] {
  const merged = new Map<string, SearchCandidate>();
  for (const candidate of [...left, ...right]) {
    const current = merged.get(candidate.id);
    if (!current || current[sortBy] < candidate[sortBy]) {
      merged.set(candidate.id, candidate);
    }
  }
  const sorted = Array.from(merged.values())
    .sort((a, b) => b[sortBy] - a[sortBy])
    .slice(0, sortBy === 'rerankScore' ? limit * 2 : limit);

  return sortBy === 'rerankScore' ? diversifyVisibleCandidates(sorted, limit) : sorted;
}

function mergeSearchRuns(base: SearchRun, extra: SearchRun): SearchRun {
  const evidence = mergeSearchCandidateLists(base.evidence, extra.evidence, 'rerankScore', 12);
  const confidence =
    base.confidence === 'low' && extra.evidence.length > 0
      ? 'medium'
      : extra.confidence === 'high' && base.confidence !== 'high'
        ? 'high'
        : base.confidence;
  const mismatchSignals =
    extra.evidence.length > 0
      ? (base.mismatchSignals ?? []).filter((signal) => signal !== 'no-focus-terms-in-top-candidates' && signal !== 'generic-only-match')
      : base.mismatchSignals ?? [];

  return {
    ...base,
    confidence,
    exactCandidates: mergeSearchCandidateLists(base.exactCandidates, extra.exactCandidates, 'exactScore'),
    lexicalCandidates: mergeSearchCandidateLists(base.lexicalCandidates, extra.lexicalCandidates, 'lexicalScore'),
    vectorCandidates: mergeSearchCandidateLists(base.vectorCandidates, extra.vectorCandidates, 'vectorScore', 36),
    fusedCandidates: mergeSearchCandidateLists(base.fusedCandidates, extra.fusedCandidates, 'rerankScore'),
    evidence,
    focusTerms: uniqueNonEmptyLines([...(base.focusTerms ?? []), ...(extra.focusTerms ?? [])]),
    mismatchSignals,
    groundingGatePassed: confidence !== 'low',
    stageTrace: base.stageTrace,
  };
}

function isLegalTableOfContentsCandidate(candidate: SearchCandidate): boolean {
  if (!['law', 'ordinance', 'rule', 'notice'].includes(candidate.sourceType)) return false;
  const haystack = `${candidate.parentSectionTitle} ${candidate.textPreview}`;
  return candidate.articleNo === '제1조' && /제2조.+제3조.+제4조.+제5조/u.test(haystack);
}

function filterEvidenceByServiceScopes(
  evidence: SearchRun['evidence'],
  serviceScopes: readonly ServiceScopeId[],
): SearchRun['evidence'] {
  if (serviceScopes.every((scope) => scope === 'all')) return evidence;

  const filtered = evidence.filter((candidate) =>
    ['law', 'ordinance', 'rule', 'notice'].includes(candidate.sourceType) ||
    candidate.sourceRole === 'primary_evaluation' ||
    isChunkCompatibleWithServiceScopes(candidate, serviceScopes),
  );
  if (filtered.length === 0) return evidence;

  const selectedScopeEvidence = filtered.filter((candidate) =>
    chunkMatchesSelectedServiceScopes(candidate, serviceScopes),
  );
  if (selectedScopeEvidence.length < 3) return filtered;

  const legalSupportEvidence = filtered.filter(
    (candidate) => ['law', 'ordinance', 'rule', 'notice'].includes(candidate.sourceType) && !isLegalTableOfContentsCandidate(candidate),
  );
  const selectedIds = new Set(selectedScopeEvidence.map((candidate) => candidate.id));
  const primaryEvaluationEvidence = filtered.filter(
    (candidate) => candidate.sourceRole === 'primary_evaluation' && !selectedIds.has(candidate.id),
  );
  return [
    ...legalSupportEvidence.filter((candidate) => !selectedIds.has(candidate.id)).slice(0, 3),
    ...primaryEvaluationEvidence.slice(0, 6),
    ...selectedScopeEvidence,
  ].sort((left, right) => right.rerankScore - left.rerankScore);
}

function applyServiceScopeEvidenceGate(search: SearchRun, serviceScopes: readonly ServiceScopeId[]): SearchRun {
  const evidence = filterEvidenceByServiceScopes(search.evidence, serviceScopes);
  if (evidence.length === search.evidence.length) {
    return search;
  }

  return {
    ...search,
    evidence,
  };
}

function prioritizeConcreteFocusEvidence(search: SearchRun, focusSources: string[]): SearchRun {
  const focusTerms = uniqueNonEmptyLines(focusSources.flatMap((source) => deriveFocusTerms(source))).filter(
    (term) => !isGenericQueryTerm(term),
  );
  if (focusTerms.length === 0 || search.evidence.length < 4) return search;

  const concreteEvidence = search.evidence.filter((candidate) => {
    const focusMatches = getCandidateFocusMatches(candidate, focusTerms).filter((term) => !isGenericQueryTerm(term));
    return (
      focusMatches.length >= 1 &&
      (candidate.lexicalScore > 0 ||
        candidate.exactScore > 0 ||
        ['law', 'ordinance', 'rule', 'notice'].includes(candidate.sourceType))
    );
  });
  if (concreteEvidence.length < 3) return search;

  return {
    ...search,
    evidence: concreteEvidence.slice(0, search.evidence.length),
  };
}

function applyIntentEvidenceGate(
  evidence: SearchRun['evidence'],
  priorityClass: RetrievalPriorityClass,
): SearchRun['evidence'] {
  if (evidence.length < 3) return evidence;
  if (priorityClass === 'document_lookup') return evidence;

  if (priorityClass === 'evaluation_readiness') {
    const hasPrimaryManual = evidence.some(
      (candidate) =>
        candidate.sourceRole === 'primary_evaluation' &&
        candidate.path.includes('/knowledge/eval/') &&
        /평가매뉴얼/u.test(`${candidate.docTitle} ${candidate.fileName}`),
    );
    if (hasPrimaryManual) {
      return evidence.filter(
        (candidate) =>
          !(
            candidate.path.includes('/knowledge/evaluation/') &&
            candidate.sourceType === 'evaluation' &&
            /직원교육|직원인권보호/u.test(candidate.docTitle)
          ),
      );
    }
  }

  const bucketCounts = new Map<string, number>();
  for (const candidate of evidence.slice(0, 6)) {
    const bucket = classifyPriorityBucket(candidate);
    bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + 1);
  }

  const dominant = Array.from(bucketCounts.entries()).sort((left, right) => right[1] - left[1])[0];
  if (!dominant || dominant[1] < 2) return evidence;

  const dominantBucket = dominant[0];
  const prioritized = evidence.filter((candidate) => classifyPriorityBucket(candidate) === dominantBucket);
  const remainder = evidence.filter((candidate) => classifyPriorityBucket(candidate) !== dominantBucket);
  return [...prioritized, ...remainder];
}

function normalizeWorkflowFacetText(value: string): string {
  return value
    .normalize('NFC')
    .toLowerCase()
    .replace(/[()[\]{}"'`.,:;!?/\\|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactWorkflowFacetText(value: string): string {
  return normalizeWorkflowFacetText(value).replace(/\s+/g, '');
}

function buildWorkflowFacetCandidateText(candidate: SearchCandidate): string {
  return [
    candidate.docTitle,
    candidate.parentSectionTitle,
    candidate.sectionPath.join(' '),
    candidate.matchedLabels.join(' '),
    candidate.searchText,
    candidate.textPreview,
    candidate.text,
  ].join(' ');
}

function inferCandidateBasisBucket(candidate: SearchCandidate): BasisBucketKey {
  if (['law', 'ordinance', 'rule', 'notice'].includes(candidate.sourceType)) return 'legal';
  if (candidate.mode === 'evaluation' || candidate.sourceRole === 'primary_evaluation' || candidate.sourceRole === 'support_reference') {
    return 'evaluation';
  }
  return 'practical';
}

function getWorkflowFacetAnchorMatches(claim: ClaimPlanItem, candidate: SearchCandidate): string[] {
  const normalizedText = normalizeWorkflowFacetText(buildWorkflowFacetCandidateText(candidate));
  const compactText = compactWorkflowFacetText(buildWorkflowFacetCandidateText(candidate));
  return uniqueNonEmptyLines(claim.supportAnchors).filter((anchor) => {
    const normalizedAnchor = normalizeWorkflowFacetText(anchor);
    const compactAnchor = compactWorkflowFacetText(anchor);
    if (normalizedAnchor.length < 2) return false;
    if (
      /제\d+조(?:의\d+)?/u.test(anchor) &&
      !['law', 'ordinance', 'rule', 'notice'].includes(candidate.sourceType)
    ) {
      return false;
    }
    return normalizedText.includes(normalizedAnchor) || (compactAnchor.length >= 2 && compactText.includes(compactAnchor));
  });
}

function extractWorkflowFacetArticleAnchors(claim: ClaimPlanItem): string[] {
  return uniqueNonEmptyLines(
    claim.supportAnchors.flatMap((anchor) => anchor.match(/제\d+조(?:의\d+)?/gu) ?? []),
  );
}

function scoreWorkflowFacetCandidate(claim: ClaimPlanItem, candidate: SearchCandidate): number {
  const matches = getWorkflowFacetAnchorMatches(claim, candidate);
  if (matches.length === 0) return 0;
  let score = matches.length * 6 + candidate.rerankScore / 12 + candidate.lexicalScore / 6 + candidate.exactScore / 4;
  if (claim.supportBucketHints.includes(inferCandidateBasisBucket(candidate))) score += 8;
  const articleAnchors = extractWorkflowFacetArticleAnchors(claim);
  if (articleAnchors.length > 0 && ['law', 'ordinance', 'rule', 'notice'].includes(candidate.sourceType)) {
    if (candidate.articleNo && articleAnchors.includes(candidate.articleNo)) {
      score += 24;
    } else {
      score -= 64;
    }
  }
  if (candidate.sourceRole === 'primary_evaluation') score += 4;
  if (candidate.sourceRole === 'routing_summary') score -= 12;
  return score;
}

function selectWorkflowFacetCandidates(
  claim: ClaimPlanItem,
  search: SearchRun,
  serviceScopes: readonly ServiceScopeId[],
  limit = 2,
): SearchCandidate[] {
  const seen = new Set<string>();
  return [...search.evidence, ...search.fusedCandidates]
    .filter((candidate) => {
      if (seen.has(candidate.id) || candidate.sourceRole === 'routing_summary') return false;
      seen.add(candidate.id);
      return ['law', 'ordinance', 'rule', 'notice'].includes(candidate.sourceType) ||
        candidate.sourceRole === 'primary_evaluation' ||
        isChunkCompatibleWithServiceScopes(candidate, serviceScopes);
    })
    .map((candidate) => ({ candidate, score: scoreWorkflowFacetCandidate(claim, candidate) }))
    .filter((entry) => entry.score >= 10)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

function promoteWorkflowFacetEvidence(search: SearchRun, claims: ClaimPlanItem[], candidates: SearchCandidate[]): SearchRun {
  const merged = new Map<string, SearchCandidate>();
  for (const candidate of [...candidates, ...search.evidence]) {
    const current = merged.get(candidate.id);
    if (!current || current.rerankScore < candidate.rerankScore) {
      merged.set(candidate.id, candidate);
    }
  }

  const pool = Array.from(merged.values());
  const selected: SearchCandidate[] = [];
  const usedIds = new Set<string>();
  const topScore = Math.max(search.evidence[0]?.rerankScore ?? 0, search.fusedCandidates[0]?.rerankScore ?? 0);

  for (const claim of claims) {
    const candidate = pool
      .filter((item) => !usedIds.has(item.id))
      .map((item) => ({ item, score: scoreWorkflowFacetCandidate(claim, item) }))
      .filter((entry) => entry.score >= 10)
      .sort((left, right) => right.score - left.score)[0]?.item;
    if (!candidate) continue;
    usedIds.add(candidate.id);
    selected.push({
      ...candidate,
      rerankScore: Math.max(candidate.rerankScore, topScore + 2 - selected.length * 0.2),
      matchedTerms: Array.from(new Set([...candidate.matchedTerms, 'workflow-facet-evidence'])),
    });
  }

  if (selected.length === 0) return search;

  const selectedIds = new Set(selected.map((candidate) => candidate.id));
  const evidence = [...selected, ...search.evidence.filter((candidate) => !selectedIds.has(candidate.id))]
    .sort((left, right) => right.rerankScore - left.rerankScore)
    .slice(0, Math.max(search.evidence.length, 12));
  const fusedCandidates = [...selected, ...search.fusedCandidates.filter((candidate) => !selectedIds.has(candidate.id))]
    .sort((left, right) => right.rerankScore - left.rerankScore)
    .slice(0, Math.max(search.fusedCandidates.length, 24));
  const mismatchSignals = (search.mismatchSignals ?? []).filter(
    (signal) => signal !== 'no-focus-terms-in-top-candidates' && signal !== 'generic-only-match',
  );

  return {
    ...search,
    confidence: selected.length >= Math.min(3, claims.length) && search.confidence === 'low' ? 'medium' : search.confidence,
    evidence,
    fusedCandidates,
    mismatchSignals,
    groundingGatePassed: selected.length >= Math.min(3, claims.length) ? true : search.groundingGatePassed,
  };
}

function buildWorkflowFacetQuery(baseQuery: string, claim: ClaimPlanItem, serviceScopeContext: string): string {
  return uniqueNonEmptyLines([
    baseQuery,
    claim.canonicalSubject,
    claim.object ?? '',
    ...claim.supportAnchors.slice(0, 14),
    serviceScopeContext,
  ]).join('\n');
}

function buildPriorityDocumentBoosts(
  chunks: readonly StructuredChunk[],
  priorityClass: RetrievalPriorityClass,
): Map<string, number> {
  const policy = INTENT_PRIORITY_MATRIX[priorityClass];
  const boosts = new Map<string, number>();

  const bucketBoost = (bucket: string): number => {
    switch (bucket) {
      case 'legal':
        return policy.legalWeight;
      case 'evaluation_primary':
        return policy.evaluationPrimaryWeight;
      case 'evaluation_support':
        return policy.evaluationSupportWeight;
      case 'manual':
        return policy.manualWeight;
      case 'qa':
        return priorityClass === 'legal_judgment' ? -policy.qaWeight : policy.qaWeight;
      case 'guide':
        return priorityClass === 'legal_judgment' ? -policy.guideWeight : policy.guideWeight;
      case 'comparison':
        return policy.comparisonWeight;
      default:
        return 0;
    }
  };

  for (const chunk of chunks) {
    const bucket = classifyPriorityBucket(chunk as SearchCandidate);
    const boost = bucketBoost(bucket);
    if (boost === 0) continue;
    const current = boosts.get(chunk.documentId) ?? 0;
    boosts.set(chunk.documentId, Math.max(current, boost));
  }

  return boosts;
}

function mergeOntologyHits(left: OntologyHit[], right: OntologyHit[]): OntologyHit[] {
  const merged = new Map<string, OntologyHit>();
  for (const hit of [...left, ...right]) {
    const current = merged.get(hit.entityId);
    if (!current || current.score < hit.score) {
      merged.set(hit.entityId, hit);
    }
  }
  return Array.from(merged.values()).sort((a, b) => b.score - a.score).slice(0, 12);
}

function applyAnswerScope(answer: ExpertAnswerEnvelope, serviceScopeLabels: readonly string[]): ExpertAnswerEnvelope {
  return {
    ...answer,
    appliedScope: serviceScopeLabels.join(', ') || '전체/공통',
  };
}

function mergeCorpora(...corpora: KnowledgeFile[][]): KnowledgeFile[] {
  const filesByPath = new Map<string, KnowledgeFile>();
  for (const corpus of corpora) {
    for (const file of corpus) {
      filesByPath.set(file.path, file);
    }
  }
  return Array.from(filesByPath.values());
}

function collectKnowledgeStats(projectRoot: string): Array<{ name: string; size: number; updatedAt: string }> {
  const knowledgeRoot = path.join(projectRoot, 'knowledge');
  if (!fs.existsSync(knowledgeRoot)) return [];

  const results: Array<{ name: string; size: number; updatedAt: string }> = [];

  const visit = (currentDir: string) => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }

      if (!entry.isFile() || !/\.(md|txt)$/i.test(entry.name)) continue;
      const stat = fs.statSync(fullPath);
      results.push({
        name: path.relative(knowledgeRoot, fullPath).replace(/\\/g, '/'),
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
      });
    }
  };

  visit(knowledgeRoot);
  return results.sort((left, right) => left.name.localeCompare(right.name, 'ko'));
}

function buildCompiledPageContext(pages: CompiledPage[]): string {
  if (pages.length === 0) return '';
  return pages
    .map(
      (page) =>
        [
          `CompiledPage: ${page.title}`,
          `Type: ${page.pageType}`,
          `Summary: ${page.summary}`,
          `Backlinks: ${page.backlinks.join(', ')}`,
        ].join('\n'),
    )
    .join('\n\n');
}

function constrainEvidence(search: SearchRun): SearchRun['evidence'] {
  const maxContextChars = MAX_CONTEXT_CHARS_BY_MODE[search.mode];
  let totalChars = 0;
  const constrained: SearchRun['evidence'] = [];
  for (const evidence of search.evidence) {
    if (totalChars + evidence.text.length > maxContextChars) break;
    totalChars += evidence.text.length;
    constrained.push(evidence);
  }
  return constrained;
}

function expandEvidenceWithNeighbors(evidence: SearchRun['evidence'], allChunks: StructuredChunk[]): SearchRun['evidence'] {
  const byParentSection = new Map<string, StructuredChunk[]>();
  for (const chunk of allChunks) {
    const key = `${chunk.documentId}:${chunk.parentSectionId}`;
    const list = byParentSection.get(key) ?? [];
    list.push(chunk);
    byParentSection.set(key, list);
  }

  const expanded = new Map<string, SearchRun['evidence'][number]>();
  for (const candidate of evidence) {
    expanded.set(candidate.id, candidate);
    if (['law', 'ordinance', 'rule', 'notice'].includes(candidate.sourceType)) {
      continue;
    }
    const key = `${candidate.documentId}:${candidate.parentSectionId}`;
    const siblings = (byParentSection.get(key) ?? []).slice().sort((left, right) => left.windowIndex - right.windowIndex);
    const index = siblings.findIndex((item) => item.id === candidate.id);
    for (const neighbor of [siblings[index - 1], siblings[index + 1]]) {
      if (!neighbor) continue;
      expanded.set(neighbor.id, {
        ...neighbor,
        exactScore: candidate.exactScore,
        lexicalScore: candidate.lexicalScore,
        vectorScore: candidate.vectorScore,
        fusedScore: candidate.fusedScore,
        rerankScore: candidate.rerankScore - 0.5,
        ontologyScore: candidate.ontologyScore,
        matchedTerms: candidate.matchedTerms,
      });
    }
  }

  return Array.from(expanded.values()).sort((left, right) => {
    const rerankDiff = right.rerankScore - left.rerankScore;
    if (rerankDiff !== 0) return rerankDiff;
    if (left.documentId !== right.documentId) return left.documentId.localeCompare(right.documentId);
    if (left.parentSectionId !== right.parentSectionId) return left.parentSectionId.localeCompare(right.parentSectionId);
    return left.windowIndex - right.windowIndex;
  });
}

export class NodeRagService {
  private readonly projectRoot: string;
  private readonly promptSources;
  private readonly brain: DomainBrain;
  private readonly metadataPool: Pool | null;
  private readonly lawMcpClient: LawMcpClient;
  private store: RagStore;
  private readonly embeddingAi: GoogleGenAI | null;
  private readonly generationMode: GenerationMode;
  private ontologyGraph: OntologyGraph | null = null;
  private diskOverlayChunks: StructuredChunk[] = [];
  private diskOverlayIndex: RagCorpusIndex = buildRagCorpusIndex([]);
  private fallbackChunks: StructuredChunk[] = [];
  private workflowBriefs: WorkflowBrief[] = [];
  private diskFiles: KnowledgeFile[] = [];
  private diskManifestEntries: IndexManifestEntry[] = [];
  private doctorIssues: KnowledgeDoctorIssue[] = [];
  private diskStateCache: DiskKnowledgeState | null = null;
  private indexStatus: IndexStatus = compareIndexStatus({
    diskEntries: [],
    indexedEntries: [],
    storageMode: 'memory',
  });
  private readonly runtimeCache = new RuntimeRagCache();
  private readonly retrievalProfiles = listRetrievalProfiles();
  private activeProfileId = resolveInitialRetrievalProfileId();
  private profileOverrides: Partial<RetrievalFeatureFlags> = {};
  private readonly recentEvalTrials: EvalTrialReport[] = [];
  private backendReadiness: BackendReadiness = createDefaultBackendReadiness();
  private workerQueue: WorkerQueueStatus = { pending: 0, running: 0 };
  private readonly adminJobs: Array<() => Promise<void>> = [];
  private adminQueueRunning = false;
  private profilesUpdatedAt = new Date().toISOString();
  private lastRetrievalByPath = new Map<string, RecentRetrievalMatch>();
  private readonly queryEmbeddingCache = new Map<string, number[] | null>();
  private embeddingRefreshTimer: NodeJS.Timeout | null = null;
  private initialized = false;
  private initializePromise: Promise<void> | null = null;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.promptSources = loadPromptSourceSet(projectRoot);
    this.brain = loadDomainBrain(projectRoot);
    this.generationMode = resolveGenerationMode();

    const storageMode = process.env.RAG_STORAGE_MODE?.toLowerCase() ?? 'memory';
    const databaseUrl = process.env.DATABASE_URL;
    this.metadataPool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
    if (storageMode === 'postgres' && databaseUrl) {
      this.store = new PostgresRagStore(databaseUrl);
    } else {
      this.store = new MemoryRagStore(projectRoot);
    }

    const embeddingApiKey = resolveEmbeddingApiKey();
    this.embeddingAi = embeddingApiKey ? new GoogleGenAI({ apiKey: embeddingApiKey }) : null;
    this.lawMcpClient = new LawMcpClient(LAW_MCP_BASE_URL, LAW_MCP_ENABLED);
    this.backendReadiness.pgvector = createBackendReadinessItem('pgvector', {
      status: storageMode === 'postgres' && databaseUrl ? 'ready' : 'degraded',
      enabled: true,
      detail:
        storageMode === 'postgres' && databaseUrl
          ? 'Postgres/pgvector store configured.'
          : 'Running on memory store; vector search falls back to in-process embeddings.',
    });
  }

  private getActiveProfile(profileId?: string): RetrievalProfile {
    const resolvedId = profileId ?? this.activeProfileId;
    return applyRetrievalFeatureOverrides(getRetrievalProfile(resolvedId), this.profileOverrides);
  }

  private getActiveFeatureFlags(profileId?: string): RetrievalFeatureFlags {
    const featureFlags = getRetrievalFeatureFlags(this.getActiveProfile(profileId));
    return {
      ...featureFlags,
      reranker:
        featureFlags.reranker &&
        this.backendReadiness.reranker.enabled &&
        this.backendReadiness.reranker.status === 'ready',
      externalElasticsearch:
        featureFlags.externalElasticsearch &&
        this.backendReadiness.elasticsearch.enabled &&
        this.backendReadiness.elasticsearch.status === 'ready',
    };
  }

  getAdminProfiles(): AdminProfilesResponse {
    return buildAdminProfilesResponse({
      activeProfileId: this.activeProfileId,
      profiles: this.retrievalProfiles,
      featureFlags: this.getActiveFeatureFlags(),
      updatedAt: this.profilesUpdatedAt,
    });
  }

  updateAdminProfiles(params: {
    activeProfileId?: string;
    overrides?: Partial<RetrievalFeatureFlags>;
  }): AdminProfilesResponse {
    const next = updateAdminProfileState({
      currentActiveProfileId: this.activeProfileId,
      currentOverrides: this.profileOverrides,
      ...params,
    });
    this.activeProfileId = next.activeProfileId;
    this.profileOverrides = next.overrides;
    this.profilesUpdatedAt = next.updatedAt;
    return this.getAdminProfiles();
  }

  getAdminOntologyReview(): AdminOntologyReviewResponse {
    return buildAdminOntologyReview(this.projectRoot);
  }

  updateOntologyConceptReview(params: {
    source: 'generated' | 'curated';
    label: string;
    status: 'candidate' | 'validated' | 'promoted' | 'rejected';
    statusReason?: string;
  }): AdminOntologyReviewResponse {
    updateOntologyConceptReviewManifest({
      projectRoot: this.projectRoot,
      ...params,
    });
    this.rebuildOntologyGraph();
    return this.getAdminOntologyReview();
  }

  updateOntologyConceptReviewBatch(params: {
    updates: Array<{
      source: 'generated' | 'curated';
      label: string;
      status: 'candidate' | 'validated' | 'promoted' | 'rejected';
      statusReason?: string;
    }>;
  }): AdminOntologyReviewResponse {
    updateOntologyConceptReviewBatchManifest({
      projectRoot: this.projectRoot,
      updates: params.updates,
    });
    this.rebuildOntologyGraph();
    return this.getAdminOntologyReview();
  }

  private async rebuildRuntimeState(): Promise<void> {
    try {
      await this.store.initialize(this.embeddingAi);
    } catch (error) {
      if (!(this.store instanceof MemoryRagStore)) {
        console.warn(`Falling back to memory RAG store: ${error instanceof Error ? error.message : String(error)}`);
        this.store = new MemoryRagStore(this.projectRoot);
        await this.store.initialize(this.embeddingAi);
      } else {
        throw error;
      }
    }
    if (this.embeddingAi) {
      await this.store.ensureEmbeddings(this.embeddingAi);
    }
    await this.loadFallbackChunks();
    this.refreshIndexStatus();
    this.rebuildOntologyGraph();
    this.workflowBriefs = this.buildWorkflowBriefIndex();
  }

  private async probeHttpBackend(url: string, detailPrefix: string): Promise<Partial<BackendReadinessItem>> {
    const start = Date.now();
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(BACKEND_HEALTH_TIMEOUT_MS) });
      return {
        status: response.ok ? 'ready' : 'degraded',
        enabled: true,
        detail: `${detailPrefix}: ${response.status}`,
        latencyMs: Date.now() - start,
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unavailable',
        enabled: true,
        detail: `${detailPrefix}: ${describeError(error)}`,
        latencyMs: Date.now() - start,
        checkedAt: new Date().toISOString(),
      };
    }
  }

  private async refreshBackendReadiness(): Promise<BackendReadiness> {
    const indexStatus = this.refreshIndexStatus();
    const backendReadiness = createDefaultBackendReadiness();
    backendReadiness.pgvector = createBackendReadinessItem('pgvector', {
      status: this.store instanceof PostgresRagStore ? 'ready' : 'degraded',
      enabled: true,
      detail:
        this.store instanceof PostgresRagStore
          ? 'Postgres/pgvector store active.'
          : 'Memory store active; vector retrieval is local-only.',
      checkedAt: new Date().toISOString(),
    });

    const elasticsearchUrl = process.env.RAG_ELASTICSEARCH_URL?.trim();
    if (elasticsearchUrl) {
      backendReadiness.elasticsearch = createBackendReadinessItem(
        'elasticsearch',
        await this.probeHttpBackend(`${elasticsearchUrl.replace(/\/$/, '')}/_cluster/health`, 'Elasticsearch'),
      );
    }

    const rerankerUrl = process.env.RAG_RERANKER_URL?.trim();
    if (rerankerUrl) {
      backendReadiness.reranker = createBackendReadinessItem(
        'reranker',
        await this.probeHttpBackend(rerankerUrl, 'Reranker'),
      );
    }

    const redisUrl = process.env.RAG_REDIS_URL?.trim();
    backendReadiness.redis = createBackendReadinessItem('redis', {
      status: redisUrl ? 'degraded' : 'disabled',
      enabled: Boolean(redisUrl),
      detail: redisUrl
        ? 'Redis URL configured, but this build is using the in-process cache fallback.'
        : 'Redis is not configured; using in-process cache fallback.',
      checkedAt: new Date().toISOString(),
    });

    const parserMode = process.env.RAG_PDF_PARSER_MODE?.trim() || 'markdown';
    backendReadiness.parser = createBackendReadinessItem('parser', {
      status: parserMode === 'markdown' ? 'degraded' : 'ready',
      enabled: true,
      detail:
        parserMode === 'markdown'
          ? 'Structured PDF parser is not configured; markdown/txt ingestion remains active.'
          : `Parser mode: ${parserMode}`,
      checkedAt: new Date().toISOString(),
    });

    backendReadiness.queue = createBackendReadinessItem('queue', {
      status: this.workerQueue.running > 0 || this.workerQueue.pending > 0 ? 'degraded' : 'ready',
      enabled: true,
      detail:
        this.workerQueue.running > 0 || this.workerQueue.pending > 0
          ? `Background worker busy (${this.workerQueue.running} running / ${this.workerQueue.pending} pending).`
          : 'Background worker queue is idle.',
      checkedAt: new Date().toISOString(),
      backlog: this.workerQueue.pending,
    });

    this.backendReadiness = backendReadiness;
    this.indexStatus = {
      ...indexStatus,
      backendReadiness,
      queue: cloneWorkerQueueStatus(this.workerQueue),
    };
    return backendReadiness;
  }

  private async drainAdminJobs(): Promise<void> {
    this.adminQueueRunning = true;
    while (this.adminJobs.length > 0) {
      const next = this.adminJobs.shift();
      this.workerQueue.pending = this.adminJobs.length;
      this.workerQueue.running = 1;
      this.workerQueue.lastStartedAt = new Date().toISOString();
      await this.refreshBackendReadiness();
      try {
        if (next) await next();
        this.workerQueue.lastCompletedAt = new Date().toISOString();
        this.workerQueue.lastError = undefined;
      } catch (error) {
        this.workerQueue.lastError = describeError(error);
      } finally {
        this.workerQueue.running = 0;
        this.workerQueue.pending = this.adminJobs.length;
        await this.refreshBackendReadiness();
      }
    }
    this.adminQueueRunning = false;
  }

  private enqueueAdminJob(task: () => Promise<void>): WorkerQueueStatus {
    this.adminJobs.push(task);
    this.workerQueue.pending = this.adminJobs.length;
    if (!this.adminQueueRunning) {
      void this.drainAdminJobs();
    }
    return cloneWorkerQueueStatus(this.workerQueue);
  }

  private async performReindex(): Promise<void> {
    await buildAndPersistAdminReindex({
      projectRoot: this.projectRoot,
      store: this.store,
      embeddingAi: this.embeddingAi,
      brain: this.brain,
    });
    this.runtimeCache.clear();
    this.queryEmbeddingCache.clear();
    this.diskStateCache = null;
    this.initialized = false;
    this.initializePromise = null;
    await this.initialize();
  }

  async requestReindex(): Promise<AdminReindexResponse> {
    await this.initialize();
    const queue = this.enqueueAdminJob(async () => {
      await this.performReindex();
    });
    return {
      accepted: true,
      queue,
    };
  }

  listEvalTrials(): EvalTrialReport[] {
    return listEvalTrialReports({
      projectRoot: this.projectRoot,
      recentEvalTrials: this.recentEvalTrials,
      onReadError: (filePath, error) => {
        console.warn(`[eval] failed to read trial report ${filePath}: ${describeError(error)}`);
      },
    });
  }

  async runEvalTrial(profileIds = [this.activeProfileId]): Promise<EvalTrialReport> {
    await this.initialize();
    const cases = loadBenchmarkCases(this.projectRoot);
    const normalizedProfileIds = profileIds.map((profileId) => getRetrievalProfile(profileId).id);
    const results: EvalTrialCaseResult[] = [];
    let top3Hits = 0;
    let top5Hits = 0;
    let expectedEvidenceHits = 0;
    let forbiddenEvidencePasses = 0;
    let requiredCitationHits = 0;
    let sectionHits = 0;
    let primarySourceHits = 0;
    let citationUniquenessTotal = 0;
    let abstainHits = 0;
    let abstainTotal = 0;

    for (const testCase of cases) {
      const profileId = normalizedProfileIds[results.length % normalizedProfileIds.length];
      const startedAt = Date.now();
      const inspection = await this.inspectRetrieval(
        testCase.messages ?? testCase.question,
        testCase.mode,
        undefined,
        testCase.serviceScopes,
        profileId,
      );
      const top3 = inspection.search.fusedCandidates.slice(0, 3);
      const top5 = inspection.search.fusedCandidates.slice(0, 5);
      const top3Hit = top3.some((candidate) => candidate.docTitle.includes(testCase.expectedDoc));
      const top5Hit = top5.some((candidate) => candidate.docTitle.includes(testCase.expectedDoc));
      const evidenceDocs = Array.from(new Set(inspection.search.evidence.map((candidate) => candidate.docTitle)));
      const matchesAnyEvidence = (needle: string) => evidenceDocs.some((doc) => doc.includes(needle));
      const expectedEvidenceHit =
        !testCase.expectedEvidenceDocs || testCase.expectedEvidenceDocs.every((doc) => matchesAnyEvidence(doc));
      const forbiddenEvidencePass =
        !testCase.forbiddenEvidenceDocs || testCase.forbiddenEvidenceDocs.every((doc) => !matchesAnyEvidence(doc));
      const requiredCitationHit =
        !testCase.requiredCitationDocs || testCase.requiredCitationDocs.every((doc) => matchesAnyEvidence(doc));
      const sectionHit = !testCase.expectedSection || inspection.sectionRouting.selectedSectionTitles.some((title) => title.includes(testCase.expectedSection ?? ''));
      const primarySourcePriority = inspection.search.evidence[0]?.sourceRole === 'primary_evaluation' || testCase.mode === 'integrated';
      const citationUniqueness = new Set(inspection.search.evidence.map((item) => item.citationGroupId)).size;
      const abstainAccepted = testCase.acceptableAbstain ? inspection.agentDecision === 'abstain' : null;

      if (top3Hit) top3Hits += 1;
      if (top5Hit) top5Hits += 1;
      if (expectedEvidenceHit) expectedEvidenceHits += 1;
      if (forbiddenEvidencePass) forbiddenEvidencePasses += 1;
      if (requiredCitationHit) requiredCitationHits += 1;
      if (sectionHit) sectionHits += 1;
      if (primarySourcePriority) primarySourceHits += 1;
      citationUniquenessTotal += citationUniqueness;
      if (testCase.acceptableAbstain) {
        abstainTotal += 1;
        if (inspection.agentDecision === 'abstain') abstainHits += 1;
      }

      results.push({
        id: testCase.id,
        top3Hit,
        top5Hit,
        expectedEvidenceHit,
        forbiddenEvidencePass,
        requiredCitationHit,
        sectionHit,
        primarySourcePriority,
        citationUniqueness,
        abstainAccepted,
        selectedProfileId: profileId,
        latencyMs: Date.now() - startedAt,
      });
    }

    const createdAt = new Date().toISOString();
    const reportId = `trial-${createdAt.replace(/[:.]/g, '-')}`;
    const outputDir = path.join(this.projectRoot, 'benchmarks', 'trials');
    fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `${reportId}.json`);
    const report: EvalTrialReport = {
      id: reportId,
      createdAt,
      profileIds: normalizedProfileIds,
      totalCases: cases.length,
      top3Recall: cases.length > 0 ? Number((top3Hits / cases.length).toFixed(4)) : 0,
      top5Recall: cases.length > 0 ? Number((top5Hits / cases.length).toFixed(4)) : 0,
      expectedEvidencePassRate: cases.length > 0 ? Number((expectedEvidenceHits / cases.length).toFixed(4)) : 0,
      forbiddenEvidencePassRate: cases.length > 0 ? Number((forbiddenEvidencePasses / cases.length).toFixed(4)) : 0,
      requiredCitationPassRate: cases.length > 0 ? Number((requiredCitationHits / cases.length).toFixed(4)) : 0,
      sectionHitRate: cases.length > 0 ? Number((sectionHits / cases.length).toFixed(4)) : 0,
      primarySourcePriorityRate: cases.length > 0 ? Number((primarySourceHits / cases.length).toFixed(4)) : 0,
      avgCitationUniqueness: cases.length > 0 ? Number((citationUniquenessTotal / cases.length).toFixed(2)) : 0,
      abstainPrecision: abstainTotal > 0 ? Number((abstainHits / abstainTotal).toFixed(4)) : null,
      outputPath,
      results,
    };
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
    rememberEvalTrialReport(this.recentEvalTrials, report);
    return report;
  }

  async getAdminHealth(): Promise<AdminHealthResponse> {
    await this.initialize();
    const backendReadiness = await this.refreshBackendReadiness();
    return {
      activeProfileId: this.activeProfileId,
      backendReadiness,
      queue: cloneWorkerQueueStatus(this.workerQueue),
      indexStatus: this.refreshIndexStatus(),
      featureFlags: this.getActiveFeatureFlags(),
    };
  }

  private loadDiskKnowledgeState(): Omit<DiskKnowledgeState, 'fingerprint'> {
    const fingerprint = sha1(
      collectKnowledgeStats(this.projectRoot)
        .map((entry) => `${entry.name}:${entry.size}:${entry.updatedAt}`)
        .join('\n'),
    );
    if (this.diskStateCache?.fingerprint === fingerprint) {
      return this.diskStateCache;
    }

    const corpora = loadKnowledgeCorporaFromDisk(this.projectRoot);
    const files = mergeCorpora(corpora.integrated, corpora.evaluation);
    const chunks = buildStructuredChunks(files);
    this.diskStateCache = {
      fingerprint,
      files,
      chunks,
      manifestEntries: buildKnowledgeManifest(files, chunks),
      issues: buildKnowledgeDoctorIssues(files, chunks),
    };
    return this.diskStateCache;
  }

  private getAllSearchChunks(): StructuredChunk[] {
    return [...this.store.getChunks(), ...this.diskOverlayChunks, ...this.fallbackChunks];
  }

  private rebuildOntologyGraph(): void {
    this.ontologyGraph = buildOntologyGraph(
      this.brain,
      this.getAllSearchChunks(),
      loadGeneratedOntologyManifest(this.projectRoot),
      loadCuratedOntologyManifest(this.projectRoot),
    );
  }

  private async loadFallbackChunks(): Promise<void> {
    if (!this.metadataPool) {
      this.fallbackChunks = [];
      return;
    }

    const client = await this.metadataPool.connect();
    try {
      await ensurePostgresSchema(client);
      const result = await client.query<StoredLawFallbackRow>(`
        select
          id,
          cache_key,
          title,
          query,
          text,
          source,
          path,
          article_no,
          created_at,
          updated_at
        from law_fallback_cache
        order by updated_at desc
      `);
      this.fallbackChunks = result.rows.map((row) => fallbackRowToChunk(row));
    } catch (error) {
      console.warn(`[law-fallback] failed to load cache: ${describeError(error)}`);
      this.fallbackChunks = [];
    } finally {
      client.release();
    }
  }

  private async persistFallbackChunk(chunk: StructuredChunk, result: LawMcpFallbackResult): Promise<void> {
    if (!this.metadataPool) return;

    const client = await this.metadataPool.connect();
    try {
      await ensurePostgresSchema(client);
      await client.query(
        `
          insert into law_fallback_cache (
            id,
            cache_key,
            title,
            query,
            text,
            source,
            path,
            article_no,
            updated_at
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,now())
          on conflict (cache_key) do update set
            title = excluded.title,
            query = excluded.query,
            text = excluded.text,
            source = excluded.source,
            path = excluded.path,
            article_no = excluded.article_no,
            updated_at = now()
        `,
        [
          chunk.id,
          result.cacheKey,
          chunk.docTitle,
          result.query,
          result.text,
          result.source,
          chunk.path,
          chunk.articleNo ?? null,
        ],
      );
    } catch (error) {
      console.warn(`[law-fallback] failed to persist cache: ${describeError(error)}`);
    } finally {
      client.release();
    }
  }

  private refreshIndexStatus(): IndexStatus {
    const diskState = this.loadDiskKnowledgeState();
    this.diskFiles = diskState.files;
    this.diskManifestEntries = diskState.manifestEntries;
    this.doctorIssues = diskState.issues;
    const indexStatus = compareIndexStatus({
      diskEntries: this.diskManifestEntries,
      indexedEntries: this.store.getManifestEntries(),
      storageMode: this.store.getStats().storageMode,
      generatedAt: this.store.getIndexGeneratedAt(),
      issues: this.doctorIssues,
      nextEmbeddingRetryAt: getNextEmbeddingRetryAt(),
    });
    this.updateDiskOverlayChunks(diskState.chunks, indexStatus);
    this.indexStatus = {
      ...indexStatus,
      backendReadiness: this.backendReadiness,
      queue: cloneWorkerQueueStatus(this.workerQueue),
    };
    return this.indexStatus;
  }

  private updateDiskOverlayChunks(diskChunks: StructuredChunk[], indexStatus: IndexStatus): void {
    const overlayPaths = new Set([...indexStatus.missingDocuments, ...indexStatus.staleDocuments]);
    if (overlayPaths.size === 0) {
      if (this.diskOverlayChunks.length > 0) {
        this.diskOverlayChunks = [];
        this.diskOverlayIndex = buildRagCorpusIndex([]);
      }
      return;
    }

    const overlayChunks = diskChunks.filter((chunk) => overlayPaths.has(chunk.path));
    const overlayFingerprint = overlayChunks.map((chunk) => chunk.id).join('\n');
    const currentFingerprint = this.diskOverlayChunks.map((chunk) => chunk.id).join('\n');
    if (overlayFingerprint === currentFingerprint) return;

    this.diskOverlayChunks = overlayChunks;
    this.diskOverlayIndex = buildRagCorpusIndex(overlayChunks);
  }

  private rememberRetrieval(retrieval: RetrievalDiagnostics, query: string): void {
    const matchedAt = new Date().toISOString();
    const matches = new Map<string, RecentRetrievalMatch>();
    retrieval.candidateDiagnostics.forEach((candidate, index) => {
      matches.set(candidate.path, {
        query,
        normalizedQuery: retrieval.normalizedQuery,
        rank: index + 1,
        inEvidence: candidate.selectedAsEvidence,
        matchedAt,
      });
    });
    this.lastRetrievalByPath = matches;
  }

  private hasMissingLawReferenceEvidence(search: SearchRun, queryProfile: NaturalLanguageQueryProfile): boolean {
    if (queryProfile.parsedLawRefs.length === 0) return false;

    return queryProfile.parsedLawRefs.some((lawRef) => {
      const lawKey = normalizeDocumentTitle(lawRef.canonicalLawName);
      return !search.evidence.some((candidate) => {
        const titleKey = normalizeDocumentTitle(candidate.docTitle);
        const lawMatches = titleKey.includes(lawKey) || lawKey.includes(titleKey);
        const articleMatches = !lawRef.article || candidate.articleNo === lawRef.article || candidate.text.includes(lawRef.article);
        return lawMatches && articleMatches;
      });
    });
  }

  private async fetchLawFallbackSearch(
    mode: PromptMode,
    queryProfile: NaturalLanguageQueryProfile,
    queryEmbedding: number[] | null,
    aliases: string[],
    cacheEnabled: boolean,
  ): Promise<{ search: SearchRun | null; sources: LawFallbackSource[]; triggered: boolean }> {
    const runtimeCacheKey = buildScopedCacheKey([
      this.indexStatus.manifestHash,
      mode,
      queryProfile.normalizedQuery,
      aliases.join(','),
      ...queryProfile.parsedLawRefs.map(
        (lawRef) => `${lawRef.canonicalLawName}:${lawRef.article ?? lawRef.jo ?? lawRef.raw}`,
      ),
    ]);
    if (cacheEnabled) {
      const cached = this.runtimeCache.get<{ search: SearchRun | null; sources: LawFallbackSource[]; triggered: boolean }>(
        'fallback',
        runtimeCacheKey,
      );
      if (cached) {
        const cloned = structuredClone(cached);
        cloned.sources = cloned.sources.map((source) => ({ ...source, cached: true }));
        return cloned;
      }
    }

    const cacheKeys = uniqueNonEmptyLines([
      queryProfile.normalizedQuery,
      ...queryProfile.parsedLawRefs.map((lawRef) => `${lawRef.canonicalLawName}:${lawRef.jo ?? lawRef.article ?? queryProfile.normalizedQuery}`),
    ]);
    const cachedChunk = this.fallbackChunks.find((chunk) =>
      cacheKeys.some((key) => chunk.id === sha1(key) || chunk.documentId === `fallback:${key}`),
    );

    let chunk: StructuredChunk | null = null;
    const sources: LawFallbackSource[] = [];

    if (cachedChunk) {
      chunk = { ...cachedChunk, mode };
      sources.push({
        source: cachedChunk.matchedLabels[0] ?? 'korean-law-mcp:cache',
        title: cachedChunk.docTitle,
        query: queryProfile.normalizedQuery,
        cached: true,
        url: cachedChunk.path,
      });
    } else {
      const fallback = await this.lawMcpClient.fetchFallback(queryProfile.normalizedQuery, queryProfile.parsedLawRefs);
      if (!fallback) {
        const result = { search: null, sources, triggered: true };
        if (cacheEnabled) {
          this.runtimeCache.set('fallback', runtimeCacheKey, result, FALLBACK_CACHE_TTL_MS);
        }
        return result;
      }

      chunk = fallbackResultToChunk(fallback, mode, queryProfile.parsedLawRefs[0]?.article);
      this.fallbackChunks = [chunk, ...this.fallbackChunks.filter((item) => item.id !== chunk.id)].slice(0, 32);
      await this.persistFallbackChunk(chunk, fallback);
      this.rebuildOntologyGraph();
      sources.push({
        source: fallback.source,
        title: fallback.title,
        query: fallback.query,
        cached: false,
        url: fallback.url,
      });
    }

    if (!chunk) {
      const result = { search: null, sources, triggered: true };
      if (cacheEnabled) {
        this.runtimeCache.set('fallback', runtimeCacheKey, result, FALLBACK_CACHE_TTL_MS);
      }
      return result;
    }

    const fallbackSearch = searchCorpus({
      index: buildRagCorpusIndex([chunk]),
      query: queryProfile.normalizedQuery,
      mode,
      queryEmbedding,
      queryAliases: aliases,
      options: {
        lawRefs: queryProfile.parsedLawRefs,
        queryType: queryProfile.queryType,
        semanticFrame: queryProfile.semanticFrame,
      },
    });

    const result = {
      search: fallbackSearch.evidence.length > 0 ? fallbackSearch : null,
      sources,
      triggered: true,
    };
    if (cacheEnabled) {
      this.runtimeCache.set('fallback', runtimeCacheKey, result, FALLBACK_CACHE_TTL_MS);
    }

    return result;
  }

  private async getQueryEmbedding(query: string): Promise<number[] | null> {
    if (!this.embeddingAi) return null;

    const normalized = query.trim();
    if (!normalized) return null;

    if (this.queryEmbeddingCache.has(normalized)) {
      return this.queryEmbeddingCache.get(normalized) ?? null;
    }

    const embedding = await embedQuery(this.embeddingAi, normalized);
    this.queryEmbeddingCache.set(normalized, embedding);

    if (this.queryEmbeddingCache.size > 128) {
      const oldestKey = this.queryEmbeddingCache.keys().next().value;
      if (oldestKey) {
        this.queryEmbeddingCache.delete(oldestKey);
      }
    }

    return embedding;
  }

  private startBackgroundEmbeddingRefresh(): void {
    if (!this.embeddingAi || this.embeddingRefreshTimer) return;
    const intervalMs = Math.max(60_000, Math.min(EMBEDDING_REFRESH_INTERVAL_MS, 5 * 60 * 1000));
    this.embeddingRefreshTimer = setInterval(() => {
      void this.store.ensureEmbeddings(this.embeddingAi).then(() => {
        this.refreshIndexStatus();
      }).catch((error) => {
        console.warn(`[embedding] background refresh failed: ${describeError(error)}`);
      });
    }, intervalMs);
  }

  private getRetrievalReadiness(): RetrievalReadiness {
    return this.indexStatus.retrievalReadiness;
  }

  private buildWorkflowBriefIndex(): WorkflowBrief[] {
    const chunks = this.getAllSearchChunks();
    const documentIds = Array.from(new Set(chunks.map((chunk) => chunk.documentId)));
    const pages = [
      ...this.store.getCompiledPages('integrated', documentIds),
      ...this.store.getCompiledPages('evaluation', documentIds),
    ];
    return buildWorkflowBriefs(this.brain, pages, chunks);
  }

  private async searchStore(
    query: string,
    mode: PromptMode,
    queryEmbedding: number[] | null,
    queryAliases: string[] = [],
    options?: SearchOptions,
  ): Promise<SearchRun> {
    const baseSearch = await this.store.search(query, mode, queryEmbedding, queryAliases, options);
    if (this.diskOverlayChunks.length === 0) {
      return baseSearch;
    }

    const overlayOptions = options
      ? {
          ...options,
          precomputedVectorCandidates: undefined,
        }
      : undefined;
    const overlaySearch = searchCorpus({
      index: this.diskOverlayIndex,
      query,
      mode,
      queryEmbedding: null,
      queryAliases,
      options: overlayOptions,
    });

    return mergeSearchRuns(baseSearch, overlaySearch);
  }

  private async executeSearch(
    mode: PromptMode,
    normalizedQuery: string,
    queryEmbedding: number[] | null,
    aliases: string[],
    options?: SearchPlanningOptions,
  ): Promise<SearchExecutionResult> {
    const combinedAliases = uniqueNonEmptyLines([...(options?.extraAliases ?? []), ...aliases]);
    const searchQuery = uniqueNonEmptyLines([normalizedQuery, ...combinedAliases]).join('\n');
    const sectionRoutingEnabled = options?.profile?.retrieval.sectionRouting ?? false;
    const emptyScope: RetrievalScopeContext = {
      routeOnlyDocumentIds: new Set<string>(),
      primaryExpansionDocumentIds: new Set<string>(),
      routingDocuments: [],
      primaryExpansionDocuments: [],
    };
    const emptyOntologyResult: OntologySearchResult = {
      documentScoreBoosts: new Map<string, number>(),
      hits: [],
      trace: [],
    };
    const emptySectionRouting = summarizeSectionRouting([], sectionRoutingEnabled);

    if (mode !== 'evaluation') {
      const allChunks = this.getAllSearchChunks();
      const representatives = buildDocumentRepresentativeMap(allChunks);
      const baseDocumentScoreBoosts = mergeDocumentScoreBoostMaps(
        buildOperationalDocumentBoosts(allChunks, normalizedQuery),
        options?.additionalDocumentScoreBoosts ?? new Map<string, number>(),
      );
      const initialSearch = applySectionRoutingBoost(
        await this.searchStore(
          searchQuery,
          mode,
          queryEmbedding,
          combinedAliases,
          {
            documentScoreBoosts: baseDocumentScoreBoosts,
            chunkScoreBoosts: options?.additionalChunkScoreBoosts,
            lawRefs: options?.queryProfile?.parsedLawRefs,
            queryType: options?.queryProfile?.queryType,
            semanticFrame: options?.queryProfile?.semanticFrame,
            selectedServiceScopes: options?.selectedServiceScopes,
            retrievalPriorityClass: options?.retrievalPriorityClass,
            retrievalPriorityPolicy: options?.retrievalPriorityClass
              ? INTENT_PRIORITY_MATRIX[options.retrievalPriorityClass]
              : undefined,
            evaluationLinked: options?.evaluationLinked,
          },
        ),
        sectionRoutingEnabled,
      );
      const ontologyResult =
        this.ontologyGraph && options?.queryProfile
          ? expandDocumentsWithOntology(
              this.ontologyGraph,
              options.queryProfile,
              uniqueDocumentCandidates(initialSearch.fusedCandidates, 4).map((candidate) => candidate.documentId),
              ONTOLOGY_GRAPH_DEPTH,
            )
          : emptyOntologyResult;
      const heuristicDocumentScoreBoosts = mergeDocumentScoreBoostMaps(
        baseDocumentScoreBoosts,
        ontologyResult.documentScoreBoosts,
      );
      const routingCandidates = uniqueDocumentCandidates(
        initialSearch.fusedCandidates.filter((candidate) => candidate.sourceRole === 'routing_summary'),
        4,
      );
      const primaryExpansionDocumentIds = resolveRoutingExpansionDocumentIds(routingCandidates, allChunks);

      if (primaryExpansionDocumentIds.size === 0) {
        return {
          search: pruneIrrelevantSupportEvidence(applyGroundingGate(initialSearch)),
          scope: emptyScope,
          ontologyHits: ontologyResult.hits,
          graphExpansionTrace: ontologyResult.trace,
          sectionRouting: summarizeSectionRouting(initialSearch.fusedCandidates.slice(0, 6), sectionRoutingEnabled),
        };
      }

      const routeOnlyDocumentIds = new Set(routingCandidates.map((candidate) => candidate.documentId));
      const documentScoreBoosts = mergeDocumentScoreBoostMaps(heuristicDocumentScoreBoosts);
      for (const documentId of primaryExpansionDocumentIds) {
        const sourceRole = representatives.get(documentId)?.sourceRole;
        const boost = sourceRole === 'primary_evaluation' ? 32 : 16;
        documentScoreBoosts.set(documentId, (documentScoreBoosts.get(documentId) ?? 0) + boost);
      }

      const expansionAliases = uniqueNonEmptyLines([
        ...combinedAliases,
        ...routingCandidates.map((candidate) => candidate.docTitle),
        ...routingCandidates.map((candidate) => candidate.parentSectionTitle),
        ...routingCandidates.flatMap((candidate) => candidate.sectionPath.slice(-2)),
      ]);
      const expansionQuery = uniqueNonEmptyLines([
        searchQuery,
        ...routingCandidates.map((candidate) => candidate.docTitle),
        ...routingCandidates.map((candidate) => candidate.parentSectionTitle),
      ]).join('\n');

      const rerankedSearch = applyGroundingGate(applySectionRoutingBoost(
        await this.searchStore(searchQuery, mode, queryEmbedding, combinedAliases, {
          documentScoreBoosts,
          chunkScoreBoosts: options?.additionalChunkScoreBoosts,
          excludedEvidenceRoles: new Set<SourceRole>(['routing_summary']),
          lawRefs: options?.queryProfile?.parsedLawRefs,
          queryType: options?.queryProfile?.queryType,
          semanticFrame: options?.queryProfile?.semanticFrame,
          selectedServiceScopes: options?.selectedServiceScopes,
          retrievalPriorityClass: options?.retrievalPriorityClass,
          retrievalPriorityPolicy: options?.retrievalPriorityClass
            ? INTENT_PRIORITY_MATRIX[options.retrievalPriorityClass]
            : undefined,
          evaluationLinked: options?.evaluationLinked,
        }),
        sectionRoutingEnabled,
      ));
      const promotedPrimarySearch = await this.searchStore(expansionQuery, mode, queryEmbedding, expansionAliases, {
        allowedDocumentIds: primaryExpansionDocumentIds,
        documentScoreBoosts,
        chunkScoreBoosts: options?.additionalChunkScoreBoosts,
        excludedEvidenceRoles: new Set<SourceRole>(['routing_summary']),
        lawRefs: options?.queryProfile?.parsedLawRefs,
        queryType: options?.queryProfile?.queryType,
        semanticFrame: options?.queryProfile?.semanticFrame,
        selectedServiceScopes: options?.selectedServiceScopes,
        retrievalPriorityClass: options?.retrievalPriorityClass,
        retrievalPriorityPolicy: options?.retrievalPriorityClass
          ? INTENT_PRIORITY_MATRIX[options.retrievalPriorityClass]
          : undefined,
        evaluationLinked: options?.evaluationLinked,
      });
      const promotedPrimaryCandidates = uniqueDocumentCandidates(
        promotedPrimarySearch.fusedCandidates.filter(
          (candidate) =>
            candidate.sourceRole !== 'routing_summary' &&
            !(
              options?.retrievalPriorityClass === 'legal_judgment' &&
              candidate.mode === 'evaluation' &&
              candidate.sourceRole === 'primary_evaluation'
            ),
        ),
        4,
      );

        return {
          search: pruneIrrelevantSupportEvidence(injectEvidenceCandidates(rerankedSearch, promotedPrimaryCandidates)),
          scope: {
            routeOnlyDocumentIds,
            primaryExpansionDocumentIds,
            routingDocuments: uniqueDocumentPaths(routingCandidates),
            primaryExpansionDocuments: documentPathsFromIds(primaryExpansionDocumentIds, representatives),
          },
          ontologyHits: ontologyResult.hits,
          graphExpansionTrace: ontologyResult.trace,
          sectionRouting: summarizeSectionRouting(rerankedSearch.fusedCandidates.slice(0, 6), sectionRoutingEnabled),
        };
      }

    const allChunks = this.getAllSearchChunks();
    const representatives = buildDocumentRepresentativeMap(allChunks);
    const baseDocumentScoreBoosts = mergeDocumentScoreBoostMaps(
      buildOperationalDocumentBoosts(allChunks, normalizedQuery),
      options?.additionalDocumentScoreBoosts ?? new Map<string, number>(),
    );
    const evaluationDocumentIds = new Set(
      allChunks.filter((chunk) => chunk.mode === 'evaluation').map((chunk) => chunk.documentId),
    );
    const retrievalPriorityClass = options?.retrievalPriorityClass ?? 'operational_workflow';
    const retrievalPriorityPolicy = INTENT_PRIORITY_MATRIX[retrievalPriorityClass];
    const routeOnlyDocumentIds = new Set(
      allChunks
        .filter((chunk) => chunk.sourceRole === 'routing_summary')
        .map((chunk) => chunk.documentId),
    );

    const routingSearch = applySectionRoutingBoost(await this.searchStore(searchQuery, mode, queryEmbedding, combinedAliases, {
      allowedDocumentIds: evaluationDocumentIds,
      documentScoreBoosts: baseDocumentScoreBoosts,
      chunkScoreBoosts: options?.additionalChunkScoreBoosts,
      lawRefs: options?.queryProfile?.parsedLawRefs,
      queryType: options?.queryProfile?.queryType,
      semanticFrame: options?.queryProfile?.semanticFrame,
      selectedServiceScopes: options?.selectedServiceScopes,
      retrievalPriorityClass,
      retrievalPriorityPolicy,
      evaluationLinked: options?.evaluationLinked,
    }), sectionRoutingEnabled);
    const ontologyResult =
      this.ontologyGraph && options?.queryProfile
        ? expandDocumentsWithOntology(
            this.ontologyGraph,
            options.queryProfile,
            uniqueDocumentCandidates(routingSearch.fusedCandidates, 4).map((candidate) => candidate.documentId),
            ONTOLOGY_GRAPH_DEPTH,
          )
        : emptyOntologyResult;
    const routingCandidates = uniqueDocumentCandidates(
      routingSearch.fusedCandidates.filter((candidate) => candidate.sourceRole === 'routing_summary'),
      4,
    );
    const primaryExpansionDocumentIds = resolveRoutingExpansionDocumentIds(routingCandidates, allChunks);

    const integratedSupportDocumentIds = new Set(
      allChunks
        .filter((chunk) => chunk.mode === 'integrated' && chunk.sourceRole === 'support_reference')
        .map((chunk) => chunk.documentId),
    );
    const directSupportSearch =
      integratedSupportDocumentIds.size > 0
        ? await this.searchStore(searchQuery, mode, queryEmbedding, combinedAliases, {
            allowedDocumentIds: integratedSupportDocumentIds,
            documentScoreBoosts: baseDocumentScoreBoosts,
            chunkScoreBoosts: options?.additionalChunkScoreBoosts,
            lawRefs: options?.queryProfile?.parsedLawRefs,
            queryType: options?.queryProfile?.queryType,
            semanticFrame: options?.queryProfile?.semanticFrame,
            selectedServiceScopes: options?.selectedServiceScopes,
            retrievalPriorityClass,
            retrievalPriorityPolicy,
            evaluationLinked: options?.evaluationLinked,
          })
        : null;
    const directSupportDocumentIds = directSupportSearch
      ? selectDirectSupportReferenceIds(directSupportSearch)
      : new Set<string>();

    const allowedDocumentIds = new Set<string>([
      ...evaluationDocumentIds,
      ...primaryExpansionDocumentIds,
      ...directSupportDocumentIds,
    ]);
    const documentScoreBoosts = mergeDocumentScoreBoostMaps(
      baseDocumentScoreBoosts,
      ontologyResult.documentScoreBoosts,
    );

    for (const documentId of primaryExpansionDocumentIds) {
      const sourceRole = representatives.get(documentId)?.sourceRole;
      const boost = sourceRole === 'primary_evaluation' ? 48 : 22;
      documentScoreBoosts.set(documentId, (documentScoreBoosts.get(documentId) ?? 0) + boost);
    }

    for (const documentId of directSupportDocumentIds) {
      documentScoreBoosts.set(documentId, (documentScoreBoosts.get(documentId) ?? 0) + 6);
    }

    const expansionAliases = uniqueNonEmptyLines([
      ...combinedAliases,
      ...routingCandidates.map((candidate) => candidate.docTitle),
      ...routingCandidates.map((candidate) => candidate.parentSectionTitle),
      ...routingCandidates.flatMap((candidate) => candidate.sectionPath.slice(-2)),
    ]);
    const expansionQuery = uniqueNonEmptyLines([
      searchQuery,
      ...routingCandidates.map((candidate) => candidate.docTitle),
      ...routingCandidates.map((candidate) => candidate.parentSectionTitle),
    ]).join('\n');

    const baseSearch = applyGroundingGate(applySectionRoutingBoost(
      await this.searchStore(searchQuery, mode, queryEmbedding, combinedAliases, {
        allowedDocumentIds,
        documentScoreBoosts,
        chunkScoreBoosts: options?.additionalChunkScoreBoosts,
        excludedEvidenceRoles: new Set<SourceRole>(['routing_summary']),
        lawRefs: options?.queryProfile?.parsedLawRefs,
        queryType: options?.queryProfile?.queryType,
        semanticFrame: options?.queryProfile?.semanticFrame,
        selectedServiceScopes: options?.selectedServiceScopes,
        retrievalPriorityClass,
        retrievalPriorityPolicy,
        evaluationLinked: options?.evaluationLinked,
      }),
      sectionRoutingEnabled,
    ));
    const promotedPrimaryCandidates =
      primaryExpansionDocumentIds.size > 0
        ? uniqueDocumentCandidates(
            (
              await this.searchStore(expansionQuery, mode, queryEmbedding, expansionAliases, {
                allowedDocumentIds: primaryExpansionDocumentIds,
                documentScoreBoosts,
                chunkScoreBoosts: options?.additionalChunkScoreBoosts,
                excludedEvidenceRoles: new Set<SourceRole>(['routing_summary']),
                lawRefs: options?.queryProfile?.parsedLawRefs,
                queryType: options?.queryProfile?.queryType,
                semanticFrame: options?.queryProfile?.semanticFrame,
                selectedServiceScopes: options?.selectedServiceScopes,
                retrievalPriorityClass,
                retrievalPriorityPolicy,
                evaluationLinked: options?.evaluationLinked,
              })
            ).fusedCandidates.filter((candidate) => candidate.sourceRole !== 'routing_summary'),
            4,
          )
        : [];
    const primaryManualDocumentIds = new Set(
      allChunks
        .filter(
          (chunk) =>
            chunk.mode === 'evaluation' &&
            chunk.sourceRole === 'primary_evaluation' &&
            chunk.path.includes('/knowledge/eval/') &&
            /평가매뉴얼/u.test(`${chunk.docTitle} ${chunk.fileName}`),
        )
        .map((chunk) => chunk.documentId),
    );
    const primaryManualCandidates =
      retrievalPriorityClass === 'evaluation_readiness' && primaryManualDocumentIds.size > 0
        ? uniqueDocumentCandidates(
            (
              await this.searchStore(
                uniqueNonEmptyLines([
                  searchQuery,
                  ...routingSearch.fusedCandidates.slice(0, 4).flatMap((candidate) => [
                    candidate.docTitle,
                    candidate.parentSectionTitle,
                    ...candidate.sectionPath.slice(-2),
                  ]),
                ]).join('\n'),
                mode,
                queryEmbedding,
                uniqueNonEmptyLines([
                  ...combinedAliases,
                  ...routingSearch.fusedCandidates.slice(0, 4).flatMap((candidate) => [
                    candidate.docTitle,
                    candidate.parentSectionTitle,
                    ...candidate.sectionPath.slice(-2),
                  ]),
                ]),
                {
                  allowedDocumentIds: primaryManualDocumentIds,
                  documentScoreBoosts,
                  chunkScoreBoosts: options?.additionalChunkScoreBoosts,
                  excludedEvidenceRoles: new Set<SourceRole>(['routing_summary']),
                  lawRefs: options?.queryProfile?.parsedLawRefs,
                  queryType: options?.queryProfile?.queryType,
                  semanticFrame: options?.queryProfile?.semanticFrame,
                  selectedServiceScopes: options?.selectedServiceScopes,
                  retrievalPriorityClass,
                  retrievalPriorityPolicy,
                  evaluationLinked: options?.evaluationLinked,
                },
              )
            ).fusedCandidates.filter((candidate) => candidate.sourceRole !== 'routing_summary'),
            2,
          )
        : [];

    return {
      search: pruneIrrelevantSupportEvidence(injectEvidenceCandidates(baseSearch, [...promotedPrimaryCandidates, ...primaryManualCandidates])),
      scope: {
        routeOnlyDocumentIds,
        primaryExpansionDocumentIds,
        routingDocuments: uniqueDocumentPaths(routingCandidates),
        primaryExpansionDocuments: documentPathsFromIds(primaryExpansionDocumentIds, representatives),
      },
      ontologyHits: ontologyResult.hits,
      graphExpansionTrace: ontologyResult.trace,
      sectionRouting:
        baseSearch.fusedCandidates.length > 0
          ? summarizeSectionRouting(baseSearch.fusedCandidates.slice(0, 6), sectionRoutingEnabled)
          : emptySectionRouting,
    };
  }

  async getChatCapabilities(): Promise<ChatCapabilities> {
    await this.initialize();
    const status = this.refreshIndexStatus();
    return this.buildChatCapabilities(status);
  }

  getChatCapabilitiesSnapshot(): ChatCapabilities {
    return this.buildChatCapabilities(this.indexStatus, {
      initializing: !this.initialized,
      degraded: !this.initialized,
      message: !this.initialized
        ? 'RAG knowledge is still loading. Search and chat may be limited until initialization finishes.'
        : undefined,
    });
  }

  private buildChatCapabilities(
    status: IndexStatus,
    statusExtras?: Pick<ChatCapabilities, 'initializing' | 'degraded' | 'message'>,
  ): ChatCapabilities {
    return {
      generationMode: this.generationMode,
      requiresUserGenerationKey: this.generationMode === 'user',
      serverEmbeddingReady: status.retrievalReadiness !== 'lexical_only',
      retrievalReadiness: status.retrievalReadiness,
      ...statusExtras,
      activeProfileId: this.activeProfileId,
      availableProfiles: this.retrievalProfiles.map((profile) => ({
        id: profile.id,
        label: profile.label,
        description: profile.description,
      })),
      featureFlags: this.getActiveFeatureFlags(),
      backendReadiness: this.backendReadiness,
      supportedModels: CHAT_MODELS.map((model) => ({
        id: model.id,
        label: model.label,
      })),
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initializePromise) {
      await this.initializePromise;
      return;
    }

    this.initializePromise = (async () => {
      await this.rebuildRuntimeState();
      await this.refreshBackendReadiness();
      this.startBackgroundEmbeddingRefresh();
      this.initialized = true;
    })();

    try {
      await this.initializePromise;
    } catch (error) {
      this.initialized = false;
      throw error;
    } finally {
      this.initializePromise = null;
    }
  }

  getStats() {
    return this.store.getStats();
  }

  listKnowledgeFiles() {
    return manifestEntriesToKnowledgeStats(this.loadDiskKnowledgeState().manifestEntries);
  }

  async getIndexStatus(): Promise<IndexStatus> {
    await this.initialize();
    await this.refreshBackendReadiness();
    return this.refreshIndexStatus();
  }

  async getDocumentDiagnostics(documentPath: string): Promise<DocumentDiagnostics | null> {
    await this.initialize();
    const status = this.refreshIndexStatus();
    const normalizedPath = documentPath.replace(/\\/g, '/');
    const safePath = normalizedPath.startsWith('/knowledge/') ? normalizedPath : `/knowledge/${normalizedPath.replace(/^\/+/, '')}`;
    const diskEntry = this.diskManifestEntries.find((entry) => entry.path === safePath);
    const indexedEntry = this.store.getManifestEntries().find((entry) => entry.path === safePath);
    if (!diskEntry && !indexedEntry) return null;

    return buildDocumentDiagnostics({
      path: safePath,
      diskEntry,
      indexedEntry,
      status,
      issues: this.doctorIssues.filter((issue) => issue.path === safePath),
      recentRetrieval: this.lastRetrievalByPath.get(safePath) ?? null,
    });
  }

  private async runRetrievalPlan(
    input: string | ChatMessage[],
    mode: PromptMode,
    serviceScopes?: ServiceScopeId[],
    profileId?: string,
  ): Promise<RetrievalPlanResult> {
    const planStartedAt = Date.now();
    const latency = createEmptyLatencyBreakdown();
    const selectedServiceScopes = parseServiceScopes(serviceScopes);
    const serviceScopeLabels = getServiceScopeLabels(selectedServiceScopes);
    const serviceScopeAliases = getServiceScopeSearchAliases(selectedServiceScopes);
    const serviceScopeContext = buildServiceScopePromptContext(selectedServiceScopes);
    const runtimeProfile = this.getActiveProfile(profileId);
    const cacheHits = createEmptyCacheHitSummary();
    const allSearchChunks = this.getAllSearchChunks();
    const recentMessages = Array.isArray(input) ? input.slice(-4) : [];
    const query = Array.isArray(input)
      ? [...recentMessages].reverse().find((message) => message.role === 'user')?.text ?? ''
      : input;
    const singleUserMessagePayload: ChatMessage[] = query.trim() ? [{ role: 'user', text: query.trim() }] : [];
    const messagePayload: ChatMessage[] = recentMessages.length > 0 ? recentMessages : singleUserMessagePayload;
    const normalizationCacheKey = buildScopedCacheKey([
      this.indexStatus.manifestHash,
      runtimeProfile.id,
      mode,
      selectedServiceScopes.join(','),
      messagePayload.map((message) => `${message.role}:${message.text}`).join('\n'),
    ]);
    const normalizationStartedAt = Date.now();
    let normalized =
      runtimeProfile.cache.normalization && runtimeProfile.queryProcessing.rewrite
        ? this.runtimeCache.get<ReturnType<typeof buildNormalizedRetrievalQuery>>('normalization', normalizationCacheKey)
        : null;
    if (normalized) {
      cacheHits.normalization = true;
    } else {
      normalized = buildNormalizedRetrievalQuery(
        runtimeProfile.queryProcessing.rewrite ? messagePayload : singleUserMessagePayload,
      );
      if (runtimeProfile.cache.normalization && runtimeProfile.queryProcessing.rewrite) {
        this.runtimeCache.set('normalization', normalizationCacheKey, normalized, NORMALIZATION_CACHE_TTL_MS);
      }
    }
    latency.queryNormalizationMs = Date.now() - normalizationStartedAt;
    const queryProfile = enrichQueryProfileWithServiceScopeLabels(normalized.queryProfile, serviceScopeLabels);
    const retrievalPriorityClass = inferRetrievalPriorityClass({
      mode,
      query: normalized.normalizedQuery,
      queryProfile,
    });
    const priorityPolicyName = RETRIEVAL_PRIORITY_POLICY_NAME;
    const evaluationLinked = isEvaluationLinkedWorkflowQuery(normalized.normalizedQuery);
    const hydeStartedAt = Date.now();
    const pseudoHyde =
      runtimeProfile.queryProcessing.hyde
        ? (() => {
            const hydeCacheKey = buildScopedCacheKey([
              this.indexStatus.manifestHash,
              runtimeProfile.id,
              normalized?.normalizedQuery,
              selectedServiceScopes.join(','),
            ]);
            const cachedHyde = runtimeProfile.cache.hyde
              ? this.runtimeCache.get<string>('hyde', hydeCacheKey)
              : null;
            if (cachedHyde) {
              cacheHits.hyde = true;
              return cachedHyde;
            }
            const value = buildPseudoHydeText({
              normalizedQuery: normalized.normalizedQuery,
              profile: runtimeProfile,
              queryProfile,
              serviceScopeLabels,
              workflowEvents: [],
            });
            if (value && runtimeProfile.cache.hyde) {
              this.runtimeCache.set('hyde', hydeCacheKey, value, HYDE_CACHE_TTL_MS);
            }
            return value;
          })()
        : '';
    latency.hydeMs = Date.now() - hydeStartedAt;
    const brainProfileQuery = uniqueNonEmptyLines([
      normalized.normalizedQuery,
      serviceScopeContext,
      ...normalized.aliases,
      ...serviceScopeAliases,
      pseudoHyde,
      ...queryProfile.searchVariants,
      ...queryProfile.aliasResolutions.flatMap((item) => [item.canonical, ...item.alternatives]),
      ...queryProfile.parsedLawRefs.flatMap((item) => [
        item.canonicalLawName,
        item.article ? `${item.canonicalLawName} ${item.article}` : '',
      ]),
    ]).join('\n');
    const profile = buildBrainQueryProfile(this.brain, brainProfileQuery, mode);
    const plannerTrace: Array<{ step: string; detail: string }> = [
      { step: 'retrieval-profile', detail: runtimeProfile.id },
      { step: 'query-type', detail: queryProfile.queryType },
      { step: 'retrieval-priority', detail: retrievalPriorityClass },
      { step: 'service-scope', detail: serviceScopeLabels.join(', ') },
      { step: 'question-archetype', detail: profile.questionArchetype },
      { step: 'preferred-answer-type', detail: profile.recommendedAnswerType },
      { step: 'initial-retrieval-mode', detail: profile.preferredRetrievalMode },
    ];
    const workflowBriefs = selectWorkflowBriefs(this.workflowBriefs, profile.workflowEvents);
    const preliminaryClaimPlan = buildClaimPlan({
      question: normalized.normalizedQuery,
      semanticFrame: queryProfile.semanticFrame,
      evidence: [],
    });
    const workflowFacetClaims = preliminaryClaimPlan.claims.filter((claim) => claim.claimType === 'workflow_step');
    const workflowFacetAliases = uniqueNonEmptyLines(
      workflowFacetClaims.flatMap((claim) => [claim.canonicalSubject, claim.object ?? '', ...claim.supportAnchors]),
    );
    const aliases = uniqueNonEmptyLines([
      ...normalized.aliases,
      ...serviceScopeAliases,
      ...profile.aliases,
      ...profile.relatedTerms,
      ...workflowFacetAliases,
      pseudoHyde,
    ]);
    const retrievalCacheKey = buildScopedCacheKey([
      this.indexStatus.manifestHash,
      runtimeProfile.id,
      mode,
      selectedServiceScopes.join(','),
      normalized.normalizedQuery,
      aliases.join('\n'),
      queryProfile.queryType,
      queryProfile.parsedLawRefs.map((item) => `${item.canonicalLawName}:${item.article ?? item.jo ?? item.raw}`).join('|'),
    ]);
    const retrievalCacheLookupStartedAt = Date.now();
    const cachedPlan =
      runtimeProfile.cache.retrieval
        ? this.runtimeCache.get<RetrievalPlanResult>('retrieval', retrievalCacheKey)
        : null;
    latency.cacheLookupMs += Date.now() - retrievalCacheLookupStartedAt;
    if (cachedPlan) {
      const cloned = structuredClone(cachedPlan);
      cloned.cacheHits = {
        ...cloned.cacheHits,
        ...cacheHits,
        retrieval: true,
      };
      cloned.latency = {
        ...cloned.latency,
        queryNormalizationMs: cloned.latency.queryNormalizationMs + latency.queryNormalizationMs,
        cacheLookupMs: cloned.latency.cacheLookupMs + latency.cacheLookupMs,
        hydeMs: cloned.latency.hydeMs + latency.hydeMs,
        totalMs: Date.now() - planStartedAt,
      };
      return cloned;
    }

    const embeddingQuery = [normalized.normalizedQuery, ...aliases].filter(Boolean).join('\n');
    const queryEmbedding = await this.getQueryEmbedding(embeddingQuery);
    const serviceScopeChunkBoosts = runtimeProfile.retrieval.scopeBoosts
      ? buildServiceScopeChunkBoosts(
          allSearchChunks,
          selectedServiceScopes,
          uniqueNonEmptyLines([
            ...deriveFocusTerms(normalized.normalizedQuery),
            ...queryProfile.searchVariants,
            ...profile.aliases,
            ...profile.relatedTerms,
            ...workflowFacetAliases,
          ]),
        )
      : new Map<string, number>();
    const workflowBoosts = mergeDocumentScoreBoostMaps(
      buildPriorityDocumentBoosts(allSearchChunks, retrievalPriorityClass),
      buildBrainDocumentBoosts(
        this.brain,
        allSearchChunks,
        profile.workflowEvents,
        normalized.normalizedQuery,
      ),
    );
    const workflowAliasHints = workflowBriefs.flatMap((brief) => [brief.label, brief.summary]);
    let selectedRetrievalMode: RetrievalMode = profile.preferredRetrievalMode;
    const retrievalStartedAt = Date.now();
    let { search, scope, ontologyHits, graphExpansionTrace, sectionRouting } = await this.executeSearch(
      mode,
      normalized.normalizedQuery,
      queryEmbedding,
      aliases,
      {
        profile: runtimeProfile,
        additionalDocumentScoreBoosts: workflowBoosts,
        additionalChunkScoreBoosts: serviceScopeChunkBoosts,
        extraAliases: selectedRetrievalMode === 'workflow-global' ? workflowAliasHints : [],
        queryProfile,
        retrievalPriorityClass,
        priorityPolicyName,
        evaluationLinked,
        selectedServiceScopes,
      },
    );
    const workflowFacetEvidenceCandidates: SearchCandidate[] = [];
    if (workflowFacetClaims.length > 0) {
      const retrievalPriorityPolicy = INTENT_PRIORITY_MATRIX[retrievalPriorityClass];
      const facetCandidates: SearchCandidate[] = [];
      for (const claim of workflowFacetClaims) {
        const facetAliases = uniqueNonEmptyLines([...aliases, ...workflowAliasHints, ...claim.supportAnchors]);
        const facetSearch = await this.searchStore(
          buildWorkflowFacetQuery(normalized.normalizedQuery, claim, serviceScopeContext),
          mode,
          null,
          facetAliases,
          {
            documentScoreBoosts: workflowBoosts,
            chunkScoreBoosts: serviceScopeChunkBoosts,
            excludedEvidenceRoles: new Set<SourceRole>(['routing_summary']),
            lawRefs: queryProfile.parsedLawRefs,
            queryType: queryProfile.queryType,
            semanticFrame: queryProfile.semanticFrame,
            selectedServiceScopes,
            retrievalPriorityClass,
            retrievalPriorityPolicy,
            evaluationLinked,
          },
        );
        facetCandidates.push(...selectWorkflowFacetCandidates(claim, facetSearch, selectedServiceScopes, 2));
      }
      workflowFacetEvidenceCandidates.push(...facetCandidates);
      const preFacetEvidenceIds = search.evidence.map((candidate) => candidate.id).join(',');
      search = promoteWorkflowFacetEvidence(search, workflowFacetClaims, facetCandidates);
      if (search.evidence.map((candidate) => candidate.id).join(',') !== preFacetEvidenceIds) {
        plannerTrace.push({
          step: 'workflow-facet-evidence',
          detail: `${facetCandidates.length} candidates across ${workflowFacetClaims.length} facets`,
        });
      }
    }
    const subquestions: string[] = [];
    let fallbackTriggered = false;
    let fallbackSources: LawFallbackSource[] = [];

    if (
      runtimeProfile.queryProcessing.decompose &&
      profile.preferredRetrievalMode !== 'local' &&
      (search.confidence === 'low' || search.evidence.length < 2 || (search.mismatchSignals ?? []).length > 0)
    ) {
      const refined = buildDriftSubquestions(this.brain, normalized.normalizedQuery, profile, mode);
      subquestions.push(...refined);
      plannerTrace.push({ step: 'drift-refine', detail: refined.length > 0 ? refined.join(' | ') : 'no-subquestions' });

      const mergedEvidence = new Map(search.evidence.map((item) => [item.id, item]));
      const mergedCandidates = new Map(search.fusedCandidates.map((item) => [item.id, item]));

      for (const subquestion of refined) {
        const refinedAliases = uniqueNonEmptyLines([...aliases, subquestion]);
        const refinedEmbedding = await this.getQueryEmbedding([subquestion, ...refinedAliases].join('\n'));
        const refinedQueryProfile = enrichQueryProfileWithServiceScopeLabels(
          buildNaturalQueryProfile(subquestion),
          serviceScopeLabels,
        );
        const refinedSearch = await this.executeSearch(mode, subquestion, refinedEmbedding, refinedAliases, {
          profile: runtimeProfile,
          additionalDocumentScoreBoosts: workflowBoosts,
          additionalChunkScoreBoosts: serviceScopeChunkBoosts,
          extraAliases: workflowAliasHints,
          queryProfile: refinedQueryProfile,
          retrievalPriorityClass,
          priorityPolicyName,
          evaluationLinked,
          selectedServiceScopes,
        });

        refinedSearch.search.evidence.forEach((item) => {
          if (!mergedEvidence.has(item.id) || (mergedEvidence.get(item.id)?.rerankScore ?? 0) < item.rerankScore) {
            mergedEvidence.set(item.id, item);
          }
        });
        refinedSearch.search.fusedCandidates.forEach((item) => {
          if (!mergedCandidates.has(item.id) || (mergedCandidates.get(item.id)?.rerankScore ?? 0) < item.rerankScore) {
            mergedCandidates.set(item.id, item);
          }
        });
        ontologyHits = mergeOntologyHits(ontologyHits, refinedSearch.ontologyHits);
        graphExpansionTrace = [...graphExpansionTrace, ...refinedSearch.graphExpansionTrace];
        if (refinedSearch.sectionRouting.selectedSectionIds.length > sectionRouting.selectedSectionIds.length) {
          sectionRouting = refinedSearch.sectionRouting;
        }
      }

      search = {
        ...search,
        confidence:
          mergedEvidence.size >= 3 && (search.mismatchSignals ?? []).length === 0
            ? 'medium'
            : search.confidence,
        fusedCandidates: Array.from(mergedCandidates.values())
          .sort((left, right) => right.rerankScore - left.rerankScore)
          .slice(0, Math.max(search.fusedCandidates.length, 20)),
        evidence: Array.from(mergedEvidence.values())
          .sort((left, right) => right.rerankScore - left.rerankScore)
          .slice(0, Math.max(search.evidence.length, 10)),
      };
      selectedRetrievalMode = refined.length > 0 ? 'drift-refine' : selectedRetrievalMode;
    }

    const shouldAttemptFallback =
      this.lawMcpClient.isEnabled() &&
      (shouldTriggerFallbackForConfidence(search.confidence) ||
        search.evidence.length < 2 ||
        this.hasMissingLawReferenceEvidence(search, queryProfile));

    if (shouldAttemptFallback) {
      const fallbackStartedAt = Date.now();
      const fallback = await this.fetchLawFallbackSearch(
        mode,
        queryProfile,
        queryEmbedding,
        aliases,
        runtimeProfile.cache.fallback,
      );
      latency.fallbackMs += Date.now() - fallbackStartedAt;
      fallbackTriggered = fallback.triggered;
      fallbackSources = fallback.sources;
      if (fallback.search) {
        search = mergeSearchRuns(search, fallback.search);
        cacheHits.fallback = fallback.sources.some((source) => source.cached);
        plannerTrace.push({
          step: 'law-fallback',
          detail: fallback.sources.map((source) => `${source.title}${source.cached ? ' (cache)' : ''}`).join(', '),
        });
      } else if (fallback.triggered) {
        plannerTrace.push({
          step: 'law-fallback',
          detail: 'triggered-but-no-fallback-result',
        });
      }
    }

    search = applyOriginalFocusGate(search, normalized.normalizedQuery, aliases);
    search = prioritizeConcreteFocusEvidence(search, [
      normalized.normalizedQuery,
      ...queryProfile.searchVariants,
      ...aliases,
    ]);
    const preScopeGateEvidenceCount = search.evidence.length;
    search = applyServiceScopeEvidenceGate(search, selectedServiceScopes);
    if (search.evidence.length !== preScopeGateEvidenceCount) {
      plannerTrace.push({
        step: 'service-scope-evidence-gate',
        detail: `${preScopeGateEvidenceCount}->${search.evidence.length}`,
      });
    }
    const preIntentGateEvidenceIds = search.evidence.map((candidate) => candidate.id).join(',');
    search = {
      ...search,
      fusedCandidates: diversifyVisibleCandidates(search.fusedCandidates, Math.max(search.fusedCandidates.length, 24)),
      evidence: applyIntentEvidenceGate(search.evidence, retrievalPriorityClass),
    };
    if (search.evidence.map((candidate) => candidate.id).join(',') !== preIntentGateEvidenceIds) {
      plannerTrace.push({
        step: 'intent-evidence-gate',
        detail: retrievalPriorityClass,
      });
    }
    if (workflowFacetClaims.length > 0) {
      search = promoteWorkflowFacetEvidence(search, workflowFacetClaims, search.evidence);
    }

    const expandedEvidence = filterEvidenceByServiceScopes(
      expandEvidenceWithNeighbors(search.evidence, allSearchChunks),
      selectedServiceScopes,
    );
    let evidence = applyIntentEvidenceGate(
      constrainEvidence({
        ...search,
        evidence: expandedEvidence,
      }),
      retrievalPriorityClass,
    );
    if (workflowFacetClaims.length > 0) {
      evidence = promoteWorkflowFacetEvidence(
        {
          ...search,
          evidence,
          fusedCandidates: evidence,
        },
        workflowFacetClaims,
        [...workflowFacetEvidenceCandidates, ...search.evidence, ...evidence],
      ).evidence;
    }
    const retrievalValidation = evaluateRetrievalValidation({
      semanticFrame: queryProfile.semanticFrame,
      evidence,
      projectRoot: this.projectRoot,
      claimPlan: buildClaimPlan({
        question: normalized.normalizedQuery,
        semanticFrame: queryProfile.semanticFrame,
        evidence,
      }),
    });
    const evidenceHaystack = evidence
      .map((chunk) => `${chunk.docTitle} ${chunk.parentSectionTitle} ${chunk.searchText}`.toLowerCase())
      .join('\n');
    const missingEvidenceFocusTerms = (search.focusTerms ?? []).filter(
      (term) => !isGenericQueryTerm(term) && !evidenceHaystack.includes(term.toLowerCase()),
    );
    const insufficientCompositionCount = retrievalValidation.validationIssues.filter(
      (issue) => issue.code === 'insufficient-evidence-composition',
    ).length;
    const hasBlockingValidation = retrievalValidation.validationIssues.some((issue) => issue.severity === 'block');
    const hasBasisConfusion = retrievalValidation.validationIssues.some((issue) => issue.code === 'basis-confusion');
    const hasUnsupportedPrimaryClaim = retrievalValidation.validationIssues.some(
      (issue) => issue.code === 'unsupported-claim' && issue.severity !== 'info',
    );
    const shouldForceAbstainConfidence =
      hasBlockingValidation ||
      hasBasisConfusion ||
      (insufficientCompositionCount >= 2 && missingEvidenceFocusTerms.length > 0) ||
      (hasUnsupportedPrimaryClaim && missingEvidenceFocusTerms.length >= 2);

    if (shouldForceAbstainConfidence) {
      const mismatchSignals = new Set([...(search.mismatchSignals ?? []), 'semantic-validation-failed']);
      if (missingEvidenceFocusTerms.length > 0) {
        mismatchSignals.add('focus-terms-missing-in-evidence');
      }
      search = {
        ...search,
        confidence: 'low',
        mismatchSignals: Array.from(mismatchSignals),
        groundingGatePassed: false,
      };
    }
    const basisCoverage = buildBasisCoverage(evidence);
    const knowledgeContext = [
      serviceScopeContext,
      buildExpertKnowledgeContext({
        evidence,
        workflowBriefs,
      }),
    ]
      .filter(Boolean)
      .join('\n\n');
    plannerTrace.push({
      step: 'workflow-events',
      detail: profile.workflowEvents.length > 0 ? summarizeWorkflowEvents(this.brain, profile.workflowEvents).join(', ') : 'none',
    });
    plannerTrace.push({
      step: 'basis-coverage',
      detail: `legal=${basisCoverage.legal}, evaluation=${basisCoverage.evaluation}, practical=${basisCoverage.practical}`,
    });
    plannerTrace.push({
      step: 'semantic-validation',
      detail:
        retrievalValidation.validationIssues.length > 0
          ? retrievalValidation.validationIssues.map((issue) => `${issue.severity}:${issue.code}`).join(', ')
          : 'clean',
    });

    const result: RetrievalPlanResult = {
      normalizedQuery: normalized.normalizedQuery,
      querySources: normalized.querySources,
      profile: runtimeProfile,
      retrievalPriorityClass,
      priorityPolicyName,
      selectedServiceScopes,
      serviceScopeLabels,
      aliases,
      queryProfile,
      questionArchetype: profile.questionArchetype,
      recommendedAnswerType: profile.recommendedAnswerType,
      selectedRetrievalMode,
      workflowEventIds: profile.workflowEvents,
      workflowEventsHit: summarizeWorkflowEvents(this.brain, profile.workflowEvents),
      subquestions,
      plannerTrace,
      search,
      scope,
      evidence,
      claimCoverage: retrievalValidation.claimCoverage,
      validationIssues: retrievalValidation.validationIssues,
      workflowBriefs,
      knowledgeContext,
      basisCoverage,
      ontologyHits,
      graphExpansionTrace,
      fallbackTriggered,
      fallbackSources,
      cacheHits,
      sectionRouting,
      latency: {
        ...latency,
        retrievalMs: Date.now() - retrievalStartedAt,
        totalMs: Date.now() - planStartedAt,
      },
    };
    if (runtimeProfile.cache.retrieval) {
      this.runtimeCache.set('retrieval', retrievalCacheKey, result, RETRIEVAL_CACHE_TTL_MS);
    }

    return result;
  }

  async inspectRetrieval(
    input: string | ChatMessage[],
    mode: PromptMode,
    apiKey?: string,
    serviceScopes?: ServiceScopeId[],
    profileId?: string,
  ): Promise<RetrievalInspectionResponse> {
    await this.initialize();
    void apiKey;
    if (this.embeddingAi) {
      await this.store.ensureEmbeddings(this.embeddingAi);
    }
    const startedAt = Date.now();
    const query = Array.isArray(input)
      ? [...input.slice(-4)].reverse().find((message) => message.role === 'user')?.text ?? ''
      : input;
    const planned = await this.runRetrievalPlan(input, mode, serviceScopes, profileId);
    const compiledPages = this.store.getCompiledPages(mode, planned.evidence.map((item) => item.documentId));
    const indexStatus = this.refreshIndexStatus();
    const guardrails = planned.profile.guardrails.promptInjection ? [detectPromptInjectionSignals(query)] : [];
    const latency: StageLatencyBreakdown = {
      ...planned.latency,
      totalMs: Date.now() - startedAt,
    };
    const retrieval = buildRetrievalDiagnostics(
      {
        ...planned.search,
        evidence: planned.evidence,
      },
      planned.normalizedQuery,
      planned.querySources,
      this.getAllSearchChunks(),
      indexStatus,
      planned.scope,
      {
        profile: planned.profile,
        retrievalPriorityClass: planned.retrievalPriorityClass,
        priorityPolicyName: planned.priorityPolicyName,
        selectedServiceScopes: planned.selectedServiceScopes,
        serviceScopeLabels: planned.serviceScopeLabels,
        selectedRetrievalMode: planned.selectedRetrievalMode,
        workflowEventsHit: planned.workflowEventsHit,
        subquestions: planned.subquestions,
        basisCoverage: planned.basisCoverage,
        plannerTrace: planned.plannerTrace,
        normalizationTrace: planned.queryProfile.normalizationTrace,
        aliasResolutions: planned.queryProfile.aliasResolutions,
        parsedLawRefs: planned.queryProfile.parsedLawRefs,
        semanticFrame: planned.queryProfile.semanticFrame,
        assumptions: planned.queryProfile.semanticFrame.assumptions,
        ontologyHits: planned.ontologyHits,
        validationIssues: planned.validationIssues,
        claimCoverage: planned.claimCoverage,
        graphExpansionTrace: planned.graphExpansionTrace,
        fallbackTriggered: planned.fallbackTriggered,
        fallbackSources: planned.fallbackSources,
        guardrails,
        latency,
        sectionRouting: planned.sectionRouting,
        cacheHits: planned.cacheHits,
      },
    );
    this.rememberRetrieval(retrieval, query);
    return {
      query,
      normalizedQuery: planned.normalizedQuery,
      querySources: planned.querySources,
      profile: planned.profile,
      retrievalPriorityClass: retrieval.retrievalPriorityClass,
      priorityPolicyName: retrieval.priorityPolicyName,
      selectedServiceScopes: retrieval.selectedServiceScopes,
      serviceScopeLabels: retrieval.serviceScopeLabels,
      search: {
        ...planned.search,
        evidence: planned.evidence,
      },
      compiledPages,
      indexStatus,
      candidateDiagnostics: retrieval.candidateDiagnostics,
      matchedDocumentPaths: retrieval.matchedDocumentPaths,
      retrievalReadiness: retrieval.retrievalReadiness,
      hybridReadinessReason: retrieval.hybridReadinessReason,
      evidenceBalance: retrieval.evidenceBalance,
      agentDecision: retrieval.agentDecision,
      stageTrace: retrieval.stageTrace,
      neighborWindows: retrieval.neighborWindows,
      rejectionReasons: retrieval.rejectionReasons,
      routingDocuments: retrieval.routingDocuments,
      primaryExpansionDocuments: retrieval.primaryExpansionDocuments,
      finalEvidenceDocuments: retrieval.finalEvidenceDocuments,
      selectedRetrievalMode: retrieval.selectedRetrievalMode,
      workflowEventsHit: retrieval.workflowEventsHit,
      subquestions: retrieval.subquestions,
      basisCoverage: retrieval.basisCoverage,
      plannerTrace: retrieval.plannerTrace,
      normalizationTrace: retrieval.normalizationTrace,
      aliasResolutions: retrieval.aliasResolutions,
      parsedLawRefs: retrieval.parsedLawRefs,
      semanticFrame: retrieval.semanticFrame,
      assumptions: retrieval.assumptions,
      ontologyHits: retrieval.ontologyHits,
      usedPromotedConcepts: retrieval.usedPromotedConcepts,
      usedValidatedConcepts: retrieval.usedValidatedConcepts,
      graphExpansionTrace: retrieval.graphExpansionTrace,
      validationIssues: retrieval.validationIssues,
      claimCoverage: retrieval.claimCoverage,
      fallbackTriggered: retrieval.fallbackTriggered,
      fallbackSources: retrieval.fallbackSources,
      guardrails: retrieval.guardrails,
      latency: retrieval.latency,
      sectionRouting: retrieval.sectionRouting,
      cacheHits: retrieval.cacheHits,
    };
  }

  async generateChatResponse(request: GroundedChatRequest): Promise<GroundedChatResponse> {
    await this.initialize();
    const startedAt = Date.now();
    let latency = createEmptyLatencyBreakdown();
    const effectiveApiKey =
      this.generationMode === 'server'
        ? resolveServerGenerationApiKey()
        : request.apiKey?.trim();
    if (!effectiveApiKey) {
      throw new Error('API key is required for grounded chat.');
    }

    const ai = new GoogleGenAI({ apiKey: effectiveApiKey });
    if (this.embeddingAi) {
      await this.store.ensureEmbeddings(this.embeddingAi);
    }

    const recentMessages = request.messages.slice(-4);
    const latestUserMessage = [...recentMessages].reverse().find((message) => message.role === 'user')?.text ?? '';
    const activeProfile = this.getActiveProfile(request.retrievalProfileId);
    const answerCacheKey = buildScopedCacheKey([
      this.indexStatus.manifestHash,
      activeProfile.id,
      request.mode,
      request.model,
      ...(request.serviceScopes ?? []),
      recentMessages.map((message) => `${message.role}:${message.text}`).join('\n'),
    ]);
    if (activeProfile.cache.answer) {
      const cached = this.runtimeCache.get<GroundedChatResponse>('answer', answerCacheKey);
      if (cached) {
        return {
          ...cached,
          retrieval: {
            ...cached.retrieval,
            cacheHits: {
              ...cached.retrieval.cacheHits,
              answer: true,
            },
            latency: {
              ...cached.retrieval.latency,
              cacheLookupMs: Date.now() - startedAt,
              totalMs: Date.now() - startedAt,
            },
          },
        };
      }
    }

    const planned = await this.runRetrievalPlan(
      recentMessages,
      request.mode,
      request.serviceScopes,
      request.retrievalProfileId,
    );
    latency = {
      ...planned.latency,
      cacheLookupMs:
        planned.latency.cacheLookupMs +
        (activeProfile.cache.answer ? Math.max(0, Date.now() - startedAt - planned.latency.totalMs) : 0),
    };
    const indexStatus = this.refreshIndexStatus();
    const guardrails: GuardrailResult[] = planned.profile.guardrails.promptInjection
      ? [detectPromptInjectionSignals(latestUserMessage)]
      : [];
    const retrieval = buildRetrievalDiagnostics(
      {
        ...planned.search,
        evidence: planned.evidence,
      },
      planned.normalizedQuery,
      planned.querySources,
      this.getAllSearchChunks(),
      indexStatus,
      planned.scope,
      {
        profile: planned.profile,
        retrievalPriorityClass: planned.retrievalPriorityClass,
        priorityPolicyName: planned.priorityPolicyName,
        selectedServiceScopes: planned.selectedServiceScopes,
        serviceScopeLabels: planned.serviceScopeLabels,
        selectedRetrievalMode: planned.selectedRetrievalMode,
        workflowEventsHit: planned.workflowEventsHit,
        subquestions: planned.subquestions,
        basisCoverage: planned.basisCoverage,
        plannerTrace: planned.plannerTrace,
        normalizationTrace: planned.queryProfile.normalizationTrace,
        aliasResolutions: planned.queryProfile.aliasResolutions,
        parsedLawRefs: planned.queryProfile.parsedLawRefs,
        semanticFrame: planned.queryProfile.semanticFrame,
        assumptions: planned.queryProfile.semanticFrame.assumptions,
        ontologyHits: planned.ontologyHits,
        validationIssues: planned.validationIssues,
        claimCoverage: planned.claimCoverage,
        graphExpansionTrace: planned.graphExpansionTrace,
        fallbackTriggered: planned.fallbackTriggered,
        fallbackSources: planned.fallbackSources,
        guardrails,
        latency,
        sectionRouting: planned.sectionRouting,
        cacheHits: planned.cacheHits,
      },
    );
    this.rememberRetrieval(retrieval, latestUserMessage || planned.normalizedQuery);

    const keyIssueDate = planned.evidence.find((item) => item.effectiveDate)?.effectiveDate;
    const citations = dedupeCitations(planned.evidence);
    const question = latestUserMessage || planned.normalizedQuery;
    const isDefinitionQuery = planned.queryProfile.queryType === 'definition';
    const hasSelectedServiceScope = planned.selectedServiceScopes.some((scope) => scope !== 'all');
    const serviceScopeClarification: ServiceScopeClarification = hasSelectedServiceScope
      ? {
          needsClarification: false,
          candidateScopes: [],
          ambiguitySignals: [],
        }
      : detectServiceScopeClarification(question);
    const clarificationDecision = suppressSelectedServiceScopeClarification(
      planned.profile.queryProcessing.clarify && !isDefinitionQuery
        ? await detectClarificationNeed({
            ai,
            model: request.model,
            recentMessages,
            question,
            normalizedQuery: planned.normalizedQuery,
            mode: request.mode,
            questionArchetype: planned.questionArchetype,
            retrievalMode: planned.selectedRetrievalMode,
            workflowEvents: planned.workflowEventIds,
            serviceScopeClarification,
          })
        : {
            needsClarification: false,
            reason: isDefinitionQuery ? 'clarification-skipped-for-definition-query' : 'clarification-disabled-by-profile',
            missingDimensions: [],
            candidateOptions: [],
          },
      hasSelectedServiceScope ? planned.serviceScopeLabels : [],
    );

    if (clarificationDecision.needsClarification) {
      retrieval.agentDecision = 'clarify';
      retrieval.plannerTrace = [
        ...retrieval.plannerTrace,
        { step: 'agent-decision', detail: `clarify: ${clarificationDecision.reason}` },
      ];
      const answer = applyAnswerScope(
        createExpertClarificationAnswer({
          question,
          decision: clarificationDecision,
          serviceScopeClarification,
        }),
        planned.serviceScopeLabels,
      );
      latency.totalMs = Date.now() - startedAt;
      retrieval.latency = latency;
      return {
        answer,
        text: formatAnswerAsMarkdown(answer),
        search: {
          ...planned.search,
          evidence: planned.evidence,
        },
        citations,
        retrieval,
      };
    }

    if (planned.evidence.length === 0 || planned.search.confidence === 'low') {
      retrieval.agentDecision = 'abstain';
      retrieval.plannerTrace = [
        ...retrieval.plannerTrace,
        { step: 'agent-decision', detail: 'abstain: evidence is empty or confidence is low' },
      ];
      const answer = applyAnswerScope(
        createExpertAbstainAnswer({
          question,
          confidence: planned.search.confidence,
          evidenceState: planned.search.confidence === 'low' ? 'not_enough' : 'partial',
          keyIssueDate,
          evidence: citations,
        }),
        planned.serviceScopeLabels,
      );
      latency.totalMs = Date.now() - startedAt;
      retrieval.latency = latency;
      return {
        answer,
        text: formatAnswerAsMarkdown(answer),
        search: {
          ...planned.search,
          evidence: planned.evidence,
        },
        citations,
        retrieval,
      };
    }

    const planningStartedAt = Date.now();
    const answerPlan = await generateAnswerPlan({
      ai,
      model: request.model,
      brain: this.brain,
      mode: request.mode,
      variant: request.promptVariant,
      sources: this.promptSources,
      question,
      retrievalMode: planned.selectedRetrievalMode,
      questionArchetype: planned.questionArchetype,
      recommendedAnswerType: planned.recommendedAnswerType,
      workflowEventIds: planned.workflowEventIds,
      workflowBriefs: planned.workflowBriefs,
      evidence: planned.evidence,
      knowledgeContext: planned.knowledgeContext,
    });
    const claimPlan = buildClaimPlan({
      question,
      semanticFrame: planned.queryProfile.semanticFrame,
      evidence: planned.evidence,
    });
    latency.planningMs = Date.now() - planningStartedAt;
    retrieval.plannerTrace = [
      ...retrieval.plannerTrace,
      { step: 'planner-answer-type', detail: answerPlan.recommendedAnswerType },
      { step: 'planner-tasks', detail: answerPlan.taskCandidates.map((task) => task.title).join(', ') || 'none' },
      { step: 'planner-claims', detail: claimPlan.claims.map((claim) => `${claim.canonicalSubject}:${claim.predicate}`).join(', ') || 'none' },
    ];

    const answerStartedAt = Date.now();
    const answer = await synthesizeExpertAnswer({
      ai,
      model: request.model,
      mode: request.mode,
      variant: request.promptVariant,
      sources: this.promptSources,
      question,
      brain: this.brain,
      plan: answerPlan,
      evidence: planned.evidence,
      knowledgeContext: planned.knowledgeContext,
      retrievalMode: planned.selectedRetrievalMode,
      priorityClass: planned.retrievalPriorityClass,
      evidenceState:
        planned.search.confidence === 'high'
          ? 'confirmed'
          : planned.search.confidence === 'medium'
            ? 'partial'
            : 'not_enough',
      confidence: planned.search.confidence,
      keyIssueDate,
      claimPlan,
      semanticFrame: planned.queryProfile.semanticFrame,
    });
    latency.answerMs = Date.now() - answerStartedAt;
    const scopedAnswer = applyAnswerScope(answer, planned.serviceScopeLabels);
    const answerEvidenceIds = new Set(scopedAnswer.citations.map((item) => item.evidenceId));
    const resolvedCitations = citations.filter((item) => answerEvidenceIds.has(item.id));
    const finalCitations = resolvedCitations.length > 0 ? resolvedCitations : citations.slice(0, 4);
    const validatedAnswer = validateAnswerEnvelope({
      answer: scopedAnswer,
      semanticFrame: planned.queryProfile.semanticFrame,
      citations: finalCitations,
      evidence: planned.evidence,
      projectRoot: this.projectRoot,
      claimPlan,
    });
    retrieval.validationIssues = validatedAnswer.validationIssues;
    retrieval.claimCoverage = validatedAnswer.claimCoverage;
    let finalAnswer = validatedAnswer.answer;
    if (validatedAnswer.shouldAbstain) {
      retrieval.agentDecision = 'abstain';
      retrieval.plannerTrace = [
        ...retrieval.plannerTrace,
        { step: 'agent-decision', detail: 'abstain: answer validation detected a blocking contradiction' },
      ];
      finalAnswer = applyAnswerScope(
        createExpertAbstainAnswer({
          question,
          confidence: 'low',
          evidenceState: 'not_enough',
          keyIssueDate,
          evidence: finalCitations,
        }),
        planned.serviceScopeLabels,
      );
    }
    finalAnswer = planned.profile.guardrails.piiMasking ? applyPiiMasking(finalAnswer) : finalAnswer;
    if (planned.profile.guardrails.citationWarning) {
      guardrails.push(buildCitationWarning(finalAnswer, finalCitations));
    }
    if (planned.profile.guardrails.hallucinationSignal) {
      guardrails.push(buildHallucinationSignal(finalAnswer, finalCitations));
    }
    if (retrieval.agentDecision !== 'abstain') {
      retrieval.agentDecision = 'answer';
      retrieval.plannerTrace = [
        ...retrieval.plannerTrace,
        { step: 'agent-decision', detail: 'answer: evidence passed grounding, clarification, and validation gates' },
      ];
    }
    retrieval.guardrails = guardrails;
    latency.totalMs = Date.now() - startedAt;
    retrieval.latency = latency;

    const response: GroundedChatResponse = {
      answer: finalAnswer,
      text: formatAnswerAsMarkdown(finalAnswer),
      search: {
        ...planned.search,
        evidence: planned.evidence,
      },
      citations: finalCitations,
      retrieval,
    };
    if (planned.profile.cache.answer) {
      this.runtimeCache.set('answer', answerCacheKey, response, ANSWER_CACHE_TTL_MS);
    }

    return response;
  }
}
