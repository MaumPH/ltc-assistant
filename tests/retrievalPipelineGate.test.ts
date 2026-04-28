import assert from 'node:assert/strict';
import test from 'node:test';
import { applyGroundingGate, applyOriginalFocusGate } from '../src/lib/retrievalPipeline';
import type { SearchCandidate, SearchRun } from '../src/lib/ragTypes';

function candidate(overrides: Partial<SearchCandidate> = {}): SearchCandidate {
  return {
    id: overrides.id ?? 'chunk-1',
    documentId: overrides.documentId ?? 'doc-1',
    path: overrides.path ?? '/knowledge/doc.md',
    mode: overrides.mode ?? 'integrated',
    sourceType: overrides.sourceType ?? 'manual',
    sourceRole: overrides.sourceRole ?? 'primary_evaluation',
    docTitle: overrides.docTitle ?? '테스트 문서',
    text: overrides.text ?? '요양보호사 보수교육 기준',
    searchText: overrides.searchText ?? '요양보호사 보수교육 기준',
    textPreview: overrides.textPreview ?? '요양보호사 보수교육 기준',
    sectionPath: overrides.sectionPath ?? ['테스트 문서'],
    articleNo: overrides.articleNo,
    matchedLabels: overrides.matchedLabels ?? [],
    chunkHash: overrides.chunkHash ?? 'hash',
    parentSectionId: overrides.parentSectionId ?? 'section-1',
    parentSectionTitle: overrides.parentSectionTitle ?? '테스트 섹션',
    windowIndex: overrides.windowIndex ?? 0,
    spanStart: overrides.spanStart ?? 0,
    spanEnd: overrides.spanEnd ?? 10,
    citationGroupId: overrides.citationGroupId ?? 'doc-1:section-1',
    linkedDocumentTitles: overrides.linkedDocumentTitles ?? [],
    exactScore: overrides.exactScore ?? 45,
    lexicalScore: overrides.lexicalScore ?? 1,
    vectorScore: overrides.vectorScore ?? 0.5,
    fusedScore: overrides.fusedScore ?? 10,
    rerankScore: overrides.rerankScore ?? 20,
    ontologyScore: overrides.ontologyScore ?? 0,
    matchedTerms: overrides.matchedTerms ?? ['요양보호사', '보수교육'],
  };
}

function searchRun(overrides: Partial<SearchRun> = {}): SearchRun {
  const evidence = overrides.evidence ?? [candidate()];
  return {
    query: overrides.query ?? '요양보호사 보수교육',
    mode: overrides.mode ?? 'integrated',
    intent: overrides.intent ?? 'integrated',
    confidence: overrides.confidence ?? 'low',
    exactCandidates: overrides.exactCandidates ?? evidence,
    lexicalCandidates: overrides.lexicalCandidates ?? evidence,
    vectorCandidates: overrides.vectorCandidates ?? evidence,
    fusedCandidates: overrides.fusedCandidates ?? evidence,
    evidence,
    focusTerms: overrides.focusTerms ?? ['요양보호사', '보수교육'],
    mismatchSignals: overrides.mismatchSignals,
    groundingGatePassed: overrides.groundingGatePassed,
    stageTrace: overrides.stageTrace,
  };
}

test('applyGroundingGate clears stale grounding failure after evidence is grounded', () => {
  const result = applyGroundingGate(
    searchRun({
      confidence: 'low',
      mismatchSignals: ['grounding-gate-failed'],
      groundingGatePassed: false,
    }),
  );

  assert.equal(result.groundingGatePassed, true);
  assert.equal(result.confidence, 'medium');
  assert.deepEqual(result.mismatchSignals, []);
});

test('applyOriginalFocusGate clears stale focus failure when top candidates match the original focus', () => {
  const result = applyOriginalFocusGate(
    searchRun({
      confidence: 'low',
      mismatchSignals: ['insufficient-original-focus-terms-in-top-candidates'],
      groundingGatePassed: false,
    }),
    '요양보호사 보수교육',
  );

  assert.equal(result.confidence, 'medium');
  assert.deepEqual(result.mismatchSignals, []);
});
