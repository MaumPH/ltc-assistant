import test from 'node:test';
import assert from 'node:assert/strict';
import { NodeRagService } from '../src/lib/nodeRagService';

const service = new NodeRagService(process.cwd());

test('day-night care scope prioritizes staffing placement evidence for staffing questions', async () => {
  await service.initialize();

  const result = await service.inspectRetrieval('인력배치 알려줘', 'evaluation', undefined, ['day-night-care']);
  const topEvidenceText = result.search.evidence
    .slice(0, 4)
    .map((candidate) => [candidate.docTitle, candidate.parentSectionTitle, candidate.textPreview].join(' '))
    .join('\n');
  const evidencePaths = result.search.evidence.map((candidate) => candidate.path);

  assert.equal(result.selectedServiceScopes.includes('day-night-care'), true);
  assert.match(topEvidenceText, /인력\s*기준|인력\s*배치|직원\s*배치/);
  assert.doesNotMatch(topEvidenceText, /건강검진|운영 질향상/);
  assert.ok(
    evidencePaths.some(
      (path) =>
        path.includes('/knowledge/evaluation/01-03-인력기준.md') ||
        path.includes('[별표 9] 재가노인복지시설의 시설기준 및 직원배치기준'),
    ),
    `expected staffing criteria evidence, got ${evidencePaths.join(', ')}`,
  );
});
