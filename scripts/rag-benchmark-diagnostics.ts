import './register-env';
import fs from 'fs';
import path from 'path';
import {
  buildRagBenchmarkDiagnosticsReport,
  formatRagBenchmarkDiagnosticsMarkdown,
  type BenchmarkDiagnosticsInput,
} from '../src/lib/ragBenchmarkDiagnostics';

function readJson<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Benchmark JSON not found: ${filePath}. Run npm.cmd run rag:bench first.`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function main() {
  const projectRoot = process.cwd();
  const cacheDir = path.join(projectRoot, '.rag-cache');
  const benchmarkPath = process.env.RAG_BENCH_OUTPUT || path.join(cacheDir, 'rag-benchmark.json');
  const outputJsonPath = process.env.RAG_BENCH_DIAGNOSTICS_JSON || path.join(cacheDir, 'rag-benchmark-diagnostics.json');
  const outputMarkdownPath =
    process.env.RAG_BENCH_DIAGNOSTICS_MD || path.join(projectRoot, 'docs/reports/rag-benchmark-diagnostics.md');

  const benchmark = readJson<BenchmarkDiagnosticsInput>(benchmarkPath);
  const report = buildRagBenchmarkDiagnosticsReport(benchmark);

  fs.mkdirSync(path.dirname(outputJsonPath), { recursive: true });
  fs.mkdirSync(path.dirname(outputMarkdownPath), { recursive: true });
  fs.writeFileSync(outputJsonPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(outputMarkdownPath, formatRagBenchmarkDiagnosticsMarkdown(report), 'utf8');

  console.log(`Wrote ${outputJsonPath}`);
  console.log(`Wrote ${outputMarkdownPath}`);
  console.log(`Analyzed benchmark cases: ${report.summary.analyzedCases}`);
}

main();
