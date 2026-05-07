import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import {
  buildRagQualityReport,
  formatRagQualityReportMarkdown,
  type RagBenchmarkSummaryInput,
} from '../src/lib/ragQualityReport';
import type { IndexManifestEntry, KnowledgeDoctorIssue } from '../src/lib/ragTypes';

dotenv.config();

interface RagIndexCachePayload {
  manifestEntries?: IndexManifestEntry[];
  doctorIssues?: KnowledgeDoctorIssue[];
  chunks?: Array<Record<string, unknown>>;
}

function readJsonIfExists<T>(filePath: string): T | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function normalizeBenchmarkPayload(payload: unknown): RagBenchmarkSummaryInput | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const value = payload as Record<string, unknown>;
  const summary = typeof value.summary === 'object' && value.summary !== null ? (value.summary as Record<string, unknown>) : value;
  const totalCases = Number(summary.totalCases ?? summary.total ?? value.totalCases ?? value.total);
  if (!Number.isFinite(totalCases) || totalCases <= 0) return undefined;

  return {
    totalCases,
    top3Hits: Number(summary.top3Hits ?? value.top3Hits ?? 0),
    top5Hits: Number(summary.top5Hits ?? value.top5Hits ?? 0),
    expectedEvidenceHits: Number(summary.expectedEvidenceHits ?? value.expectedEvidenceHits ?? 0),
    forbiddenEvidencePasses: Number(summary.forbiddenEvidencePasses ?? value.forbiddenEvidencePasses ?? 0),
    requiredCitationHits: Number(summary.requiredCitationHits ?? value.requiredCitationHits ?? 0),
    failedCaseIds: Array.isArray(value.failedCaseIds) ? value.failedCaseIds.map(String) : [],
    failedRecallCaseIds: Array.isArray(value.failedRecallCaseIds) ? value.failedRecallCaseIds.map(String) : [],
    failedEvidenceCaseIds: Array.isArray(value.failedEvidenceCaseIds) ? value.failedEvidenceCaseIds.map(String) : [],
    acceptedAbstainCaseIds: Array.isArray(value.acceptedAbstainCaseIds) ? value.acceptedAbstainCaseIds.map(String) : [],
    performance:
      typeof value.performance === 'object' && value.performance !== null
        ? (value.performance as RagBenchmarkSummaryInput['performance'])
        : undefined,
  };
}

function main() {
  const projectRoot = process.cwd();
  const cacheDir = path.join(projectRoot, '.rag-cache');
  const indexPath = process.env.RAG_INDEX_CACHE_PATH || path.join(cacheDir, 'rag-index.json');
  const benchmarkPath = process.env.RAG_BENCH_OUTPUT || path.join(cacheDir, 'rag-benchmark.json');
  const outputJsonPath = process.env.RAG_QUALITY_REPORT_JSON || path.join(cacheDir, 'rag-quality-report.json');
  const outputMarkdownPath = process.env.RAG_QUALITY_REPORT_MD || path.join(projectRoot, 'docs/reports/rag-quality-report.md');

  const indexPayload = readJsonIfExists<RagIndexCachePayload>(indexPath);
  if (!indexPayload?.manifestEntries) {
    throw new Error(`RAG index cache not found or invalid: ${indexPath}. Run npm run rag:index first.`);
  }

  const benchmarkPayload = readJsonIfExists<unknown>(benchmarkPath);
  const report = buildRagQualityReport({
    manifestEntries: indexPayload.manifestEntries,
    doctorIssues: indexPayload.doctorIssues ?? [],
    chunks: indexPayload.chunks ?? [],
    benchmark: normalizeBenchmarkPayload(benchmarkPayload),
  });

  fs.mkdirSync(path.dirname(outputJsonPath), { recursive: true });
  fs.mkdirSync(path.dirname(outputMarkdownPath), { recursive: true });
  fs.writeFileSync(outputJsonPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(outputMarkdownPath, formatRagQualityReportMarkdown(report), 'utf8');

  console.log(`Wrote ${outputJsonPath}`);
  console.log(`Wrote ${outputMarkdownPath}`);
}

main();
