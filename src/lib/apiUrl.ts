const API_BASE_URL = (import.meta.env.VITE_RAG_API_BASE_URL || '').replace(/\/$/, '');

export function getApiUrl(route: string): string {
  return API_BASE_URL ? `${API_BASE_URL}${route}` : route;
}
