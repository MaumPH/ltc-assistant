import assert from 'node:assert/strict';
import test from 'node:test';
import { EMBEDDING_DIMENSIONS, embedChunks } from '../src/lib/embeddingService';
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
