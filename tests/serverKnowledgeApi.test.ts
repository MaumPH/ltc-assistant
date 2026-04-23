import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';

async function findOpenPort(): Promise<number> {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const port = address.port;
  server.close();
  await once(server, 'close');
  return port;
}

async function waitForServerReady(server: ChildProcessWithoutNullStreams, timeoutMs: number): Promise<void> {
  let output = '';

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`server did not start within ${timeoutMs}ms\n${output}`));
    }, timeoutMs);

    const onData = (chunk: Buffer) => {
      output += chunk.toString('utf8');
      if (output.includes('Server running on')) {
        clearTimeout(timeout);
        resolve();
      }
    };

    const onExit = (code: number | null) => {
      clearTimeout(timeout);
      reject(new Error(`server exited before listening with code ${code}\n${output}`));
    };

    server.stdout.on('data', onData);
    server.stderr.on('data', onData);
    server.once('exit', onExit);
  });
}

async function stopServer(server: ChildProcessWithoutNullStreams): Promise<void> {
  if (server.killed || server.exitCode !== null) return;
  const exited = once(server, 'exit');
  server.kill();
  await exited;
}

test('GET /api/knowledge waits for cold-start RAG initialization and returns evaluation documents', async () => {
  const port = await findOpenPort();
  const server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'production',
      RAG_STORAGE_MODE: 'memory',
      DATABASE_URL: '',
    },
  });

  try {
    await waitForServerReady(server, 60_000);

    const response = await fetch(`http://127.0.0.1:${port}/api/knowledge`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'public, max-age=60');

    const documents = (await response.json()) as Array<{ path?: string; mode?: string; source?: string }>;
    assert.ok(documents.length > 0, 'expected knowledge documents to be returned');
    assert.ok(
      documents.some(
        (document) =>
          document.mode === 'evaluation' ||
          document.source === 'eval' ||
          document.path?.startsWith('/knowledge/evaluation/'),
      ),
      'expected at least one evaluation document',
    );

    const healthResponse = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(healthResponse.status, 200);
    const health = (await healthResponse.json()) as {
      indexStatus?: {
        diskDocumentCount?: number;
        modeCounts?: { evaluation?: number };
      };
    };
    assert.ok((health.indexStatus?.diskDocumentCount ?? 0) > 0, 'expected disk documents in health status');
    assert.ok((health.indexStatus?.modeCounts?.evaluation ?? 0) > 0, 'expected evaluation documents in health status');
  } finally {
    await stopServer(server);
  }
});
