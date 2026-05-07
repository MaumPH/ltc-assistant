import type {
  OperationalRetrievalDocument,
  OperationalRetrievalLogEntry,
  OperationalReviewSignalType,
} from './ragOperationalLog';
import type { ConfidenceLevel, PromptMode, RetrievalMode, RetrievalReadiness } from './ragTypes';
import { buildOperationalRetrievalLogSummary, type OperationalRetrievalLogSummary } from './ragOperationalLogView';

export const DEFAULT_OPERATIONAL_RETRIEVAL_REPORT_LIMIT = 20;
export const DEFAULT_OPERATIONAL_RETRIEVAL_REPORT_MAX_LIMIT = 100;
export const DEFAULT_OPERATIONAL_RANKING_REVIEW_MIN_OCCURRENCES = 2;

const RANKING_RELEVANT_REVIEW_SIGNALS = new Set<OperationalReviewSignalType>([
  'validation_issue',
  'unsupported_claim',
  'rank_evidence_gap',
  'residual_ranking_candidate',
]);

export interface OperationalRetrievalLogReportOptions {
  limit?: number;
  rankingReviewMinOccurrences?: number;
}

export interface OperationalRetrievalLogReportCount {
  value: string;
  occurrences: number;
}

export interface OperationalRetrievalLogReportValidationCode {
  code: string;
  occurrences: number;
}

export interface OperationalRetrievalLogReportDocument extends OperationalRetrievalDocument {
  occurrences: number;
  selectedAsEvidenceCount: number;
}

export interface OperationalRankingReviewDecision {
  action: 'monitor' | 'review_ranking';
  reason: string;
  minOccurrences: number;
  observedOccurrences: number;
  rankingRelevantSignalCount: number;
}

export interface OperationalRetrievalLogReportGroup {
  normalizedQueryHash: string;
  queryPreview: string;
  normalizedQueryPreview: string;
  occurrences: number;
  firstObservedAt: string;
  latestObservedAt: string;
  signalCounts: Partial<Record<OperationalReviewSignalType, number>>;
  modes: Partial<Record<PromptMode, number>>;
  profiles: OperationalRetrievalLogReportCount[];
  retrievalModes: Partial<Record<RetrievalMode, number>>;
  readiness: Partial<Record<RetrievalReadiness, number>>;
  confidence: Partial<Record<ConfidenceLevel, number>>;
  topDocuments: OperationalRetrievalLogReportDocument[];
  evidenceDocumentPaths: OperationalRetrievalLogReportCount[];
  validationIssueCodes: OperationalRetrievalLogReportValidationCode[];
  unsupportedClaims: number;
  fallbackCount: number;
  averageLatency: {
    retrievalMs: number;
    totalMs: number;
  };
  decision: OperationalRankingReviewDecision;
}

export interface OperationalRetrievalLogReport {
  generatedAt: string;
  options: {
    limit: number;
    rankingReviewMinOccurrences: number;
  };
  window: {
    entryCount: number;
    firstObservedAt?: string;
    latestObservedAt?: string;
  };
  summary: OperationalRetrievalLogSummary;
  reviewGroups: OperationalRetrievalLogReportGroup[];
}

interface MutableGroup {
  normalizedQueryHash: string;
  queryPreview: string;
  normalizedQueryPreview: string;
  occurrences: number;
  firstObservedAt: string;
  latestObservedAt: string;
  signalCounts: Partial<Record<OperationalReviewSignalType, number>>;
  modes: Partial<Record<PromptMode, number>>;
  profiles: Map<string, number>;
  retrievalModes: Partial<Record<RetrievalMode, number>>;
  readiness: Partial<Record<RetrievalReadiness, number>>;
  confidence: Partial<Record<ConfidenceLevel, number>>;
  topDocuments: Map<string, OperationalRetrievalLogReportDocument>;
  evidenceDocumentPaths: Map<string, number>;
  validationIssueCodes: Map<string, number>;
  unsupportedClaims: number;
  fallbackCount: number;
  retrievalLatencyTotal: number;
  totalLatencyTotal: number;
}

function incrementMap(map: Map<string, number>, value: string, amount = 1): void {
  map.set(value, (map.get(value) ?? 0) + amount);
}

function incrementRecord<K extends string>(record: Partial<Record<K, number>>, value: K, amount = 1): void {
  record[value] = (record[value] ?? 0) + amount;
}

function toSortedCounts(map: Map<string, number>): OperationalRetrievalLogReportCount[] {
  return Array.from(map.entries())
    .map(([value, occurrences]) => ({ value, occurrences }))
    .sort((left, right) => right.occurrences - left.occurrences || left.value.localeCompare(right.value));
}

function toSortedValidationCodes(map: Map<string, number>): OperationalRetrievalLogReportValidationCode[] {
  return Array.from(map.entries())
    .map(([code, occurrences]) => ({ code, occurrences }))
    .sort((left, right) => right.occurrences - left.occurrences || left.code.localeCompare(right.code));
}

function sortRecord<T extends string>(record: Partial<Record<T, number>>): Partial<Record<T, number>> {
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right))) as Partial<
    Record<T, number>
  >;
}

function getSignalPressure(group: OperationalRetrievalLogReportGroup): number {
  return Object.values(group.signalCounts).reduce((sum, count) => sum + (count ?? 0), 0);
}

function normalizeLimit(value: number | undefined): number {
  const parsed =
    Number.isFinite(value) && value && value > 0 ? Math.floor(value) : DEFAULT_OPERATIONAL_RETRIEVAL_REPORT_LIMIT;
  return Math.min(parsed, DEFAULT_OPERATIONAL_RETRIEVAL_REPORT_MAX_LIMIT);
}

function normalizeMinOccurrences(value: number | undefined): number {
  return Number.isFinite(value) && value && value > 0
    ? Math.floor(value)
    : DEFAULT_OPERATIONAL_RANKING_REVIEW_MIN_OCCURRENCES;
}

function buildRankingReviewDecision(
  group: MutableGroup,
  minOccurrences: number,
): OperationalRankingReviewDecision {
  const rankingRelevantSignalCount = Object.entries(group.signalCounts).reduce((sum, [type, count]) => {
    return RANKING_RELEVANT_REVIEW_SIGNALS.has(type as OperationalReviewSignalType) ? sum + (count ?? 0) : sum;
  }, 0);
  const repeatedEnough = group.occurrences >= minOccurrences;
  const hasRankingRelevantSignal = rankingRelevantSignalCount > 0;

  if (repeatedEnough && hasRankingRelevantSignal) {
    return {
      action: 'review_ranking',
      reason: 'Repeated ranking-relevant review signals were observed for the same normalized query hash.',
      minOccurrences,
      observedOccurrences: group.occurrences,
      rankingRelevantSignalCount,
    };
  }

  return {
    action: 'monitor',
    reason: repeatedEnough
      ? 'Repeated entries were observed, but no ranking-relevant review signal is present.'
      : 'Ranking tuning remains deferred until the same normalized query hash repeats.',
    minOccurrences,
    observedOccurrences: group.occurrences,
    rankingRelevantSignalCount,
  };
}

function addEntryToGroup(group: MutableGroup, entry: OperationalRetrievalLogEntry): void {
  group.occurrences += 1;
  if (entry.observedAt < group.firstObservedAt) {
    group.firstObservedAt = entry.observedAt;
  }
  if (entry.observedAt >= group.latestObservedAt) {
    group.latestObservedAt = entry.observedAt;
    group.queryPreview = entry.queryPreview;
    group.normalizedQueryPreview = entry.normalizedQueryPreview;
  }

  for (const signal of entry.reviewSignals) {
    incrementRecord(group.signalCounts, signal.type);
  }
  incrementRecord(group.modes, entry.mode);
  incrementMap(group.profiles, entry.profileId);
  incrementRecord(group.retrievalModes, entry.selectedRetrievalMode);
  incrementRecord(group.readiness, entry.retrievalReadiness);
  incrementRecord(group.confidence, entry.confidence);
  for (const document of entry.topDocuments) {
    const existing = group.topDocuments.get(document.path);
    if (existing) {
      existing.occurrences += 1;
      existing.selectedAsEvidenceCount += document.selectedAsEvidence ? 1 : 0;
    } else {
      group.topDocuments.set(document.path, {
        ...document,
        occurrences: 1,
        selectedAsEvidenceCount: document.selectedAsEvidence ? 1 : 0,
      });
    }
  }
  for (const path of entry.evidenceDocumentPaths) {
    incrementMap(group.evidenceDocumentPaths, path);
  }
  for (const code of entry.validationIssueCodes) {
    incrementMap(group.validationIssueCodes, code);
  }
  group.unsupportedClaims += entry.unsupportedClaims;
  group.fallbackCount += entry.fallbackTriggered ? 1 : 0;
  group.retrievalLatencyTotal += entry.latency.retrievalMs;
  group.totalLatencyTotal += entry.latency.totalMs;
}

function createGroup(entry: OperationalRetrievalLogEntry): MutableGroup {
  const group: MutableGroup = {
    normalizedQueryHash: entry.normalizedQueryHash,
    queryPreview: entry.queryPreview,
    normalizedQueryPreview: entry.normalizedQueryPreview,
    occurrences: 0,
    firstObservedAt: entry.observedAt,
    latestObservedAt: entry.observedAt,
    signalCounts: {},
    modes: {},
    profiles: new Map(),
    retrievalModes: {},
    readiness: {},
    confidence: {},
    topDocuments: new Map(),
    evidenceDocumentPaths: new Map(),
    validationIssueCodes: new Map(),
    unsupportedClaims: 0,
    fallbackCount: 0,
    retrievalLatencyTotal: 0,
    totalLatencyTotal: 0,
  };
  addEntryToGroup(group, entry);
  return group;
}

function finalizeGroup(group: MutableGroup, minOccurrences: number): OperationalRetrievalLogReportGroup {
  const topDocuments = Array.from(group.topDocuments.values()).sort(
    (left, right) =>
      right.selectedAsEvidenceCount - left.selectedAsEvidenceCount ||
      right.occurrences - left.occurrences ||
      left.rank - right.rank ||
      left.path.localeCompare(right.path),
  );

  return {
    normalizedQueryHash: group.normalizedQueryHash,
    queryPreview: group.queryPreview,
    normalizedQueryPreview: group.normalizedQueryPreview,
    occurrences: group.occurrences,
    firstObservedAt: group.firstObservedAt,
    latestObservedAt: group.latestObservedAt,
    signalCounts: sortRecord(group.signalCounts),
    modes: sortRecord(group.modes),
    profiles: toSortedCounts(group.profiles),
    retrievalModes: sortRecord(group.retrievalModes),
    readiness: sortRecord(group.readiness),
    confidence: sortRecord(group.confidence),
    topDocuments,
    evidenceDocumentPaths: toSortedCounts(group.evidenceDocumentPaths),
    validationIssueCodes: toSortedValidationCodes(group.validationIssueCodes),
    unsupportedClaims: group.unsupportedClaims,
    fallbackCount: group.fallbackCount,
    averageLatency: {
      retrievalMs: Math.round(group.retrievalLatencyTotal / group.occurrences),
      totalMs: Math.round(group.totalLatencyTotal / group.occurrences),
    },
    decision: buildRankingReviewDecision(group, minOccurrences),
  };
}

export function buildOperationalRetrievalLogReport(
  entries: OperationalRetrievalLogEntry[],
  options: OperationalRetrievalLogReportOptions = {},
  generatedAt = new Date().toISOString(),
): OperationalRetrievalLogReport {
  const limit = normalizeLimit(options.limit);
  const rankingReviewMinOccurrences = normalizeMinOccurrences(options.rankingReviewMinOccurrences);
  const groups = new Map<string, MutableGroup>();
  let firstObservedAt: string | undefined;
  let latestObservedAt: string | undefined;

  for (const entry of entries) {
    if (!firstObservedAt || entry.observedAt < firstObservedAt) {
      firstObservedAt = entry.observedAt;
    }
    if (!latestObservedAt || entry.observedAt > latestObservedAt) {
      latestObservedAt = entry.observedAt;
    }
    if (entry.reviewSignals.length === 0) {
      continue;
    }

    const existing = groups.get(entry.normalizedQueryHash);
    if (existing) {
      addEntryToGroup(existing, entry);
    } else {
      groups.set(entry.normalizedQueryHash, createGroup(entry));
    }
  }

  const reviewGroups = Array.from(groups.values())
    .map((group) => finalizeGroup(group, rankingReviewMinOccurrences))
    .sort(
      (left, right) =>
        getSignalPressure(right) - getSignalPressure(left) ||
        right.occurrences - left.occurrences ||
        right.latestObservedAt.localeCompare(left.latestObservedAt),
    )
    .slice(0, limit);

  return {
    generatedAt,
    options: {
      limit,
      rankingReviewMinOccurrences,
    },
    window: {
      entryCount: entries.length,
      firstObservedAt,
      latestObservedAt,
    },
    summary: buildOperationalRetrievalLogSummary(entries),
    reviewGroups,
  };
}
