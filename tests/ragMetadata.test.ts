import test from 'node:test';
import assert from 'node:assert/strict';
import { toDocumentMetadata } from '../src/lib/ragMetadata';

test('evaluation indicator files are primary evaluation evidence', () => {
  const metadata = toDocumentMetadata({
    path: '/knowledge/evaluation/04-05-식사간식.md',
    name: '04-05-식사간식.md',
    size: 0,
    content: '',
  });

  assert.equal(metadata.mode, 'evaluation');
  assert.equal(metadata.sourceType, 'evaluation');
  assert.equal(metadata.sourceRole, 'primary_evaluation');
  assert.equal(metadata.documentGroup, 'evaluation');
});

test('evaluation index stays a routing summary', () => {
  const metadata = toDocumentMetadata({
    path: '/knowledge/evaluation/index.md',
    name: 'index.md',
    size: 0,
    content: '',
  });

  assert.equal(metadata.mode, 'evaluation');
  assert.equal(metadata.sourceRole, 'routing_summary');
});
