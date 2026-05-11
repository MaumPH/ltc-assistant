import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildQueryEmbeddingCacheKey,
  loadQueryEmbeddingCache,
  persistQueryEmbeddingCache,
} from '../src/lib/queryEmbeddingCache';
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from '../src/lib/embeddingService';

function tempFilePath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-query-embedding-cache-'));
  return path.join(dir, 'query-embeddings.json');
}

test('query embedding cache stores vectors by hash without persisting raw query text', () => {
  const cachePath = tempFilePath();
  const query = 'sensitive user query text';
  const key = buildQueryEmbeddingCacheKey(query, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS);
  const cache = new Map([[key, Array.from({ length: EMBEDDING_DIMENSIONS }, (_, index) => (index === 0 ? 1 : 0))]]);

  persistQueryEmbeddingCache(cachePath, cache);

  const raw = fs.readFileSync(cachePath, 'utf8');
  assert.equal(raw.includes(query), false);
  const loaded = loadQueryEmbeddingCache(cachePath);
  assert.equal(loaded.get(key)?.length, EMBEDDING_DIMENSIONS);
  assert.equal(loaded.get(key)?.[0], 1);
});

test('query embedding cache ignores malformed vectors', () => {
  const cachePath = tempFilePath();
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify({ valid: [1], invalid: 'not-a-vector' }), 'utf8');

  const loaded = loadQueryEmbeddingCache(cachePath);

  assert.equal(loaded.size, 0);
});
