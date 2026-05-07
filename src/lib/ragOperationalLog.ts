import { sha1 } from './ragMetadata';
import type { ConfidenceLevel, PromptMode, RetrievalMode, RetrievalReadiness, ServiceScopeId } from './ragTypes';

const PHONE_RE = /(?:\+?82[-\s]?)?0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}/g;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const RESIDENT_ID_RE = /\b\d{6}[-\s]?[1-4]\d{6}\b/g;
const DEFAULT_PREVIEW_LIMIT = 120;

export type OperationalReviewSignalType =
  | 'low_confidence'
  | 'validation_issue'
  | 'unsupported_claim'
  | 'fallback_used'
  | 'rank_evidence_gap'
  | 'residual_ranking_candidate';

export interface OperationalReviewSignal {
  type: OperationalReviewSignalType;
  detail: string;
}

export interface OperationalRetrievalDocument {
  rank: number;
  path: string;
  docTitle: string;
  selectedAsEvidence: boolean;
}

export interface OperationalRetrievalLogEntry {
  id: string;
  observedAt: string;
  queryHash: string;
  normalizedQueryHash: string;
  queryPreview: string;
  normalizedQueryPreview: string;
  mode: PromptMode;
  profileId: string;
  selectedServiceScopes: ServiceScopeId[];
  selectedRetrievalMode: RetrievalMode;
  confidence: ConfidenceLevel;
  retrievalReadiness: RetrievalReadiness;
  topDocuments: OperationalRetrievalDocument[];
  evidenceDocumentPaths: string[];
  validationIssueCodes: string[];
  unsupportedClaims: number;
  fallbackTriggered: boolean;
  latency: {
    retrievalMs: number;
    totalMs: number;
  };
  reviewSignals: OperationalReviewSignal[];
}

export interface OperationalRetrievalLogInput {
  query: string;
  normalizedQuery: string;
  mode: PromptMode;
  profileId: string;
  selectedServiceScopes: ServiceScopeId[];
  selectedRetrievalMode: RetrievalMode;
  confidence: ConfidenceLevel;
  retrievalReadiness: RetrievalReadiness;
  candidateDiagnostics: Array<{
    path: string;
    docTitle: string;
    selectedAsEvidence: boolean;
  }>;
  finalEvidenceDocuments: string[];
  validationIssues: Array<{
    code: string;
    severity: string;
  }>;
  claimCoverage: {
    unsupportedClaims: number;
  };
  fallbackTriggered: boolean;
  latency: {
    retrievalMs: number;
    totalMs: number;
  };
}

export interface OperationalRetrievalLogResponse {
  updatedAt: string;
  entries: OperationalRetrievalLogEntry[];
}

function maskSensitiveText(value: string): string {
  return value
    .replace(RESIDENT_ID_RE, '[REDACTED_ID]')
    .replace(PHONE_RE, '[REDACTED_PHONE]')
    .replace(EMAIL_RE, '[REDACTED_EMAIL]');
}

function buildPreview(value: string, limit = DEFAULT_PREVIEW_LIMIT): string {
  const compact = maskSensitiveText(value).replace(/\s+/g, ' ').trim();
  if (compact.length <= limit) return compact;
  return `${compact.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function buildReviewSignals(input: OperationalRetrievalLogInput): OperationalReviewSignal[] {
  const signals: OperationalReviewSignal[] = [];
  const topDocument = input.candidateDiagnostics[0];
  const hasValidationIssues = input.validationIssues.length > 0;
  const unsupportedClaims = input.claimCoverage.unsupportedClaims;
  const rankEvidenceGap = Boolean(topDocument && !topDocument.selectedAsEvidence && input.finalEvidenceDocuments.length > 0);

  if (input.confidence === 'low') {
    signals.push({
      type: 'low_confidence',
      detail: 'Retrieval confidence was low for a real user query.',
    });
  }
  if (hasValidationIssues) {
    signals.push({
      type: 'validation_issue',
      detail: `Validation issues: ${input.validationIssues.map((issue) => issue.code).join(', ')}`,
    });
  }
  if (unsupportedClaims > 0) {
    signals.push({
      type: 'unsupported_claim',
      detail: `${unsupportedClaims} answer claims were unsupported.`,
    });
  }
  if (input.fallbackTriggered) {
    signals.push({
      type: 'fallback_used',
      detail: 'Law fallback was used for this query.',
    });
  }
  if (rankEvidenceGap) {
    signals.push({
      type: 'rank_evidence_gap',
      detail: 'The top ranked document was not selected as final evidence.',
    });
  }
  if (input.mode === 'evaluation' && (rankEvidenceGap || hasValidationIssues || unsupportedClaims > 0)) {
    signals.push({
      type: 'residual_ranking_candidate',
      detail: 'Evaluation retrieval should be reviewed when enough similar user queries accumulate.',
    });
  }

  return signals;
}

export function buildOperationalRetrievalLogEntry(
  input: OperationalRetrievalLogInput,
  observedAt = new Date().toISOString(),
): OperationalRetrievalLogEntry {
  const normalizedQuery = input.normalizedQuery || input.query;
  const queryHash = sha1(input.query);
  return {
    id: sha1(`${observedAt}|${queryHash}|${input.mode}|${input.profileId}`).slice(0, 16),
    observedAt,
    queryHash,
    normalizedQueryHash: sha1(normalizedQuery),
    queryPreview: buildPreview(input.query),
    normalizedQueryPreview: buildPreview(normalizedQuery),
    mode: input.mode,
    profileId: input.profileId,
    selectedServiceScopes: input.selectedServiceScopes,
    selectedRetrievalMode: input.selectedRetrievalMode,
    confidence: input.confidence,
    retrievalReadiness: input.retrievalReadiness,
    topDocuments: input.candidateDiagnostics.slice(0, 5).map((candidate, index) => ({
      rank: index + 1,
      path: candidate.path,
      docTitle: candidate.docTitle,
      selectedAsEvidence: candidate.selectedAsEvidence,
    })),
    evidenceDocumentPaths: input.finalEvidenceDocuments,
    validationIssueCodes: input.validationIssues.map((issue) => issue.code),
    unsupportedClaims: input.claimCoverage.unsupportedClaims,
    fallbackTriggered: input.fallbackTriggered,
    latency: {
      retrievalMs: input.latency.retrievalMs,
      totalMs: input.latency.totalMs,
    },
    reviewSignals: buildReviewSignals(input),
  };
}

export function rememberOperationalRetrievalLog(
  entries: OperationalRetrievalLogEntry[],
  entry: OperationalRetrievalLogEntry,
  limit: number,
): void {
  entries.unshift(entry);
  if (entries.length > limit) {
    entries.splice(limit);
  }
}
