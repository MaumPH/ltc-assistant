import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSearchStoreMemoKey,
  createSearchStoreMemo,
} from '../src/lib/nodeRagService';
import { createLexicalScoringCache } from '../src/lib/ragEngine';
import type { SearchRun } from '../src/lib/ragTypes';

function emptySearchRun(query: string): SearchRun {
  return {
    query,
    mode: 'evaluation',
    intent: 'general',
    confidence: 'low',
    exactCandidates: [],
    lexicalCandidates: [],
    vectorCandidates: [],
    fusedCandidates: [],
    evidence: [],
  };
}

test('search memo key canonicalizes unordered search scope options', () => {
  const firstKey = buildSearchStoreMemoKey({
    query: 'notice period',
    mode: 'evaluation',
    queryEmbedding: [0.1234567, 0.7654321],
    queryAliases: ['employee rights', 'education'],
    options: {
      allowedDocumentIds: new Set(['doc-b', 'doc-a']),
      documentScoreBoosts: new Map([
        ['doc-b', 4],
        ['doc-a', 2],
      ]),
      chunkScoreBoosts: new Map([
        ['chunk-b', 3],
        ['chunk-a', 1],
      ]),
      excludedEvidenceRoles: new Set(['routing_summary']),
      maxLexicalCandidateChunks: 900,
    },
  });
  const secondKey = buildSearchStoreMemoKey({
    query: 'notice period',
    mode: 'evaluation',
    queryEmbedding: [0.12345671, 0.76543211],
    queryAliases: ['employee rights', 'education'],
    options: {
      allowedDocumentIds: new Set(['doc-a', 'doc-b']),
      documentScoreBoosts: new Map([
        ['doc-a', 2],
        ['doc-b', 4],
      ]),
      chunkScoreBoosts: new Map([
        ['chunk-a', 1],
        ['chunk-b', 3],
      ]),
      excludedEvidenceRoles: new Set(['routing_summary']),
      maxLexicalCandidateChunks: 900,
    },
  });

  assert.equal(firstKey, secondKey);
});

test('search memo key separates different document scopes and evidence exclusions', () => {
  const base = {
    query: 'notice period',
    mode: 'evaluation' as const,
    queryEmbedding: null,
    queryAliases: ['employee rights'],
  };

  assert.notEqual(
    buildSearchStoreMemoKey({
      ...base,
      options: { allowedDocumentIds: new Set(['doc-a']) },
    }),
    buildSearchStoreMemoKey({
      ...base,
      options: { allowedDocumentIds: new Set(['doc-b']) },
    }),
  );
  assert.notEqual(
    buildSearchStoreMemoKey({
      ...base,
      options: { excludedEvidenceRoles: new Set(['routing_summary']) },
    }),
    buildSearchStoreMemoKey({
      ...base,
      options: { excludedEvidenceRoles: new Set() },
    }),
  );
});

test('search memo key separates different precomputed lexical chunk pools', () => {
  const base = {
    query: 'notice period',
    mode: 'evaluation' as const,
    queryEmbedding: null,
    queryAliases: ['employee rights'],
  };

  assert.notEqual(
    buildSearchStoreMemoKey({
      ...base,
      options: {
        precomputedLexicalCandidateChunks: [
          {
            id: 'chunk-a',
            documentId: 'doc-a',
          } as never,
        ],
      },
    }),
    buildSearchStoreMemoKey({
      ...base,
      options: {
        precomputedLexicalCandidateChunks: [
          {
            id: 'chunk-b',
            documentId: 'doc-b',
          } as never,
        ],
      },
    }),
  );
});

test('search memo key separates lexical pool replacement and merge-only modes', () => {
  const base = {
    query: 'notice period',
    mode: 'evaluation' as const,
    queryEmbedding: null,
    queryAliases: ['employee rights'],
    options: {
      precomputedLexicalCandidateChunks: [
        {
          id: 'chunk-a',
          documentId: 'doc-a',
        } as never,
      ],
    },
  };

  assert.notEqual(
    buildSearchStoreMemoKey(base),
    buildSearchStoreMemoKey({
      ...base,
      options: {
        ...base.options,
        mergePrecomputedLexicalCandidateChunks: true,
      },
    }),
  );
});

test('search memo key ignores lexical scoring cache instances', () => {
  const base = {
    query: 'notice period',
    mode: 'evaluation' as const,
    queryEmbedding: null,
    queryAliases: ['employee rights'],
    options: {
      allowedDocumentIds: new Set(['doc-a']),
    },
  };

  assert.equal(
    buildSearchStoreMemoKey({
      ...base,
      options: {
        ...base.options,
        lexicalScoringCache: createLexicalScoringCache(),
      },
    }),
    buildSearchStoreMemoKey({
      ...base,
      options: {
        ...base.options,
        lexicalScoringCache: createLexicalScoringCache(),
      },
    }),
  );
});

test('search memo key ignores search diagnostics instrumentation', () => {
  const base = {
    query: 'notice period',
    mode: 'evaluation' as const,
    queryEmbedding: null,
    queryAliases: ['employee rights'],
    options: {
      allowedDocumentIds: new Set(['doc-a']),
    },
  };

  assert.equal(
    buildSearchStoreMemoKey({
      ...base,
      options: {
        ...base.options,
        searchDiagnosticStage: 'evaluation-routing',
        searchDiagnostics: { record: () => undefined },
      },
    }),
    buildSearchStoreMemoKey({
      ...base,
      options: {
        ...base.options,
        searchDiagnosticStage: 'evaluation-base',
        searchDiagnostics: { record: () => undefined },
      },
    }),
  );
});

test('search store memo reuses identical in-flight and completed search calls', async () => {
  let calls = 0;
  const memo = createSearchStoreMemo(async (query): Promise<SearchRun> => {
    calls += 1;
    return emptySearchRun(query);
  });

  const [first, second] = await Promise.all([
    memo.search('notice period', 'evaluation', null, ['employee rights'], {
      allowedDocumentIds: new Set(['doc-b', 'doc-a']),
      documentScoreBoosts: new Map([
        ['doc-b', 3],
        ['doc-a', 1],
      ]),
    }),
    memo.search('notice period', 'evaluation', null, ['employee rights'], {
      allowedDocumentIds: new Set(['doc-a', 'doc-b']),
      documentScoreBoosts: new Map([
        ['doc-a', 1],
        ['doc-b', 3],
      ]),
    }),
  ]);

  assert.equal(calls, 1);
  assert.equal(first, second);

  await memo.search('notice period', 'evaluation', null, ['employee rights'], {
    allowedDocumentIds: new Set(['doc-a']),
  });
  assert.equal(calls, 2);
});
