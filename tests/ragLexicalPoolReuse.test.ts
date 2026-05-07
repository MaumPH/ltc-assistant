import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLexicalPoolReuseCandidatePool,
  buildLexicalPoolReuseDiagnostic,
  shouldFallbackLexicalPoolReuse,
} from '../src/lib/nodeRagService';
import type { SearchCandidate } from '../src/lib/ragTypes';

function candidate(id: string, documentId = `doc-${id}`): SearchCandidate {
  return {
    id,
    documentId,
    chunkIndex: 0,
    title: id,
    text: id,
    textPreview: id,
    searchText: id,
    mode: 'evaluation',
    sourceType: 'manual',
    sourceRole: 'primary_evaluation',
    documentGroup: 'manual',
    docTitle: id,
    fileName: `${id}.md`,
    path: `/knowledge/${id}.md`,
    sectionPath: [id],
    headingPath: [id],
    matchedLabels: [],
    chunkHash: `hash-${id}`,
    parentSectionId: `section-${id}`,
    parentSectionTitle: id,
    windowIndex: 0,
    spanStart: 0,
    spanEnd: id.length,
    citationGroupId: `citation-${id}`,
    linkedDocumentTitles: [],
    exactScore: 0,
    lexicalScore: 1,
    vectorScore: 0,
    fusedScore: 0,
    rerankScore: 0,
    headingScore: 0,
    ontologyScore: 0,
    matchedTerms: ['term'],
  };
}

test('buildLexicalPoolReuseDiagnostic summarizes previous pool coverage of base lexical candidates', () => {
  const diagnostic = buildLexicalPoolReuseDiagnostic({
    targetStage: 'evaluation-base',
    previousStages: [
      {
        stage: 'evaluation-routing',
        lexicalCandidates: [candidate('a'), candidate('b')],
      },
      {
        stage: 'evaluation-direct-support',
        lexicalCandidates: [candidate('b'), candidate('c')],
      },
    ],
    targetLexicalCandidates: [candidate('a'), candidate('b'), candidate('d')],
  });

  assert.deepEqual(diagnostic, {
    step: 'lexical-pool-reuse',
    detail: 'target=evaluation-base, previous=3, targetLexical=3, overlap=2, coverage=66.7%, stages=evaluation-routing:2|evaluation-direct-support:2',
  });
});

test('buildLexicalPoolReuseDiagnostic returns null when the target has no lexical candidates', () => {
  assert.equal(
    buildLexicalPoolReuseDiagnostic({
      targetStage: 'evaluation-base',
      previousStages: [
        {
          stage: 'evaluation-routing',
          lexicalCandidates: [candidate('a')],
        },
      ],
      targetLexicalCandidates: [],
    }),
    null,
  );
});

test('buildLexicalPoolReuseCandidatePool deduplicates previous lexical candidates in stage order', () => {
  const pool = buildLexicalPoolReuseCandidatePool([
    {
      stage: 'evaluation-routing',
      lexicalCandidates: [candidate('a'), candidate('b')],
    },
    {
      stage: 'evaluation-direct-support',
      lexicalCandidates: [candidate('b'), candidate('c')],
    },
  ]);

  assert.deepEqual(pool.map((item) => item.id), ['a', 'b', 'c']);
});

test('shouldFallbackLexicalPoolReuse keeps strong reused search results and falls back on weak results', () => {
  assert.equal(
    shouldFallbackLexicalPoolReuse({
      ...candidate('strong'),
      query: 'strong',
      intent: 'general',
      confidence: 'high',
      exactCandidates: [],
      lexicalCandidates: [candidate('a'), candidate('b'), candidate('c')],
      vectorCandidates: [],
      fusedCandidates: [candidate('a'), candidate('b'), candidate('c')],
      evidence: [candidate('a'), candidate('b'), candidate('c')],
    }),
    false,
  );

  assert.equal(
    shouldFallbackLexicalPoolReuse({
      ...candidate('weak'),
      query: 'weak',
      intent: 'general',
      confidence: 'low',
      exactCandidates: [],
      lexicalCandidates: [candidate('a')],
      vectorCandidates: [],
      fusedCandidates: [candidate('a')],
      evidence: [candidate('a')],
      mismatchSignals: ['no-focus-terms-in-top-candidates'],
    }),
    true,
  );
});
