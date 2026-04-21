import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNaturalLanguageQueryProfile } from '../src/lib/ragNaturalQuery';
import { evaluateRetrievalValidation, validateAnswerEnvelope } from '../src/lib/ragSemanticValidation';
import type { ExpertAnswerEnvelope, StructuredChunk } from '../src/lib/ragTypes';

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
