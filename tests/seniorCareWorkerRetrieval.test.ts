import test from 'node:test';
import assert from 'node:assert/strict';
import { NodeRagService } from '../src/lib/nodeRagService';

const service = new NodeRagService(process.cwd());

test('day-care senior care worker promotion query retrieves legal and practical basis together', async () => {
  await service.initialize();

  const result = await service.inspectRetrieval(
    '주간보호센터 요양보호사 승급제, 선임요양보호사 관련내용 알려줘',
    'integrated',
  );

  assert.ok(
    result.basisCoverage.legal >= 1,
    `expected at least one legal basis document, got ${JSON.stringify(result.basisCoverage)}`,
  );
  assert.ok(
    result.search.evidence.some((candidate) =>
      candidate.path.includes('/knowledge/eval/장기요양급여_제공기준_및_급여비용_산정방법_등에_관한_고시_전문.md'),
    ),
    `expected legal notice evidence, got ${result.search.evidence.map((candidate) => candidate.path).join(', ')}`,
  );
  assert.ok(
    result.search.evidence.some((candidate) => candidate.path.includes('/knowledge/2026 요양보호사 승급제.md')),
    `expected practical guide evidence, got ${result.search.evidence.map((candidate) => candidate.path).join(', ')}`,
  );
});
