import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRagEmbeddingVerifyReport,
  formatRagEmbeddingVerifyMarkdown,
} from '../src/lib/ragEmbeddingVerify';
import type { IndexManifestEntry } from '../src/lib/ragTypes';

const manifestEntries: IndexManifestEntry[] = [
  {
    documentId: 'doc-a',
    path: '/knowledge/a.md',
    name: 'a.md',
    mode: 'integrated',
    contentHash: 'hash-a',
    size: 1000,
    chunkCount: 2,
    embeddingCount: 1,
  },
  {
    documentId: 'doc-b',
    path: '/knowledge/b.md',
    name: 'b.md',
    mode: 'evaluation',
    contentHash: 'hash-b',
    size: 2000,
    chunkCount: 2,
    embeddingCount: 0,
  },
];

test('buildRagEmbeddingVerifyReport classifies missing embeddings by retry reason', () => {
  const report = buildRagEmbeddingVerifyReport({
    manifestEntries,
    chunks: [
      {
        id: 'chunk-a-1',
        document_id: 'doc-a',
        chunk_hash: 'hash-a-1',
        doc_title: 'A',
        path: '/knowledge/a.md',
        embedding: [0.1, 0.2],
      },
      {
        id: 'chunk-a-2',
        document_id: 'doc-a',
        chunk_hash: 'hash-a-2',
        doc_title: 'A',
        path: '/knowledge/a.md',
        embedding: null,
      },
      {
        id: 'chunk-b-1',
        document_id: 'doc-b',
        chunk_hash: 'hash-b-1',
        doc_title: 'B',
        path: '/knowledge/b.md',
        embedding: [],
      },
      {
        id: 'chunk-b-2',
        document_id: 'doc-b',
        chunk_hash: 'hash-b-2',
        doc_title: 'B',
        path: '/knowledge/b.md',
      },
    ],
    embeddingCacheHashes: ['hash-a-2'],
    embeddingApiConfigured: false,
    databaseConfigured: false,
  });

  assert.equal(report.summary.totalChunks, 4);
  assert.equal(report.summary.embeddedChunks, 1);
  assert.equal(report.summary.missingChunks, 3);
  assert.equal(report.summary.embeddingCoverageRatio, 0.25);
  assert.equal(report.summary.documentCountWithMissingEmbeddings, 2);
  assert.deepEqual(report.summary.reasonCounts, {
    cache_available_not_restored: 1,
    embedding_api_key_missing: 2,
  });

  assert.deepEqual(
    report.documents.map((document) => ({
      documentId: document.documentId,
      missing: document.missingChunks,
      reasonCounts: document.reasonCounts,
    })),
    [
      {
        documentId: 'doc-b',
        missing: 2,
        reasonCounts: { embedding_api_key_missing: 2 },
      },
      {
        documentId: 'doc-a',
        missing: 1,
        reasonCounts: { cache_available_not_restored: 1 },
      },
    ],
  );
  assert.match(report.notes[0], /local manifest/);
});

test('buildRagEmbeddingVerifyReport marks quota cooldown separately when retry time is known', () => {
  const report = buildRagEmbeddingVerifyReport({
    manifestEntries: [manifestEntries[1]],
    chunks: [
      {
        id: 'chunk-b-1',
        document_id: 'doc-b',
        chunk_hash: 'hash-b-1',
        doc_title: 'B',
        path: '/knowledge/b.md',
        embedding: null,
      },
    ],
    embeddingCacheHashes: [],
    embeddingApiConfigured: true,
    databaseConfigured: true,
    nextEmbeddingRetryAt: '2026-04-30T12:00:00.000Z',
  });

  assert.deepEqual(report.summary.reasonCounts, {
    quota_cooldown: 1,
  });
  assert.equal(report.retryQueue.length, 1);
  assert.equal(report.retryQueue[0].retryReason, 'quota_cooldown');
});

test('formatRagEmbeddingVerifyMarkdown includes retry queue and notes', () => {
  const report = buildRagEmbeddingVerifyReport({
    manifestEntries: [manifestEntries[0]],
    chunks: [
      {
        id: 'chunk-a-2',
        document_id: 'doc-a',
        chunk_hash: 'hash-a-2',
        doc_title: 'A',
        path: '/knowledge/a.md',
        embedding: null,
      },
    ],
    embeddingCacheHashes: ['hash-a-2'],
    embeddingApiConfigured: true,
    databaseConfigured: false,
  });

  const markdown = formatRagEmbeddingVerifyMarkdown(report);
  assert.match(markdown, /# RAG Embedding Verify Report/);
  assert.match(markdown, /cache_available_not_restored: 1/);
  assert.match(markdown, /chunk-a-2/);
});
