import { deriveFocusTerms } from './ragEngine';
import { buildEvidenceBalance, describeHybridReadiness, inferAgentDecision } from './ragDiagnostics';
import { getRetrievalProfile } from './ragProfiles';
import { RETRIEVAL_PRIORITY_POLICY_NAME } from './retrievalPriority';
import { safeTrim } from './textGuards';
import {
  buildCandidateDiagnostics,
  buildChunkWindowRef,
  buildRetrievalStageTrace,
  summarizeSectionRouting,
  uniqueDocumentPaths,
  type RetrievalScopeContext,
} from './retrievalPipeline';
import type {
  CacheHitSummary,
  ChunkWindowRef,
  ClaimCoverage,
  GuardrailResult,
  GraphExpansionTrace,
  IndexStatus,
  LawAliasResolution,
  LawFallbackSource,
  OntologyHit,
  RetrievalDiagnostics,
  RetrievalMode,
  RetrievalPriorityClass,
  RetrievalProfile,
  SearchRun,
  SectionRoutingDecision,
  ServiceScopeId,
  StageLatencyBreakdown,
  StructuredChunk,
  ValidationIssue,
} from './ragTypes';

export function createEmptyLatencyBreakdown(): StageLatencyBreakdown {
  return {
    queryNormalizationMs: 0,
    cacheLookupMs: 0,
    hydeMs: 0,
    retrievalMs: 0,
    fallbackMs: 0,
    planningMs: 0,
    answerMs: 0,
    totalMs: 0,
  };
}

export function createEmptyCacheHitSummary(): CacheHitSummary {
  return {
    normalization: false,
    hyde: false,
    retrieval: false,
    fallback: false,
    answer: false,
  };
}

export function collectNeighborWindows(allChunks: StructuredChunk[], evidence: StructuredChunk[]): ChunkWindowRef[] {
  const byParentSection = new Map<string, StructuredChunk[]>();
  for (const chunk of allChunks) {
    const key = `${chunk.documentId}:${chunk.parentSectionId}`;
    const list = byParentSection.get(key) ?? [];
    list.push(chunk);
    byParentSection.set(key, list);
  }

  const refs = new Map<string, ChunkWindowRef>();
  for (const chunk of evidence) {
    const key = `${chunk.documentId}:${chunk.parentSectionId}`;
    const sectionChunks = (byParentSection.get(key) ?? []).slice().sort((left, right) => left.windowIndex - right.windowIndex);
    const currentIndex = sectionChunks.findIndex((item) => item.id === chunk.id);
    if (currentIndex < 0) continue;

    const current = sectionChunks[currentIndex];
    refs.set(`${current.id}:current`, buildChunkWindowRef(current, 'current', true));

    const previous = sectionChunks[currentIndex - 1];
    if (previous) {
      refs.set(`${previous.id}:previous`, buildChunkWindowRef(previous, 'previous', false));
    }

    const next = sectionChunks[currentIndex + 1];
    if (next) {
      refs.set(`${next.id}:next`, buildChunkWindowRef(next, 'next', false));
    }
  }

  return Array.from(refs.values()).sort((left, right) => {
    const pathDiff = left.path.localeCompare(right.path, 'ko');
    if (pathDiff !== 0) return pathDiff;
    if (left.parentSectionId !== right.parentSectionId) return left.parentSectionId.localeCompare(right.parentSectionId);
    return left.windowIndex - right.windowIndex;
  });
}

function uniqueNonEmptyLines(values: unknown[]): string[] {
  return Array.from(new Set(values.map((value) => safeTrim(value)).filter(Boolean)));
}

export function buildRetrievalDiagnostics(
  search: SearchRun,
  normalizedQuery: string,
  querySources: string[],
  allChunks: StructuredChunk[],
  indexStatus: IndexStatus,
  scope: RetrievalScopeContext,
  extras?: {
    profile?: RetrievalProfile;
    retrievalPriorityClass?: RetrievalPriorityClass;
    priorityPolicyName?: string;
    selectedServiceScopes?: ServiceScopeId[];
    serviceScopeLabels?: string[];
    selectedRetrievalMode?: RetrievalMode;
    workflowEventsHit?: string[];
    subquestions?: string[];
    basisCoverage?: Record<'legal' | 'evaluation' | 'practical', number>;
    plannerTrace?: Array<{ step: string; detail: string }>;
    normalizationTrace?: RetrievalDiagnostics['normalizationTrace'];
    aliasResolutions?: LawAliasResolution[];
    parsedLawRefs?: RetrievalDiagnostics['parsedLawRefs'];
    semanticFrame?: RetrievalDiagnostics['semanticFrame'];
    assumptions?: RetrievalDiagnostics['assumptions'];
    ontologyHits?: OntologyHit[];
    validationIssues?: ValidationIssue[];
    claimCoverage?: ClaimCoverage;
    graphExpansionTrace?: GraphExpansionTrace[];
    fallbackTriggered?: boolean;
    fallbackSources?: LawFallbackSource[];
    agentDecision?: RetrievalDiagnostics['agentDecision'];
    guardrails?: GuardrailResult[];
    latency?: StageLatencyBreakdown;
    sectionRouting?: SectionRoutingDecision;
    cacheHits?: CacheHitSummary;
  },
): RetrievalDiagnostics {
  const neighborWindows = collectNeighborWindows(allChunks, search.evidence);
  const candidateDiagnostics = buildCandidateDiagnostics(search, neighborWindows, scope);
  const basisCoverage = extras?.basisCoverage ?? { legal: 0, evaluation: 0, practical: 0 };
  const agentDecision =
    extras?.agentDecision ??
    inferAgentDecision({
      confidence: search.confidence,
      evidenceCount: search.evidence.length,
    });
  const usedPromotedConcepts = uniqueNonEmptyLines(
    (extras?.ontologyHits ?? [])
      .filter((hit) => hit.status === 'promoted')
      .map((hit) => hit.label),
  );
  const usedValidatedConcepts = uniqueNonEmptyLines(
    (extras?.ontologyHits ?? [])
      .filter((hit) => hit.status === 'validated')
      .map((hit) => hit.label),
  );

  return {
    normalizedQuery,
    querySources,
    profile: extras?.profile ?? getRetrievalProfile(undefined),
    retrievalPriorityClass: extras?.retrievalPriorityClass ?? 'operational_workflow',
    priorityPolicyName: extras?.priorityPolicyName ?? RETRIEVAL_PRIORITY_POLICY_NAME,
    selectedServiceScopes: extras?.selectedServiceScopes ?? ['all'],
    serviceScopeLabels: extras?.serviceScopeLabels ?? ['전체/공통'],
    matchedDocumentPaths: Array.from(new Set(search.evidence.map((item) => item.path))),
    candidateDiagnostics,
    focusTerms: search.focusTerms ?? deriveFocusTerms(search.query),
    mismatchSignals: search.mismatchSignals ?? [],
    groundingGatePassed: search.groundingGatePassed ?? false,
    stageTrace: buildRetrievalStageTrace(search, normalizedQuery, querySources, scope),
    retrievalReadiness: indexStatus.retrievalReadiness,
    hybridReadinessReason: describeHybridReadiness(indexStatus),
    evidenceBalance: buildEvidenceBalance(basisCoverage),
    agentDecision,
    neighborWindows,
    rejectionReasons: candidateDiagnostics
      .filter((candidate) => candidate.rejectionReasons.length > 0)
      .map((candidate) => ({
        candidateId: candidate.id,
        reasons: candidate.rejectionReasons,
      })),
    routingDocuments: scope.routingDocuments,
    primaryExpansionDocuments: scope.primaryExpansionDocuments,
    finalEvidenceDocuments: uniqueDocumentPaths(search.evidence),
    selectedRetrievalMode: extras?.selectedRetrievalMode ?? 'local',
    workflowEventsHit: extras?.workflowEventsHit ?? [],
    subquestions: extras?.subquestions ?? [],
    basisCoverage,
    plannerTrace: extras?.plannerTrace ?? [],
    normalizationTrace: extras?.normalizationTrace ?? [],
    aliasResolutions: extras?.aliasResolutions ?? [],
    parsedLawRefs: extras?.parsedLawRefs ?? [],
    semanticFrame: extras?.semanticFrame ?? {
      primaryIntent: 'compliance',
      secondaryIntents: [],
      canonicalTerms: [],
      entityRefs: [],
      relationRequests: [],
      slots: {},
      assumptions: [],
      missingCriticalSlots: [],
      riskLevel: 'low',
    },
    assumptions: extras?.assumptions ?? [],
    ontologyHits: extras?.ontologyHits ?? [],
    usedPromotedConcepts,
    usedValidatedConcepts,
    graphExpansionTrace: extras?.graphExpansionTrace ?? [],
    validationIssues: extras?.validationIssues ?? [],
    claimCoverage: extras?.claimCoverage ?? {
      totalClaims: 0,
      supportedClaims: 0,
      partiallySupportedClaims: 0,
      unsupportedClaims: 0,
      details: [],
    },
    fallbackTriggered: extras?.fallbackTriggered ?? false,
    fallbackSources: extras?.fallbackSources ?? [],
    guardrails: extras?.guardrails ?? [],
    latency: extras?.latency ?? createEmptyLatencyBreakdown(),
    sectionRouting: extras?.sectionRouting ?? summarizeSectionRouting(search.evidence, false),
    cacheHits: extras?.cacheHits ?? createEmptyCacheHitSummary(),
  };
}
