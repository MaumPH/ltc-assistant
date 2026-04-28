import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveFocusTerms } from '../src/lib/ragEngine';
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

test('applyGroundingGate treats procedure evidence as grounded for onboarding workflow queries', () => {
  const query = '신규수급자가 왔을때 해야하는 업무는?';
  const evidence = [
    candidate({
      id: 'onboarding-1',
      documentId: 'workflow-doc',
      searchText: '신규 수급자 초기상담 욕구사정 보호자 안내 기록',
      textPreview: '신규 수급자 초기상담과 욕구사정, 보호자 안내를 진행한다.',
      matchedTerms: ['신규 수급자', '초기상담', '욕구사정'],
    }),
    candidate({
      id: 'onboarding-2',
      documentId: 'workflow-doc',
      searchText: '급여제공계획 작성 장기요양계약 체결 동의 교육',
      textPreview: '급여제공계획을 작성하고 장기요양계약 체결, 동의 및 교육을 확인한다.',
      matchedTerms: ['급여제공계획', '계약', '교육'],
    }),
  ];

  const result = applyGroundingGate(
    searchRun({
      query,
      confidence: 'low',
      focusTerms: deriveFocusTerms(query),
      evidence,
      fusedCandidates: evidence,
      mismatchSignals: ['grounding-gate-failed'],
      groundingGatePassed: false,
    }),
  );

  assert.equal(result.groundingGatePassed, true);
  assert.equal(result.confidence, 'medium');
  assert.deepEqual(result.mismatchSignals, []);
});

test('applyOriginalFocusGate relaxes focus matching for broad procedure queries', () => {
  const query = '신규수급자가 왔을때 해야하는 업무는?';
  const evidence = [
    candidate({
      id: 'onboarding-focus',
      searchText: '수급자 초기상담 욕구사정 계약 급여제공계획 작성',
      textPreview: '수급자 초기상담, 욕구사정, 계약, 급여제공계획 작성 순서',
      matchedTerms: ['수급자'],
    }),
  ];

  const result = applyOriginalFocusGate(
    searchRun({
      query,
      confidence: 'medium',
      focusTerms: deriveFocusTerms(query),
      fusedCandidates: evidence,
      evidence,
      mismatchSignals: ['insufficient-original-focus-terms-in-top-candidates'],
      groundingGatePassed: true,
    }),
    query,
  );

  assert.equal(result.groundingGatePassed, true);
  assert.equal(result.confidence, 'medium');
  assert.deepEqual(result.mismatchSignals, []);
});
