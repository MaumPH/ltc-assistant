import './register-env';
import fs from 'fs';
import path from 'path';
import {
  buildRagAliasCandidateReport,
  formatRagAliasCandidateMarkdown,
  type AliasCandidateChunkInput,
} from '../src/lib/ragAliasCandidates';
import type { BenchmarkCase, IndexManifestEntry } from '../src/lib/ragTypes';

interface RagIndexCachePayload {
  manifestEntries?: IndexManifestEntry[];
  chunks?: AliasCandidateChunkInput[];
}

function readJsonIfExists<T>(filePath: string): T | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function main() {
  const projectRoot = process.cwd();
  const cacheDir = path.join(projectRoot, '.rag-cache');
  const indexPath = process.env.RAG_INDEX_CACHE_PATH || path.join(cacheDir, 'rag-index.json');
  const benchmarkPath = process.env.RAG_GOLDEN_CASES_PATH || path.join(projectRoot, 'benchmarks/golden-cases.json');
  const outputJsonPath = process.env.RAG_ALIAS_CANDIDATES_JSON || path.join(cacheDir, 'alias-candidates.json');
  const outputMarkdownPath =
    process.env.RAG_ALIAS_CANDIDATES_MD || path.join(projectRoot, 'docs/reports/rag-alias-candidates.md');

  const indexPayload = readJsonIfExists<RagIndexCachePayload>(indexPath);
  if (!indexPayload?.manifestEntries || !indexPayload?.chunks) {
    throw new Error(`RAG index cache not found or invalid: ${indexPath}. Run npm run rag:index first.`);
  }

  const benchmarkCases = readJsonIfExists<BenchmarkCase[]>(benchmarkPath) ?? [];
  const report = buildRagAliasCandidateReport({
    manifestEntries: indexPayload.manifestEntries,
    chunks: indexPayload.chunks,
    benchmarkCases,
  });

  fs.mkdirSync(path.dirname(outputJsonPath), { recursive: true });
  fs.mkdirSync(path.dirname(outputMarkdownPath), { recursive: true });
  fs.writeFileSync(outputJsonPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(outputMarkdownPath, formatRagAliasCandidateMarkdown(report), 'utf8');

  console.log(`Wrote ${outputJsonPath}`);
  console.log(`Wrote ${outputMarkdownPath}`);
  console.log(`Alias candidates: ${report.summary.candidateCount} across ${report.summary.documentCount} documents.`);
}

main();
