import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNaturalLanguageQueryProfile,
  enrichQueryProfileWithServiceScopeLabels,
} from '../src/lib/ragNaturalQuery';

test('cost question builds semantic frame with slots and relation requests', () => {
  const profile = buildNaturalLanguageQueryProfile('주야간보호 3등급 본인부담금 얼마야?');

  assert.equal(profile.semanticFrame.primaryIntent, 'cost');
  assert.ok(profile.semanticFrame.canonicalTerms.includes('주야간보호'));
  assert.ok(profile.semanticFrame.canonicalTerms.includes('본인부담금'));
  assert.ok(
    (profile.semanticFrame.slots.service_scope ?? []).some((value) => value.canonical === '주야간보호'),
  );
  assert.ok(
    (profile.semanticFrame.slots.recipient_grade ?? []).some((value) => value.canonical === '장기요양 3등급'),
  );
  assert.ok(
    profile.semanticFrame.relationRequests.some((request) => request.relation === 'has-cost'),
  );
});

test('eligibility question keeps assumptions when critical slots are missing', () => {
  const profile = buildNaturalLanguageQueryProfile('엄마가 거동이 불편한데 요양원 바로 들어갈 수 있어?');

  assert.equal(profile.semanticFrame.primaryIntent, 'eligibility');
  assert.ok(profile.semanticFrame.assumptions.length >= 1);
  assert.ok(profile.semanticFrame.missingCriticalSlots.includes('recipient_grade'));
  assert.ok(
    profile.searchVariants.some((variant) => variant.includes('가능 여부') || variant.includes('적용 조건')),
  );
});

test('selected service scope label fills service scope slot for short staffing questions', () => {
  const profile = buildNaturalLanguageQueryProfile('인력기준은?');
  const enriched = enrichQueryProfileWithServiceScopeLabels(profile, ['방문요양']);

  assert.equal(enriched.semanticFrame.missingCriticalSlots.includes('service_scope'), false);
  assert.ok(enriched.searchVariants.includes('방문요양'));
  assert.ok(
    (enriched.semanticFrame.slots.service_scope ?? []).some((value) => value.canonical === '방문요양'),
  );
  assert.ok(
    enriched.semanticFrame.entityRefs.some(
      (entity) => entity.entityType === 'service' && entity.canonical === '방문요양',
    ),
  );
});
