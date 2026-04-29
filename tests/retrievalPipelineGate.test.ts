import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRagCorpusIndex, deriveFocusTerms, searchCorpus } from '../src/lib/ragEngine';
import { applyGroundingGate, applyOriginalFocusGate } from '../src/lib/retrievalPipeline';
import type { SearchCandidate, SearchRun, StructuredChunk } from '../src/lib/ragTypes';

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

function chunk(overrides: Partial<StructuredChunk> & { id: string; text: string }): StructuredChunk {
  return {
    id: overrides.id,
    documentId: overrides.documentId ?? 'doc-1',
    chunkIndex: overrides.chunkIndex ?? 0,
    title: overrides.title ?? overrides.parentSectionTitle ?? overrides.id,
    text: overrides.text,
    textPreview: overrides.text.slice(0, 120),
    searchText: overrides.searchText ?? overrides.text,
    mode: overrides.mode ?? 'evaluation',
    sourceType: overrides.sourceType ?? 'manual',
    sourceRole: overrides.sourceRole ?? 'primary_evaluation',
    documentGroup: overrides.documentGroup ?? 'manual',
    docTitle: overrides.docTitle ?? '2026년 재가급여 평가매뉴얼',
    fileName: overrides.fileName ?? '2026년_재가급여_평가매뉴얼.md',
    path: overrides.path ?? '/knowledge/evaluation/2026-manual.md',
    effectiveDate: overrides.effectiveDate ?? '2026-01-01',
    publishedDate: overrides.publishedDate ?? '2026-01-01',
    sectionPath: overrides.sectionPath ?? ['2026년 재가급여 평가매뉴얼', overrides.parentSectionTitle ?? overrides.id],
    headingPath: overrides.headingPath ?? ['2026년 재가급여 평가매뉴얼', overrides.parentSectionTitle ?? overrides.id],
    articleNo: overrides.articleNo,
    matchedLabels: overrides.matchedLabels ?? [],
    chunkHash: overrides.chunkHash ?? `hash-${overrides.id}`,
    parentSectionId: overrides.parentSectionId ?? `section-${overrides.id}`,
    parentSectionTitle: overrides.parentSectionTitle ?? overrides.id,
    listGroupId: overrides.listGroupId,
    containsCheckList: overrides.containsCheckList ?? true,
    embeddingInput: overrides.embeddingInput,
    windowIndex: overrides.windowIndex ?? 0,
    spanStart: overrides.spanStart ?? 0,
    spanEnd: overrides.spanEnd ?? overrides.text.length,
    citationGroupId: overrides.citationGroupId ?? `${overrides.documentId ?? 'doc-1'}:${overrides.parentSectionId ?? `section-${overrides.id}`}`,
    linkedDocumentTitles: overrides.linkedDocumentTitles ?? [],
    embedding: overrides.embedding,
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

test('searchCorpus relaxes per-document cap for enumeration queries', () => {
  const query = '신규수급자가 오면 해야하는 업무는?';
  const chunks = Array.from({ length: 6 }, (_, index) =>
    chunk({
      id: `enum-${index + 1}`,
      documentId: 'eval-doc',
      parentSectionId: `section-${index + 1}`,
      parentSectionTitle: `지표 ${index + 1}`,
      articleNo: `지표 ${index + 1}`,
      text: `신규수급자 업무 ${index + 1}. 해야 하는 절차와 기록을 설명합니다.`,
    }),
  );

  const result = searchCorpus({
    index: buildRagCorpusIndex(chunks),
    query,
    mode: 'evaluation',
    queryEmbedding: null,
  });

  const topSameDocument = result.fusedCandidates.slice(0, 5).filter((item) => item.documentId === 'eval-doc');
  assert.equal(topSameDocument.length, 5);
});

test('searchCorpus preserves entity-linked indicator coverage for enumeration queries', () => {
  const query = '신규수급자가 오면 해야하는 업무는?';
  const chunks = [
    chunk({
      id: 'need-assessment',
      documentId: 'eval-doc',
      parentSectionId: 'section-20',
      parentSectionTitle: '욕구사정',
      articleNo: '지표 20',
      text: '신규수급자는 급여제공 시작일부터 토요일·공휴일 포함 14일 이내에 욕구사정을 완료합니다.',
    }),
    chunk({
      id: 'care-plan',
      documentId: 'eval-doc',
      parentSectionId: 'section-22',
      parentSectionTitle: '급여제공계획',
      articleNo: '지표 22',
      text: '신규수급자는 급여제공 시작일까지 급여제공계획을 작성하고 보호자와 공유합니다.',
    }),
    chunk({
      id: 'guidance',
      documentId: 'eval-doc',
      parentSectionId: 'section-19',
      parentSectionTitle: '지침설명',
      articleNo: '지표 19',
      text: '모든 수급자와 보호자에게 8가지 지침을 설명하며 신규수급자는 급여제공 시작일부터 토요일·공휴일 포함 14일 이내에 설명합니다.',
    }),
    chunk({
      id: 'dominant-1',
      documentId: 'eval-doc',
      parentSectionId: 'section-d1',
      parentSectionTitle: '초기상담',
      articleNo: '지표 10',
      text: '신규수급자 초기상담과 기록을 반복 안내합니다. 신규수급자 초기상담과 기록을 반복 안내합니다.',
    }),
    chunk({
      id: 'dominant-2',
      documentId: 'eval-doc',
      parentSectionId: 'section-d2',
      parentSectionTitle: '계약체결',
      articleNo: '지표 11',
      text: '신규수급자 계약체결과 동의서를 반복 안내합니다. 신규수급자 계약체결과 동의서를 반복 안내합니다.',
    }),
  ];

  const result = searchCorpus({
    index: buildRagCorpusIndex(chunks),
    query,
    mode: 'evaluation',
    queryEmbedding: null,
  });

  const parentTitles = new Set(result.evidence.map((item) => item.parentSectionTitle));
  assert.ok(parentTitles.has('욕구사정'));
  assert.ok(parentTitles.has('급여제공계획'));
  assert.ok(parentTitles.has('지침설명'));
  assert.ok(result.evidence.some((item) => item.forcedByEntity));
});
