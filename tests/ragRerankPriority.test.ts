import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRagCorpusIndex, searchCorpus } from '../src/lib/ragEngine';
import { injectEvidenceCandidates } from '../src/lib/retrievalPipeline';
import type { SearchCandidate, SearchRun, StructuredChunk } from '../src/lib/ragTypes';

function chunk(overrides: Partial<StructuredChunk> & { id: string; documentId: string; docTitle: string; text: string }): StructuredChunk {
  return {
    id: overrides.id,
    documentId: overrides.documentId,
    chunkIndex: overrides.chunkIndex ?? 0,
    title: overrides.title ?? overrides.docTitle,
    text: overrides.text,
    textPreview: overrides.text.slice(0, 120),
    searchText: overrides.searchText ?? overrides.text,
    mode: overrides.mode ?? 'integrated',
    sourceType: overrides.sourceType ?? 'manual',
    sourceRole: overrides.sourceRole ?? 'support_reference',
    documentGroup: overrides.documentGroup ?? 'manual',
    docTitle: overrides.docTitle,
    fileName: overrides.fileName ?? `${overrides.docTitle}.md`,
    path: overrides.path ?? `/knowledge/${overrides.docTitle}.md`,
    effectiveDate: overrides.effectiveDate,
    publishedDate: overrides.publishedDate,
    sectionPath: overrides.sectionPath ?? [overrides.docTitle],
    headingPath: overrides.headingPath ?? [overrides.docTitle],
    articleNo: overrides.articleNo,
    matchedLabels: overrides.matchedLabels ?? [],
    linkedDocumentTitles: overrides.linkedDocumentTitles ?? [],
    chunkHash: overrides.chunkHash ?? `hash-${overrides.id}`,
    parentSectionId: overrides.parentSectionId ?? `section-${overrides.id}`,
    parentSectionTitle: overrides.parentSectionTitle ?? overrides.title ?? overrides.docTitle,
    windowIndex: overrides.windowIndex ?? 0,
    spanStart: overrides.spanStart ?? 0,
    spanEnd: overrides.spanEnd ?? overrides.text.length,
    citationGroupId: overrides.citationGroupId ?? `citation-${overrides.id}`,
    embedding: overrides.embedding,
  };
}

function candidate(overrides: Partial<SearchCandidate> & { id: string; documentId: string; docTitle: string }): SearchCandidate {
  const base = chunk({
    id: overrides.id,
    documentId: overrides.documentId,
    docTitle: overrides.docTitle,
    text: overrides.text ?? `${overrides.docTitle} 검색 후보입니다.`,
    sourceRole: overrides.sourceRole,
    sourceType: overrides.sourceType,
  });
  return {
    ...base,
    exactScore: overrides.exactScore ?? 0,
    lexicalScore: overrides.lexicalScore ?? 0,
    vectorScore: overrides.vectorScore ?? 0,
    fusedScore: overrides.fusedScore ?? 0,
    rerankScore: overrides.rerankScore ?? 0,
    headingScore: overrides.headingScore ?? 0,
    ontologyScore: overrides.ontologyScore ?? 0,
    matchedTerms: overrides.matchedTerms ?? [],
    sourceRole: overrides.sourceRole ?? base.sourceRole,
    sourceType: overrides.sourceType ?? base.sourceType,
  };
}

function searchRun(fusedCandidates: SearchCandidate[], evidence = fusedCandidates.slice(0, 3)): SearchRun {
  return {
    query: '민원상담 사례집 문서를 찾아줘',
    mode: 'integrated',
    intent: 'manual-qna',
    confidence: 'high',
    exactCandidates: [],
    lexicalCandidates: [],
    vectorCandidates: [],
    fusedCandidates,
    evidence,
    focusTerms: ['민원상담', '사례집', '문서'],
    mismatchSignals: [],
    groundingGatePassed: true,
  };
}

test('injectEvidenceCandidates keeps strong document-title matches above routing expansion candidates', () => {
  const documentTitleHit = candidate({
    id: 'document-title-hit',
    documentId: 'doc-title-hit',
    docTitle: '2026년_노인장기요양보험_민원상담_사례집',
    sourceRole: 'support_reference',
    sourceType: 'qa',
    exactScore: 224,
    lexicalScore: 0.77,
    rerankScore: 647.2,
    matchedTerms: ['document-title', '민원상담', '사례집', '문서'],
  });
  const primaryExpansion = candidate({
    id: 'primary-expansion',
    documentId: 'primary-doc',
    docTitle: '2026년 주야간보호 평가매뉴얼(26년꺼만)',
    sourceRole: 'primary_evaluation',
    sourceType: 'evaluation',
    rerankScore: 505,
    matchedTerms: ['entity-anchor', 'routing-expanded-primary'],
  });

  const promoted = injectEvidenceCandidates(searchRun([documentTitleHit]), [primaryExpansion]);

  assert.equal(promoted.fusedCandidates[0].id, 'document-title-hit');
  assert.equal(promoted.fusedCandidates[1].id, 'primary-expansion');
});

test('injectEvidenceCandidates keeps comparison lookup documents above routing expansion candidates', () => {
  const comparisonHit = candidate({
    id: 'comparison-hit',
    documentId: 'comparison-doc',
    docTitle: '2026년_장기요양기관_재가급여_평가매뉴얼_다빈도Q&A_개정전후_비교표',
    sourceRole: 'support_reference',
    sourceType: 'comparison',
    exactScore: 290,
    lexicalScore: 0,
    rerankScore: 1362.5,
    matchedTerms: ['개정', '전후', '비교표', 'synthesis-source', 'document-lookup-source'],
  });
  const primaryExpansion = candidate({
    id: 'primary-eval-expansion',
    documentId: 'primary-eval-doc',
    docTitle: '2026년 주야간보호 평가매뉴얼(26년꺼만)',
    sourceRole: 'primary_evaluation',
    sourceType: 'evaluation',
    exactScore: 146,
    rerankScore: 1267.5,
    matchedTerms: ['평가매뉴얼', 'routing-expanded-primary'],
  });

  const promoted = injectEvidenceCandidates(searchRun([comparisonHit]), [primaryExpansion]);

  assert.equal(promoted.fusedCandidates[0].id, 'comparison-hit');
  assert.equal(promoted.fusedCandidates[1].id, 'primary-eval-expansion');
});

test('searchCorpus keeps document-title manual matches ahead of generic notice matches for document lookup', () => {
  const query = '통합재가서비스 운영기준과 비용 산정은 어떤 매뉴얼을 봐야 하나요?';
  const target = chunk({
    id: 'target-manual',
    documentId: 'target-manual-doc',
    docTitle: '(붙임)_통합재가서비스_운영_매뉴얼',
    sourceType: 'manual',
    text: '통합재가서비스 운영 매뉴얼입니다. 운영기준, 제공방법, 비용 산정 절차를 설명합니다.',
    sectionPath: ['통합재가서비스 운영 매뉴얼', '통합재가서비스 운영기준', '통합재가서비스 비용 산정'],
    headingPath: ['통합재가서비스 운영기준', '통합재가서비스 비용 산정'],
    parentSectionTitle: '통합재가서비스 운영기준 및 비용 산정',
  });
  const distractors = Array.from({ length: 6 }, (_, index) =>
    chunk({
      id: `notice-${index}`,
      documentId: `notice-doc-${index}`,
      docTitle: '장기요양급여_제공기준_및_급여비용_산정방법_등에_관한_고시_전문',
      sourceType: 'notice',
      text: '통합재가서비스 급여비용 산정 기준 적용 대상 제한 감경 본인부담금 고시 전문입니다.',
      sectionPath: ['장기요양급여 고시', '통합재가서비스', '급여비용 산정기준'],
      headingPath: ['통합재가서비스', '급여비용 산정기준'],
      parentSectionTitle: `통합재가서비스 급여비용 산정기준 ${index}`,
      citationGroupId: `notice-citation-${index}`,
    }),
  );

  const result = searchCorpus({
    index: buildRagCorpusIndex([...distractors, target]),
    query,
    mode: 'integrated',
    queryEmbedding: null,
  });

  const top3DocTitles = result.fusedCandidates.slice(0, 3).map((candidate) => candidate.docTitle);
  assert.ok(
    top3DocTitles.includes('(붙임)_통합재가서비스_운영_매뉴얼'),
    `expected target manual in top3, got ${top3DocTitles.join(', ')}`,
  );
});

test('searchCorpus prioritizes guide documents over generic notice chunks for document lookup questions', () => {
  const query = '급여비용 청구 업무 처리 흐름은 어디서 확인해?';
  const target = chunk({
    id: 'claim-guide',
    documentId: 'claim-guide-doc',
    docTitle: '급여비용_청구_업무_바로알기(2022.1)',
    sourceType: 'guide',
    text: '급여비용 청구 업무 바로알기 자료입니다. 청구·심사업무 처리 흐름과 업무화면을 안내합니다.',
    sectionPath: ['급여비용 청구 업무 바로알기', '청구·심사업무처리흐름도'],
    headingPath: ['청구·심사업무처리흐름도', '업무화면'],
    parentSectionTitle: '청구·심사업무처리흐름도',
  });
  const distractors = Array.from({ length: 5 }, (_, index) =>
    chunk({
      id: `claim-notice-${index}`,
      documentId: `claim-notice-doc-${index}`,
      docTitle: '장기요양급여비용 청구 및 심사·지급업무 처리기준(고시)(제2025-66호)(20250416)',
      sourceType: 'notice',
      text: '급여비용 청구 업무 처리 본인부담금 비용 산정 유형 고시 기준 조문입니다.',
      sectionPath: ['장기요양급여비용 고시', '급여비용 청구 및 심사 지급업무 처리기준'],
      headingPath: ['급여비용 청구', '심사 지급업무 처리기준'],
      parentSectionTitle: `급여비용 청구 및 심사 지급업무 처리기준 ${index}`,
      citationGroupId: `claim-notice-citation-${index}`,
    }),
  );

  const result = searchCorpus({
    index: buildRagCorpusIndex([...distractors, target]),
    query,
    mode: 'integrated',
    queryEmbedding: null,
  });

  const top3DocTitles = result.fusedCandidates.slice(0, 3).map((candidate) => candidate.docTitle);
  assert.ok(
    top3DocTitles.includes('급여비용_청구_업무_바로알기(2022.1)'),
    `expected guide in top3, got ${top3DocTitles.join(', ')}`,
  );
});

test('searchCorpus keeps workflow guide documents in top3 when legal notices also match the query', () => {
  const query = '급여비용 청구 업무 처리 흐름은 어디서 확인해?';
  const target = chunk({
    id: 'claim-guide-realistic',
    documentId: 'claim-guide-realistic-doc',
    docTitle: '급여비용_청구_업무_바로알기(2022.1)',
    sourceType: 'guide',
    text: '급여비용 청구 업무 바로알기 자료입니다. 청구 업무 처리 흐름과 업무화면 확인 방법을 안내합니다.',
    sectionPath: ['급여비용 청구 업무 바로알기', '청구 심사 업무처리 흐름'],
    headingPath: ['청구 심사 업무처리 흐름', '업무화면'],
    parentSectionTitle: '청구 심사 업무처리 흐름',
  });
  const legalNotices = Array.from({ length: 4 }, (_, index) =>
    chunk({
      id: `claim-legal-${index}`,
      documentId: `claim-legal-doc-${index}`,
      docTitle: '장기요양급여비용 청구 및 심사·지급업무 처리기준(고시)(제2025-66호)(20250416)',
      sourceType: 'notice',
      text: '급여비용 청구 및 심사 지급업무 처리기준 고시 조문입니다. 청구 업무 처리 흐름과 심사 기준을 정합니다.',
      sectionPath: ['장기요양급여비용 청구 및 심사 지급업무 처리기준', `제${index + 1}조`],
      headingPath: [`제${index + 1}조`, '청구 업무 처리'],
      parentSectionTitle: `제${index + 1}조 청구 업무 처리`,
      articleNo: `제${index + 1}조`,
      citationGroupId: `claim-legal-citation-${index}`,
    }),
  );

  const result = searchCorpus({
    index: buildRagCorpusIndex([...legalNotices, target]),
    query,
    mode: 'integrated',
    queryEmbedding: null,
  });

  const top3DocTitles = result.fusedCandidates.slice(0, 3).map((candidate) => candidate.docTitle);
  assert.ok(
    top3DocTitles.includes('급여비용_청구_업무_바로알기(2022.1)'),
    `expected workflow guide in top3, got ${top3DocTitles.join(', ')}`,
  );
});

test('searchCorpus narrows explicit document-title lookup before lexical scoring', () => {
  const query = 'Find the Claim Processing Guide document';
  const targetChunks = Array.from({ length: 3 }, (_, index) =>
    chunk({
      id: `target-guide-${index}`,
      documentId: 'claim-processing-guide',
      docTitle: 'Claim Processing Guide',
      sourceType: 'guide',
      text: `Claim Processing Guide section ${index}. Billing workflow and review checklist.`,
      parentSectionTitle: `Guide section ${index}`,
      citationGroupId: `target-guide-citation-${index}`,
    }),
  );
  const distractors = Array.from({ length: 40 }, (_, index) =>
    chunk({
      id: `claim-policy-${index}`,
      documentId: `claim-policy-${index}`,
      docTitle: `Claim Processing Policy ${index}`,
      sourceType: 'notice',
      text: 'Claim processing guide document billing workflow review checklist policy notice.',
      parentSectionTitle: `Policy section ${index}`,
      citationGroupId: `claim-policy-citation-${index}`,
    }),
  );

  const result = searchCorpus({
    index: buildRagCorpusIndex([...distractors, ...targetChunks]),
    query,
    mode: 'integrated',
    queryEmbedding: null,
  });
  const lexicalStage = result.stageTrace?.find((stage) => stage.stage === 'lexical_candidates');

  assert.ok(lexicalStage?.notes?.includes('document-fast-path=1'));
  assert.ok(result.lexicalCandidates.every((candidate) => candidate.documentId === 'claim-processing-guide'));
  assert.equal(result.fusedCandidates[0].documentId, 'claim-processing-guide');
});

test('searchCorpus does not apply generic support document lookup boost over primary evaluation in evaluation mode', () => {
  const query = '직원인권침해교육 문서는 어떻게 확인해?';
  const primaryEvaluation = chunk({
    id: 'primary-rights',
    documentId: 'primary-rights-doc',
    docTitle: '2026년 주야간보호 평가매뉴얼(26년꺼만)',
    sourceRole: 'primary_evaluation',
    sourceType: 'evaluation',
    mode: 'evaluation',
    text: '직원 인권침해 예방 교육은 평가 확인방법에 따라 관련 자료와 교육 실시 여부를 확인합니다.',
    sectionPath: ['2026년 주야간보호 평가매뉴얼', '직원인권보호'],
    headingPath: ['직원인권보호', '확인방법'],
    parentSectionTitle: '직원인권보호',
  });
  const supportGuide = chunk({
    id: 'support-guide',
    documentId: 'support-guide-doc',
    docTitle: '2026 노인복지사업안내(2nd)',
    sourceRole: 'support_reference',
    sourceType: 'guide',
    mode: 'integrated',
    text: '직원 인권 침해 교육 방법과 문서 작성 안내를 설명하는 지원 참고자료입니다.',
    sectionPath: ['노인복지사업안내', '직원 인권 침해 교육'],
    headingPath: ['직원 인권 침해 교육', '문서 작성'],
    parentSectionTitle: '직원 인권 침해 교육',
  });

  const result = searchCorpus({
    index: buildRagCorpusIndex([supportGuide, primaryEvaluation]),
    query,
    mode: 'evaluation',
    queryEmbedding: null,
  });

  assert.equal(result.fusedCandidates[0].docTitle, '2026년 주야간보호 평가매뉴얼(26년꺼만)');
});

test('searchCorpus can probe evaluation authority drift guard for exact-top evaluation sections', () => {
  const query = 'Employee rights protection guide document';
  const section = chunk({
    id: 'employee-rights-section',
    documentId: 'employee-rights-section-doc',
    docTitle: '01-07-Employee Rights Protection',
    sourceRole: 'primary_evaluation',
    sourceType: 'evaluation',
    mode: 'evaluation',
    text: 'Employee rights protection guide document. Staff education and response procedure.',
    sectionPath: ['Employee Rights Protection'],
    headingPath: ['Employee Rights Protection'],
    parentSectionTitle: 'Employee Rights Protection',
  });
  const primaryManual = chunk({
    id: 'primary-manual',
    documentId: 'primary-manual-doc',
    docTitle: '2026 Evaluation Manual',
    sourceRole: 'primary_evaluation',
    sourceType: 'evaluation',
    mode: 'evaluation',
    text: 'Employee rights protection guide document is checked in the yearly evaluation manual.',
    sectionPath: ['Evaluation Manual'],
    headingPath: ['Employee Rights'],
    parentSectionTitle: 'Evaluation Manual',
  });
  const chunkScoreBoosts = new Map([[primaryManual.id, 80]]);
  const index = buildRagCorpusIndex([section, primaryManual]);

  const baseline = searchCorpus({
    index,
    query,
    mode: 'evaluation',
    queryEmbedding: null,
    options: { chunkScoreBoosts },
  });
  const guarded = searchCorpus({
    index,
    query,
    mode: 'evaluation',
    queryEmbedding: null,
    options: { chunkScoreBoosts, evaluationAuthorityDriftGuard: true },
  });

  assert.equal(baseline.exactCandidates[0].documentId, 'employee-rights-section-doc');
  assert.equal(baseline.fusedCandidates[0].documentId, 'primary-manual-doc');
  assert.equal(guarded.fusedCandidates[0].documentId, 'employee-rights-section-doc');
  assert.ok(guarded.fusedCandidates[0].matchedTerms.includes('evaluation-authority-drift-guard'));
  assert.ok(
    guarded.stageTrace
      ?.find((stage) => stage.stage === 'fusion')
      ?.notes?.includes('evaluation-authority-drift-guard=enabled'),
  );
});
