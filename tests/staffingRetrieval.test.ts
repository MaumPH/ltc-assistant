import test from 'node:test';
import assert from 'node:assert/strict';
import { NodeRagService } from '../src/lib/nodeRagService';

const service = new NodeRagService(process.cwd());

test('staffing-status wording retrieves staffing criteria evidence', async () => {
  await service.initialize();

  const result = await service.inspectRetrieval('인력현황 알려줘', 'evaluation');
  const evidencePaths = result.search.evidence.map((candidate) => candidate.path);
  const evidenceText = result.search.evidence
    .map((candidate) => [candidate.docTitle, candidate.parentSectionTitle, candidate.textPreview].join(' '))
    .join('\n');

  assert.notEqual(result.agentDecision, 'abstain', `expected answerable retrieval, got ${result.search.mismatchSignals}`);
  assert.ok(
    result.routingDocuments.some((path) => path.includes('/knowledge/evaluation/01-03-인력기준.md')),
    `expected 인력기준 routing document, got ${result.routingDocuments.join(', ')}`,
  );
  assert.ok(
    result.primaryExpansionDocuments.some((path) => path.includes('[별표 9] 재가노인복지시설의 시설기준 및 직원배치기준')),
    `expected staffing placement expansion document, got ${result.primaryExpansionDocuments.join(', ')}`,
  );
  assert.ok(
    evidencePaths.some((path) => path.includes('[별표 9] 재가노인복지시설의 시설기준 및 직원배치기준')),
    `expected staffing placement evidence, got ${evidencePaths.join(', ')}`,
  );
  assert.match(evidenceText, /인력\s*기준|인력\s*배치|직원\s*배치/);
});
