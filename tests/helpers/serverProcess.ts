import assert from 'node:assert/strict';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';

export async function findOpenPort(): Promise<number> {
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

export async function waitForServerReady(
  server: ChildProcessWithoutNullStreams,
  timeoutMs: number,
): Promise<void> {
  let output = '';

  await new Promise<void>((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout>;

    const cleanup = () => {
      clearTimeout(timeout);
      server.stdout.off('data', onData);
      server.stderr.off('data', onData);
      server.off('exit', onExit);
    };

    const onData = (chunk: Buffer) => {
      output += chunk.toString('utf8');
      if (output.includes('Server running on')) {
        cleanup();
        resolve();
      }
    };

    const onExit = (code: number | null) => {
      cleanup();
      reject(new Error(`server exited before listening with code ${code}\n${output}`));
    };

    timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`server did not start within ${timeoutMs}ms\n${output}`));
    }, timeoutMs);

    server.stdout.on('data', onData);
    server.stderr.on('data', onData);
    server.once('exit', onExit);
  });
}

export async function stopServer(server: ChildProcessWithoutNullStreams): Promise<void> {
  if (server.killed || server.exitCode !== null) return;
  const exited = once(server, 'exit');
  server.kill();
  await exited;
}
