import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadScriptEnv } from '../scripts/load-env';

function withTempProject(files: Record<string, string>, run: (projectRoot: string) => void): void {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-script-env-'));
  try {
    for (const [fileName, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(projectRoot, fileName), content, 'utf8');
    }
    run(projectRoot);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
}

function withClearedEnv(keys: string[], run: () => void): void {
  const previous = new Map(keys.map((key) => [key, process.env[key]] as const));
  try {
    for (const key of keys) {
      delete process.env[key];
    }
    run();
  } finally {
    for (const key of keys) {
      const value = previous.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test('loadScriptEnv loads .env.local before .env and keeps shell values authoritative', () => {
  const keys = ['SCRIPT_ENV_SHARED', 'SCRIPT_ENV_LOCAL_ONLY', 'SCRIPT_ENV_DOTENV_ONLY'];
  withClearedEnv(keys, () => {
    process.env.SCRIPT_ENV_SHARED = 'shell-value';
    withTempProject(
      {
        '.env.local': 'SCRIPT_ENV_SHARED=local-value\nSCRIPT_ENV_LOCAL_ONLY=from-local\n',
        '.env': 'SCRIPT_ENV_SHARED=dotenv-value\nSCRIPT_ENV_DOTENV_ONLY=from-dotenv\n',
      },
      (projectRoot) => {
        const loaded = loadScriptEnv(projectRoot);

        assert.equal(process.env.SCRIPT_ENV_SHARED, 'shell-value');
        assert.equal(process.env.SCRIPT_ENV_LOCAL_ONLY, 'from-local');
        assert.equal(process.env.SCRIPT_ENV_DOTENV_ONLY, 'from-dotenv');
        assert.deepEqual(
          loaded.filter((entry) => entry.exists).map((entry) => path.basename(entry.path)),
          ['.env.local', '.env'],
        );
      },
    );
  });
});
