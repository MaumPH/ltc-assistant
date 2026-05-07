import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBenchmarkCases } from '../src/lib/nodeRagService';

const projectRoot = process.cwd();

test('golden cases include P1-3 coverage for high-value operational documents', () => {
  const cases = loadBenchmarkCases(projectRoot);
  const caseIds = new Set(cases.map((testCase) => testCase.id));

  for (const expectedId of [
    'integrated-complaint-casebook',
    'integrated-fraud-claim-casebook',
    'integrated-claim-work-guide',
    'integrated-caregiver-continuing-education',
    'integrated-integrated-homecare-manual',
  ]) {
    assert.equal(caseIds.has(expectedId), true, `${expectedId} should be included in golden cases`);
  }
});

test('golden case ids are unique', () => {
  const cases = loadBenchmarkCases(projectRoot);
  const ids = cases.map((testCase) => testCase.id);
  assert.equal(new Set(ids).size, ids.length);
});
