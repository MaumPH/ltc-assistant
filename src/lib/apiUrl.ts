interface ApiUrlEnv {
  VITE_RAG_API_BASE_URL?: string;
}

function getConfiguredApiBaseUrl(): string {
  const viteEnv = (import.meta as ImportMeta & { env?: ApiUrlEnv }).env;
  const processEnv =
    typeof process === 'undefined' ? undefined : (process.env as Record<string, string | undefined>);

  return (viteEnv?.VITE_RAG_API_BASE_URL ?? processEnv?.VITE_RAG_API_BASE_URL ?? '').replace(/\/$/, '');
}

export function getApiUrl(route: string): string {
  const apiBaseUrl = getConfiguredApiBaseUrl();
  return apiBaseUrl ? `${apiBaseUrl}${route.startsWith('/') ? route : `/${route}`}` : route;
}
