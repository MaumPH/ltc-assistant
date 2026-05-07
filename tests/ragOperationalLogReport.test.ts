import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildOperationalRetrievalLogReport,
  DEFAULT_OPERATIONAL_RANKING_REVIEW_MIN_OCCURRENCES,
  DEFAULT_OPERATIONAL_RETRIEVAL_REPORT_MAX_LIMIT,
  DEFAULT_OPERATIONAL_RETRIEVAL_REPORT_LIMIT,
} from '../src/lib/ragOperationalLogReport';
import type { OperationalRetrievalLogEntry, OperationalReviewSignalType } from '../src/lib/ragOperationalLog';

function makeEntry(
  id: string,
  overrides: Partial<OperationalRetrievalLogEntry> & {
    normalizedQueryHash?: string;
    reviewSignalTypes?: OperationalReviewSignalType[];
  } = {},
): OperationalRetrievalLogEntry {
  const reviewSignalTypes = overrides.reviewSignalTypes ?? ['rank_evidence_gap'];
  return {
    id,
    observedAt: overrides.observedAt ?? `2026-05-07T03:0${id}:00.000Z`,
    queryHash: overrides.queryHash ?? `query-${id}`,
    normalizedQueryHash: overrides.normalizedQueryHash ?? `normalized-${id}`,
    queryPreview: overrides.queryPreview ?? `masked preview ${id}`,
    normalizedQueryPreview: overrides.normalizedQueryPreview ?? `normalized preview ${id}`,
    mode: overrides.mode ?? 'evaluation',
    profileId: overrides.profileId ?? 'balanced',
    selectedServiceScopes: overrides.selectedServiceScopes ?? ['facility'],
    selectedRetrievalMode: overrides.selectedRetrievalMode ?? 'hybrid',
    confidence: overrides.confidence ?? 'medium',
    retrievalReadiness: overrides.retrievalReadiness ?? 'ready',
    topDocuments: overrides.topDocuments ?? [
      {
        rank: 1,
        path: 'knowledge/evaluation/a.md',
        docTitle: 'A',
        selectedAsEvidence: false,
      },
    ],
    evidenceDocumentPaths: overrides.evidenceDocumentPaths ?? ['knowledge/evaluation/b.md'],
    validationIssueCodes: overrides.validationIssueCodes ?? [],
    unsupportedClaims: overrides.unsupportedClaims ?? 0,
    fallbackTriggered: overrides.fallbackTriggered ?? false,
    latency: overrides.latency ?? {
      retrievalMs: 100,
      totalMs: 250,
    },
    reviewSignals: reviewSignalTypes.map((type) => ({
      type,
      detail: `${type} detail`,
    })),
  };
}

describe('buildOperationalRetrievalLogReport', () => {
  it('groups review candidates by normalized query hash without raw query text', () => {
    const report = buildOperationalRetrievalLogReport([
      makeEntry('1', {
        normalizedQueryHash: 'same-query',
        queryPreview: '직원 교육 문의',
        normalizedQueryPreview: '직원 교육 문의',
        observedAt: '2026-05-07T03:01:00.000Z',
        reviewSignalTypes: ['rank_evidence_gap', 'residual_ranking_candidate'],
      }),
      makeEntry('2', {
        normalizedQueryHash: 'same-query',
        queryPreview: '직원교육 문의',
        normalizedQueryPreview: '직원 교육 문의',
        observedAt: '2026-05-07T03:03:00.000Z',
        reviewSignalTypes: ['validation_issue', 'residual_ranking_candidate'],
        validationIssueCodes: ['missing-required-evidence'],
        unsupportedClaims: 1,
        latency: {
          retrievalMs: 140,
          totalMs: 360,
        },
      }),
      makeEntry('3', {
        normalizedQueryHash: 'clean-query',
        reviewSignalTypes: [],
      }),
    ]);

    assert.equal(report.generatedAt.length > 0, true);
    assert.equal(report.window.entryCount, 3);
    assert.equal(report.summary.totalEntries, 3);
    assert.equal(report.summary.reviewCandidateCount, 2);
    assert.equal(report.reviewGroups.length, 1);

    const [group] = report.reviewGroups;
    assert.equal(group.normalizedQueryHash, 'same-query');
    assert.equal(group.queryPreview, '직원교육 문의');
    assert.equal(group.normalizedQueryPreview, '직원 교육 문의');
    assert.equal(group.occurrences, 2);
    assert.deepEqual(group.signalCounts, {
      rank_evidence_gap: 1,
      residual_ranking_candidate: 2,
      validation_issue: 1,
    });
    assert.equal(group.unsupportedClaims, 1);
    assert.deepEqual(group.validationIssueCodes, [{ code: 'missing-required-evidence', occurrences: 1 }]);
    assert.deepEqual(group.averageLatency, {
      retrievalMs: 120,
      totalMs: 305,
    });
  });

  it('orders groups by review signal pressure and applies a limit', () => {
    const report = buildOperationalRetrievalLogReport(
      [
        makeEntry('1', {
          normalizedQueryHash: 'low-pressure',
          observedAt: '2026-05-07T03:01:00.000Z',
          reviewSignalTypes: ['low_confidence'],
        }),
        makeEntry('2', {
          normalizedQueryHash: 'high-pressure',
          observedAt: '2026-05-07T03:02:00.000Z',
          reviewSignalTypes: ['validation_issue', 'unsupported_claim', 'residual_ranking_candidate'],
        }),
      ],
      { limit: 1 },
    );

    assert.equal(report.options.limit, 1);
    assert.equal(report.reviewGroups.length, 1);
    assert.equal(report.reviewGroups[0].normalizedQueryHash, 'high-pressure');
  });

  it('recommends ranking review only after repeated ranking-relevant signals', () => {
    const report = buildOperationalRetrievalLogReport([
      makeEntry('1', {
        normalizedQueryHash: 'repeated-ranking',
        reviewSignalTypes: ['rank_evidence_gap', 'residual_ranking_candidate'],
      }),
      makeEntry('2', {
        normalizedQueryHash: 'repeated-ranking',
        reviewSignalTypes: ['validation_issue', 'residual_ranking_candidate'],
      }),
      makeEntry('3', {
        normalizedQueryHash: 'single-ranking',
        reviewSignalTypes: ['rank_evidence_gap', 'residual_ranking_candidate'],
      }),
    ]);

    const repeated = report.reviewGroups.find((group) => group.normalizedQueryHash === 'repeated-ranking');
    const single = report.reviewGroups.find((group) => group.normalizedQueryHash === 'single-ranking');

    assert.equal(repeated?.decision.action, 'review_ranking');
    assert.equal(repeated?.decision.minOccurrences, DEFAULT_OPERATIONAL_RANKING_REVIEW_MIN_OCCURRENCES);
    assert.equal(single?.decision.action, 'monitor');
  });

  it('uses stable default report options', () => {
    const report = buildOperationalRetrievalLogReport([]);

    assert.equal(report.options.limit, DEFAULT_OPERATIONAL_RETRIEVAL_REPORT_LIMIT);
    assert.equal(report.window.entryCount, 0);
    assert.deepEqual(report.reviewGroups, []);
  });

  it('clamps excessive report limits', () => {
    const report = buildOperationalRetrievalLogReport([], { limit: 10_000 });

    assert.equal(report.options.limit, DEFAULT_OPERATIONAL_RETRIEVAL_REPORT_MAX_LIMIT);
  });
});
