import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRagCorpusIndex, createLexicalScoringCache, searchCorpus } from '../src/lib/ragEngine';
import { buildPostgresLexicalCandidateQuery } from '../src/lib/ragDbLexical';
import type { SearchCandidate, StructuredChunk } from '../src/lib/ragTypes';

function chunk(overrides: Partial<StructuredChunk> & { id: string; text: string }): StructuredChunk {
  return {
    id: overrides.id,
    documentId: overrides.documentId ?? `doc-${overrides.id}`,
    chunkIndex: overrides.chunkIndex ?? 0,
    title: overrides.title ?? overrides.id,
    text: overrides.text,
    textPreview: overrides.text.slice(0, 120),
    searchText: overrides.searchText ?? overrides.text,
    mode: overrides.mode ?? 'integrated',
    sourceType: overrides.sourceType ?? 'manual',
    sourceRole: overrides.sourceRole ?? 'support_reference',
    documentGroup: overrides.documentGroup ?? 'manual',
    docTitle: overrides.docTitle ?? '테스트 문서',
    fileName: overrides.fileName ?? '테스트 문서.md',
    path: overrides.path ?? '/knowledge/test.md',
    effectiveDate: overrides.effectiveDate,
    publishedDate: overrides.publishedDate,
    sectionPath: overrides.sectionPath ?? ['테스트 문서'],
    headingPath: overrides.headingPath ?? ['테스트 문서'],
    articleNo: overrides.articleNo,
    matchedLabels: overrides.matchedLabels ?? [],
    chunkHash: overrides.chunkHash ?? `hash-${overrides.id}`,
    parentSectionId: overrides.parentSectionId ?? `section-${overrides.id}`,
    parentSectionTitle: overrides.parentSectionTitle ?? overrides.title ?? overrides.id,
    windowIndex: overrides.windowIndex ?? 0,
    spanStart: overrides.spanStart ?? 0,
    spanEnd: overrides.spanEnd ?? overrides.text.length,
    citationGroupId: overrides.citationGroupId ?? `citation-${overrides.id}`,
    linkedDocumentTitles: overrides.linkedDocumentTitles ?? [],
    embedding: overrides.embedding,
  };
}

function lexicalCandidate(base: StructuredChunk): SearchCandidate {
  return {
    ...base,
    exactScore: 0,
    lexicalScore: 7,
    vectorScore: 0,
    fusedScore: 0,
    rerankScore: 0,
    headingScore: 0,
    ontologyScore: 0,
    matchedTerms: ['db-lexical', '인건비지출비율'],
  };
}

test('buildPostgresLexicalCandidateQuery creates scoped lexical SQL with term values', () => {
  const query = buildPostgresLexicalCandidateQuery({
    query: '인건비지출비율 고시',
    mode: 'evaluation',
    allowedDocumentIds: ['doc-a', 'doc-b'],
    excludedEvidenceRoles: ['routing_summary'],
    limit: 24,
  });

  assert.match(query.sql, /with lexical_terms as/i);
  assert.match(query.sql, /search_text/i);
  assert.match(query.sql, /mode = \$3/);
  assert.match(query.sql, /document_id = any\(\$4::text\[\]\)/);
  assert.match(query.sql, /source_role = any\(\$5::text\[\]\)/);
  assert.match(query.sql, /limit \$6/);
  assert.ok(Array.isArray(query.values[0]));
  assert.ok((query.values[0] as string[]).includes('인건비지출비율'));
  assert.ok((query.values[0] as string[]).includes('인건비'));
  assert.ok((query.values[0] as string[]).includes('지출'));
  assert.ok((query.values[0] as string[]).includes('비율'));
  assert.ok((query.values[0] as string[]).includes('고시'));
  assert.equal(query.values[1], '%인건비지출비율 고시%');
  assert.equal(query.values[2], 'evaluation');
  assert.deepEqual(query.values[3], ['doc-a', 'doc-b']);
  assert.deepEqual(query.values[4], ['routing_summary']);
  assert.equal(query.values[5], 24);
});

test('searchCorpus fuses precomputed DB lexical candidates into lexical and fused stages', () => {
  const dbChunk = chunk({
    id: 'db-lexical-hit',
    documentId: 'db-doc',
    docTitle: '인건비지출비율 고시',
    text: '데이터베이스 lexical 후보로 찾은 인건비지출비율 근거입니다.',
    searchText: '데이터베이스 lexical 후보 인건비지출비율',
  });
  const localOnly = chunk({
    id: 'local-only',
    documentId: 'local-doc',
    docTitle: '일반 문서',
    text: '검색어와 직접 관련 없는 일반 문서입니다.',
    searchText: '일반 문서',
  });

  const result = searchCorpus({
    index: buildRagCorpusIndex([localOnly]),
    query: '인건비지출비율',
    mode: 'integrated',
    queryEmbedding: null,
    options: {
      precomputedLexicalCandidates: [lexicalCandidate(dbChunk)],
    },
  });

  assert.equal(result.lexicalCandidates[0].id, 'db-lexical-hit');
  assert.ok(result.lexicalCandidates[0].matchedTerms.includes('db-lexical'));
  assert.ok(result.fusedCandidates.some((candidate) => candidate.id === 'db-lexical-hit'));
  assert.ok(result.stageTrace?.some((stage) => stage.stage === 'lexical_candidates' && stage.outputCount >= 1));
});

test('searchCorpus can reuse a precomputed lexical candidate chunk pool', () => {
  const target = chunk({
    id: 'target',
    documentId: 'target-doc',
    docTitle: 'Target document',
    text: 'needle-token appears only in this target chunk body.',
    searchText: 'needle-token appears only in this target chunk body.',
  });
  const precomputedOnly = chunk({
    id: 'precomputed-only',
    documentId: 'precomputed-doc',
    docTitle: 'Precomputed document',
    text: 'This chunk does not contain the query token.',
    searchText: 'This chunk does not contain the query token.',
  });

  const result = searchCorpus({
    index: buildRagCorpusIndex([target, precomputedOnly]),
    query: 'needle-token',
    mode: 'integrated',
    queryEmbedding: null,
    options: {
      precomputedLexicalCandidateChunks: [precomputedOnly],
    },
  });

  assert.equal(result.lexicalCandidates.some((candidate) => candidate.id === 'target'), false);
  assert.equal(result.fusedCandidates.some((candidate) => candidate.id === 'target'), false);
});

test('searchCorpus can merge a precomputed lexical chunk pool with local lexical candidates', () => {
  const localCapped = chunk({
    id: 'local-capped',
    documentId: 'local-doc',
    docTitle: 'Local capped document',
    text: 'merge-token appears in this local capped chunk.',
    searchText: 'merge-token appears in this local capped chunk.',
  });
  const precomputed = chunk({
    id: 'precomputed-merged',
    documentId: 'precomputed-doc',
    docTitle: 'Precomputed merged document',
    text: 'merge-token appears in this precomputed chunk.',
    searchText: 'merge-token appears in this precomputed chunk.',
  });

  const result = searchCorpus({
    index: buildRagCorpusIndex([localCapped, precomputed]),
    query: 'merge-token',
    mode: 'integrated',
    queryEmbedding: null,
    options: {
      maxLexicalCandidateChunks: 1,
      precomputedLexicalCandidateChunks: [precomputed],
      mergePrecomputedLexicalCandidateChunks: true,
    },
  });
  const lexicalIds = new Set(result.lexicalCandidates.map((candidate) => candidate.id));
  const lexicalStage = result.stageTrace?.find((stage) => stage.stage === 'lexical_candidates');

  assert.equal(lexicalIds.has('local-capped'), true);
  assert.equal(lexicalIds.has('precomputed-merged'), true);
  assert.ok(lexicalStage?.notes?.includes('lexical-pool=merged'));
  assert.ok(lexicalStage?.notes?.includes('lexical-pool-size=2'));
});

test('searchCorpus stage trace marks shared lexical candidate pool reuse', () => {
  const target = chunk({
    id: 'target',
    documentId: 'target-doc',
    text: 'shared-pool-token appears in this chunk.',
    searchText: 'shared-pool-token appears in this chunk.',
  });

  const result = searchCorpus({
    index: buildRagCorpusIndex([target]),
    query: 'shared-pool-token',
    mode: 'integrated',
    queryEmbedding: null,
    options: {
      maxLexicalCandidateChunks: 12,
    },
  });

  const lexicalStage = result.stageTrace?.find((stage) => stage.stage === 'lexical_candidates');

  assert.ok(lexicalStage?.notes?.includes('lexical-pool=shared'));
});

test('searchCorpus uses posting-backed lexical pool for scoped searches without changing corpus order', () => {
  const first = chunk({
    id: 'first',
    documentId: 'scoped-doc',
    chunkIndex: 0,
    text: 'needlexyz appears in the first matching chunk.',
    searchText: 'needlexyz appears in the first matching chunk.',
  });
  const unrelated = chunk({
    id: 'unrelated',
    documentId: 'scoped-doc',
    chunkIndex: 1,
    text: 'This chunk does not match the lexical query.',
    searchText: 'This chunk does not match the lexical query.',
  });
  const second = chunk({
    id: 'second',
    documentId: 'scoped-doc',
    chunkIndex: 2,
    text: 'needlexyz appears in the second matching chunk.',
    searchText: 'needlexyz appears in the second matching chunk.',
  });
  const third = chunk({
    id: 'third',
    documentId: 'scoped-doc',
    chunkIndex: 3,
    text: 'needlexyz appears in the third matching chunk.',
    searchText: 'needlexyz appears in the third matching chunk.',
  });
  const outOfScope = chunk({
    id: 'out-of-scope',
    documentId: 'other-doc',
    text: 'needlexyz appears outside the allowed document scope.',
    searchText: 'needlexyz appears outside the allowed document scope.',
  });

  const result = searchCorpus({
    index: buildRagCorpusIndex([first, unrelated, second, third, outOfScope]),
    query: 'needlexyz',
    mode: 'integrated',
    queryEmbedding: null,
    options: {
      allowedDocumentIds: new Set(['scoped-doc']),
      maxLexicalCandidateChunks: 2,
    },
  });
  const lexicalStage = result.stageTrace?.find((stage) => stage.stage === 'lexical_candidates');

  assert.deepEqual(
    result.lexicalCandidates.map((candidate) => candidate.id),
    ['first', 'second'],
  );
  assert.ok(lexicalStage?.notes?.includes('lexical-pool-source=posting-scope'));
});

test('searchCorpus reuses indexed exact metadata during exact scoring', () => {
  const target = chunk({
    id: 'indexed-exact-target',
    documentId: 'indexed-exact-doc',
    docTitle: 'Indexed Exact Guide',
    fileName: 'Indexed Exact Guide.md',
    text: 'A guide document used to verify indexed exact metadata reuse.',
    searchText: 'indexed exact guide metadata reuse',
  });
  const unrelated = chunk({
    id: 'indexed-exact-unrelated',
    documentId: 'unrelated-doc',
    docTitle: 'Unrelated Notice',
    text: 'This notice should not win the exact title lookup.',
    searchText: 'unrelated notice',
  });

  const result = searchCorpus({
    index: buildRagCorpusIndex([unrelated, target]),
    query: 'Find the Indexed Exact Guide document',
    mode: 'integrated',
    queryEmbedding: null,
  });
  const fusionStage = result.stageTrace?.find((stage) => stage.stage === 'fusion');

  assert.equal(result.exactCandidates[0]?.documentId, 'indexed-exact-doc');
  assert.ok(fusionStage?.notes?.includes('exact-scoring=indexed-metadata'));
  assert.ok(fusionStage?.notes?.includes('exact-scoring=lazy-candidate'));
  assert.ok(fusionStage?.notes?.includes('exact-scoring=compact-query-terms'));
  assert.ok(fusionStage?.notes?.includes('exact-scoring=query-signals'));
  assert.ok(fusionStage?.notes?.includes('exact-ranking=bounded-topk'));
  assert.equal(typeof result.corpusPhaseTimings?.fusionDetails?.entityAnchorMs, 'number');
  assert.equal(typeof result.corpusPhaseTimings?.fusionDetails?.diversifyMs, 'number');
});

test('searchCorpus uses indexed entity anchor candidates during fusion', () => {
  const entityHit = chunk({
    id: 'entity-anchor-hit',
    documentId: 'entity-anchor-doc',
    docTitle: '신규 수급자 업무 지침',
    title: '신규 수급자 초기 업무',
    parentSectionTitle: '신규 수급자 초기 업무',
    text: '신규 수급자가 처음 오면 욕구사정과 급여제공계획을 확인해야 합니다.',
    searchText: '신규 수급자 처음 오면 욕구사정 급여제공계획 업무',
  });
  const unrelated = chunk({
    id: 'entity-anchor-unrelated',
    documentId: 'entity-anchor-unrelated-doc',
    docTitle: '일반 업무 지침',
    text: '일반 행정 업무 안내입니다.',
    searchText: '일반 행정 업무 안내',
  });
  const index = buildRagCorpusIndex([unrelated, entityHit]);

  const result = searchCorpus({
    index,
    query: '신규 수급자 오면 해야할 업무',
    mode: 'integrated',
    queryEmbedding: null,
  });
  const fusionStage = result.stageTrace?.find((stage) => stage.stage === 'fusion');

  assert.deepEqual(index.entityAnchorPostingMap.get('신규수급자'), ['entity-anchor-hit']);
  assert.ok(result.fusedCandidates.some((candidate) => candidate.id === 'entity-anchor-hit'));
  assert.ok(fusionStage?.notes?.includes('entity-anchor-source=index'));
});

test('searchCorpus shares rerank query context across fusion candidates', () => {
  const target = chunk({
    id: 'rerank-context-target',
    documentId: 'rerank-context-doc',
    docTitle: '업무 처리 매뉴얼',
    title: '업무 처리 흐름',
    parentSectionTitle: '업무 처리 흐름',
    text: '업무 처리 흐름과 확인 절차를 설명합니다.',
    searchText: '업무 처리 흐름 확인 절차 매뉴얼',
    sourceType: 'guide',
    sourceRole: 'support_reference',
  });
  const result = searchCorpus({
    index: buildRagCorpusIndex([target]),
    query: '업무 처리 매뉴얼 찾아줘',
    mode: 'integrated',
    queryEmbedding: null,
  });
  const fusionStage = result.stageTrace?.find((stage) => stage.stage === 'fusion');

  assert.ok(fusionStage?.notes?.includes('rerank-context=shared'));
});

test('searchCorpus reuses lexical scoring cache across scoped searches', () => {
  const shared = chunk({
    id: 'shared',
    documentId: 'shared-doc',
    text: 'cache-token appears in this shared chunk.',
    searchText: 'cache-token appears in this shared chunk.',
  });
  const other = chunk({
    id: 'other',
    documentId: 'other-doc',
    text: 'cache-token appears in this other chunk.',
    searchText: 'cache-token appears in this other chunk.',
  });
  const index = buildRagCorpusIndex([shared, other]);
  const lexicalScoringCache = createLexicalScoringCache();

  searchCorpus({
    index,
    query: 'cache-token',
    mode: 'integrated',
    queryEmbedding: null,
    options: {
      allowedDocumentIds: new Set(['shared-doc']),
      lexicalScoringCache,
    },
  });
  const afterFirst = lexicalScoringCache.getStats();

  const second = searchCorpus({
    index,
    query: 'cache-token',
    mode: 'integrated',
    queryEmbedding: null,
    options: {
      allowedDocumentIds: new Set(['shared-doc', 'other-doc']),
      lexicalScoringCache,
    },
  });
  const afterSecond = lexicalScoringCache.getStats();
  const lexicalStage = second.stageTrace?.find((stage) => stage.stage === 'lexical_candidates');

  assert.equal(afterFirst.hits, 0);
  assert.equal(afterFirst.misses, 1);
  assert.ok(afterSecond.hits >= 1);
  assert.ok(afterSecond.misses >= 2);
  assert.ok(lexicalStage?.notes?.includes('lexical-scoring=idf-precomputed'));
  assert.ok(lexicalStage?.notes?.some((note) => note.startsWith('lexical-score-cache=')));
});
