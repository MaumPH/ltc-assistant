import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { findOpenPort, stopServer, waitForServerReady } from './helpers/serverProcess';

async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

test('admin operational retrieval endpoints require auth and disable response caching', async () => {
  const port = await findOpenPort();
  const password = 'contract-password';
  const server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'production',
      RAG_STORAGE_MODE: 'memory',
      DATABASE_URL: '',
      ADMIN_DASHBOARD_PASSWORD: password,
      ADMIN_JWT_SECRET: 'contract-test-secret',
    },
  });

  try {
    await waitForServerReady(server, 120_000);

    const unauthenticated = await fetch(`http://127.0.0.1:${port}/api/admin/rag/retrieval-log/report?limit=8`);
    assert.equal(unauthenticated.status, 401);
    assert.equal(unauthenticated.headers.get('cache-control'), 'no-store');

    const rejectedLogin = await fetch(`http://127.0.0.1:${port}/api/admin/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'wrong-password' }),
    });
    assert.equal(rejectedLogin.status, 401);
    assert.equal(rejectedLogin.headers.get('cache-control'), 'no-store');

    const login = await fetch(`http://127.0.0.1:${port}/api/admin/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    assert.equal(login.status, 200);
    assert.equal(login.headers.get('cache-control'), 'no-store');
    const session = (await readJson(login)) as { token?: string };
    assert.equal(typeof session.token, 'string');

    const authHeaders = { authorization: `Bearer ${session.token}` };
    const logResponse = await fetch(`http://127.0.0.1:${port}/api/admin/rag/retrieval-log`, {
      headers: authHeaders,
    });
    assert.equal(logResponse.status, 200);
    assert.equal(logResponse.headers.get('cache-control'), 'no-store');
    const logBody = (await readJson(logResponse)) as { updatedAt?: string; entries?: unknown[] };
    assert.equal(typeof logBody.updatedAt, 'string');
    assert.ok(Array.isArray(logBody.entries));

    const reportResponse = await fetch(`http://127.0.0.1:${port}/api/admin/rag/retrieval-log/report?limit=10000`, {
      headers: authHeaders,
    });
    assert.equal(reportResponse.status, 200);
    assert.equal(reportResponse.headers.get('cache-control'), 'no-store');
    const reportBody = (await readJson(reportResponse)) as {
      options?: { limit?: number };
      reviewGroups?: unknown[];
      summary?: unknown;
    };
    assert.equal(reportBody.options?.limit, 100);
    assert.ok(Array.isArray(reportBody.reviewGroups));
    assert.ok(reportBody.summary);
  } finally {
    await stopServer(server);
  }
});
