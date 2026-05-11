import test from 'node:test';
import assert from 'node:assert/strict';
import { NodeRagService } from '../src/lib/nodeRagService';

const service = new NodeRagService(process.cwd());

test('evaluation requirement evidence short-circuits workflow facet expansion', async () => {
  await service.initialize();

  const result = await service.inspectRetrieval(
    '신규 수급자에게 안내해야 하는 8가지 지침이 뭐고 언제까지 설명해야 해?',
    'evaluation',
  );
  const plannerSteps = result.plannerTrace.map((entry) => entry.step);

  assert.ok(plannerSteps.includes('evaluation-requirement-match'));
  assert.ok(plannerSteps.includes('procedure-aspect-skip'));
  assert.ok(plannerSteps.includes('workflow-facet-skip'));
  assert.equal(plannerSteps.includes('workflow-facet-evidence'), false);
});
