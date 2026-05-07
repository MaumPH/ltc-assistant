import type { IndexManifestEntry, PromptMode } from './ragTypes';

export type EmbeddingRetryReason =
  | 'cache_available_not_restored'
  | 'quota_cooldown'
  | 'embedding_api_key_missing'
  | 'embedding_not_generated';

export interface EmbeddingVerifyChunkRow {
  id?: string;
  document_id?: string;
  documentId?: string;
  chunk_hash?: string;
  chunkHash?: string;
  doc_title?: string;
  docTitle?: string;
  title?: string;
  path?: string;
  embedding?: number[] | string | null;
}

export interface RagEmbeddingVerifyInput {
  manifestEntries: IndexManifestEntry[];
  chunks: EmbeddingVerifyChunkRow[];
  embeddingCacheHashes?: Iterable<string>;
  embeddingApiConfigured: boolean;
  databaseConfigured: boolean;
  nextEmbeddingRetryAt?: string;
  generatedAt?: string;
}

export interface RagEmbeddingMissingChunk {
  id: string;
  documentId: string;
  path: string;
  docTitle: string;
  chunkHash: string;
  retryReason: EmbeddingRetryReason;
}

export interface RagEmbeddingDocumentReport {
  documentId: string;
  path: string;
  name: string;
  mode: PromptMode;
  chunkCount: number;
  embeddedChunks: number;
  missingChunks: number;
  embeddingCoverageRatio: number;
  reasonCounts: Partial<Record<EmbeddingRetryReason, number>>;
}

export interface RagEmbeddingVerifyReport {
  generatedAt: string;
  summary: {
    documentCount: number;
    totalChunks: number;
    embeddedChunks: number;
    missingChunks: number;
    embeddingCoverageRatio: number;
    documentCountWithMissingEmbeddings: number;
    reasonCounts: Partial<Record<EmbeddingRetryReason, number>>;
    databaseConfigured: boolean;
    embeddingApiConfigured: boolean;
    nextEmbeddingRetryAt?: string;
  };
  documents: RagEmbeddingDocumentReport[];
  retryQueue: RagEmbeddingMissingChunk[];
  notes: string[];
}

function safeRatio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

function hasEmbedding(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

function incrementReasonCount(
  counts: Partial<Record<EmbeddingRetryReason, number>>,
  reason: EmbeddingRetryReason,
): void {
  counts[reason] = (counts[reason] ?? 0) + 1;
}

function sortReasonCounts(
  counts: Partial<Record<EmbeddingRetryReason, number>>,
): Partial<Record<EmbeddingRetryReason, number>> {
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function resolveRetryReason(params: {
  chunkHash: string;
  embeddingCacheHashes: Set<string>;
  embeddingApiConfigured: boolean;
  nextEmbeddingRetryAt?: string;
}): EmbeddingRetryReason {
  if (params.embeddingCacheHashes.has(params.chunkHash)) return 'cache_available_not_restored';
  if (params.nextEmbeddingRetryAt) return 'quota_cooldown';
  if (!params.embeddingApiConfigured) return 'embedding_api_key_missing';
  return 'embedding_not_generated';
}

function normalizeChunk(row: EmbeddingVerifyChunkRow): {
  id: string;
  documentId: string;
  path: string;
  docTitle: string;
  chunkHash: string;
  embedded: boolean;
} {
  const documentId = String(row.document_id ?? row.documentId ?? '');
  const chunkHash = String(row.chunk_hash ?? row.chunkHash ?? '');
  const id = String(row.id ?? chunkHash);
  return {
    id,
    documentId,
    path: String(row.path ?? ''),
    docTitle: String(row.doc_title ?? row.docTitle ?? row.title ?? ''),
    chunkHash,
    embedded: hasEmbedding(row.embedding),
  };
}

export function buildRagEmbeddingVerifyReport(input: RagEmbeddingVerifyInput): RagEmbeddingVerifyReport {
  const embeddingCacheHashes = new Set(input.embeddingCacheHashes ?? []);
  const manifestByDocumentId = new Map(input.manifestEntries.map((entry) => [entry.documentId, entry] as const));
  const documentCounts = new Map<
    string,
    {
      embeddedChunks: number;
      missingChunks: number;
      reasonCounts: Partial<Record<EmbeddingRetryReason, number>>;
    }
  >();
  const summaryReasonCounts: Partial<Record<EmbeddingRetryReason, number>> = {};
  const retryQueue: RagEmbeddingMissingChunk[] = [];

  for (const rawChunk of input.chunks) {
    const chunk = normalizeChunk(rawChunk);
    if (!chunk.documentId) continue;

    const current = documentCounts.get(chunk.documentId) ?? {
      embeddedChunks: 0,
      missingChunks: 0,
      reasonCounts: {},
    };

    if (chunk.embedded) {
      current.embeddedChunks += 1;
      documentCounts.set(chunk.documentId, current);
      continue;
    }

    const retryReason = resolveRetryReason({
      chunkHash: chunk.chunkHash,
      embeddingCacheHashes,
      embeddingApiConfigured: input.embeddingApiConfigured,
      nextEmbeddingRetryAt: input.nextEmbeddingRetryAt,
    });

    current.missingChunks += 1;
    incrementReasonCount(current.reasonCounts, retryReason);
    incrementReasonCount(summaryReasonCounts, retryReason);
    documentCounts.set(chunk.documentId, current);

    const manifestEntry = manifestByDocumentId.get(chunk.documentId);
    retryQueue.push({
      id: chunk.id,
      documentId: chunk.documentId,
      path: chunk.path || manifestEntry?.path || '',
      docTitle: chunk.docTitle || manifestEntry?.name || '',
      chunkHash: chunk.chunkHash,
      retryReason,
    });
  }

  const documents = input.manifestEntries
    .map((entry): RagEmbeddingDocumentReport => {
      const counts = documentCounts.get(entry.documentId) ?? {
        embeddedChunks: entry.embeddingCount,
        missingChunks: Math.max(entry.chunkCount - entry.embeddingCount, 0),
        reasonCounts: {},
      };

      return {
        documentId: entry.documentId,
        path: entry.path,
        name: entry.name,
        mode: entry.mode,
        chunkCount: entry.chunkCount,
        embeddedChunks: counts.embeddedChunks,
        missingChunks: counts.missingChunks,
        embeddingCoverageRatio: safeRatio(counts.embeddedChunks, entry.chunkCount),
        reasonCounts: sortReasonCounts(counts.reasonCounts),
      };
    })
    .filter((document) => document.missingChunks > 0)
    .sort((left, right) => right.missingChunks - left.missingChunks || left.path.localeCompare(right.path, 'ko'));

  const totalChunks = input.manifestEntries.reduce((sum, entry) => sum + entry.chunkCount, 0);
  const embeddedChunks = input.chunks.reduce((sum, chunk) => sum + (hasEmbedding(chunk.embedding) ? 1 : 0), 0);
  const missingChunks = Math.max(totalChunks - embeddedChunks, 0);

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    summary: {
      documentCount: input.manifestEntries.length,
      totalChunks,
      embeddedChunks,
      missingChunks,
      embeddingCoverageRatio: safeRatio(embeddedChunks, totalChunks),
      documentCountWithMissingEmbeddings: documents.length,
      reasonCounts: sortReasonCounts(summaryReasonCounts),
      databaseConfigured: input.databaseConfigured,
      embeddingApiConfigured: input.embeddingApiConfigured,
      nextEmbeddingRetryAt: input.nextEmbeddingRetryAt,
    },
    documents,
    retryQueue: retryQueue.sort((left, right) => left.path.localeCompare(right.path, 'ko') || left.id.localeCompare(right.id)),
    notes: [
      'This report is based on the local manifest and chunk cache. Server-side DB embeddings may differ until DB verification is connected.',
      input.databaseConfigured
        ? 'DATABASE_URL is configured; compare this report with Postgres chunk embedding counts when investigating drift.'
        : 'DATABASE_URL is not configured; this run cannot verify server-side Postgres embeddings.',
    ],
  };
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatReasonCounts(counts: Partial<Record<EmbeddingRetryReason, number>>): string {
  const entries = Object.entries(counts);
  if (entries.length === 0) return '- none';
  return entries.map(([reason, count]) => `- ${reason}: ${count}`).join('\n');
}

export function formatRagEmbeddingVerifyMarkdown(report: RagEmbeddingVerifyReport): string {
  const documentLines =
    report.documents.length === 0
      ? ['- none']
      : report.documents
          .slice(0, 50)
          .map(
            (document) =>
              `- ${document.path}: missing ${document.missingChunks}/${document.chunkCount}, coverage ${formatPercent(document.embeddingCoverageRatio)}`,
          );
  const retryLines =
    report.retryQueue.length === 0
      ? ['- none']
      : report.retryQueue
          .slice(0, 50)
          .map((chunk) => `- ${chunk.id} | ${chunk.path} | ${chunk.retryReason} | ${chunk.chunkHash}`);

  return [
    '# RAG Embedding Verify Report',
    '',
    `Generated at: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Documents: ${report.summary.documentCount}`,
    `- Total chunks: ${report.summary.totalChunks}`,
    `- Embedded chunks: ${report.summary.embeddedChunks}`,
    `- Missing chunks: ${report.summary.missingChunks}`,
    `- Embedding coverage: ${formatPercent(report.summary.embeddingCoverageRatio)}`,
    `- Documents with missing embeddings: ${report.summary.documentCountWithMissingEmbeddings}`,
    `- Embedding API configured: ${report.summary.embeddingApiConfigured ? 'yes' : 'no'}`,
    `- Database configured: ${report.summary.databaseConfigured ? 'yes' : 'no'}`,
    report.summary.nextEmbeddingRetryAt ? `- Next embedding retry at: ${report.summary.nextEmbeddingRetryAt}` : null,
    '',
    '## Missing Reasons',
    '',
    formatReasonCounts(report.summary.reasonCounts),
    '',
    '## Documents With Missing Embeddings',
    '',
    ...documentLines,
    '',
    '## Retry Queue Sample',
    '',
    ...retryLines,
    '',
    '## Notes',
    '',
    ...report.notes.map((note) => `- ${note}`),
    '',
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}
