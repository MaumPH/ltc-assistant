import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchKnowledgeFile, fetchKnowledgeList } from '../src/lib/knowledge';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

test('fetchKnowledgeList uses the configured RAG API base URL', async () => {
  const originalFetch = globalThis.fetch;
  const originalApiBaseUrl = process.env.VITE_RAG_API_BASE_URL;
  const requestedUrls: string[] = [];

  process.env.VITE_RAG_API_BASE_URL = 'http://127.0.0.1:3100/';
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrls.push(String(input));
    return jsonResponse([]);
  }) as typeof fetch;

  try {
    await fetchKnowledgeList();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiBaseUrl === undefined) {
      delete process.env.VITE_RAG_API_BASE_URL;
    } else {
      process.env.VITE_RAG_API_BASE_URL = originalApiBaseUrl;
    }
  }

  assert.deepEqual(requestedUrls, ['http://127.0.0.1:3100/api/knowledge']);
});

test('fetchKnowledgeList normalizes legacy name-only knowledge entries', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    jsonResponse([
      {
        name: 'evaluation/04-05-식사간식.md',
        size: 123,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ])) as typeof fetch;

  try {
    const entries = await fetchKnowledgeList();
    assert.equal(entries[0]?.path, '/knowledge/evaluation/04-05-식사간식.md');
    assert.equal(entries[0]?.mode, 'evaluation');
    assert.equal(entries[0]?.source, 'eval');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchKnowledgeFile uses the configured RAG API base URL', async () => {
  const originalFetch = globalThis.fetch;
  const originalApiBaseUrl = process.env.VITE_RAG_API_BASE_URL;
  const requestedUrls: string[] = [];

  process.env.VITE_RAG_API_BASE_URL = 'http://127.0.0.1:3100/';
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrls.push(String(input));
    return new Response('content', { status: 200 });
  }) as typeof fetch;

  try {
    await fetchKnowledgeFile('/knowledge/evaluation/sample.md');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiBaseUrl === undefined) {
      delete process.env.VITE_RAG_API_BASE_URL;
    } else {
      process.env.VITE_RAG_API_BASE_URL = originalApiBaseUrl;
    }
  }

  assert.deepEqual(requestedUrls, [
    'http://127.0.0.1:3100/api/knowledge/file?path=%2Fknowledge%2Fevaluation%2Fsample.md',
  ]);
});
