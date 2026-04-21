import test from 'node:test';
import assert from 'node:assert/strict';
import { suppressSelectedServiceScopeClarification } from '../src/lib/expertAnswering';

test('selected service scope suppresses service-scope-only clarification requests', () => {
  const decision = suppressSelectedServiceScopeClarification(
    {
      needsClarification: true,
      reason: '서비스 유형 확인 필요',
      missingDimensions: ['service_scope'],
      clarificationQuestion: '어떤 서비스의 인력배치 기준이 궁금하신가요?',
      candidateOptions: ['노인요양시설(요양원)', '주야간보호', '방문요양'],
    },
    ['주야간보호'],
  );

  assert.equal(decision.needsClarification, false);
  assert.equal(decision.clarificationQuestion, undefined);
  assert.deepEqual(decision.missingDimensions, []);
  assert.deepEqual(decision.candidateOptions, []);
});

test('selected service scope preserves non-service clarification requests', () => {
  const decision = suppressSelectedServiceScopeClarification(
    {
      needsClarification: true,
      reason: '비교 대상 확인 필요',
      missingDimensions: ['comparison_target'],
      clarificationQuestion: '어떤 기준과 비교할까요?',
      candidateOptions: ['법정 기준', '평가 기준'],
    },
    ['주야간보호'],
  );

  assert.equal(decision.needsClarification, true);
  assert.deepEqual(decision.missingDimensions, ['comparison_target']);
  assert.equal(decision.clarificationQuestion, '어떤 기준과 비교할까요?');
});
