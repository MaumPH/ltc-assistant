import assert from 'node:assert/strict';
import test from 'node:test';
import { formatAnswerAsMarkdown } from '../src/lib/answerMarkdown';
import { formatMarkdownAnswer } from '../src/lib/answerGeneration';
import { buildBrainQueryProfile, detectServiceScopeClarification, type DomainBrain } from '../src/lib/brain';
import type { ExpertAnswerEnvelope, GroundedAnswer, StructuredChunk } from '../src/lib/ragTypes';

function makeChunk(id: string, patch: Partial<StructuredChunk> = {}): StructuredChunk {
  const text = patch.text ?? '신규수급자는 급여제공 시작일부터 토요일·공휴일 포함 14일 이내에 실시한다.';
  return {
    id,
    documentId: patch.documentId ?? `doc-${id}`,
    chunkIndex: patch.chunkIndex ?? 0,
    title: patch.title ?? '지침설명',
    text,
    textPreview: patch.textPreview ?? text,
    searchText: patch.searchText ?? text,
    mode: patch.mode ?? 'integrated',
    sourceType: patch.sourceType ?? 'manual',
    sourceRole: patch.sourceRole ?? 'primary_evaluation',
    documentGroup: patch.documentGroup ?? 'manual',
    docTitle: patch.docTitle ?? '02-04-정보제공',
    fileName: patch.fileName ?? '02-04-정보제공.md',
    path: patch.path ?? '/knowledge/02-04-정보제공.md',
    effectiveDate: patch.effectiveDate ?? '2026-01-01',
    publishedDate: patch.publishedDate,
    sectionPath: patch.sectionPath ?? ['02. 운영규정', '정보제공'],
    articleNo: patch.articleNo ?? '지표 19',
    matchedLabels: patch.matchedLabels ?? [],
    chunkHash: patch.chunkHash ?? `hash-${id}`,
    parentSectionId: patch.parentSectionId ?? `section-${id}`,
    parentSectionTitle: patch.parentSectionTitle ?? '지침설명',
    windowIndex: patch.windowIndex ?? 0,
    spanStart: patch.spanStart ?? 0,
    spanEnd: patch.spanEnd ?? text.length,
    citationGroupId: patch.citationGroupId ?? `citation-${id}`,
    linkedDocumentTitles: patch.linkedDocumentTitles ?? [],
    embedding: patch.embedding,
  };
}

function buildMalformedGroundedAnswer(): GroundedAnswer {
  return {
    evidenceState: 'partial',
    confidence: 'medium',
    keyIssueDate: { value: '2026-01-01' } as unknown as string,
    conclusion: { text: '결론' } as unknown as string,
    applicabilityConditions: [{ text: '14일 이내' }, { label: '급여제공 시작일' }, null] as unknown as string[],
    coverageIndicators: [{ label: '지표 19' }, {}, '지표 22'] as unknown as string[],
    directEvidence: [{ text: '직접 근거' }] as unknown as string[],
    practicalGuidance: [{ text: '실무 안내' }] as unknown as string[],
    caveats: [{ text: '주의 사항' }] as unknown as string[],
    citationEvidenceIds: [{ value: 'evidence-1' }] as unknown as string[],
    followUpQuestion: { text: '추가 확인이 필요합니까?' } as unknown as string,
  };
}

function buildMalformedExpertAnswer(): ExpertAnswerEnvelope {
  return {
    answerType: 'checklist',
    headline: { headline: '객체 제목' } as unknown as string,
    summary: ['첫 줄 요약', { text: '둘째 줄 요약' }] as unknown as string,
    directAnswer: { answer: '직접 답변' } as unknown as string,
    confidence: 'medium',
    evidenceState: 'partial',
    keyIssueDate: ['2026-01-01'] as unknown as string,
    referenceDate: { date: '2026-05-01' } as unknown as string,
    conclusion: { conclusion: '정리된 결론' } as unknown as string,
    groundedBasis: {
      legal: [],
      evaluation: [],
      practical: [],
    },
    practicalInterpretation: [
      {
        label: { text: '실무 항목' } as unknown as string,
        detail: { text: '설명 내용' } as unknown as string,
        actor: { text: '사회복지사' } as unknown as string,
        timeWindow: ['14일 이내'] as unknown as string,
        artifact: { label: '상담기록지' } as unknown as string,
        term: { value: '2026' } as unknown as string,
      },
    ],
    additionalChecks: [{ label: { text: '확인' } as unknown as string, detail: { text: '추가 확인' } as unknown as string }],
    appliedScope: { label: '주야간보호' } as unknown as string,
    scope: { text: '주야간보호' } as unknown as string,
    basis: {
      legal: [],
      evaluation: [],
      practical: [],
    },
    blocks: [],
    citations: [
      {
        evidenceId: 'evidence-1',
        label: { text: '지표 19' } as unknown as string,
        docTitle: { title: '정보제공' } as unknown as string,
        articleNo: { value: '지표 19' } as unknown as string,
        sectionPath: [{ text: '02. 운영규정' }, '정보제공'] as unknown as string[],
        effectiveDate: ['2026-01-01'] as unknown as string,
      },
    ],
    followUps: [{ text: '추가 후속 확인' }] as unknown as string[],
  };
}

const EMPTY_BRAIN: DomainBrain = {
  questionArchetypes: [],
  workflowEvents: [],
  actors: [],
  artifacts: [],
  timeWindows: [],
  tasks: [],
  terms: [],
};

test('formatMarkdownAnswer does not throw on malformed qualifier arrays', () => {
  const markdown = formatMarkdownAnswer(buildMalformedGroundedAnswer(), [makeChunk('evidence-1')]);

  assert.match(markdown, /14일 이내/);
  assert.match(markdown, /지표 19/);
  assert.match(markdown, /직접 근거/);
});

test('formatAnswerAsMarkdown does not throw on malformed expert answer fields', () => {
  const markdown = formatAnswerAsMarkdown(buildMalformedExpertAnswer());

  assert.match(markdown, /객체 제목/);
  assert.match(markdown, /직접 답변/);
  assert.match(markdown, /상담기록지/);
});

test('brain query helpers tolerate object-like enumeration input', () => {
  const clarification = detectServiceScopeClarification({ text: '신규수급자가 오면 해야하는 업무는?' } as unknown as string);
  const profile = buildBrainQueryProfile(EMPTY_BRAIN, { text: '수급자가 퇴소하면 해야할 업무는?' } as unknown as string, 'integrated');

  assert.equal(typeof clarification.needsClarification, 'boolean');
  assert.equal(typeof profile.questionArchetype, 'string');
  assert.equal(typeof profile.recommendedAnswerType, 'string');
});
