import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEvaluationRequirementChunkBoosts,
  buildEvaluationRequirementCompletenessInstructions,
  buildEvaluationRequirementDocumentBoosts,
  buildEvaluationRequirementFixtures,
  findMatchingEvaluationRequirements,
  validateEvaluationRequirementCompleteness,
} from '../src/lib/evaluationRequirementCompleteness';
import { tryBuildDeterministicEvaluationRequirementAnswer } from '../src/lib/expertAnswering';
import type { StructuredChunk } from '../src/lib/ragTypes';

function makeChunk(id: string, patch: Partial<StructuredChunk> = {}): StructuredChunk {
  return {
    id,
    documentId: patch.documentId ?? 'doc-recipient-rights',
    chunkIndex: patch.chunkIndex ?? 0,
    title: patch.title ?? '확인방법',
    text:
      patch.text ??
      '8가지 지침은 욕창예방, 낙상예방, 탈수예방, 배변도움, 관절구축예방, 치매예방, 감염예방, 노인인권보호이다. 신규수급자는 급여제공 시작일부터 토요일·공휴일 포함 14일 이내 확인한다. 평가 당일 기록 미확인 시 불인정(N)이다.',
    textPreview: patch.textPreview ?? patch.text ?? '',
    searchText: patch.searchText ?? patch.text ?? '',
    mode: patch.mode ?? 'evaluation',
    sourceType: patch.sourceType ?? 'evaluation',
    sourceRole: patch.sourceRole ?? 'primary_evaluation',
    documentGroup: patch.documentGroup ?? 'evaluation',
    docTitle: patch.docTitle ?? '02-05-노인인권보호',
    fileName: patch.fileName ?? '02-05-노인인권보호.md',
    path: patch.path ?? '/knowledge/evaluation/02-05-노인인권보호.md',
    effectiveDate: patch.effectiveDate,
    publishedDate: patch.publishedDate,
    sectionPath: patch.sectionPath ?? ['02-05-노인인권보호', '확인방법'],
    headingPath: patch.headingPath,
    articleNo: patch.articleNo,
    matchedLabels: patch.matchedLabels ?? [],
    chunkHash: patch.chunkHash ?? id,
    parentSectionId: patch.parentSectionId ?? 'section-confirmation',
    parentSectionTitle: patch.parentSectionTitle ?? '확인방법',
    listGroupId: patch.listGroupId,
    containsCheckList: patch.containsCheckList ?? true,
    embeddingInput: patch.embeddingInput,
    windowIndex: patch.windowIndex ?? 0,
    spanStart: patch.spanStart ?? 0,
    spanEnd: patch.spanEnd ?? 100,
    citationGroupId: patch.citationGroupId ?? id,
    linkedDocumentTitles: patch.linkedDocumentTitles ?? [],
    embedding: patch.embedding,
  };
}

test('evaluation requirement matching is fixture-driven and returns generic boost maps', () => {
  const question = '신규 수급자에게 안내해야 하는 8가지 지침이 뭐고 언제까지 설명해야 해?';
  const chunks = [makeChunk('rights'), makeChunk('other', { documentId: 'other', docTitle: '직원인권보호', text: '직원 교육' })];
  const matches = findMatchingEvaluationRequirements(question, buildEvaluationRequirementFixtures());

  assert.equal(matches[0]?.rule.id, 'evaluation-completeness-recipient-rights-checklist');
  assert.equal(buildEvaluationRequirementDocumentBoosts(matches, chunks).has('doc-recipient-rights'), true);
  assert.equal(buildEvaluationRequirementChunkBoosts(matches, chunks).has('rights'), true);
});

test('evaluation requirement instructions are generic and list required items from matched rules', () => {
  const question = '8대 지침 교육 신규 입소자는 며칠 안에 해야 돼?';
  const evidence = [makeChunk('rights')];
  const instructions = buildEvaluationRequirementCompletenessInstructions({
    question,
    matchedRequirements: findMatchingEvaluationRequirements(question),
    evidence,
  }).join('\n');

  assert.match(instructions, /Evaluation requirement completeness/);
  assert.match(instructions, /욕창예방/);
  assert.match(instructions, /14일 이내/);
});

test('evaluation completeness validation emits generic issue codes for missing checklist and deadline items', () => {
  const question = '신규 수급자에게 안내해야 하는 8가지 지침이 뭐고 언제까지 설명해야 해?';
  const issues = validateEvaluationRequirementCompleteness({
    question,
    answerText: '욕창예방, 낙상예방만 설명하면 됩니다.',
    matchedRequirements: findMatchingEvaluationRequirements(question),
    evidence: [makeChunk('rights')],
  });
  const codes = new Set(issues.map((issue) => issue.code));

  assert.equal(codes.has('missing-evaluation-required-item'), true);
  assert.equal(codes.has('missing-evaluation-deadline'), true);
  assert.equal(Array.from(codes).some((code) => code.includes('recipient-rights') || code.includes('eight')), false);
});

test('deterministic evaluation requirement answer is built from matched requirement items', () => {
  const answer = tryBuildDeterministicEvaluationRequirementAnswer({
    question: '8대 지침 설명 기록이 평가 당일 없으면 인정되나요?',
    evidence: [makeChunk('rights')],
    confidence: 'high',
  });
  const answerText = [
    answer?.summary,
    answer?.directAnswer,
    ...(answer?.blocks ?? []).flatMap((block) => block.items.flatMap((item) => [item.label, item.detail])),
  ].join(' ');

  assert.ok(answer);
  assert.match(answerText, /욕창예방/);
  assert.match(answerText, /노인인권보호/);
  assert.match(answerText, /평가 당일 기록 미확인 시 불인정\(N\)/);
});

test('a second evaluation fixture validates staff education record fields and deadline', () => {
  const question = '신규직원 급여제공지침 교육은 며칠 이내에 해야 하고 기록 필수사항은 무엇인가요?';
  const evidence = [
    makeChunk('staff-education', {
      documentId: 'doc-staff-education',
      docTitle: '01-06-직원교육',
      title: '확인방법',
      parentSectionTitle: '확인방법',
      text:
        '모든 직원에게 연 1회 이상 운영규정 교육과 급여제공지침 교육을 실시한다. 필수사항은 교육일자, 교육방법, 강사명, 참석자명(서명)이다. 신규직원은 급여제공 시작일로부터 7일 이내로 교육받았는지 확인한다.',
    }),
  ];
  const matches = findMatchingEvaluationRequirements(question);
  const issues = validateEvaluationRequirementCompleteness({
    question,
    answerText: '신규직원은 급여제공 시작일로부터 7일 이내 교육받아야 한다.',
    matchedRequirements: matches,
    evidence,
  });

  assert.equal(matches[0]?.rule.id, 'evaluation-completeness-staff-education-record-fields');
  assert.equal(issues.some((issue) => issue.code === 'missing-evaluation-required-item'), true);
  assert.equal(issues.some((issue) => issue.code === 'missing-evaluation-deadline'), false);
});

test('staff rights protection fixture handles human-rights education wording without special-case code', () => {
  const question = '직원인권침해교육은 어떻게 해야해';
  const evidence = [
    makeChunk('staff-rights', {
      documentId: 'doc-staff-rights',
      docTitle: '01-07-직원인권보호',
      title: '확인방법',
      parentSectionTitle: '확인방법',
      text:
        '모든 수급자(보호자)에게 연 1회 이상 폭언·폭행·성희롱 예방 및 직원과 수급자의 상호존중을 포함하는 내용을 안내한다. 확인사항은 안내일자, 안내방법, 안내내용, 수급자명, 보호자명(관계)이다.',
    }),
  ];
  const matches = findMatchingEvaluationRequirements(question);
  const instructions = buildEvaluationRequirementCompletenessInstructions({
    question,
    matchedRequirements: matches,
    evidence,
  }).join('\n');

  assert.equal(matches[0]?.rule.id, 'evaluation-completeness-staff-rights-protection-guidance');
  assert.match(instructions, /폭언·폭행·성희롱 예방/);
  assert.match(instructions, /안내일자/);
});
