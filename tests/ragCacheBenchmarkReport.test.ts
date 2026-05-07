import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRagCacheBenchmarkReport,
  formatRagCacheBenchmarkMarkdown,
} from '../src/lib/ragCacheBenchmarkReport';

test('buildRagCacheBenchmarkReport compares cold and warm retrieval cache runs', () => {
  const report = buildRagCacheBenchmarkReport({
    generatedAt: '2026-05-04T03:00:00.000Z',
    totalDurationMs: 4200,
    runs: [
      {
        id: 'slow-a',
        iteration: 1,
        latency: { totalMs: 2000, retrievalMs: 1900, cacheLookupMs: 5 },
        cacheHits: { retrieval: false },
      },
      {
        id: 'slow-a',
        iteration: 2,
        latency: { totalMs: 120, retrievalMs: 1900, cacheLookupMs: 8 },
        cacheHits: { retrieval: true },
      },
      {
        id: 'slow-b',
        iteration: 1,
        latency: { totalMs: 1600, retrievalMs: 1500, cacheLookupMs: 4 },
        cacheHits: { retrieval: false },
      },
      {
        id: 'slow-b',
        iteration: 2,
        latency: { totalMs: 400, retrievalMs: 1500, cacheLookupMs: 10 },
        cacheHits: { retrieval: true },
      },
    ],
  });

  assert.equal(report.totalCases, 2);
  assert.equal(report.warmRetrievalCacheHits, 2);
  assert.equal(report.averageColdTotalMs, 1800);
  assert.equal(report.averageWarmTotalMs, 260);
  assert.equal(report.averageTotalReductionRatio, 0.856);
  assert.equal(report.averageSpeedupRatio, 10.4);
  assert.deepEqual(report.cases[0], {
    id: 'slow-a',
    coldIteration: 1,
    warmIteration: 2,
    coldTotalMs: 2000,
    warmTotalMs: 120,
    coldRetrievalMs: 1900,
    warmRetrievalMs: 1900,
    coldCacheLookupMs: 5,
    warmCacheLookupMs: 8,
    warmRetrievalCacheHit: true,
    totalReductionMs: 1880,
    totalReductionRatio: 0.94,
    speedupRatio: 16.7,
  });
});

test('formatRagCacheBenchmarkMarkdown includes cache hit and decision guidance', () => {
  const report = buildRagCacheBenchmarkReport({
    generatedAt: '2026-05-04T03:00:00.000Z',
    totalDurationMs: 1000,
    runs: [
      {
        id: 'slow-a',
        iteration: 1,
        latency: { totalMs: 1000, retrievalMs: 900, cacheLookupMs: 3 },
        cacheHits: { retrieval: false },
      },
      {
        id: 'slow-a',
        iteration: 2,
        latency: { totalMs: 100, retrievalMs: 900, cacheLookupMs: 6 },
        cacheHits: { retrieval: true },
      },
    ],
  });

  const markdown = formatRagCacheBenchmarkMarkdown(report);

  assert.match(markdown, /# RAG Cache Benchmark/);
  assert.match(markdown, /Warm retrieval cache hits: 1\/1/);
  assert.match(markdown, /\| slow-a \| 1000 \| 100 \| yes \| 90\.0% \| 10\.0x \|/);
  assert.match(markdown, /retrieval cache is effective for repeated slow queries/i);
});
