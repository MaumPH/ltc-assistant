import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeUserFacingCandidateDiagnostics,
  sanitizeUserFacingStageTrace,
} from '../src/lib/ragPublicDiagnostics';

test('sanitizeUserFacingStageTrace removes internal authority drift guard notes', () => {
  const trace = sanitizeUserFacingStageTrace([
    {
      stage: 'fusion',
      inputCount: 3,
      outputCount: 2,
      notes: ['evaluation-authority-drift-guard=enabled', 'rrf=enabled'],
    },
  ]);

  assert.deepEqual(trace, [
    {
      stage: 'fusion',
      inputCount: 3,
      outputCount: 2,
      notes: ['rrf=enabled'],
    },
  ]);
});

test('sanitizeUserFacingStageTrace drops empty note arrays after sanitizing', () => {
  const trace = sanitizeUserFacingStageTrace([
    {
      stage: 'fusion',
      inputCount: 3,
      outputCount: 2,
      notes: ['evaluation-authority-drift-guard=enabled'],
    },
  ]);

  assert.deepEqual(trace, [
    {
      stage: 'fusion',
      inputCount: 3,
      outputCount: 2,
    },
  ]);
});

test('sanitizeUserFacingCandidateDiagnostics removes internal authority drift guard matched terms', () => {
  const diagnostics = sanitizeUserFacingCandidateDiagnostics([
    {
      id: 'candidate-a',
      matchedTerms: ['직원인권보호', 'evaluation-authority-drift-guard'],
      focusTermMatches: ['직원인권보호'],
    },
  ]);

  assert.deepEqual(diagnostics, [
    {
      id: 'candidate-a',
      matchedTerms: ['직원인권보호'],
      focusTermMatches: ['직원인권보호'],
    },
  ]);
});
