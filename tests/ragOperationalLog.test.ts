import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOperationalRetrievalLogEntry,
  rememberOperationalRetrievalLog,
  type OperationalRetrievalLogInput,
} from '../src/lib/ragOperationalLog';

function buildInput(overrides: Partial<OperationalRetrievalLogInput> = {}): OperationalRetrievalLogInput {
  return {
    query: '홍길동 010-1234-5678 직원 인권보호 교육은 어떤 문서를 봐야 하나요?',
    normalizedQuery: '직원 인권보호 교육 문서',
    mode: 'evaluation',
    profileId: 'balanced',
    selectedServiceScopes: ['day_night_care'],
    selectedRetrievalMode: 'local',
    confidence: 'medium',
    retrievalReadiness: 'lexical_only',
    candidateDiagnostics: [
      {
        path: 'knowledge/evaluation/manual.md',
        docTitle: '2026년 주야간보호 평가매뉴얼',
        selectedAsEvidence: false,
      },
      {
        path: 'knowledge/evaluation/01-07-rights.md',
        docTitle: '01-07-직원인권보호',
        selectedAsEvidence: true,
      },
    ],
    finalEvidenceDocuments: ['knowledge/evaluation/01-07-rights.md'],
    validationIssues: [{ code: 'authority-mismatch', severity: 'warning' }],
    claimCoverage: {
      totalClaims: 2,
      supportedClaims: 1,
      partiallySupportedClaims: 0,
      unsupportedClaims: 1,
    },
    fallbackTriggered: false,
    latency: {
      retrievalMs: 148,
      totalMs: 240,
    },
    ...overrides,
  };
}

test('buildOperationalRetrievalLogEntry stores a masked preview and query hash', () => {
  const entry = buildOperationalRetrievalLogEntry(buildInput(), '2026-05-07T01:02:03.004Z');

  assert.equal(entry.observedAt, '2026-05-07T01:02:03.004Z');
  assert.equal(entry.queryPreview.includes('010-1234-5678'), false);
  assert.match(entry.queryPreview, /\[REDACTED_PHONE\]/);
  assert.equal(entry.queryHash.length, 40);
  assert.equal(entry.normalizedQueryHash.length, 40);
  assert.notEqual(entry.queryHash, entry.normalizedQueryHash);
});

test('buildOperationalRetrievalLogEntry records ranking and validation review signals', () => {
  const entry = buildOperationalRetrievalLogEntry(buildInput(), '2026-05-07T01:02:03.004Z');

  assert.deepEqual(
    entry.reviewSignals.map((signal) => signal.type),
    ['validation_issue', 'unsupported_claim', 'rank_evidence_gap', 'residual_ranking_candidate'],
  );
  assert.deepEqual(entry.topDocuments.map((document) => document.rank), [1, 2]);
  assert.equal(entry.topDocuments[0].selectedAsEvidence, false);
  assert.deepEqual(entry.validationIssueCodes, ['authority-mismatch']);
});

test('buildOperationalRetrievalLogEntry records low confidence and fallback signals', () => {
  const entry = buildOperationalRetrievalLogEntry(
    buildInput({
      confidence: 'low',
      fallbackTriggered: true,
      validationIssues: [],
      claimCoverage: {
        totalClaims: 1,
        supportedClaims: 1,
        partiallySupportedClaims: 0,
        unsupportedClaims: 0,
      },
    }),
    '2026-05-07T01:02:03.004Z',
  );

  assert.deepEqual(
    entry.reviewSignals.map((signal) => signal.type),
    ['low_confidence', 'fallback_used', 'rank_evidence_gap', 'residual_ranking_candidate'],
  );
});

test('rememberOperationalRetrievalLog prepends entries and enforces the configured limit', () => {
  const entries = [
    buildOperationalRetrievalLogEntry(buildInput({ query: 'old' }), '2026-05-07T01:00:00.000Z'),
    buildOperationalRetrievalLogEntry(buildInput({ query: 'middle' }), '2026-05-07T01:01:00.000Z'),
  ];
  const next = buildOperationalRetrievalLogEntry(buildInput({ query: 'new' }), '2026-05-07T01:02:00.000Z');

  rememberOperationalRetrievalLog(entries, next, 2);

  assert.deepEqual(entries.map((entry) => entry.observedAt), ['2026-05-07T01:02:00.000Z', '2026-05-07T01:00:00.000Z']);
});
