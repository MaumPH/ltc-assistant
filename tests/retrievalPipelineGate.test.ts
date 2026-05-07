import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRagCorpusIndex, deriveFocusTerms, searchCorpus } from '../src/lib/ragEngine';
import { applyGroundingGate, applyOriginalFocusGate, buildSmallToBigContextExpansion } from '../src/lib/retrievalPipeline';
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

test('buildSmallToBigContextExpansion selects adjacent context windows without mutating evidence', () => {
  const evidence = chunk({
    id: 'section-a-1',
    documentId: 'doc-a',
    parentSectionId: 'section-a',
    parentSectionTitle: '절차 섹션',
    windowIndex: 1,
    text: '선택된 evidence chunk',
  });
  const allChunks = [
    chunk({
      id: 'section-a-0',
      documentId: 'doc-a',
      parentSectionId: 'section-a',
      parentSectionTitle: '절차 섹션',
      windowIndex: 0,
      text: '앞쪽 context chunk',
    }),
    evidence,
    chunk({
      id: 'section-a-2',
      documentId: 'doc-a',
      parentSectionId: 'section-a',
      parentSectionTitle: '절차 섹션',
      windowIndex: 2,
      text: '뒤쪽 context chunk',
    }),
    chunk({
      id: 'section-b-0',
      documentId: 'doc-a',
      parentSectionId: 'section-b',
      parentSectionTitle: '다른 섹션',
      windowIndex: 0,
      text: '다른 parent section chunk',
    }),
  ];

  const expansion = buildSmallToBigContextExpansion(allChunks, [evidence], {
    maxContextChunks: 2,
    maxContextChars: 1000,
  });

  assert.deepEqual(expansion.contextChunks.map((item) => item.id), ['section-a-0', 'section-a-2']);
  assert.equal(expansion.candidateWindowCount, 2);
  assert.equal(expansion.includedWindowCount, 2);
  assert.equal(expansion.skippedByGuardCount, 0);
  assert.equal(expansion.includedCharCount, '앞쪽 context chunk뒤쪽 context chunk'.length);
  assert.deepEqual([evidence.id], ['section-a-1']);
});

test('buildSmallToBigContextExpansion reports guard skips when context caps are reached', () => {
  const evidence = chunk({
    id: 'section-a-1',
    documentId: 'doc-a',
    parentSectionId: 'section-a',
    windowIndex: 1,
    text: '선택 evidence',
  });
  const allChunks = [
    chunk({
      id: 'section-a-0',
      documentId: 'doc-a',
      parentSectionId: 'section-a',
      windowIndex: 0,
      text: '앞쪽 긴 context chunk',
    }),
    evidence,
    chunk({
      id: 'section-a-2',
      documentId: 'doc-a',
      parentSectionId: 'section-a',
      windowIndex: 2,
      text: '뒤쪽 긴 context chunk',
    }),
  ];

  const expansion = buildSmallToBigContextExpansion(allChunks, [evidence], {
    maxContextChunks: 1,
    maxContextChars: 1000,
  });

  assert.deepEqual(expansion.contextChunks.map((item) => item.id), ['section-a-0']);
  assert.equal(expansion.candidateWindowCount, 2);
  assert.equal(expansion.includedWindowCount, 1);
  assert.equal(expansion.skippedByGuardCount, 1);
  assert.equal(expansion.skippedByMaxChunksCount, 1);
  assert.equal(expansion.skippedByMaxCharsCount, 0);
});

test('buildSmallToBigContextExpansion prioritizes stronger neighbor context when caps are tight', () => {
  const lowPriorityEvidence = candidate({
    id: 'low-evidence',
    documentId: 'doc-low',
    parentSectionId: 'section-low',
    parentSectionTitle: '보조 섹션',
    sourceRole: 'support_reference',
    rerankScore: 10,
    windowIndex: 1,
  });
  const highPriorityEvidence = candidate({
    id: 'high-evidence',
    documentId: 'doc-high',
    parentSectionId: 'section-high',
    parentSectionTitle: '평가 섹션',
    sourceRole: 'primary_evaluation',
    rerankScore: 90,
    windowIndex: 1,
  });
  const allChunks = [
    chunk({
      id: 'low-neighbor',
      documentId: 'doc-low',
      parentSectionId: 'section-low',
      parentSectionTitle: '보조 섹션',
      sourceRole: 'support_reference',
      windowIndex: 0,
      text: '보조 context chunk',
    }),
    lowPriorityEvidence,
    chunk({
      id: 'high-neighbor',
      documentId: 'doc-high',
      parentSectionId: 'section-high',
      parentSectionTitle: '평가 섹션',
      sourceRole: 'primary_evaluation',
      windowIndex: 0,
      text: '평가 원문 context chunk',
      matchedLabels: ['chunk-policy:evaluation'],
    }),
    highPriorityEvidence,
  ];

  const expansion = buildSmallToBigContextExpansion(allChunks, [lowPriorityEvidence, highPriorityEvidence], {
    maxContextChunks: 1,
    maxContextChars: 1000,
  });

  assert.deepEqual(expansion.contextChunks.map((item) => item.id), ['high-neighbor']);
  assert.equal(expansion.candidateWindowCount, 2);
  assert.equal(expansion.includedWindowCount, 1);
  assert.equal(expansion.skippedByGuardCount, 1);
  assert.equal(expansion.skippedByMaxChunksCount, 1);
});

test('buildSmallToBigContextExpansion trims long context-only neighbors before applying char caps', () => {
  const longText = '긴 context 문장 '.repeat(120);
  const evidence = chunk({
    id: 'trim-evidence',
    documentId: 'doc-trim',
    parentSectionId: 'section-trim',
    windowIndex: 1,
    text: '선택 evidence',
  });
  const longNeighbor = chunk({
    id: 'trim-neighbor',
    documentId: 'doc-trim',
    parentSectionId: 'section-trim',
    windowIndex: 0,
    text: longText,
  });

  const expansion = buildSmallToBigContextExpansion([longNeighbor, evidence], [evidence], {
    maxContextChunks: 1,
    maxContextChars: 260,
    maxContextChunkChars: 200,
  });

  assert.equal(expansion.candidateWindowCount, 1);
  assert.equal(expansion.includedWindowCount, 1);
  assert.equal(expansion.skippedByGuardCount, 0);
  assert.equal(expansion.contextChunks[0]?.id, 'trim-neighbor');
  assert.ok((expansion.contextChunks[0]?.text.length ?? 0) <= 203);
  assert.equal(longNeighbor.text, longText);
});

test('buildSmallToBigContextExpansion reports max char skip reason separately', () => {
  const evidence = chunk({
    id: 'char-evidence',
    documentId: 'doc-char',
    parentSectionId: 'section-char',
    windowIndex: 1,
    text: '선택 evidence',
  });
  const neighbor = chunk({
    id: 'char-neighbor',
    documentId: 'doc-char',
    parentSectionId: 'section-char',
    windowIndex: 0,
    text: '긴 context '.repeat(100),
  });

  const expansion = buildSmallToBigContextExpansion([neighbor, evidence], [evidence], {
    maxContextChunks: 2,
    maxContextChars: 100,
    maxContextChunkChars: 300,
  });

  assert.equal(expansion.candidateWindowCount, 1);
  assert.equal(expansion.includedWindowCount, 0);
  assert.equal(expansion.skippedByGuardCount, 1);
  assert.equal(expansion.skippedByMaxChunksCount, 0);
  assert.equal(expansion.skippedByMaxCharsCount, 1);
});

test('buildSmallToBigContextExpansion applies source-role specific context excerpt caps', () => {
  const primaryEvidence = chunk({
    id: 'primary-evidence',
    documentId: 'doc-primary',
    parentSectionId: 'section-primary',
    sourceRole: 'primary_evaluation',
    windowIndex: 1,
    text: '선택 evidence',
  });
  const supportEvidence = chunk({
    id: 'support-evidence',
    documentId: 'doc-support',
    parentSectionId: 'section-support',
    sourceRole: 'support_reference',
    windowIndex: 1,
    text: '선택 evidence',
  });
  const primaryNeighbor = chunk({
    id: 'primary-neighbor',
    documentId: 'doc-primary',
    parentSectionId: 'section-primary',
    sourceRole: 'primary_evaluation',
    windowIndex: 0,
    text: '평가 원문 '.repeat(200),
  });
  const supportNeighbor = chunk({
    id: 'support-neighbor',
    documentId: 'doc-support',
    parentSectionId: 'section-support',
    sourceRole: 'support_reference',
    windowIndex: 0,
    text: '보조 자료 '.repeat(200),
  });

  const expansion = buildSmallToBigContextExpansion(
    [primaryNeighbor, primaryEvidence, supportNeighbor, supportEvidence],
    [primaryEvidence, supportEvidence],
    {
      maxContextChunks: 2,
      maxContextChars: 2000,
      maxContextChunkChars: 700,
      maxContextChunkCharsBySourceRole: {
        primary_evaluation: 900,
        support_reference: 300,
      },
    },
  );

  const primaryContext = expansion.contextChunks.find((item) => item.id === 'primary-neighbor');
  const supportContext = expansion.contextChunks.find((item) => item.id === 'support-neighbor');

  assert.ok((primaryContext?.text.length ?? 0) > 700);
  assert.ok((primaryContext?.text.length ?? 0) <= 903);
  assert.ok((supportContext?.text.length ?? 0) <= 303);
});

test('buildSmallToBigContextExpansion applies source-role specific total char budgets for authority anchors', () => {
  const primaryEvidence = chunk({
    id: 'primary-budget-evidence',
    documentId: 'doc-primary-budget',
    parentSectionId: 'section-primary-budget',
    sourceRole: 'primary_evaluation',
    windowIndex: 1,
    text: '선택 evidence',
  });
  const previousNeighbor = chunk({
    id: 'primary-budget-previous',
    documentId: 'doc-primary-budget',
    parentSectionId: 'section-primary-budget',
    sourceRole: 'primary_evaluation',
    windowIndex: 0,
    text: '평가 이전 문맥 '.repeat(60),
  });
  const nextNeighbor = chunk({
    id: 'primary-budget-next',
    documentId: 'doc-primary-budget',
    parentSectionId: 'section-primary-budget',
    sourceRole: 'primary_evaluation',
    windowIndex: 2,
    text: '평가 다음 문맥 '.repeat(60),
  });

  const expansion = buildSmallToBigContextExpansion([previousNeighbor, primaryEvidence, nextNeighbor], [primaryEvidence], {
    maxContextChunks: 2,
    maxContextChars: 900,
    maxContextCharsByAnchorSourceRole: {
      primary_evaluation: 1500,
    },
    maxContextChunkChars: 700,
  });

  assert.deepEqual(expansion.contextChunks.map((item) => item.id), ['primary-budget-previous', 'primary-budget-next']);
  assert.equal(expansion.includedWindowCount, 2);
  assert.equal(expansion.skippedByGuardCount, 0);
  assert.ok(expansion.includedCharCount > 900);
  assert.ok(expansion.includedCharCount <= 1500);
  assert.equal(expansion.effectiveMaxContextChars, 1500);
});

test('searchCorpus caps ordinary lexical and fusion candidates for latency-sensitive lookups', () => {
  const query = 'latency cap policy';
  const chunks = Array.from({ length: 40 }, (_, index) =>
    chunk({
      id: `latency-cap-${index + 1}`,
      documentId: `latency-doc-${index + 1}`,
      parentSectionId: `latency-section-${index + 1}`,
      parentSectionTitle: `Latency section ${index + 1}`,
      text: `latency cap policy chunk ${index + 1}`,
    }),
  );

  const result = searchCorpus({
    index: buildRagCorpusIndex(chunks),
    query,
    mode: 'integrated',
    queryEmbedding: null,
  });

  assert.equal(result.lexicalCandidates.length, 24);
  assert.equal(result.fusedCandidates.length, 24);
  assert.equal(result.stageTrace?.find((stage) => stage.stage === 'lexical_candidates')?.outputCount, 24);
  assert.equal(result.stageTrace?.find((stage) => stage.stage === 'fusion')?.outputCount, 24);
});

test('searchCorpus applies lexical candidate budget with rare query terms first', () => {
  const target = chunk({
    id: 'rare-target',
    documentId: 'rare-target-doc',
    parentSectionId: 'rare-target-section',
    parentSectionTitle: 'Rare target section',
    text: 'common common raretopic precise policy evidence',
  });
  const distractors = Array.from({ length: 40 }, (_, index) =>
    chunk({
      id: `common-distractor-${index}`,
      documentId: `common-distractor-doc-${index}`,
      parentSectionId: `common-distractor-section-${index}`,
      parentSectionTitle: `Common distractor ${index}`,
      text: 'common common general operations policy',
    }),
  );

  const result = searchCorpus({
    index: buildRagCorpusIndex([...distractors, target]),
    query: 'common raretopic',
    mode: 'integrated',
    queryEmbedding: null,
    options: {
      maxLexicalCandidateChunks: 6,
    },
  });

  assert.ok(result.lexicalCandidates.some((candidate) => candidate.documentId === 'rare-target-doc'));
  assert.ok(result.lexicalCandidates.length <= 6);
});

test('buildRagCorpusIndex precomputes lexical term frequencies for retrieval reuse', () => {
  const index = buildRagCorpusIndex([
    chunk({
      id: 'tf-cache',
      text: 'latency latency cap policy',
    }),
  ]);

  assert.equal(index.tokenCountMap.get('tf-cache'), 3);
  assert.equal(index.tfMap.get('tf-cache')?.get('latency'), 1);
  assert.equal(index.tfMap.get('tf-cache')?.get('cap'), 1);
  assert.ok(index.postingMap.get('latency')?.has('tf-cache'));
  assert.ok(index.chunkById.get('tf-cache'));
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
