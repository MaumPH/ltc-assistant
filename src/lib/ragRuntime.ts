import type { GenerationMode } from './ragTypes';

export function resolveEmbeddingApiKey(): string {
  return process.env.RAG_EMBEDDING_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim() || '';
}

export function resolveGenerationMode(): GenerationMode {
  // Prefer RAG_GENERATION_MODE=server for shared deployments so user API keys are not stored in browsers.
  return process.env.RAG_GENERATION_MODE?.trim().toLowerCase() === 'server' ? 'server' : 'user';
}

export function resolveServerGenerationApiKey(): string {
  return process.env.GEMINI_API_KEY?.trim() || resolveEmbeddingApiKey();
}
