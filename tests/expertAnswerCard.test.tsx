import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ExpertAnswerCard from '../src/components/ExpertAnswerCard';
import { renderExpertAnswerMarkdown } from '../src/lib/expertAnswering';
import type { ExpertAnswerEnvelope } from '../src/lib/ragTypes';

test('ExpertAnswerCard renders a partial answer payload without crashing', () => {
  const partialAnswer = {
    headline: '검증 중인 답변',
    conclusion: '근거를 확인 중입니다.',
    evidenceState: 'partial',
    confidence: 'low',
    referenceDate: '확인 필요',
    appliedScope: '전체',
  } as ExpertAnswerEnvelope;

  assert.doesNotThrow(() => renderToStaticMarkup(<ExpertAnswerCard answer={partialAnswer} />));
  const html = renderToStaticMarkup(<ExpertAnswerCard answer={partialAnswer} />);
  assert.match(html, /검색된 확정 근거가 없습니다\./);
  assert.doesNotMatch(html, /직접 연결된 확정 근거는 아직 비어 있습니다\./);
});

test('ExpertAnswerCard renders direct answer section when provided', () => {
  const answer: ExpertAnswerEnvelope = {
    answerType: 'definition',
    headline: '기피식품 설명',
    summary: '요약',
    directAnswer: '기피식품은 수급자가 피해야 하거나 원하지 않는 식품입니다.',
    confidence: 'medium',
    evidenceState: 'confirmed',
    referenceDate: '2026년 평가매뉴얼',
    conclusion: '기피식품은 욕구사정과 식사 제공 기준에 반영해야 합니다.',
    groundedBasis: { legal: [], evaluation: [], practical: [] },
    practicalInterpretation: [],
    additionalChecks: [],
    appliedScope: '주야간보호',
    scope: '주야간보호 평가',
    basis: { legal: [], evaluation: [], practical: [] },
    blocks: [],
    citations: [],
    followUps: [],
  };

  const html = renderToStaticMarkup(<ExpertAnswerCard answer={answer} />);
  assert.match(html, /\[답변\]/);
  assert.match(html, /기피식품은 수급자가 피해야 하거나 원하지 않는 식품입니다\./);

  const markdown = renderExpertAnswerMarkdown(answer);
  assert.match(markdown, /## \[답변\]/);
  assert.match(markdown, /기피식품은 수급자가 피해야 하거나 원하지 않는 식품입니다\./);
});
