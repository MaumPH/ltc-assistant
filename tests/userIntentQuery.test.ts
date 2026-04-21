import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBrainQueryProfile, loadDomainBrain } from '../src/lib/brain';
import { deriveFocusTerms } from '../src/lib/ragEngine';
import { buildNaturalLanguageQueryProfile } from '../src/lib/ragNaturalQuery';

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
