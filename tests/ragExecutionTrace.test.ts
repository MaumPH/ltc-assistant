import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const nodeRagServiceSource = readFileSync(new URL('../src/lib/nodeRagService.ts', import.meta.url), 'utf8');
const ragEngineSource = readFileSync(new URL('../src/lib/ragEngine.ts', import.meta.url), 'utf8');
const ragTypesSource = readFileSync(new URL('../src/lib/ragTypes.ts', import.meta.url), 'utf8');

test('executeSearch trace splits routing and integrated postprocess phases', () => {
  const requiredPhaseLabels = [
    'evaluation-section-routing',
    'evaluation-ontology-expand',
    'evaluation-routing-resolve',
    'integrated-section-routing',
    'integrated-ontology-expand',
    'integrated-routing-resolve',
  ];

  for (const label of requiredPhaseLabels) {
    assert.match(nodeRagServiceSource, new RegExp(`'${label}'`));
  }
});

test('integrated initial lexical candidate cap default stays conservative', () => {
  assert.match(
    nodeRagServiceSource,
    /INTEGRATED_INITIAL_MAX_LEXICAL_CHUNKS\s*=\s*parsePositiveInteger\(process\.env\.RAG_INTEGRATED_INITIAL_MAX_LEXICAL_CHUNKS,\s*2_000\)/,
  );
});

test('integrated reranked lexical candidate cap default stays conservative', () => {
  assert.match(
    nodeRagServiceSource,
    /INTEGRATED_RERANKED_MAX_LEXICAL_CHUNKS\s*=\s*parsePositiveInteger\(\s*process\.env\.RAG_INTEGRATED_RERANKED_MAX_LEXICAL_CHUNKS,\s*2_000,\s*\)/,
  );
  assert.match(nodeRagServiceSource, /maxLexicalCandidateChunks:\s*INTEGRATED_RERANKED_MAX_LEXICAL_CHUNKS/);
});

test('evaluation routing and base lexical candidate cap defaults stay conservative', () => {
  assert.match(
    nodeRagServiceSource,
    /EVALUATION_ROUTING_MAX_LEXICAL_CHUNKS\s*=\s*parsePositiveInteger\(\s*process\.env\.RAG_EVALUATION_ROUTING_MAX_LEXICAL_CHUNKS,\s*2_400,\s*\)/,
  );
  assert.match(
    nodeRagServiceSource,
    /EVALUATION_BASE_MAX_LEXICAL_CHUNKS\s*=\s*parsePositiveInteger\(process\.env\.RAG_EVALUATION_BASE_MAX_LEXICAL_CHUNKS,\s*3_000\)/,
  );
  assert.match(nodeRagServiceSource, /maxLexicalCandidateChunks:\s*EVALUATION_ROUTING_MAX_LEXICAL_CHUNKS/);
  assert.match(nodeRagServiceSource, /maxLexicalCandidateChunks:\s*EVALUATION_BASE_MAX_LEXICAL_CHUNKS/);
});

test('evaluation base lexical pool merge is the default reuse strategy', () => {
  assert.match(
    nodeRagServiceSource,
    /EVALUATION_BASE_LEXICAL_POOL_MERGE_ENABLED\s*=\s*\(process\.env\.RAG_ENABLE_EVALUATION_BASE_LEXICAL_POOL_MERGE\s*\|\|\s*'true'\)\.toLowerCase\(\)\s*===\s*'true'/,
  );
  assert.match(nodeRagServiceSource, /mergePrecomputedLexicalCandidateChunks:\s*EVALUATION_BASE_LEXICAL_POOL_MERGE_ENABLED/);
  assert.match(nodeRagServiceSource, /strategy=\$\{shouldAttemptBaseLexicalPoolReuse \? lexicalPoolReuseStrategy : 'disabled'\}/);
});

test('executeSearch reuses a cached corpus snapshot for stable document sets', () => {
  assert.match(nodeRagServiceSource, /interface SearchCorpusSnapshot/);
  assert.match(nodeRagServiceSource, /private getSearchCorpusSnapshot\(\): SearchCorpusSnapshot/);
  assert.match(
    nodeRagServiceSource,
    /const \{\s*chunks: allChunks,\s*representatives,\s*evaluationDocumentIds,\s*routeOnlyDocumentIds,\s*integratedSupportDocumentIds,\s*recipientOnboardingDocumentBoosts,\s*\} = this\.getSearchCorpusSnapshot\(\);/,
  );
  assert.match(nodeRagServiceSource, /recipientOnboardingDocumentBoosts: buildRecipientOnboardingDocumentBoosts\(chunks\)/);
  assert.match(nodeRagServiceSource, /this\.searchCorpusSnapshot = null/);
  assert.match(nodeRagServiceSource, /this\.workflowBriefs = this\.buildWorkflowBriefIndex\(\);\s*this\.getSearchCorpusSnapshot\(\);/);
});

test('stage exact candidate caps keep integrated and evaluation-base scoring lean', () => {
  const integratedCaps = [
    ['INTEGRATED_INITIAL_MAX_EXACT_CHUNKS', 'RAG_INTEGRATED_INITIAL_MAX_EXACT_CHUNKS'],
    ['INTEGRATED_RERANKED_MAX_EXACT_CHUNKS', 'RAG_INTEGRATED_RERANKED_MAX_EXACT_CHUNKS'],
  ];
  const evaluationRoutingCaps = [
    ['EVALUATION_ROUTING_MAX_EXACT_CHUNKS', 'RAG_EVALUATION_ROUTING_MAX_EXACT_CHUNKS', 'EVALUATION_ROUTING_MAX_LEXICAL_CHUNKS'],
  ];

  for (const [constantName, envName] of integratedCaps) {
    assert.match(
      nodeRagServiceSource,
      new RegExp(`${constantName}\\s*=\\s*parsePositiveInteger\\(\\s*process\\.env\\.${envName},\\s*1_600,\\s*\\)`),
    );
    assert.match(nodeRagServiceSource, new RegExp(`maxExactCandidateChunks:\\s*${constantName}`));
  }

  for (const [constantName, envName, fallbackName] of evaluationRoutingCaps) {
    assert.match(
      nodeRagServiceSource,
      new RegExp(`${constantName}\\s*=\\s*parsePositiveInteger\\(\\s*process\\.env\\.${envName},\\s*${fallbackName},\\s*\\)`),
    );
    assert.match(nodeRagServiceSource, new RegExp(`maxExactCandidateChunks:\\s*${constantName}`));
  }
  assert.match(
    nodeRagServiceSource,
    /EVALUATION_BASE_MAX_EXACT_CHUNKS\s*=\s*parsePositiveInteger\(\s*process\.env\.RAG_EVALUATION_BASE_MAX_EXACT_CHUNKS,\s*2_800,\s*\)/,
  );
  assert.match(nodeRagServiceSource, /maxExactCandidateChunks:\s*EVALUATION_BASE_MAX_EXACT_CHUNKS/);
});

test('retrieval plan shares exact scoring cache across sub-searches', () => {
  assert.match(nodeRagServiceSource, /createExactScoringCache/);
  assert.match(nodeRagServiceSource, /const exactScoringCache = createExactScoringCache\(\)/);
  assert.match(nodeRagServiceSource, /exactScoringCache,/);
  assert.match(nodeRagServiceSource, /phaseExactCacheHits/);
  assert.match(ragEngineSource, /cacheSignature/);
  assert.match(ragTypesSource, /exactScoringCache\?:/);
});
