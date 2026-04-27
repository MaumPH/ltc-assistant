export const API_KEY_STORAGE = 'ltc_gemini_api_key';

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export function readStoredApiKey(): string | null {
  return getStorage()?.getItem(API_KEY_STORAGE) ?? null;
}

export function saveApiKey(key: string): void {
  if (typeof window !== 'undefined' && import.meta.env.PROD) {
    console.warn(
      '[apiKeyStorage] Gemini API keys are stored in browser localStorage. Prefer RAG_GENERATION_MODE=server for shared or production deployments.',
    );
  }
  getStorage()?.setItem(API_KEY_STORAGE, key.trim());
}

export function clearStoredApiKey(): void {
  getStorage()?.removeItem(API_KEY_STORAGE);
}
