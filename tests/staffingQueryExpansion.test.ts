import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveFocusTerms } from '../src/lib/ragEngine';
import { buildNaturalLanguageQueryProfile } from '../src/lib/ragNaturalQuery';
import { tokenize } from '../src/lib/ragMetadata';

test('staffing-status wording expands to staffing criteria aliases', () => {
  const profile = buildNaturalLanguageQueryProfile('인력현황 알려줘');

  assert.ok(profile.searchVariants.includes('인력기준'));
  assert.ok(profile.searchVariants.includes('인력배치기준'));
  assert.ok(profile.searchVariants.includes('직원배치기준'));
  assert.ok(profile.searchVariants.includes('인력신고 현황'));
});

test('staffing compound words keep concrete focus terms without request filler', () => {
  assert.deepEqual(tokenize('인력현황 알려줘'), ['인력현황', '인력', '현황', '알려줘']);
  assert.deepEqual(deriveFocusTerms('인력현황 알려줘'), ['인력현황', '인력', '현황']);
});
