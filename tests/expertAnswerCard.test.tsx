import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ExpertAnswerCard from '../src/components/ExpertAnswerCard';
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
});
