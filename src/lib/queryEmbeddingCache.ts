import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { prepareEmbedding } from './embeddingService';

export function buildQueryEmbeddingCacheKey(query: string, model: string, dimensions: number): string {
  return crypto
    .createHash('sha1')
    .update(`${model}:${dimensions}:${query.trim()}`)
    .digest('hex');
}

export function loadQueryEmbeddingCache(cachePath: string): Map<string, number[]> {
  if (!fs.existsSync(cachePath)) return new Map();

  try {
    const parsed = JSON.parse(fs.readFileSync(cachePath, 'utf8')) as Record<string, unknown>;
    const entries = Object.entries(parsed)
      .map(([key, value]) => {
        const embedding = Array.isArray(value) ? prepareEmbedding(value.map((item) => Number(item))) : [];
        return [key, embedding] as const;
      })
      .filter((entry): entry is readonly [string, number[]] => entry[1].length > 0);
    return new Map(entries);
  } catch {
    return new Map();
  }
}

export function persistQueryEmbeddingCache(cachePath: string, cache: Map<string, number[]>): void {
  const payload = Object.fromEntries(
    Array.from(cache.entries())
      .map(([key, value]) => [key, prepareEmbedding(value)] as const)
      .filter((entry) => entry[1].length > 0),
  );
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(payload, null, 2), 'utf8');
}
