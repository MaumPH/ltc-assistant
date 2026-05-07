import type {
  OperationalRetrievalDocument,
  OperationalRetrievalLogEntry,
  OperationalReviewSignalType,
} from './ragOperationalLog';
import type { ConfidenceLevel, PromptMode, RetrievalMode, RetrievalReadiness } from './ragTypes';

export interface OperationalRetrievalLogViewEntry {
  observedAt: string;
  queryPreview: string;
  normalizedQueryPreview: string;
  mode: PromptMode;
  confidence: ConfidenceLevel;
  selectedRetrievalMode: RetrievalMode;
  retrievalReadiness: RetrievalReadiness;
  profileId: string;
  topDocuments: OperationalRetrievalDocument[];
  evidenceDocumentPaths: string[];
  validationIssueCodes: string[];
  unsupportedClaims: number;
  fallbackTriggered: boolean;
  latency: {
    retrievalMs: number;
    totalMs: number;
  };
  reviewSignals: Array<{
    type: OperationalReviewSignalType;
    detail: string;
  }>;
}

export interface OperationalRetrievalLogSummary {
  totalEntries: number;
  reviewCandidateCount: number;
  signalCounts: Partial<Record<OperationalReviewSignalType, number>>;
  latestObservedAt?: string;
}

export function buildOperationalRetrievalLogSummary(
  entries: Array<OperationalRetrievalLogEntry | OperationalRetrievalLogViewEntry>,
): OperationalRetrievalLogSummary {
  const signalCounts: Partial<Record<OperationalReviewSignalType, number>> = {};
  let reviewCandidateCount = 0;

  for (const entry of entries) {
    if (entry.reviewSignals.length > 0) {
      reviewCandidateCount += 1;
    }
    for (const signal of entry.reviewSignals) {
      signalCounts[signal.type] = (signalCounts[signal.type] ?? 0) + 1;
    }
  }

  return {
    totalEntries: entries.length,
    reviewCandidateCount,
    signalCounts: Object.fromEntries(Object.entries(signalCounts).sort(([left], [right]) => left.localeCompare(right))),
    latestObservedAt: entries[0]?.observedAt,
  };
}

export function getOperationalReviewSignalLabel(type: OperationalReviewSignalType): string {
  switch (type) {
    case 'low_confidence':
      return 'Low confidence';
    case 'validation_issue':
      return 'Validation';
    case 'unsupported_claim':
      return 'Unsupported claim';
    case 'fallback_used':
      return 'Fallback';
    case 'rank_evidence_gap':
      return 'Rank/evidence gap';
    case 'residual_ranking_candidate':
      return 'Residual ranking';
  }
}

export function getOperationalReviewSignalTone(type: OperationalReviewSignalType): string {
  switch (type) {
    case 'low_confidence':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'validation_issue':
      return 'border-orange-200 bg-orange-50 text-orange-700';
    case 'unsupported_claim':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'fallback_used':
      return 'border-violet-200 bg-violet-50 text-violet-700';
    case 'rank_evidence_gap':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    case 'residual_ranking_candidate':
      return 'border-slate-300 bg-white text-slate-700';
  }
}
