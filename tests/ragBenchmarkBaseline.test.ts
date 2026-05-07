import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PHASE2_FINAL_BENCHMARK_BASELINE,
  validateRagBenchmarkBaseline,
  type RagBenchmarkBaselinePayload,
} from '../src/lib/ragBenchmarkBaseline';

function buildPassingPayload(): RagBenchmarkBaselinePayload {
  return {
    generatedAt: '2026-05-06T14:46:10.399Z',
    totalCases: 27,
    top3Hits: 26,
    top5Hits: 26,
    expectedEvidenceHits: 27,
    forbiddenEvidencePasses: 27,
    requiredCitationHits: 27,
    performance: {
      caseLatencyMs: {
        average: 185.2,
        p95: 623,
      },
      stageLatencyMs: {
        retrievalMs: {
          average: 94.1,
          p95: 176,
        },
      },
    },
    summary: {
      validationSignalPassRate: 1,
      validationSignalChecks: 3,
      claimCoveragePassRate: 1,
      claimCoverageChecks: 3,
    },
  };
}

test('validateRagBenchmarkBaseline accepts the Phase 2 final metrics', () => {
  const result = validateRagBenchmarkBaseline(buildPassingPayload(), PHASE2_FINAL_BENCHMARK_BASELINE);

  assert.equal(result.ok, true);
  assert.deepEqual(result.failures, []);
  assert.equal(result.metrics.top3Recall, 0.963);
  assert.equal(result.metrics.top5Recall, 0.963);
  assert.equal(result.metrics.retrievalAverageMs, 94.1);
  assert.equal(result.metrics.retrievalP95Ms, 176);
});

test('validateRagBenchmarkBaseline reads validation and claim metrics from the benchmark archive root', () => {
  const payload = buildPassingPayload();
  delete payload.summary;
  payload.validationSignalPassRate = 1;
  payload.validationSignalChecks = 3;
  payload.claimCoveragePassRate = 1;
  payload.claimCoverageChecks = 3;

  const result = validateRagBenchmarkBaseline(payload, PHASE2_FINAL_BENCHMARK_BASELINE);

  assert.equal(result.ok, true);
  assert.equal(result.metrics.validationSignalPassRate, 1);
  assert.equal(result.metrics.claimCoveragePassRate, 1);
});

test('validateRagBenchmarkBaseline fails quality regressions against the fixed baseline', () => {
  const payload = buildPassingPayload();
  payload.top3Hits = 25;
  payload.expectedEvidenceHits = 26;
  payload.summary = {
    validationSignalPassRate: 0.667,
    validationSignalChecks: 3,
    claimCoveragePassRate: 1,
    claimCoverageChecks: 3,
  };

  const result = validateRagBenchmarkBaseline(payload, PHASE2_FINAL_BENCHMARK_BASELINE);

  assert.equal(result.ok, false);
  assert.match(result.failures.join('\n'), /Top-3 hits/);
  assert.match(result.failures.join('\n'), /Expected evidence hits/);
  assert.match(result.failures.join('\n'), /Validation signal pass rate/);
});

test('validateRagBenchmarkBaseline fails retrieval latency regressions with headroom thresholds', () => {
  const payload = buildPassingPayload();
  payload.performance = {
    caseLatencyMs: {
      average: 185.2,
      p95: 900,
    },
    stageLatencyMs: {
      retrievalMs: {
        average: 121,
        p95: 251,
      },
    },
  };

  const result = validateRagBenchmarkBaseline(payload, PHASE2_FINAL_BENCHMARK_BASELINE);

  assert.equal(result.ok, false);
  assert.match(result.failures.join('\n'), /Retrieval average latency/);
  assert.match(result.failures.join('\n'), /Retrieval p95 latency/);
  assert.match(result.failures.join('\n'), /Case p95 latency/);
});
