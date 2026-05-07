import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { NodeRagService, loadBenchmarkCases } from '../src/lib/nodeRagService';
import {
  buildRagCacheBenchmarkReport,
  formatRagCacheBenchmarkMarkdown,
  type RagCacheBenchmarkRunInput,
} from '../src/lib/ragCacheBenchmarkReport';
import type { BenchmarkCase } from '../src/lib/ragTypes';

dotenv.config();

interface BenchmarkSnapshot {
  performance?: {
    slowCases?: Array<{ id?: string }>;
  };
}

function timestampForFileName(value: string): string {
  return value.replace(/[:.]/g, '-');
}

function readBenchmarkSnapshot(projectRoot: string): BenchmarkSnapshot | null {
  const benchmarkPath =
    process.env.RAG_CACHE_BENCH_SOURCE ?? path.join(projectRoot, '.rag-cache', 'rag-benchmark.json');
  if (!fs.existsSync(benchmarkPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(benchmarkPath, 'utf8')) as BenchmarkSnapshot;
  } catch {
    return null;
  }
}

function pickBenchmarkCases(projectRoot: string, cases: BenchmarkCase[]): BenchmarkCase[] {
  const snapshot = readBenchmarkSnapshot(projectRoot);
  const slowCaseIds =
    snapshot?.performance?.slowCases
      ?.map((item) => item.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0) ?? [];
  const caseById = new Map(cases.map((item) => [item.id, item]));
  const limit = Number(process.env.RAG_CACHE_BENCH_CASE_LIMIT ?? 5);
  const selected = slowCaseIds.map((id) => caseById.get(id)).filter((item): item is BenchmarkCase => Boolean(item));

  return (selected.length > 0 ? selected : cases).slice(0, Number.isFinite(limit) && limit > 0 ? limit : 5);
}

async function main() {
  const startedAt = Date.now();
  const projectRoot = process.cwd();
  const cases = loadBenchmarkCases(projectRoot);
  if (cases.length === 0) {
    throw new Error('No benchmark cases found in benchmarks/golden-cases.json');
  }

  const selectedCases = pickBenchmarkCases(projectRoot, cases);
  const repeatCount = Math.max(2, Number(process.env.RAG_CACHE_BENCH_REPEATS ?? 2) || 2);
  const service = new NodeRagService(projectRoot);
  await service.initialize();

  const runs: RagCacheBenchmarkRunInput[] = [];
  for (const testCase of selectedCases) {
    for (let iteration = 1; iteration <= repeatCount; iteration += 1) {
      const inspection = await service.inspectRetrieval(
        testCase.messages ?? testCase.question,
        testCase.mode,
        undefined,
        testCase.serviceScopes,
      );
      runs.push({
        id: testCase.id,
        iteration,
        latency: inspection.latency,
        cacheHits: inspection.cacheHits,
      });
      console.log(
        `${testCase.id} #${iteration}: total=${inspection.latency.totalMs}ms retrievalCache=${inspection.cacheHits.retrieval ? 'hit' : 'miss'}`,
      );
    }
  }

  const generatedAt = new Date().toISOString();
  const report = buildRagCacheBenchmarkReport({
    generatedAt,
    totalDurationMs: Date.now() - startedAt,
    runs,
  });
  const payload = {
    ...report,
    sourceCases: selectedCases.map((item) => item.id),
    runs,
  };
  const json = JSON.stringify(payload, null, 2);
  const cachePath = path.join(projectRoot, '.rag-cache', 'rag-cache-benchmark.json');
  const archivePath = path.join(
    projectRoot,
    'benchmarks',
    'results',
    `rag-cache-benchmark-${timestampForFileName(generatedAt)}.json`,
  );
  const markdownPath = path.join(projectRoot, 'docs', 'reports', 'rag-cache-benchmark.md');

  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, json, 'utf8');
  fs.mkdirSync(path.dirname(archivePath), { recursive: true });
  fs.writeFileSync(archivePath, json, 'utf8');
  fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
  fs.writeFileSync(markdownPath, formatRagCacheBenchmarkMarkdown(report), 'utf8');

  console.log(`Saved cache benchmark results to ${cachePath}`);
  console.log(`Archived cache benchmark results to ${archivePath}`);
  console.log(`Saved cache benchmark report to ${markdownPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
