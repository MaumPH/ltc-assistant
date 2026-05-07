import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import {
  buildRagEmbeddingVerifyReport,
  formatRagEmbeddingVerifyMarkdown,
  type EmbeddingVerifyChunkRow,
} from '../src/lib/ragEmbeddingVerify';
import { resolveEmbeddingApiKey } from '../src/lib/ragRuntime';
import type { IndexManifestEntry } from '../src/lib/ragTypes';

dotenv.config();

interface RagIndexCachePayload {
  manifestEntries?: IndexManifestEntry[];
  chunks?: EmbeddingVerifyChunkRow[];
  nextEmbeddingRetryAt?: string;
  indexStatus?: {
    nextEmbeddingRetryAt?: string;
  };
}

function readJsonIfExists<T>(filePath: string): T | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function readEmbeddingCacheHashes(filePath: string): string[] {
  const payload = readJsonIfExists<Record<string, unknown>>(filePath);
  return payload ? Object.keys(payload) : [];
}

function main() {
  const projectRoot = process.cwd();
  const cacheDir = path.join(projectRoot, '.rag-cache');
  const indexPath = process.env.RAG_INDEX_CACHE_PATH || path.join(cacheDir, 'rag-index.json');
  const embeddingCachePath = process.env.RAG_EMBEDDING_CACHE_PATH || path.join(cacheDir, 'embeddings.json');
  const outputJsonPath = process.env.RAG_EMBEDDING_VERIFY_JSON || path.join(cacheDir, 'rag-embedding-verify.json');
  const outputMarkdownPath =
    process.env.RAG_EMBEDDING_VERIFY_MD || path.join(projectRoot, 'docs/reports/rag-embedding-verify.md');

  const indexPayload = readJsonIfExists<RagIndexCachePayload>(indexPath);
  if (!indexPayload?.manifestEntries || !indexPayload?.chunks) {
    throw new Error(`RAG index cache not found or invalid: ${indexPath}. Run npm run rag:index first.`);
  }

  const report = buildRagEmbeddingVerifyReport({
    manifestEntries: indexPayload.manifestEntries,
    chunks: indexPayload.chunks,
    embeddingCacheHashes: readEmbeddingCacheHashes(embeddingCachePath),
    embeddingApiConfigured: Boolean(resolveEmbeddingApiKey()),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    nextEmbeddingRetryAt: indexPayload.nextEmbeddingRetryAt ?? indexPayload.indexStatus?.nextEmbeddingRetryAt,
  });

  fs.mkdirSync(path.dirname(outputJsonPath), { recursive: true });
  fs.mkdirSync(path.dirname(outputMarkdownPath), { recursive: true });
  fs.writeFileSync(outputJsonPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(outputMarkdownPath, formatRagEmbeddingVerifyMarkdown(report), 'utf8');

  console.log(`Wrote ${outputJsonPath}`);
  console.log(`Wrote ${outputMarkdownPath}`);
  console.log(
    `Missing embeddings: ${report.summary.missingChunks}/${report.summary.totalChunks}; reasons: ${JSON.stringify(
      report.summary.reasonCounts,
    )}`,
  );
}

main();
