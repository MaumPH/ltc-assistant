import assert from 'node:assert/strict';
import test from 'node:test';
import { EMBEDDING_DIMENSIONS, embedChunks, embedQuery } from '../src/lib/embeddingService';
import { embedIndexRows } from '../src/lib/nodeRagService';
import type { StructuredChunk } from '../src/lib/ragTypes';

function chunk(id: string): StructuredChunk {
  return {
    id,
    documentId: 'doc-1',
    chunkIndex: 0,
    title: '테스트 문서',
    text: '요양보호사 보수교육 기준',
    textPreview: '요양보호사 보수교육 기준',
    searchText: '요양보호사 보수교육 기준',
    embeddingInput: '요양보호사 보수교육 기준',
    mode: 'integrated',
    sourceType: 'manual',
    sourceRole: 'primary_evaluation',
    documentGroup: 'manual',
    docTitle: '테스트 문서',
    fileName: 'test.md',
    path: '/knowledge/test.md',
    effectiveDate: '2026-01-01',
    publishedDate: '2026-01-01',
    sectionPath: ['테스트 문서'],
    headingPath: ['테스트 문서'],
    matchedLabels: [],
    chunkHash: `hash-${id}`,
    parentSectionId: 'section-1',
    parentSectionTitle: '테스트 섹션',
    windowIndex: 0,
    spanStart: 0,
    spanEnd: 10,
    citationGroupId: 'doc-1:section-1',
    linkedDocumentTitles: [],
  };
}

test('embedChunks counts only non-empty embedding responses as successful', async () => {
  const chunks = [chunk('empty-response'), chunk('valid-response')];
  const ai = {
    models: {
      embedContent: async ({ contents }: { contents: string }) =>
        contents.includes('요양보호사') && !contents.includes('valid-response-marker')
          ? { embeddings: [{ values: [] }] }
          : { embeddings: [{ values: Array.from({ length: EMBEDDING_DIMENSIONS }, (_, index) => (index === 0 ? 1 : 0)) }] },
    },
  } as never;

  chunks[1].embeddingInput = 'valid-response-marker';

  const embeddedCount = await embedChunks(ai, chunks);

  assert.equal(embeddedCount, 1);
  assert.equal(chunks[0].embedding, undefined);
  assert.equal(chunks[1].embedding?.length, EMBEDDING_DIMENSIONS);
  assert.equal(chunks[1].embedding?.[0], 1);
  assert.equal(chunks[1].embedding?.[1], 0);
});

test('embedChunks can be disabled for read-only script runs', async () => {
  const previous = process.env.RAG_DISABLE_CHUNK_EMBEDDING_GENERATION;
  process.env.RAG_DISABLE_CHUNK_EMBEDDING_GENERATION = 'true';
  try {
    let callCount = 0;
    const chunks = [chunk('disabled')];
    const ai = {
      models: {
        embedContent: async () => {
          callCount += 1;
          return { embeddings: [{ values: Array.from({ length: EMBEDDING_DIMENSIONS }, () => 1) }] };
        },
      },
    } as never;

    const embeddedCount = await embedChunks(ai, chunks);

    assert.equal(embeddedCount, 0);
    assert.equal(callCount, 0);
    assert.equal(chunks[0].embedding, undefined);
  } finally {
    if (previous === undefined) {
      delete process.env.RAG_DISABLE_CHUNK_EMBEDDING_GENERATION;
    } else {
      process.env.RAG_DISABLE_CHUNK_EMBEDDING_GENERATION = previous;
    }
  }
});

test('embedIndexRows can be disabled for read-only script runs', async () => {
  const previous = process.env.RAG_DISABLE_CHUNK_EMBEDDING_GENERATION;
  process.env.RAG_DISABLE_CHUNK_EMBEDDING_GENERATION = 'true';
  try {
    let callCount = 0;
    const rows: Array<Record<string, unknown>> = [
      {
        id: 'index-disabled',
        search_text: '요양보호사 index embedding input',
      },
    ];
    const ai = {
      models: {
        embedContent: async () => {
          callCount += 1;
          return { embeddings: [{ values: Array.from({ length: EMBEDDING_DIMENSIONS }, (_, index) => (index === 0 ? 1 : 0)) }] };
        },
      },
    } as never;

    const embeddedCount = await embedIndexRows(ai, rows);

    assert.equal(embeddedCount, 0);
    assert.equal(callCount, 0);
    assert.equal(rows[0].embedding, undefined);
  } finally {
    if (previous === undefined) {
      delete process.env.RAG_DISABLE_CHUNK_EMBEDDING_GENERATION;
    } else {
      process.env.RAG_DISABLE_CHUNK_EMBEDDING_GENERATION = previous;
    }
  }
});

test('embedQuery can be disabled for read-only benchmark runs', async () => {
  const previous = process.env.RAG_DISABLE_QUERY_EMBEDDING_GENERATION;
  process.env.RAG_DISABLE_QUERY_EMBEDDING_GENERATION = 'true';
  try {
    let callCount = 0;
    const ai = {
      models: {
        embedContent: async () => {
          callCount += 1;
          return { embeddings: [{ values: Array.from({ length: EMBEDDING_DIMENSIONS }, () => 1) }] };
        },
      },
    } as never;

    const embedding = await embedQuery(ai, 'benchmark cache miss query');

    assert.equal(embedding, null);
    assert.equal(callCount, 0);
  } finally {
    if (previous === undefined) {
      delete process.env.RAG_DISABLE_QUERY_EMBEDDING_GENERATION;
    } else {
      process.env.RAG_DISABLE_QUERY_EMBEDDING_GENERATION = previous;
    }
  }
});
