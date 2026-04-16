import { spawn } from 'node:child_process';

const port = Number.parseInt(process.env.LAW_SIDECAR_PORT ?? '3100', 10);

if (!Number.isFinite(port) || port <= 0) {
  console.error('LAW_SIDECAR_PORT must be a positive integer.');
  process.exit(1);
}

const baseUrl = (process.env.LAW_MCP_BASE_URL ?? `http://127.0.0.1:${port}`).trim();
const sidecarCommand = (process.env.LAW_SIDECAR_COMMAND ?? `npx -y korean-law-mcp --mode http --port ${port}`).trim();

if (!process.env.LAW_OC?.trim() && !process.env.LAW_SIDECAR_COMMAND?.trim()) {
  console.error('LAW_OC is required for the default Korean Law MCP sidecar command.');
  console.error('Set LAW_OC in your shell or provide LAW_SIDECAR_COMMAND for a custom sidecar process.');
  process.exit(1);
}

const sharedEnv = {
  ...process.env,
  LAW_MCP_ENABLED: 'true',
  LAW_MCP_BASE_URL: baseUrl,
};

function forwardStream(stream, writer, label) {
  stream.on('data', (chunk) => {
    const text = String(chunk);
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (!line && index === lines.length - 1) return;
      writer.write(`[${label}] ${line}\n`);
    });
  });
}

function spawnLabeled(command, label) {
  const child = spawn(command, {
    cwd: process.cwd(),
    env: sharedEnv,
    shell: true,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  if (child.stdout) forwardStream(child.stdout, process.stdout, label);
  if (child.stderr) forwardStream(child.stderr, process.stderr, label);
  return child;
}

let shuttingDown = false;
const children = [];

function stopChildren() {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
    }
  }
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  stopChildren();
  process.exitCode = exitCode;
}

const sidecar = spawnLabeled(sidecarCommand, 'law-mcp');
children.push(sidecar);

sidecar.on('exit', (code, signal) => {
  if (shuttingDown) return;
  const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
  console.error(`[law-mcp] sidecar exited unexpectedly with ${reason}.`);
  shutdown(code ?? 1);
});

const app = spawnLabeled('npm run dev', 'app');
children.push(app);

app.on('exit', (code, signal) => {
  if (signal) {
    shutdown(1);
    return;
  }
  shutdown(code ?? 0);
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

