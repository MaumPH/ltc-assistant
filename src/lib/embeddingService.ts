import { GoogleGenAI } from '@google/genai';
import type { StructuredChunk } from './ragTypes';

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const EMBEDDING_MODEL = 'gemini-embedding-001';
export const EMBEDDING_DIMENSIONS = 768;
export const EMBEDDING_BATCH_SIZE = parsePositiveInteger(process.env.RAG_EMBEDDING_BATCH_SIZE, 20);
export const EMBEDDING_MAX_CHUNKS_PER_PASS = parsePositiveInteger(process.env.RAG_EMBEDDING_MAX_CHUNKS_PER_PASS, 400);
export const EMBEDDING_REFRESH_INTERVAL_MS = parsePositiveInteger(process.env.RAG_EMBEDDING_REFRESH_INTERVAL_MS, 15 * 60 * 1000);
const EMBEDDING_QUOTA_COOLDOWN_MS = parsePositiveInteger(process.env.RAG_EMBEDDING_QUOTA_COOLDOWN_MS, 6 * 60 * 60 * 1000);

let embeddingQuotaBlockedUntil = 0;
let embeddingQuotaBlockLogShown = false;

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function prepareEmbedding(values: number[] | undefined | null): number[] {
  if (!values || values.length === 0) return [];
  const clipped = values.length > EMBEDDING_DIMENSIONS ? values.slice(0, EMBEDDING_DIMENSIONS) : values;
  if (clipped.length !== EMBEDDING_DIMENSIONS) return [];

  const norm = Math.sqrt(clipped.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(norm) || norm === 0) {
    return clipped;
  }
  return clipped.map((value) => value / norm);
}

export function isQuotaExceededError(error: unknown): boolean {
  const message = describeError(error);
  return (
    message.includes('RESOURCE_EXHAUSTED') ||
    message.includes('"code":429') ||
    message.includes('code 429') ||
    message.includes('quota')
  );
}

export function shouldSkipEmbeddingWork(context: string): boolean {
  if (Date.now() < embeddingQuotaBlockedUntil) {
    if (!embeddingQuotaBlockLogShown) {
      console.warn(
        `[embedding] skipping ${context} until ${new Date(embeddingQuotaBlockedUntil).toISOString()} because quota is exhausted.`,
      );
      embeddingQuotaBlockLogShown = true;
    }
    return true;
  }

  embeddingQuotaBlockLogShown = false;
  return false;
}

export function markEmbeddingQuotaExceeded(error: unknown, context: string): void {
  embeddingQuotaBlockedUntil = Date.now() + EMBEDDING_QUOTA_COOLDOWN_MS;
  embeddingQuotaBlockLogShown = false;
  console.warn(
    `[embedding] ${context} hit quota exhaustion. Pausing embedding attempts until ${new Date(embeddingQuotaBlockedUntil).toISOString()}: ${describeError(error)}`,
  );
}

export function getNextEmbeddingRetryAt(): string | undefined {
  return Date.now() < embeddingQuotaBlockedUntil ? new Date(embeddingQuotaBlockedUntil).toISOString() : undefined;
}

export async function embedQuery(ai: GoogleGenAI, query: string): Promise<number[] | null> {
  if (!query.trim()) return null;
  if (shouldSkipEmbeddingWork('query embedding')) return null;
  try {
    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: query,
      config: {
        outputDimensionality: EMBEDDING_DIMENSIONS,
      },
    });
    const values = prepareEmbedding(response.embeddings[0]?.values);
    return values.length > 0 ? values : null;
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markEmbeddingQuotaExceeded(error, 'query embedding');
      return null;
    }
    console.warn(`[embedding] query embedding failed: ${describeError(error)}`);
    return null;
  }
}

export async function embedChunks(ai: GoogleGenAI, chunks: StructuredChunk[]): Promise<number> {
  const missing = chunks.filter((chunk) => !chunk.embedding || chunk.embedding.length === 0);
  if (missing.length === 0) return 0;
  if (shouldSkipEmbeddingWork('chunk embeddings')) return 0;

  const target = missing.slice(0, EMBEDDING_MAX_CHUNKS_PER_PASS);
  let embeddedCount = 0;

  for (let index = 0; index < target.length; index += EMBEDDING_BATCH_SIZE) {
    const batch = target.slice(index, index + EMBEDDING_BATCH_SIZE);
    try {
      const responses = await Promise.all(
        batch.map((chunk) =>
          ai.models.embedContent({
            model: EMBEDDING_MODEL,
            contents: chunk.embeddingInput || chunk.searchText,
            config: {
              outputDimensionality: EMBEDDING_DIMENSIONS,
            },
          }),
        ),
      );
      responses.forEach((response, batchIndex) => {
        batch[batchIndex].embedding = prepareEmbedding(response.embeddings[0]?.values);
      });
      embeddedCount += batch.length;
    } catch (error) {
      if (isQuotaExceededError(error)) {
        markEmbeddingQuotaExceeded(error, `batch ${index}~${index + batch.length}`);
        break;
      }
      console.warn(`[embedding] batch ${index}~${index + batch.length} failed: ${describeError(error)}`);
    }
  }

  if (missing.length > target.length) {
    console.info(`[embedding] deferred ${missing.length - target.length} remaining chunks for later passes.`);
  }

  return embeddedCount;
}
