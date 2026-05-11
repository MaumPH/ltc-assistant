import './register-env';
import fs from 'fs';
import path from 'path';
import {
  PHASE2_FINAL_BENCHMARK_BASELINE,
  validateRagBenchmarkBaseline,
  type RagBenchmarkBaselinePayload,
} from '../src/lib/ragBenchmarkBaseline';

function readJson<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(`RAG benchmark baseline archive not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function main() {
  const projectRoot = process.cwd();
  const baseline = PHASE2_FINAL_BENCHMARK_BASELINE;
  const archivePath = path.resolve(projectRoot, process.env.RAG_BENCH_BASELINE_PATH || baseline.archivePath);
  const payload = readJson<RagBenchmarkBaselinePayload>(archivePath);
  const result = validateRagBenchmarkBaseline(payload, baseline);

  console.log(`${baseline.label}: ${path.relative(projectRoot, archivePath)}`);
  console.log(`Top-3/Top-5: ${formatPercent(result.metrics.top3Recall)} / ${formatPercent(result.metrics.top5Recall)}`);
  console.log(
    `Evidence/citation: ${result.metrics.expectedEvidenceHits}/${result.metrics.forbiddenEvidencePasses}/${result.metrics.requiredCitationHits} of ${result.metrics.totalCases}`,
  );
  console.log(
    `Validation/claim coverage: ${formatPercent(result.metrics.validationSignalPassRate)} / ${formatPercent(result.metrics.claimCoveragePassRate)}`,
  );
  console.log(
    `Retrieval latency avg/p95: ${result.metrics.retrievalAverageMs}ms / ${result.metrics.retrievalP95Ms}ms`,
  );

  if (!result.ok) {
    console.error('RAG benchmark baseline check failed:');
    for (const failure of result.failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
  }
}

main();
