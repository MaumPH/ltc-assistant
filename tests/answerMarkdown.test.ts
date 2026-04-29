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
        detail: '세부 내용',
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
