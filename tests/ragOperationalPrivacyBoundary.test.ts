import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildOperationalRetrievalLogEntry } from '../src/lib/ragOperationalLog';
import { buildOperationalRetrievalLogReport } from '../src/lib/ragOperationalLogReport';

describe('operational retrieval privacy boundary', () => {
  it('masks PII in log previews and report output', () => {
    const entry = buildOperationalRetrievalLogEntry(
      {
        query:
          '홍길동 수급자 010-1234-5678, test@example.com, 900101-1234567 정보로 직원교육 기준 알려줘',
        normalizedQuery:
          '홍길동 수급자 010-1234-5678, test@example.com, 900101-1234567 정보로 직원교육 기준 알려줘',
        mode: 'evaluation',
        profileId: 'balanced',
        selectedServiceScopes: ['facility'],
        selectedRetrievalMode: 'hybrid',
        confidence: 'medium',
        retrievalReadiness: 'ready',
        candidateDiagnostics: [
          {
            path: 'knowledge/evaluation/employee-training.md',
            docTitle: '직원교육',
            selectedAsEvidence: false,
          },
        ],
        finalEvidenceDocuments: ['knowledge/evaluation/rights-education.md'],
        validationIssues: [
          {
            code: 'missing-required-evidence',
            severity: 'warning',
          },
        ],
        claimCoverage: {
          unsupportedClaims: 0,
        },
        fallbackTriggered: false,
        latency: {
          retrievalMs: 110,
          totalMs: 260,
        },
      },
      '2026-05-07T04:00:00.000Z',
    );

    const reportJson = JSON.stringify(buildOperationalRetrievalLogReport([entry]));

    assert.match(entry.queryPreview, /\[REDACTED_PHONE\]/);
    assert.match(entry.queryPreview, /\[REDACTED_EMAIL\]/);
    assert.match(entry.queryPreview, /\[REDACTED_ID\]/);
    assert.doesNotMatch(reportJson, /010-1234-5678/);
    assert.doesNotMatch(reportJson, /test@example\.com/);
    assert.doesNotMatch(reportJson, /900101-1234567/);
    assert.doesNotMatch(reportJson, /queryHash/);
  });
});
