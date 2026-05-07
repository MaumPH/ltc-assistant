export interface RagBenchmarkLatencyPayload {
  average?: number;
  p95?: number;
}

export interface RagBenchmarkBaselinePayload {
  generatedAt?: string;
  totalCases?: number;
  top3Hits?: number;
  top5Hits?: number;
  expectedEvidenceHits?: number;
  forbiddenEvidencePasses?: number;
  requiredCitationHits?: number;
  validationSignalPassRate?: number;
  validationSignalChecks?: number;
  claimCoveragePassRate?: number;
  claimCoverageChecks?: number;
  performance?: {
    caseLatencyMs?: RagBenchmarkLatencyPayload;
    stageLatencyMs?: {
      retrievalMs?: RagBenchmarkLatencyPayload;
    };
  };
  summary?: {
    validationSignalPassRate?: number;
    validationSignalChecks?: number;
    claimCoveragePassRate?: number;
    claimCoverageChecks?: number;
  };
}

export interface RagBenchmarkBaseline {
  label: string;
  archivePath: string;
  expectedGeneratedAt: string;
  expectedTotalCases: number;
  minTop3Hits: number;
  minTop5Hits: number;
  requireExpectedEvidencePass: boolean;
  requireForbiddenEvidencePass: boolean;
  requireRequiredCitationPass: boolean;
  minValidationSignalPassRate: number;
  minValidationSignalChecks: number;
  minClaimCoveragePassRate: number;
  minClaimCoverageChecks: number;
  maxRetrievalAverageMs: number;
  maxRetrievalP95Ms: number;
  maxCaseP95Ms: number;
}

export interface RagBenchmarkBaselineMetrics {
  totalCases: number;
  top3Hits: number;
  top5Hits: number;
  top3Recall: number;
  top5Recall: number;
  expectedEvidenceHits: number;
  forbiddenEvidencePasses: number;
  requiredCitationHits: number;
  validationSignalPassRate: number;
  validationSignalChecks: number;
  claimCoveragePassRate: number;
  claimCoverageChecks: number;
  retrievalAverageMs: number;
  retrievalP95Ms: number;
  caseP95Ms: number;
}

export interface RagBenchmarkBaselineValidation {
  ok: boolean;
  failures: string[];
  metrics: RagBenchmarkBaselineMetrics;
}

export const PHASE2_FINAL_BENCHMARK_BASELINE: RagBenchmarkBaseline = {
  label: 'Phase 2 final RAG benchmark',
  archivePath: 'benchmarks/results/rag-benchmark-2026-05-06T14-46-10-399Z.json',
  expectedGeneratedAt: '2026-05-06T14:46:10.399Z',
  expectedTotalCases: 27,
  minTop3Hits: 26,
  minTop5Hits: 26,
  requireExpectedEvidencePass: true,
  requireForbiddenEvidencePass: true,
  requireRequiredCitationPass: true,
  minValidationSignalPassRate: 1,
  minValidationSignalChecks: 3,
  minClaimCoveragePassRate: 1,
  minClaimCoverageChecks: 3,
  maxRetrievalAverageMs: 120,
  maxRetrievalP95Ms: 250,
  maxCaseP95Ms: 750,
};

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function roundedRatio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

function pushMinimumFailure(
  failures: string[],
  label: string,
  actual: number,
  expected: number,
  unit = '',
) {
  if (actual < expected) {
    failures.push(`${label} ${actual}${unit} is below baseline ${expected}${unit}.`);
  }
}

function pushMaximumFailure(
  failures: string[],
  label: string,
  actual: number,
  expected: number,
  unit = '',
) {
  if (actual > expected) {
    failures.push(`${label} ${actual}${unit} exceeds baseline ${expected}${unit}.`);
  }
}

export function validateRagBenchmarkBaseline(
  payload: RagBenchmarkBaselinePayload,
  baseline: RagBenchmarkBaseline = PHASE2_FINAL_BENCHMARK_BASELINE,
): RagBenchmarkBaselineValidation {
  const totalCases = numberOrZero(payload.totalCases);
  const top3Hits = numberOrZero(payload.top3Hits);
  const top5Hits = numberOrZero(payload.top5Hits);
  const expectedEvidenceHits = numberOrZero(payload.expectedEvidenceHits);
  const forbiddenEvidencePasses = numberOrZero(payload.forbiddenEvidencePasses);
  const requiredCitationHits = numberOrZero(payload.requiredCitationHits);
  const validationSignalPassRate = numberOrZero(
    payload.summary?.validationSignalPassRate ?? payload.validationSignalPassRate,
  );
  const validationSignalChecks = numberOrZero(payload.summary?.validationSignalChecks ?? payload.validationSignalChecks);
  const claimCoveragePassRate = numberOrZero(payload.summary?.claimCoveragePassRate ?? payload.claimCoveragePassRate);
  const claimCoverageChecks = numberOrZero(payload.summary?.claimCoverageChecks ?? payload.claimCoverageChecks);
  const retrievalAverageMs = numberOrZero(payload.performance?.stageLatencyMs?.retrievalMs?.average);
  const retrievalP95Ms = numberOrZero(payload.performance?.stageLatencyMs?.retrievalMs?.p95);
  const caseP95Ms = numberOrZero(payload.performance?.caseLatencyMs?.p95);

  const metrics: RagBenchmarkBaselineMetrics = {
    totalCases,
    top3Hits,
    top5Hits,
    top3Recall: roundedRatio(top3Hits, totalCases),
    top5Recall: roundedRatio(top5Hits, totalCases),
    expectedEvidenceHits,
    forbiddenEvidencePasses,
    requiredCitationHits,
    validationSignalPassRate,
    validationSignalChecks,
    claimCoveragePassRate,
    claimCoverageChecks,
    retrievalAverageMs,
    retrievalP95Ms,
    caseP95Ms,
  };

  const failures: string[] = [];

  if (payload.generatedAt !== baseline.expectedGeneratedAt) {
    failures.push(
      `Benchmark archive generatedAt ${payload.generatedAt ?? '<missing>'} does not match ${baseline.expectedGeneratedAt}.`,
    );
  }

  if (totalCases !== baseline.expectedTotalCases) {
    failures.push(`Total cases ${totalCases} does not match baseline ${baseline.expectedTotalCases}.`);
  }

  pushMinimumFailure(failures, 'Top-3 hits', top3Hits, baseline.minTop3Hits);
  pushMinimumFailure(failures, 'Top-5 hits', top5Hits, baseline.minTop5Hits);

  if (baseline.requireExpectedEvidencePass && expectedEvidenceHits !== totalCases) {
    failures.push(`Expected evidence hits ${expectedEvidenceHits} does not cover all ${totalCases} cases.`);
  }
  if (baseline.requireForbiddenEvidencePass && forbiddenEvidencePasses !== totalCases) {
    failures.push(`Forbidden evidence passes ${forbiddenEvidencePasses} does not cover all ${totalCases} cases.`);
  }
  if (baseline.requireRequiredCitationPass && requiredCitationHits !== totalCases) {
    failures.push(`Required citation hits ${requiredCitationHits} does not cover all ${totalCases} cases.`);
  }

  pushMinimumFailure(
    failures,
    'Validation signal pass rate',
    validationSignalPassRate,
    baseline.minValidationSignalPassRate,
  );
  pushMinimumFailure(failures, 'Validation signal checks', validationSignalChecks, baseline.minValidationSignalChecks);
  pushMinimumFailure(failures, 'Claim coverage pass rate', claimCoveragePassRate, baseline.minClaimCoveragePassRate);
  pushMinimumFailure(failures, 'Claim coverage checks', claimCoverageChecks, baseline.minClaimCoverageChecks);
  pushMaximumFailure(failures, 'Retrieval average latency', retrievalAverageMs, baseline.maxRetrievalAverageMs, 'ms');
  pushMaximumFailure(failures, 'Retrieval p95 latency', retrievalP95Ms, baseline.maxRetrievalP95Ms, 'ms');
  pushMaximumFailure(failures, 'Case p95 latency', caseP95Ms, baseline.maxCaseP95Ms, 'ms');

  return {
    ok: failures.length === 0,
    failures,
    metrics,
  };
}
