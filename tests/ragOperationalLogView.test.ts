import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOperationalRetrievalLogSummary,
  getOperationalReviewSignalLabel,
  getOperationalReviewSignalTone,
  type OperationalRetrievalLogViewEntry,
} from '../src/lib/ragOperationalLogView';

function buildEntry(overrides: Partial<OperationalRetrievalLogViewEntry> = {}): OperationalRetrievalLogViewEntry {
  return {
    observedAt: '2026-05-07T03:00:00.000Z',
    queryPreview: '직원 인권보호 교육',
    normalizedQueryPreview: '직원 인권보호 교육',
    mode: 'evaluation',
    confidence: 'medium',
    selectedRetrievalMode: 'local',
    retrievalReadiness: 'lexical_only',
    profileId: 'balanced',
    topDocuments: [
      {
        rank: 1,
        docTitle: '2026년 주야간보호 평가매뉴얼',
        path: 'knowledge/evaluation/manual.md',
        selectedAsEvidence: false,
      },
    ],
    evidenceDocumentPaths: ['knowledge/evaluation/01-07-rights.md'],
    validationIssueCodes: [],
    unsupportedClaims: 0,
    fallbackTriggered: false,
    latency: {
      retrievalMs: 148,
      totalMs: 240,
    },
    reviewSignals: [
      {
        type: 'rank_evidence_gap',
        detail: 'The top ranked document was not selected as final evidence.',
      },
    ],
    ...overrides,
  };
}

test('buildOperationalRetrievalLogSummary counts entries and review signals', () => {
  const summary = buildOperationalRetrievalLogSummary([
    buildEntry(),
    buildEntry({
      mode: 'integrated',
      confidence: 'low',
      reviewSignals: [
        { type: 'low_confidence', detail: 'low confidence' },
        { type: 'fallback_used', detail: 'fallback used' },
      ],
    }),
  ]);

  assert.equal(summary.totalEntries, 2);
  assert.equal(summary.reviewCandidateCount, 2);
  assert.deepEqual(summary.signalCounts, {
    fallback_used: 1,
    low_confidence: 1,
    rank_evidence_gap: 1,
  });
  assert.equal(summary.latestObservedAt, '2026-05-07T03:00:00.000Z');
});

test('buildOperationalRetrievalLogSummary returns stable empty summary', () => {
  const summary = buildOperationalRetrievalLogSummary([]);

  assert.deepEqual(summary, {
    totalEntries: 0,
    reviewCandidateCount: 0,
    signalCounts: {},
    latestObservedAt: undefined,
  });
});

test('review signal label and tone are stable for admin UI', () => {
  assert.equal(getOperationalReviewSignalLabel('residual_ranking_candidate'), 'Residual ranking');
  assert.equal(getOperationalReviewSignalLabel('rank_evidence_gap'), 'Rank/evidence gap');
  assert.match(getOperationalReviewSignalTone('unsupported_claim'), /rose/);
  assert.match(getOperationalReviewSignalTone('fallback_used'), /violet/);
});
