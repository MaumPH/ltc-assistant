import fs from 'node:fs';
import path from 'node:path';
import * as dotenv from 'dotenv';

export interface LoadedScriptEnvFile {
  path: string;
  exists: boolean;
  parsedKeys: string[];
}

export function loadScriptEnv(projectRoot = process.cwd()): LoadedScriptEnvFile[] {
  return ['.env.local', '.env'].map((fileName) => {
    const envPath = path.join(projectRoot, fileName);
    if (!fs.existsSync(envPath)) {
      return {
        path: envPath,
        exists: false,
        parsedKeys: [],
      };
    }

    const result = dotenv.config({ path: envPath, override: false, quiet: true });
    if (result.error) {
      throw result.error;
    }

    return {
      path: envPath,
      exists: true,
      parsedKeys: Object.keys(result.parsed ?? {}),
    };
  });
}
