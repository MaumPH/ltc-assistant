import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBrainQueryProfile, detectServiceScopeClarification, loadDomainBrain } from '../src/lib/brain';
import { deriveFocusTerms } from '../src/lib/ragEngine';
import { buildNaturalLanguageQueryProfile } from '../src/lib/ragNaturalQuery';
import { detectClarificationNeed } from '../src/lib/expertAnswering';

const brain = loadDomainBrain(process.cwd());

test('conversational definition questions are treated as concept explanations', () => {
  const profile = buildNaturalLanguageQueryProfile('인력현황 이게 뭐야?');
  const brainProfile = buildBrainQueryProfile(brain, '인력현황 이게 뭐야?', 'evaluation');

  assert.equal(profile.queryType, 'definition');
  assert.ok(profile.searchVariants.includes('정의'));
  assert.ok(profile.searchVariants.includes('개념'));
  assert.equal(brainProfile.recommendedAnswerType, 'definition');
});

test('conversational how-to questions are treated as procedures', () => {
  const profile = buildNaturalLanguageQueryProfile('인력현황 어떻게 해?');
  const brainProfile = buildBrainQueryProfile(brain, '인력현황 어떻게 해?', 'evaluation');

  assert.equal(profile.queryType, 'procedure');
  assert.ok(profile.searchVariants.includes('절차'));
  assert.ok(profile.searchVariants.includes('방법'));
  assert.equal(brainProfile.recommendedAnswerType, 'procedure');
});

test('conversational permission questions are treated as verdicts', () => {
  const profile = buildNaturalLanguageQueryProfile('인력현황 이렇게 하면 돼?');
  const brainProfile = buildBrainQueryProfile(brain, '인력현황 이렇게 하면 돼?', 'evaluation');

  assert.equal(profile.queryType, 'requirement');
  assert.ok(profile.searchVariants.includes('가능 여부'));
  assert.ok(profile.searchVariants.includes('해도 되는지'));
  assert.equal(brainProfile.recommendedAnswerType, 'verdict');
});

test('conversational preparation questions are treated as checklists', () => {
  const profile = buildNaturalLanguageQueryProfile('인력현황 뭐 준비해?');
  const brainProfile = buildBrainQueryProfile(brain, '인력현황 뭐 준비해?', 'evaluation');

  assert.equal(profile.queryType, 'checklist');
  assert.ok(profile.searchVariants.includes('체크리스트'));
  assert.ok(profile.searchVariants.includes('확인사항'));
  assert.equal(brainProfile.recommendedAnswerType, 'checklist');
});

test('conversational intent words do not become retrieval focus terms', () => {
  assert.deepEqual(deriveFocusTerms('인력현황 이게 뭐야?'), ['인력현황', '인력', '현황']);
  assert.deepEqual(deriveFocusTerms('인력현황 이렇게 하면 돼?'), ['인력현황', '인력', '현황']);
  assert.deepEqual(deriveFocusTerms('인력현황 뭐 준비해?'), ['인력현황', '인력', '현황']);
});

test('new recipient business questions are routed to workflow checklist retrieval', () => {
  const profile = buildBrainQueryProfile(brain, '신규 수급자 업무', 'integrated');

  assert.equal(profile.recommendedAnswerType, 'checklist');
  assert.equal(profile.preferredRetrievalMode, 'workflow-global');
  assert.ok(profile.workflowEvents.includes('new-recipient-onboarding'));
});

test('new recipient workflow questions do not become clarification-only answers', async () => {
  const throwingAi = {
    models: {
      generateContent: async () => {
        throw new Error('clarification model should not be called for answerable onboarding workflow');
      },
    },
  };

  const decision = await detectClarificationNeed({
    ai: throwingAi as never,
    model: 'test-model',
    recentMessages: [],
    question: '신규 수급자 업무',
    normalizedQuery: '신규 수급자 업무',
    mode: 'integrated',
    questionArchetype: 'mixed-general',
    retrievalMode: 'workflow-global',
    workflowEvents: ['new-recipient-onboarding'],
    serviceScopeClarification: detectServiceScopeClarification('주야간보호 신규 수급자 업무'),
  });

  assert.equal(decision.needsClarification, false);
  assert.equal(decision.reason, 'workflow-enumeration-answerable-with-conditional-guidance');
});
