import type { GenerationMode } from './ragTypes';

export function resolveEmbeddingApiKey(): string {
  return process.env.RAG_EMBEDDING_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim() || '';
}

export function resolveGenerationMode(): GenerationMode {
  return process.env.RAG_GENERATION_MODE?.trim().toLowerCase() === 'server' ? 'server' : 'user';
}

export function resolveServerGenerationApiKey(): string {
  return process.env.GEMINI_API_KEY?.trim() || resolveEmbeddingApiKey();
}
