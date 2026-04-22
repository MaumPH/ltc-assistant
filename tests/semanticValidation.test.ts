import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNaturalLanguageQueryProfile } from '../src/lib/ragNaturalQuery';
import { evaluateRetrievalValidation, validateAnswerEnvelope } from '../src/lib/ragSemanticValidation';
import type { ExpertAnswerEnvelope, SemanticFrame, StructuredChunk } from '../src/lib/ragTypes';

function makeChunk(id: string, patch: Partial<StructuredChunk>): StructuredChunk {
  return {
    id,
    documentId: patch.documentId ?? `doc-${id}`,
    chunkIndex: patch.chunkIndex ?? 0,
    title: patch.title ?? patch.docTitle ?? '테스트 문서',
    text: patch.text ?? patch.searchText ?? '',
    textPreview: patch.textPreview ?? (patch.text ?? patch.searchText ?? '').slice(0, 120),
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

test('retrieval validation marks high-risk cost question without legal evidence as blocking', () => {
  const profile = buildNaturalLanguageQueryProfile('주야간보호 3등급 본인부담금 얼마야?');
  const evidence = [
    makeChunk('manual-cost', {
      docTitle: '주야간보호 운영 안내',
      searchText: '주야간보호 본인부담금 안내와 실무 설명',
      text: '실무적으로 주야간보호 본인부담금을 안내한다.',
      sourceType: 'manual',
    }),
  ];

  const summary = evaluateRetrievalValidation({
    semanticFrame: profile.semanticFrame,
    evidence,
  });

  assert.ok(summary.validationIssues.some((issue) => issue.code === 'basis-confusion' && issue.severity === 'block'));
  assert.equal(summary.claimCoverage.totalClaims >= 1, true);
});

test('answer validation injects assumptions and warns about missing exception wording', () => {
  const profile = buildNaturalLanguageQueryProfile('본인부담금 감경은 어떻게 돼?');
  const evidence = [
    makeChunk('notice-exception', {
      docTitle: '장기요양 본인부담금 감경 고시',
      searchText: '본인부담금 감경 예외 단서 기준',
      text: '감경은 예외와 단서 기준에 따라 달라진다.',
      sourceType: 'notice',
      effectiveDate: '2026-01-20',
    }),
  ];
  const answer: ExpertAnswerEnvelope = {
    answerType: 'mixed',
    headline: '본인부담금 감경',
    summary: '감경 기준을 정리했습니다.',
    confidence: 'medium',
    evidenceState: 'partial',
    scope: '질문 범위를 정리했습니다.',
    basis: {
      legal: [],
      evaluation: [],
      practical: [],
    },
    blocks: [
      {
        type: 'bullets',
        title: '핵심',
        items: [{ label: '정리', detail: '감경 기준을 확인하세요.' }],
      },
    ],
    citations: [
      {
        evidenceId: evidence[0].id,
        label: evidence[0].docTitle,
        docTitle: evidence[0].docTitle,
        sectionPath: evidence[0].sectionPath,
        effectiveDate: evidence[0].effectiveDate,
      },
    ],
    followUps: [],
  };

  const validated = validateAnswerEnvelope({
    answer,
    semanticFrame: profile.semanticFrame,
    citations: evidence,
    evidence,
  });

  assert.ok(validated.answer.scope.includes('해석 가정') || profile.semanticFrame.assumptions.length === 0);
  assert.ok(validated.validationIssues.some((issue) => issue.code === 'missing-exception'));
});

test('answer validation warning block uses Korean user-facing labels and details', () => {
  const semanticFrame: SemanticFrame = {
    primaryIntent: 'compliance',
    secondaryIntents: [],
    canonicalTerms: ['입소 가능 여부'],
    entityRefs: [],
    relationRequests: [],
    slots: {
      service_scope: [
        {
          value: '방문요양',
          canonical: '방문요양',
          confidence: 1,
          source: 'query',
        },
      ],
    },
    assumptions: [],
    missingCriticalSlots: ['institution_type', 'recipient_grade'],
    riskLevel: 'high',
  };
  const evidence = [
    makeChunk('day-night-staffing', {
      docTitle: '주야간보호 평가매뉴얼',
      searchText: '주야간보호 이용 가능 기준',
      text: '주야간보호 이용 가능 기준을 설명합니다.',
      sourceType: 'manual',
    }),
  ];
  const answer: ExpertAnswerEnvelope = {
    answerType: 'mixed',
    headline: '입소 가능 여부',
    summary: '검색된 근거 기준으로 입소 가능 여부를 정리했습니다.',
    confidence: 'medium',
    evidenceState: 'partial',
    scope: '방문요양',
    basis: {
      legal: [],
      evaluation: [],
      practical: [],
    },
    blocks: [
      {
        type: 'bullets',
        title: '핵심',
        items: [{ label: '가능 여부', detail: '기준을 확인하세요.' }],
      },
    ],
    citations: [],
    followUps: [],
  };

  const validated = validateAnswerEnvelope({
    answer,
    semanticFrame,
    citations: evidence,
    evidence,
  });

  const warningBlock = validated.answer.blocks.find(
    (block) => block.type === 'warning' && block.title === '추가 확인이 필요한 부분',
  );
  assert.ok(warningBlock);

  const warningText = warningBlock.items.map((item) => `${item.label} ${item.detail}`).join(' ');
  assert.doesNotMatch(
    warningText,
    /insufficient-evidence-composition|mixed-service-scope|Missing slots|Evidence contains|institution_type|recipient_grade/u,
  );
  assert.match(warningText, /질문 조건 확인 필요/u);
  assert.match(warningText, /기관\/시설 유형/u);
  assert.match(warningText, /수급자 등급/u);
  assert.match(warningText, /급여유형 범위 확인 필요/u);
  assert.match(warningText, /주야간보호/u);
});

test('staffing compliance with a selected service scope does not ask for recipient grade', () => {
  const semanticFrame: SemanticFrame = {
    primaryIntent: 'compliance',
    secondaryIntents: [],
    canonicalTerms: ['인력배치'],
    entityRefs: [],
    relationRequests: [],
    slots: {
      service_scope: [
        {
          value: '요양원/공동생활가정',
          canonical: '요양원/공동생활가정',
          confidence: 1,
          source: 'query',
        },
      ],
    },
    assumptions: [],
    missingCriticalSlots: ['institution_type', 'recipient_grade'],
    riskLevel: 'medium',
  };
  const evidence = [
    makeChunk('facility-legal-staffing', {
      docTitle: '노인복지법 시행규칙 별표 4',
      parentSectionTitle: '노인의료복지시설의 시설기준 및 직원배치기준',
      searchText: '노인요양시설 공동생활가정 시설급여 직원배치기준',
      text: '노인요양시설과 노인요양공동생활가정의 직원배치기준입니다.',
      sourceType: 'rule',
    }),
    makeChunk('facility-practical-staffing', {
      docTitle: '인력기준 준비 서류',
      parentSectionTitle: '시설급여 인력기준 확인 방법',
      searchText: '시설급여 인력기준 요양원 공동생활가정 근무표 출근부',
      text: '시설급여 인력기준 확인 방법입니다.',
      sourceType: 'manual',
    }),
  ];

  const summary = evaluateRetrievalValidation({
    semanticFrame,
    evidence,
  });
  const missingSlotWarnings = summary.validationIssues.filter(
    (issue) => issue.code === 'insufficient-evidence-composition' && /Missing slots/.test(issue.message),
  );

  assert.deepEqual(missingSlotWarnings, []);
});

test('facility care selection treats facility benefit evidence as the selected service scope', () => {
  const semanticFrame: SemanticFrame = {
    primaryIntent: 'compliance',
    secondaryIntents: [],
    canonicalTerms: ['인력배치'],
    entityRefs: [],
    relationRequests: [],
    slots: {
      service_scope: [
        {
          value: '요양원/공동생활가정',
          canonical: '요양원/공동생활가정',
          confidence: 1,
          source: 'query',
        },
      ],
    },
    assumptions: [],
    missingCriticalSlots: [],
    riskLevel: 'medium',
  };
  const evidence = [
    makeChunk('facility-staffing', {
      docTitle: '노인복지법 시행규칙 별표 4',
      parentSectionTitle: '노인의료복지시설의 시설기준 및 직원배치기준',
      searchText: '노인요양시설 공동생활가정 시설급여 직원배치기준',
      text: '노인요양시설과 노인요양공동생활가정의 직원배치기준입니다.',
      sourceType: 'rule',
    }),
    makeChunk('day-night-reference', {
      docTitle: '주야간보호 평가매뉴얼',
      parentSectionTitle: '주야간보호 인력기준',
      searchText: '주야간보호 인력배치 기준',
      text: '주야간보호 인력배치 기준입니다.',
      sourceType: 'manual',
    }),
  ];

  const summary = evaluateRetrievalValidation({
    semanticFrame,
    evidence,
  });
  const mixedScopeIssue = summary.validationIssues.find((issue) => issue.code === 'mixed-service-scope');

  assert.ok(mixedScopeIssue);
  assert.doesNotMatch(mixedScopeIssue.message, /시설급여/u);
  assert.match(mixedScopeIssue.message, /주야간보호/u);
});
