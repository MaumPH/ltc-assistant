import assert from 'node:assert/strict';
import test from 'node:test';
import { formatAnswerAsMarkdown } from '../src/lib/answerMarkdown';
import type { ExpertAnswerEnvelope } from '../src/lib/ragTypes';

function buildAnswer(): ExpertAnswerEnvelope {
  return {
    answerType: 'checklist',
    headline: '테스트 답변',
    summary: '요약',
    confidence: 'medium',
    evidenceState: 'partial',
    referenceDate: '2026-04-29',
    conclusion: '결론',
    groundedBasis: {
      legal: [],
      evaluation: [],
      practical: [],
    },
    practicalInterpretation: [
      {
        label: '실무 항목',
        detail: '설명 내용',
        actor: { text: '사회복지사' } as unknown as string,
        timeWindow: ['14일 이내'] as unknown as string,
        artifact: { label: '상담기록지' } as unknown as string,
        term: 2026 as unknown as string,
      },
    ],
    additionalChecks: [],
    appliedScope: '방문요양',
    scope: '방문요양',
    basis: {
      legal: [],
      evaluation: [],
      practical: [],
    },
    blocks: [],
    citations: [],
    followUps: [],
  };
}

test('formatAnswerAsMarkdown tolerates non-string block metadata', () => {
  const markdown = formatAnswerAsMarkdown(buildAnswer());

  assert.match(markdown, /실무 항목/);
  assert.match(markdown, /사회복지사/);
  assert.match(markdown, /14일 이내/);
  assert.match(markdown, /상담기록지/);
});

test('formatAnswerAsMarkdown tolerates non-string top-level and citation fields', () => {
  const answer = {
    ...buildAnswer(),
    headline: { text: '객체 제목' },
    summary: ['첫 줄 요약', '둘째 줄 요약'],
    directAnswer: { answer: '직접 답변' },
    conclusion: 2026,
    referenceDate: { value: '2026-05-01' },
    appliedScope: { label: '주야간보호' },
    keyIssueDate: ['2026-01-01'],
    citations: [
      {
        evidenceId: 'evidence-1',
        label: { text: '지표 19' },
        docTitle: { title: '정보제공' },
        articleNo: { value: '지표 19' },
        sectionPath: [{ text: '02. 운영규정' }, '정보제공'],
        effectiveDate: ['2026-01-01'],
      },
    ],
  } as unknown as ExpertAnswerEnvelope;

  const markdown = formatAnswerAsMarkdown(answer);

  assert.match(markdown, /객체 제목/);
  assert.match(markdown, /첫 줄 요약/);
  assert.match(markdown, /직접 답변/);
  assert.match(markdown, /2026/);
  assert.match(markdown, /주야간보호/);
  assert.match(markdown, /지표 19/);
  assert.match(markdown, /02\. 운영규정 > 정보제공/);
});
