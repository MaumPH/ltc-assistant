import assert from 'node:assert/strict';
import test from 'node:test';
import { buildQueryExpansionProfile, detectEnumerationIntent, extractMatchedEntityAnchors } from '../src/lib/queryIntent';

test('detectEnumerationIntent identifies broad onboarding workflow queries', () => {
  const query = '신규수급자가 오면 해야하는 업무는?';

  assert.equal(detectEnumerationIntent(query), true);
  assert.deepEqual(extractMatchedEntityAnchors(query).map((item) => item.id), ['신규수급자']);

  const profile = buildQueryExpansionProfile(query);
  assert.equal(profile.enumeration, true);
  assert.equal(profile.fusedTopK, 48);
  assert.equal(profile.evidenceTopK, 28);
  assert.equal(profile.maxVisibleCandidatesPerDocument, 5);
  assert.equal(profile.maxEvidenceClustersPerDocument, 5);
  assert.equal(profile.maxForcedInjections, 4);
});

test('point lookup queries keep the default retrieval profile', () => {
  const query = 'CCTV 설치 기준은 무엇인가요?';

  assert.equal(detectEnumerationIntent(query), false);
  assert.deepEqual(extractMatchedEntityAnchors(query), []);

  const profile = buildQueryExpansionProfile(query);
  assert.equal(profile.enumeration, false);
  assert.equal(profile.fusedTopK, 32);
  assert.equal(profile.evidenceTopK, 18);
  assert.equal(profile.maxVisibleCandidatesPerDocument, 3);
  assert.equal(profile.maxEvidenceClustersPerDocument, 2);
  assert.equal(profile.maxForcedInjections, 0);
});
