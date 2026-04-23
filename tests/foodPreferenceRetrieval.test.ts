import test from 'node:test';
import assert from 'node:assert/strict';
import { NodeRagService } from '../src/lib/nodeRagService';

const service = new NodeRagService(process.cwd());
const foodPreferenceQuestion =
  '\uAE30\uD53C\uC2DD\uD488\uACFC \uC2DD\uD488\uC120\uD638\uB3C4 \uC870\uC0AC\uC5D0 \uB300\uD574 \uC124\uBA85\uD574';

test('day-night care food preference explanation questions use definition intent and retrieve meal guidance', async () => {
  await service.initialize();

  const result = await service.inspectRetrieval(foodPreferenceQuestion, 'evaluation', undefined, ['day-night-care']);
  const evidencePaths = result.search.evidence.map((candidate) => candidate.path);
  const evidenceText = result.search.evidence
    .map((candidate) => [candidate.docTitle, candidate.parentSectionTitle, candidate.textPreview].join(' '))
    .join('\n');

  assert.equal(result.semanticFrame.primaryIntent, 'definition');
  assert.ok(['medium', 'high'].includes(result.search.confidence), `expected medium+ confidence, got ${result.search.confidence}`);
  assert.ok(
    result.search.evidence.filter((candidate) => candidate.mode === 'evaluation').length >= 3,
    'expected at least 3 evaluation evidence candidates',
  );
  assert.ok(
    evidencePaths.some((filePath) => filePath.includes('/knowledge/evaluation/04-05-식사간식.md')),
    `expected meal/snack evaluation guidance, got ${evidencePaths.join(', ')}`,
  );
  assert.match(evidenceText, /기피식품|식사\s*만족도|대체식품|욕구사정/u);
  assert.equal(result.validationIssues.some((issue) => issue.code === 'basis-confusion'), false);
});

test('day-night care food preference workflow questions keep workflow routing', async () => {
  await service.initialize();

  const result = await service.inspectRetrieval('기피식품 작성 방법', 'evaluation', undefined, ['day-night-care']);

  assert.equal(result.semanticFrame.primaryIntent, 'workflow');
  assert.equal(result.retrievalPriorityClass, 'evaluation_readiness');
});
