import assert from 'node:assert/strict';
import test from 'node:test';
import { safeTrim, toSafeString } from '../src/lib/textGuards';

test('toSafeString normalizes primitive, array, and object values', () => {
  assert.equal(toSafeString(' value '), ' value ');
  assert.equal(toSafeString(123), '123');
  assert.equal(toSafeString(null), '');
  assert.equal(toSafeString(['요양', { label: '보호' }, false]), '요양 보호 false');
  assert.equal(toSafeString({ summary: '근거 요약' }), '근거 요약');
});

test('safeTrim never throws on non-string model payload fragments', () => {
  assert.equal(safeTrim({ text: ' 답변 ' }), '답변');
  assert.equal(safeTrim([' A ', ' B ']), 'A   B');
  assert.equal(safeTrim(undefined), '');
});
