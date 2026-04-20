import assert from 'node:assert/strict';
import { buildEvidenceBalance, describeHybridReadiness, inferAgentDecision } from '../src/lib/ragDiagnostics';
import { compareIndexStatus } from '../src/lib/ragIndex';
import { buildRagCorpusIndex, searchCorpus } from '../src/lib/ragEngine';
import { buildPlannerSystemInstruction } from '../src/lib/promptAssembly';
import { buildServiceScopeDocumentBoosts, parseServiceScopes } from '../src/lib/serviceScopes';
import type { StructuredChunk } from '../src/lib/ragTypes';

function makeChunk(id: string, patch: Partial<StructuredChunk>): StructuredChunk {
  return {
    id,
    documentId: patch.documentId ?? `doc-${id}`,
    chunkIndex: patch.chunkIndex ?? 0,
    title: patch.title ?? patch.docTitle ?? '테스트 문서',
    text: patch.text ?? patch.searchText ?? '',
    textPreview: patch.textPreview ?? (patch.text ?? patch.searchText ?? '').slice(0, 220),
    searchText: patch.searchText ?? patch.text ?? '',
    mode: patch.mode ?? 'integrated',
    sourceType: patch.sourceType ?? 'manual',
    sourceRole: patch.sourceRole ?? 'support_reference',
    documentGroup: patch.documentGroup ?? 'manual',
    docTitle: patch.docTitle ?? '테스트 문서',
    fileName: patch.fileName ?? `${patch.docTitle ?? '테스트 문서'}.md`,
    path: patch.path ?? `/knowledge/${patch.fileName ?? `${patch.docTitle ?? '테스트 문서'}.md`}`,
    effectiveDate: patch.effectiveDate,
    publishedDate: patch.publishedDate,
    sectionPath: patch.sectionPath ?? [patch.docTitle ?? '테스트 문서'],
    articleNo: patch.articleNo,
    matchedLabels: patch.matchedLabels ?? [],
    chunkHash: patch.chunkHash ?? `hash-${id}`,
    parentSectionId: patch.parentSectionId ?? `section-${id}`,
    parentSectionTitle: patch.parentSectionTitle ?? patch.title ?? patch.docTitle ?? '테스트 문서',
    windowIndex: patch.windowIndex ?? 0,
    spanStart: patch.spanStart ?? 0,
    spanEnd: patch.spanEnd ?? (patch.text ?? patch.searchText ?? '').length,
    citationGroupId: patch.citationGroupId ?? `citation-${id}`,
    linkedDocumentTitles: patch.linkedDocumentTitles ?? [],
    embedding: patch.embedding,
  };
}

function testHybridReadinessReason() {
  const status = compareIndexStatus({
    storageMode: 'local-cache',
    diskEntries: [],
    indexedEntries: [
      {
        documentId: 'doc-a',
        path: '/knowledge/a.md',
        name: 'a.md',
        mode: 'integrated',
        contentHash: 'hash-a',
        size: 10,
        chunkCount: 4,
        embeddingCount: 0,
      },
    ],
  });

  const reason = describeHybridReadiness(status);
  assert.match(reason, /임베딩된 청크가 없습니다/);
  assert.match(reason, /local-cache/);
}

function testEvidenceBalanceAndAgentDecision() {
  const balance = buildEvidenceBalance({ legal: 1, evaluation: 0, practical: 2 });
  assert.deepEqual(balance.missingBuckets, ['evaluation']);
  assert.equal(balance.balanced, false);

  assert.equal(inferAgentDecision({ confidence: 'medium', evidenceCount: 2 }), 'answer');
  assert.equal(inferAgentDecision({ confidence: 'low', evidenceCount: 2 }), 'abstain');
  assert.equal(inferAgentDecision({ confidence: 'medium', evidenceCount: 2, needsClarification: true }), 'clarify');
}

function testShortKoreanQueryFallback() {
  const chunks = [
    makeChunk('fall', {
      docTitle: '안전하고 쾌적한 환경',
      searchText: '안전하고 쾌적한 환경 낙상예방 관리 지침',
      text: '낙상예방 관리 지침을 확인한다.',
      mode: 'evaluation',
      sourceRole: 'primary_evaluation',
      sourceType: 'manual',
    }),
  ];

  const result = searchCorpus({
    index: buildRagCorpusIndex(chunks),
    query: '낙상',
    mode: 'evaluation',
    queryEmbedding: null,
  });

  assert.equal(result.fusedCandidates[0]?.id, 'fall');
}

function testCompactedDocumentTitleQuery() {
  const targetTitle = '2026년_인건비지출비율_다빈도_질의응답';
  const chunks = [
    makeChunk('payroll', {
      docTitle: targetTitle,
      fileName: `${targetTitle}.md`,
      searchText: `${targetTitle} 2026년 인건비 지출비율 다빈도 질의응답`,
      text: '2026년 인건비 지출비율 다빈도 질의응답 문서입니다.',
      sourceType: 'qa',
    }),
    makeChunk('other', {
      docTitle: '장기근속장려금 청구 전산 문의사항',
      searchText: '장기근속장려금 청구 전산 문의사항',
      text: '장기근속장려금 안내입니다.',
      sourceType: 'qa',
    }),
  ];

  const result = searchCorpus({
    index: buildRagCorpusIndex(chunks),
    query: '2026년인건비지출비율다빈도질의응답문서를찾아줘',
    mode: 'integrated',
    queryEmbedding: null,
  });

  assert.equal(result.fusedCandidates[0]?.id, 'payroll');
}

function testOutOfDomainQueryStaysLowConfidence() {
  const chunks = [
    makeChunk('claim-notice', {
      docTitle: '장기요양급여비용 청구 고시',
      searchText: '장기요양급여비용 청구 심사 지급 기준',
      text: '장기요양급여비용 청구 심사 지급 기준을 정한다.',
      sourceType: 'notice',
    }),
    makeChunk('generic-domain-notice', {
      docTitle: '장기요양기관 급여비용 청구 기준',
      searchText: '장기요양기관 급여 비용 청구 심사 지급 기준',
      text: '장기요양기관의 급여비용 청구 기준을 설명한다.',
      sourceType: 'notice',
    }),
  ];

  const result = searchCorpus({
    index: buildRagCorpusIndex(chunks),
    query: '장기요양기관에서 드론 배송 비용을 급여로 청구할 수 있나요?',
    mode: 'integrated',
    queryEmbedding: null,
  });

  assert.equal(result.confidence, 'low');
  assert.ok(result.mismatchSignals?.includes('no-focus-terms-in-top-candidates'));
}

function testPlannerPromptDocumentsAnswerTypeSelection() {
  const instruction = buildPlannerSystemInstruction({
    mode: 'evaluation',
    variant: 'v2',
    knowledgeContext: '',
    retrievalMode: 'local',
    sources: {
      baseline: '',
      base: 'base prompt',
      overlays: {
        integrated: '',
        evaluation: '',
      },
    },
  });

  assert.match(instruction, /Answer Type Selection/);
  assert.match(instruction, /verdict/);
  assert.match(instruction, /checklist/);
  assert.match(instruction, /procedure/);
  assert.match(instruction, /comparison/);
  assert.match(instruction, /definition/);
  assert.match(instruction, /mixed/);
}

function testServiceScopeParserRejectsInvalidValues() {
  assert.deepEqual(parseServiceScopes(undefined), ['all']);
  assert.deepEqual(parseServiceScopes(['all']), ['all']);
  assert.deepEqual(parseServiceScopes(['all', 'day-night-care']), ['day-night-care']);
  assert.deepEqual(parseServiceScopes(['home-visit-care', 'home-visit-bath', 'home-visit-care']), [
    'home-visit-care',
    'home-visit-bath',
  ]);
  assert.throws(() => parseServiceScopes(['day-night-care', 'unknown-scope']), /Invalid serviceScopes/);
}

function testServiceScopeBoostsDayNightCareEvidence() {
  const chunks = [
    makeChunk('facility-staffing', {
      documentId: 'facility-doc',
      docTitle: '노인요양시설 인력기준',
      searchText: '요양원 공동생활가정 시설급여 인력기준 직원배치기준',
      text: '노인요양시설과 공동생활가정 인력기준입니다.',
      sourceType: 'manual',
    }),
    makeChunk('day-care-staffing', {
      documentId: 'day-care-doc',
      docTitle: '주야간보호 인력기준',
      searchText: '주야간보호센터 주간보호 데이케어 인력기준 직원배치기준',
      text: '주야간보호센터 인력기준입니다.',
      sourceType: 'manual',
    }),
  ];

  const result = searchCorpus({
    index: buildRagCorpusIndex(chunks),
    query: '인력기준 알려줘',
    mode: 'integrated',
    queryEmbedding: null,
    queryAliases: ['주야간보호', '주간보호', '데이케어'],
    options: {
      documentScoreBoosts: buildServiceScopeDocumentBoosts(chunks, ['day-night-care']),
    },
  });

  assert.equal(result.fusedCandidates[0]?.documentId, 'day-care-doc');
}

function testServiceScopeBoostsFacilityEvidence() {
  const chunks = [
    makeChunk('facility-staffing', {
      documentId: 'facility-doc',
      docTitle: '노인요양시설 인력기준',
      searchText: '요양원 공동생활가정 시설급여 인력기준 직원배치기준',
      text: '노인요양시설과 공동생활가정 인력기준입니다.',
      sourceType: 'manual',
    }),
    makeChunk('day-care-staffing', {
      documentId: 'day-care-doc',
      docTitle: '주야간보호 인력기준',
      searchText: '주야간보호센터 주간보호 데이케어 인력기준 직원배치기준',
      text: '주야간보호센터 인력기준입니다.',
      sourceType: 'manual',
    }),
  ];

  const result = searchCorpus({
    index: buildRagCorpusIndex(chunks),
    query: '인력기준 알려줘',
    mode: 'integrated',
    queryEmbedding: null,
    queryAliases: ['요양원', '공동생활가정', '시설급여'],
    options: {
      documentScoreBoosts: buildServiceScopeDocumentBoosts(chunks, ['facility-care']),
    },
  });

  assert.equal(result.fusedCandidates[0]?.documentId, 'facility-doc');
}

testHybridReadinessReason();
testEvidenceBalanceAndAgentDecision();
testShortKoreanQueryFallback();
testCompactedDocumentTitleQuery();
testOutOfDomainQueryStaysLowConfidence();
testPlannerPromptDocumentsAnswerTypeSelection();
testServiceScopeParserRejectsInvalidValues();
testServiceScopeBoostsDayNightCareEvidence();
testServiceScopeBoostsFacilityEvidence();

console.log('RAG regression tests passed.');
