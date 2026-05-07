import type { CacheHitSummary, StageLatencyBreakdown } from './ragTypes';

export interface RagCacheBenchmarkRunInput {
  id: string;
  iteration: number;
  latency?: Partial<StageLatencyBreakdown>;
  cacheHits?: Partial<CacheHitSummary>;
}

export interface RagCacheBenchmarkInput {
  generatedAt: string;
  totalDurationMs: number;
  runs: RagCacheBenchmarkRunInput[];
}

export interface RagCacheBenchmarkCaseSummary {
  id: string;
  coldIteration: number;
  warmIteration: number;
  coldTotalMs: number;
  warmTotalMs: number;
  coldRetrievalMs: number;
  warmRetrievalMs: number;
  coldCacheLookupMs: number;
  warmCacheLookupMs: number;
  warmRetrievalCacheHit: boolean;
  totalReductionMs: number;
  totalReductionRatio: number;
  speedupRatio: number;
}

export interface RagCacheBenchmarkReport {
  generatedAt: string;
  totalDurationMs: number;
  totalCases: number;
  totalRuns: number;
  warmRetrievalCacheHits: number;
  averageColdTotalMs: number;
  averageWarmTotalMs: number;
  averageTotalReductionMs: number;
  averageTotalReductionRatio: number;
  averageSpeedupRatio: number;
  cases: RagCacheBenchmarkCaseSummary[];
}

function roundMetric(value: number, digits = 1): number {
  if (!Number.isFinite(value)) return 0;
  return Number((value + 1e-9).toFixed(digits));
}

function latencyValue(
  run: RagCacheBenchmarkRunInput | undefined,
  key: keyof StageLatencyBreakdown,
): number {
  const value = run?.latency?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function groupRunsByCase(runs: RagCacheBenchmarkRunInput[]): Map<string, RagCacheBenchmarkRunInput[]> {
  const grouped = new Map<string, RagCacheBenchmarkRunInput[]>();
  for (const run of runs) {
    const current = grouped.get(run.id) ?? [];
    current.push(run);
    grouped.set(run.id, current);
  }

  for (const [id, caseRuns] of grouped.entries()) {
    grouped.set(
      id,
      [...caseRuns].sort((left, right) => left.iteration - right.iteration),
    );
  }

  return grouped;
}

function summarizeCase(id: string, runs: RagCacheBenchmarkRunInput[]): RagCacheBenchmarkCaseSummary | null {
  const coldRun = runs[0];
  const warmRun = runs.find((run) => run.iteration > coldRun.iteration) ?? runs[1];
  if (!coldRun || !warmRun) return null;

  const coldTotalMs = roundMetric(latencyValue(coldRun, 'totalMs'));
  const warmTotalMs = roundMetric(latencyValue(warmRun, 'totalMs'));
  const totalReductionMs = roundMetric(coldTotalMs - warmTotalMs);
  const totalReductionRatio = coldTotalMs > 0 ? roundMetric(totalReductionMs / coldTotalMs, 3) : 0;
  const speedupRatio = warmTotalMs > 0 ? roundMetric(coldTotalMs / warmTotalMs) : 0;

  return {
    id,
    coldIteration: coldRun.iteration,
    warmIteration: warmRun.iteration,
    coldTotalMs,
    warmTotalMs,
    coldRetrievalMs: roundMetric(latencyValue(coldRun, 'retrievalMs')),
    warmRetrievalMs: roundMetric(latencyValue(warmRun, 'retrievalMs')),
    coldCacheLookupMs: roundMetric(latencyValue(coldRun, 'cacheLookupMs')),
    warmCacheLookupMs: roundMetric(latencyValue(warmRun, 'cacheLookupMs')),
    warmRetrievalCacheHit: warmRun.cacheHits?.retrieval === true,
    totalReductionMs,
    totalReductionRatio,
    speedupRatio,
  };
}

function average(values: number[], digits = 1): number {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return 0;
  return roundMetric(finite.reduce((sum, value) => sum + value, 0) / finite.length, digits);
}

export function buildRagCacheBenchmarkReport(input: RagCacheBenchmarkInput): RagCacheBenchmarkReport {
  const cases = Array.from(groupRunsByCase(input.runs).entries())
    .map(([id, runs]) => summarizeCase(id, runs))
    .filter((item): item is RagCacheBenchmarkCaseSummary => item !== null);
  const coldTotal = cases.reduce((sum, item) => sum + item.coldTotalMs, 0);
  const warmTotal = cases.reduce((sum, item) => sum + item.warmTotalMs, 0);

  return {
    generatedAt: input.generatedAt,
    totalDurationMs: roundMetric(input.totalDurationMs),
    totalCases: cases.length,
    totalRuns: input.runs.length,
    warmRetrievalCacheHits: cases.filter((item) => item.warmRetrievalCacheHit).length,
    averageColdTotalMs: average(cases.map((item) => item.coldTotalMs)),
    averageWarmTotalMs: average(cases.map((item) => item.warmTotalMs)),
    averageTotalReductionMs: average(cases.map((item) => item.totalReductionMs)),
    averageTotalReductionRatio: coldTotal > 0 ? roundMetric((coldTotal - warmTotal) / coldTotal, 3) : 0,
    averageSpeedupRatio: average(cases.map((item) => item.speedupRatio)),
    cases,
  };
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatRagCacheBenchmarkMarkdown(report: RagCacheBenchmarkReport): string {
  const lines = [
    '# RAG Cache Benchmark',
    '',
    `Generated at: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Cases: ${report.totalCases}`,
    `- Runs: ${report.totalRuns}`,
    `- Warm retrieval cache hits: ${report.warmRetrievalCacheHits}/${report.totalCases}`,
    `- Average cold total: ${report.averageColdTotalMs}ms`,
    `- Average warm total: ${report.averageWarmTotalMs}ms`,
    `- Average total reduction: ${report.averageTotalReductionMs}ms (${formatPercent(report.averageTotalReductionRatio)})`,
    `- Average speedup: ${report.averageSpeedupRatio.toFixed(1)}x`,
    '',
    '## Cases',
    '',
    '| Case | Cold total ms | Warm total ms | Retrieval cache hit | Reduction | Speedup |',
    '| --- | ---: | ---: | --- | ---: | ---: |',
    ...report.cases.map(
      (item) =>
        `| ${item.id} | ${item.coldTotalMs} | ${item.warmTotalMs} | ${item.warmRetrievalCacheHit ? 'yes' : 'no'} | ${formatPercent(item.totalReductionRatio)} | ${item.speedupRatio.toFixed(1)}x |`,
    ),
    '',
    '## Decision Guidance',
    '',
  ];

  const hitRate = report.totalCases > 0 ? report.warmRetrievalCacheHits / report.totalCases : 0;
  if (hitRate >= 0.8 && report.averageTotalReductionRatio >= 0.5) {
    lines.push(
      'The retrieval cache is effective for repeated slow queries. Keep cache instrumentation and prioritize non-repeat latency paths next.',
    );
  } else if (hitRate < 0.8) {
    lines.push(
      'Warm retrieval cache hits are inconsistent. Check cache key stability before relying on cache for latency targets.',
    );
  } else {
    lines.push(
      'Retrieval cache hits are present, but warm latency reduction is limited. Prioritize exact fast path or retrieval-stage work for remaining slow cases.',
    );
  }

  return `${lines.join('\n')}\n`;
}
